import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import * as turf from '@turf/turf';
import { getFarmer, getFarmers, updateFarmer, setFarmerActiveStatus, type Farmer, type Farm } from '../../api/farmers';
import { deleteFarmer } from '../../api/farmerActions';
import { setFarmerVerificationStatus, type IdentityStatus } from '../../api/farmerVerification';
import { getFarmerAuditLog, type FarmerAuditLogEntry } from '../../api/farmerAuditLog';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { resolveFileUrl } from '../../utils/fileUrl';
import SafeImage from '../../components/SafeImage';
import Tabs, { type TabItem } from '../../components/ui/Tabs';
import { getFarmDocuments, type FarmDocument } from '../../api/documents';
import { getRiskHistory, type RiskAnalysisResult } from '../../api/risk';
import { getAllBatches, type Batch } from '../../api/batches';
import { getCustodyHistory, type CustodyHistoryData } from '../../api/transfers';
import { formatFarmerLocationLine, formatFarmerId, hasSharedPhoneNumber } from './farmerListHelpers';
import {
    triState, type TriState,
    formatFarmLocationLine, getFarmCommoditySummary, calcAreaHaFor,
    computeOutstandingTasks,
} from './farmerProfileHelpers';
import {
    ArrowLeft, ShieldCheck, ShieldAlert, ShieldQuestion, Edit2, Save, X, MoreHorizontal,
    QrCode, Share2, FileText, Image as ImageIcon, AlertTriangle, CheckCircle2,
    Sprout, FolderOpen, Download, Loader2, ChevronDown, Package, PlusCircle, User, Trash2,
    HelpCircle, MapPin, History as HistoryIcon, Info, LayoutGrid, FileCheck2, Satellite,
} from 'lucide-react';
import FarmMap from '../../components/FarmMap';
import { QRCodeCanvas } from 'qrcode.react';

/* ---------------------------------------------------------------------- */
/* Small shared UI helpers                                                */
/* ---------------------------------------------------------------------- */

const SectionCard: React.FC<{ title: string; icon?: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, badge, children, className = '' }) => (
    <div className={`bg-brand-card rounded-xl border border-brand-border shadow-card ${className}`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-brand-border">
            <h2 className="text-sm font-bold text-brand-text flex items-center gap-2">
                {icon}
                {title}
            </h2>
            {badge}
        </div>
        <div className="p-5">{children}</div>
    </div>
);

const FallbackAvatar: React.FC<{ className?: string }> = ({ className = 'h-12 w-12' }) => (
    <div className={`${className} rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white flex-shrink-0`}>
        <User className="h-[45%] w-[45%]" />
    </div>
);

const Field: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
    <div>
        <p className="text-[11px] font-medium text-brand-muted uppercase tracking-wide">{label}</p>
        <p className={`text-sm text-brand-text mt-0.5 ${mono ? 'font-mono' : ''}`}>{value ?? <span className="text-gray-400">N/A</span>}</p>
    </div>
);

/**
 * Three-state status indicator — the direct fix for the old YesNoBadge,
 * which rendered `undefined` (meaning "not assessed"/"unknown") identically
 * to a confirmed `false`, falsely implying a real negative answer had been
 * checked and found negative. "unknown" now ALWAYS renders as its own
 * distinct, neutral state and is never collapsed into "No".
 */
const TriStateBadge: React.FC<{ state: TriState; positiveIsGood?: boolean; unknownLabel?: string }> = ({ state, positiveIsGood = false, unknownLabel = 'Not assessed' }) => {
    if (state === 'unknown') {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
                <HelpCircle className="h-3.5 w-3.5" /> {unknownLabel}
            </span>
        );
    }
    const value = state === 'yes';
    const isGood = positiveIsGood ? value : !value;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isGood ? 'text-green-700' : 'text-red-600'}`}>
            {isGood ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {value ? 'Yes' : 'No'}
        </span>
    );
};

/**
 * Risk/compliance pill. `level` is `null`/`undefined`-safe: unlike the
 * previous version (which silently defaulted a never-assessed farm to a
 * green "Low" badge), a missing level now renders an honest, neutral
 * "Not Assessed" state instead of implying a real "Low risk" finding.
 */
const RiskPill: React.FC<{ level?: string | null }> = ({ level }) => {
    if (!level) {
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Not Assessed</span>;
    }
    const cls = level === 'High' ? 'bg-red-100 text-red-700' : level === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{level}</span>;
};

/** Checklist row state: 'ok' (passes) / 'issue' (fails/missing) / 'unknown' (never assessed — distinct from passing). */
type ChecklistState = 'ok' | 'issue' | 'unknown';
const ChecklistRow: React.FC<{ label: string; state: ChecklistState }> = ({ label, state }) => (
    <div className="flex items-center justify-between">
        <span className="text-brand-muted">{label}</span>
        {state === 'ok' && <CheckCircle2 className="h-4 w-4 text-brand-green" />}
        {state === 'issue' && <AlertTriangle className="h-4 w-4 text-orange-500" />}
        {state === 'unknown' && <span className="inline-flex items-center gap-1 text-xs text-gray-500"><HelpCircle className="h-4 w-4" /> Not assessed</span>}
    </div>
);

/**
 * Small inline chip identifying which farm the surrounding panel's content
 * belongs to. Rendered above the boundary map, farm photos, documents list,
 * and assessment results whenever a farmer has at least one farm, so a
 * reviewer is never left guessing which farm's data they're looking at
 * (especially important once a farmer has multiple farms and a selector).
 */
const FarmContextLabel: React.FC<{ farm?: Farm }> = ({ farm }) => {
    if (!farm) return null;
    return (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-green bg-brand-green/5 border border-brand-green/20 rounded-md px-2 py-1 mb-3">
            <MapPin className="h-3.5 w-3.5" /> Viewing: {farm.name}
        </p>
    );
};

const inputCls = 'border border-brand-border rounded-lg px-2.5 py-1.5 text-sm w-full bg-white text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-colors';

const fmtDate = (d?: string | Date | null) => {
    if (!d) return 'N/A';
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateTime = (d?: string | Date | null) => {
    if (!d) return 'N/A';
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Human-readable labels for FarmerAuditLogEntry.action — powers the Activity tab. */
const AUDIT_ACTION_LABELS: Record<string, string> = {
    CONTACT_UPDATED: 'Contact information updated',
    FARM_ADDED: 'Farm added',
    IDENTITY_CONFIRMED: 'Identity re-confirmed',
    COMMODITY_ADDED: 'Commodity added',
    COMMODITY_UPDATED: 'Commodity updated',
    COMMODITY_DEACTIVATED: 'Commodity deactivated',
    IDENTITY_VERIFIED: 'Identity verified',
    IDENTITY_CONFLICT_FLAGGED: 'Identity conflict flagged',
    IDENTITY_REVERTED_TO_UNVERIFIED: 'Identity reverted to unverified',
};
/** True for the three identity-verification decisions (Verify / Flag Conflict / Revert). */
const isVerificationDecision = (action: string) => action === 'IDENTITY_VERIFIED' || action === 'IDENTITY_CONFLICT_FLAGGED' || action === 'IDENTITY_REVERTED_TO_UNVERIFIED';

type ProfileTab = 'overview' | 'identity' | 'farms' | 'compliance' | 'activity';

/* ---------------------------------------------------------------------- */
/* Main component                                                        */
/* ---------------------------------------------------------------------- */

const VALID_TABS: ProfileTab[] = ['overview', 'identity', 'farms', 'compliance', 'activity'];

const FarmerProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const canManageVerification = user?.role === UserRole.ADMIN;

    // Deep-link support: the Identity Verification Queue's "Review" action
    // (and the missing-item links inside it) opens a farmer directly on a
    // specific tab — e.g. ?tab=identity jumps straight to the Identity &
    // Documents tab's missing document/consent fields, ?tab=farms jumps to
    // the farm boundary/registration section — instead of always landing on
    // Overview and making the reviewer re-navigate manually. Read once on
    // mount; normal in-page tab clicks still work exactly as before and are
    // NOT round-tripped back into the URL (kept simple — this is a one-way
    // entry point, not a bookmarkable tab state).
    const [searchParams] = useSearchParams();
    const initialTabParam = searchParams.get('tab') as ProfileTab | null;
    const initialFarmParam = searchParams.get('farm');

    const [farmer, setFarmer] = useState<Farmer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showQr, setShowQr] = useState(false);
    const [activeTab, setActiveTab] = useState<ProfileTab>(
        initialTabParam && VALID_TABS.includes(initialTabParam) ? initialTabParam : 'overview'
    );
    const [showAllPhotos, setShowAllPhotos] = useState(false);

    // Identity Verification action modal (Verify / Flag Conflict / Revert
    // to Unverified). `pendingAction` is the status being applied; a
    // reason is required for Conflict and for reversing a Verified
    // status — the backend enforces this too, but we ask up-front so the
    // admin doesn't hit an avoidable error.
    const [verificationModal, setVerificationModal] = useState<{ status: IdentityStatus } | null>(null);
    const [verificationReason, setVerificationReason] = useState('');
    const [verifying, setVerifying] = useState(false);

    const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
    const [documents, setDocuments] = useState<FarmDocument[]>([]);
    const [riskHistory, setRiskHistory] = useState<RiskAnalysisResult[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [custody, setCustody] = useState<CustodyHistoryData | null>(null);
    const [loadingFarmData, setLoadingFarmData] = useState(false);

    // Audit log for the "Activity" tab — contact/farm/commodity corrections
    // plus every identity-verification decision, most-recent first.
    const [auditLog, setAuditLog] = useState<FarmerAuditLogEntry[]>([]);
    const [loadingAuditLog, setLoadingAuditLog] = useState(false);
    const [auditLogError, setAuditLogError] = useState<string | null>(null);

    // Every other farmer, fetched once — used ONLY for the read-only
    // "shared phone number" triage signal (same backend logic as
    // FarmerController.computeDataReadiness), never to merge/hide/delete
    // anything. Mirrors the pattern already used by FarmersList.
    const [allFarmers, setAllFarmers] = useState<Farmer[]>([]);

    const [editForm, setEditForm] = useState({
        firstName: '', lastName: '', phone: '', email: '',
        gender: '', nationality: '', nationalId: '', address: '',
        community: '', district: '', region: '',
        cooperativeName: '', cooperativeId: '', directions: ''
    });

    const fetchFarmer = async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const res = await getFarmer(id);
            if (res.data.status) {
                const data = res.data.data;
                setFarmer(data);
                // If a specific farm was requested via ?farm=<id> (e.g. from the
                // Identity Verification Queue's "Review" link), select it when it
                // actually belongs to this farmer; otherwise fall back to the
                // first registered farm, same as before.
                const requestedFarm = initialFarmParam && data.farms?.some(f => f.id === initialFarmParam)
                    ? initialFarmParam
                    : data.farms?.[0]?.id ?? null;
                setSelectedFarmId(requestedFarm);
                setEditForm({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    phone: data.phoneNumber,
                    email: data.email || '',
                    gender: data.gender || '',
                    nationality: data.nationality || '',
                    nationalId: data.nationalId || '',
                    address: data.address || '',
                    community: data.community || '',
                    district: data.district || '',
                    region: data.region || '',
                    cooperativeName: data.cooperativeName || '',
                    cooperativeId: data.cooperativeId || ''
                    , directions: data.directions || ''
                });
            } else {
                setError(res.data.message || 'Failed to load farmer profile');
            }
        } catch (err) {
            console.error('Failed to fetch farmer', err);
            setError('Failed to load farmer profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFarmer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Batches for this farmer (used for the Traceability Summary section) — fetched once per farmer.
    useEffect(() => {
        if (!farmer) return;
        getAllBatches()
            .then(res => {
                if (res.data.status) {
                    const mine = res.data.data.filter((b: any) =>
                        Array.isArray(b.farmers) && b.farmers.some((f: any) => f.id === farmer.id)
                    );
                    setBatches(mine);
                }
            })
            .catch(err => console.error('Failed to fetch batches', err));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [farmer?.id]);

    // Per-farm data: documents + risk history + custody history for the most recent batch
    useEffect(() => {
        if (!selectedFarmId) {
            setDocuments([]);
            setRiskHistory([]);
            return;
        }
        setLoadingFarmData(true);
        Promise.all([
            getFarmDocuments(selectedFarmId).catch(() => null),
            getRiskHistory(selectedFarmId).catch(() => null),
        ]).then(([docsRes, riskRes]) => {
            setDocuments(docsRes?.data?.status ? docsRes.data.data : []);
            setRiskHistory(riskRes?.data?.status ? riskRes.data.data : []);
        }).finally(() => setLoadingFarmData(false));
    }, [selectedFarmId]);

    useEffect(() => {
        const latestBatch = batches[0];
        if (!latestBatch) { setCustody(null); return; }
        getCustodyHistory(latestBatch.id)
            .then(res => setCustody(res.data.status ? res.data.data : null))
            .catch(() => setCustody(null));
    }, [batches]);

    // Audit history — fetched once per farmer (available for both the
    // Activity tab and the Identity & Documents tab's verification-decision
    // history, so it isn't re-fetched every time a tab is switched).
    useEffect(() => {
        if (!farmer?.id) { setAuditLog([]); return; }
        setLoadingAuditLog(true);
        setAuditLogError(null);
        getFarmerAuditLog(farmer.id)
            .then(res => {
                if (res.data.status) setAuditLog(res.data.data);
                else setAuditLogError(res.data.message || 'Failed to load audit history');
            })
            .catch(err => {
                console.error('Failed to fetch farmer audit log', err);
                setAuditLogError('Failed to load audit history. Please try again.');
            })
            .finally(() => setLoadingAuditLog(false));
    }, [farmer?.id]);

    // Every farmer (for the shared-phone-number triage signal only) — fetched once.
    useEffect(() => {
        getFarmers()
            .then(res => { if (res.data.status) setAllFarmers(res.data.data); })
            .catch(err => console.error('Failed to fetch farmers list for duplicate-signal check', err));
    }, []);

    const handleSave = async () => {
        if (!farmer || !id) return;
        setSaving(true);
        try {
            const updated = await updateFarmer(id, {
                firstName: editForm.firstName,
                lastName: editForm.lastName,
                phoneNumber: editForm.phone,
                email: editForm.email,
                gender: editForm.gender,
                nationality: editForm.nationality,
                nationalId: editForm.nationalId,
                address: editForm.address,
                community: editForm.community,
                district: editForm.district,
                region: editForm.region,
                cooperativeName: editForm.cooperativeName,
                cooperativeId: editForm.cooperativeId,
                directions: editForm.directions
            } as any);
            if (updated.data.status) {
                setFarmer(updated.data.data);
                setIsEditing(false);
            }
        } catch (err) {
            console.error('Error updating farmer', err);
            alert('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async () => {
        if (!farmer || !id) return;
        const nextActive = !(farmer.isActive ?? true);
        const label = nextActive ? 'reactivate' : 'deactivate';
        if (!window.confirm(`Are you sure you want to ${label} this farmer?`)) return;
        try {
            const res = await setFarmerActiveStatus(id, nextActive);
            if (res.data.status) setFarmer(res.data.data);
        } catch (err) {
            console.error('Error updating farmer status', err);
            alert('Failed to update farmer status');
        }
    };

    const handleDelete = async () => {
        if (!farmer || !id) return;
        const fullName = `${farmer.firstName} ${farmer.lastName}`.trim();
        const confirmed = window.confirm(
            `Permanently delete ${fullName}?\n\nThis will also delete all of their registered farm(s), plots, commodities, documents, risk assessments and their login account (if any). This action cannot be undone.`
        );
        if (!confirmed) return;
        setDeleting(true);
        try {
            const res = await deleteFarmer(id);
            if (res.data.status) {
                alert('Farmer deleted successfully');
                navigate('/farmers');
            } else {
                alert(res.data.message || 'Failed to delete farmer');
            }
        } catch (err: any) {
            console.error('Error deleting farmer', err);
            alert(err?.response?.data?.message || 'Failed to delete farmer');
        } finally {
            setDeleting(false);
        }
    };

    // Reason is required when flagging Conflict, or when reversing an
    // existing Verified status back to Unverified — mirrors the backend's
    // own validation in FarmerController.setVerificationStatus().
    const isReasonRequired = (status: IdentityStatus) => {
        if (!farmer) return false;
        if (status === 'Conflict') return true;
        if (status === 'Unverified' && farmer.identityStatus === 'Verified') return true;
        return false;
    };

    const handleConfirmVerification = async () => {
        if (!farmer || !id || !verificationModal) return;
        const { status } = verificationModal;
        if (isReasonRequired(status) && !verificationReason.trim()) {
            alert('A reason is required for this action.');
            return;
        }
        setVerifying(true);
        try {
            const res = await setFarmerVerificationStatus(id, status, verificationReason.trim() || undefined);
            if (res.data.status) {
                setFarmer(res.data.data);
                setVerificationModal(null);
                setVerificationReason('');
                // The decision was just recorded in FarmerAuditLog server-side —
                // refresh so the Activity tab / verification history reflect it
                // immediately without requiring a full page reload.
                getFarmerAuditLog(id).then(r => { if (r.data.status) setAuditLog(r.data.data); }).catch(() => { /* non-fatal */ });
            } else {
                alert(res.data.message || 'Failed to update verification status');
            }
        } catch (err: any) {
            console.error('Error updating verification status', err);
            alert(err?.response?.data?.message || 'Failed to update verification status');
        } finally {
            setVerifying(false);
        }
    };

    // --- Derived selected farm (must be computed before hooks below so its identity is stable) ---
    const selectedFarm: Farm | undefined = farmer ? (farmer.farms.find(f => f.id === selectedFarmId) || farmer.farms[0]) : undefined;
    const isActive = farmer?.isActive ?? true;

    // --- Derived geometry stats for the selected farm (computed from real GeoJSON, not fabricated) ---
    // NOTE: These hooks MUST run unconditionally on every render (Rules of Hooks) —
    // they are placed BEFORE the loading/error early-returns below, with null-safe guards inside.
    const geo = useMemo(() => {
        const loc = selectedFarm?.location;
        if (!loc || !loc.coordinates) return { points: [] as { lat: number; lng: number }[], areaHa: null as number | null, perimeterM: null as number | null, center: null as [number, number] | null };
        try {
            if (loc.type === 'Polygon') {
                const ring = loc.coordinates[0] as [number, number][];
                const points = ring.slice(0, ring.length - 1).map((c) => ({ lat: c[1], lng: c[0] }));
                const areaHa = turf.area(loc as any) / 10000;
                const perimeterM = turf.length(turf.polygonToLine(loc as any) as any, { units: 'kilometers' }) * 1000;
                const centroid = turf.centroid(loc as any);
                return { points, areaHa, perimeterM, center: [centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]] as [number, number] };
            }
            if (loc.type === 'Point') {
                const c = loc.coordinates as [number, number];
                return { points: [{ lat: c[1], lng: c[0] }], areaHa: null, perimeterM: null, center: [c[1], c[0]] as [number, number] };
            }
        } catch (e) {
            console.error('Failed to compute geometry stats', e);
        }
        return { points: [], areaHa: null, perimeterM: null, center: null };
    }, [selectedFarm]);

    const latestAssessment: RiskAnalysisResult | undefined = riskHistory[0];
    // null (not a 'Low' default) when nothing has ever been assessed — see RiskPill, which now
    // renders a distinct "Not Assessed" state instead of silently implying a real "Low risk" finding.
    const overallRiskLevel: string | null = selectedFarm?.riskLevel ?? latestAssessment?.overallRisk ?? null;

    const hasSharedPhone = farmer ? hasSharedPhoneNumber(farmer, allFarmers) : false;

    // --- Data Quality Score: computed from real completeness of captured fields (not fabricated) ---
    // NOTE: this is a data-COMPLETENESS metric only, deliberately kept visually
    // separate from the risk/compliance assessment results in the Compliance &
    // Risk tab below (per the explicit "clearly separated" requirement).
    const quality = useMemo(() => {
        const farmerFields = farmer ? [farmer.firstName, farmer.lastName, farmer.phoneNumber, farmer.gender, farmer.dob, farmer.nationalId, farmer.community, farmer.district] : [];
        const farmerScore = farmerFields.length ? farmerFields.filter(Boolean).length / farmerFields.length : 0;

        const farmFields = selectedFarm ? [selectedFarm.name, selectedFarm.cropType, selectedFarm.totalAreaHa, selectedFarm.ownershipType, selectedFarm.farmRegistrationStatus] : [];
        const farmScore = farmFields.length ? farmFields.filter(Boolean).length / farmFields.length : 0;

        const gpsScore = geo.points.length > 0 ? 1 : 0;
        const photosScore = (!!farmer?.farmSelfie || (!!selectedFarm?.farmPhotos && selectedFarm.farmPhotos.length > 0)) ? 1 : 0;
        const docsScore = documents.length > 0 ? documents.filter(d => d.status === 'Valid').length / documents.length : 0;

        const overall = (farmerScore + farmScore + gpsScore + photosScore + docsScore) / 5;
        return {
            farmerInfo: Math.round(farmerScore * 100),
            farmInfo: Math.round(farmScore * 100),
            gps: Math.round(gpsScore * 100),
            photos: Math.round(photosScore * 100),
            documents: Math.round(docsScore * 100),
            overall: Math.round(overall * 100)
        };
    }, [farmer, selectedFarm, geo, documents]);

    const outstandingTasks = useMemo(() => {
        if (!farmer) return [];
        return computeOutstandingTasks({ farmer, farms: farmer.farms, documents, hasSharedPhoneNumber: hasSharedPhone });
    }, [farmer, documents, hasSharedPhone]);

    // --- Early returns for loading/error/no-data states ---
    // IMPORTANT: placed AFTER all hooks above so hook order stays identical on every render.
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 p-20 text-brand-muted">
                <Loader2 className="animate-spin h-8 w-8 text-brand-green" />
                <p className="text-sm">Loading farmer profile…</p>
            </div>
        );
    }

    if (error || !farmer) {
        return (
            <div className="max-w-md mx-auto mt-12 bg-brand-card rounded-xl border border-brand-border shadow-card p-8 text-center">
                <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
                <p className="text-sm text-red-600 mb-4">{error || 'Farmer not found'}</p>
                <button onClick={fetchFarmer} className="px-4 py-2 rounded-lg bg-brand-green text-white text-sm font-semibold hover:bg-brand-green-hover transition-colors">Retry</button>
            </div>
        );
    }

    const statusBadge = () => {
        const status = farmer.identityStatus;
        if (status === 'Verified') {
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100"><ShieldCheck className="h-3.5 w-3.5" /> Verified Farmer</span>;
        }
        if (status === 'Conflict') {
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100"><ShieldAlert className="h-3.5 w-3.5" /> Conflict</span>;
        }
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-100"><ShieldQuestion className="h-3.5 w-3.5" /> Unverified</span>;
    };

    const locationLine = formatFarmerLocationLine(farmer) || (farmer.community ? farmer.community : null);

    const farmCommoditiesFlat = Array.from(new Set(farmer.farms.map(f => getFarmCommoditySummary(f).primary).filter(Boolean))) as string[];
    const totalDeclaredAreaHa = farmer.farms.reduce((sum, f) => sum + (f.totalAreaHa || 0), 0);

    const TAB_ITEMS: TabItem[] = [
        { key: 'overview', label: 'Overview', icon: <LayoutGrid className="h-4 w-4" /> },
        { key: 'identity', label: 'Identity & Documents', icon: <FileCheck2 className="h-4 w-4" /> },
        { key: 'farms', label: 'Farms & Maps', icon: <Sprout className="h-4 w-4" /> },
        { key: 'compliance', label: 'Compliance & Risk', icon: <Satellite className="h-4 w-4" />, badge: <RiskPill level={overallRiskLevel} /> },
        {
            key: 'activity', label: 'Activity', icon: <HistoryIcon className="h-4 w-4" />,
            badge: auditLog.length > 0 ? <span className="ml-1 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">{auditLog.length}</span> : undefined,
        },
    ];

    return (
        <div className="max-w-[1400px] mx-auto space-y-4">
            {/* Back link — uses browser history (not a fresh /farmers URL)
                so the Farmer Registry's search/filter/sort/page state
                (all stored in its URL query string) is preserved exactly
                as the admin left it, rather than resetting to an
                unfiltered first page. */}
            <button onClick={() => navigate(-1)} className="text-xs font-medium text-brand-muted hover:text-brand-green flex items-center gap-1 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Farmers
            </button>

            {/* ---------------------------------------------------------- */}
            {/* Persistent summary (header): photo, name, Farmer ID,        */}
            {/* identity status, location, and key actions.                 */}
            {/* ---------------------------------------------------------- */}
            <div className="bg-brand-card rounded-xl border border-brand-border shadow-card px-5 py-4 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="flex-none">
                        <SafeImage
                            src={resolveFileUrl(farmer.profilePhoto)}
                            alt="Farmer"
                            className="h-12 w-12 rounded-full object-cover border border-brand-border"
                            fallback={<FallbackAvatar className="h-12 w-12" />}
                        />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-xl font-bold text-brand-text">{farmer.firstName} {farmer.lastName}</h1>
                            {statusBadge()}
                            {!isActive && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">Deactivated</span>
                            )}
                        </div>
                        <p className="text-xs text-brand-muted mt-1 flex flex-wrap items-center gap-x-1">
                            Farmer ID: <span className="font-mono text-brand-text">{formatFarmerId(farmer)}</span>
                            {locationLine && (
                                <span className="flex items-center gap-1">
                                    {' · '}<MapPin className="h-3 w-3" />{locationLine}
                                </span>
                            )}
                            {' · '}Registered {fmtDate(farmer.createdAt)}
                            {' · '}Updated {fmtDate(farmer.updatedAt)}
                        </p>
                    </div>
                </div>

                {/* Actions, deliberately grouped by risk: routine non-destructive
                    (Edit/Save, QR, Share) first, then a routine secondary dropdown
                    (identity verification + deactivate/reactivate), then — visually
                    separated by a border and red styling — the single destructive
                    action (Delete Farmer), so it can never be mistaken for or
                    accidentally triggered alongside a routine action. */}
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <button onClick={() => setIsEditing(false)} className="px-3 py-2 text-sm rounded-lg border border-brand-border text-brand-muted hover:bg-brand-bg flex items-center gap-1.5 transition-colors">
                                <X className="h-4 w-4" /> Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving} className="px-3 py-2 text-sm rounded-lg bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-60 flex items-center gap-1.5 transition-colors">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="px-3 py-2 text-sm rounded-lg bg-brand-green text-white hover:bg-brand-green-hover flex items-center gap-1.5 transition-colors">
                            <Edit2 className="h-4 w-4" /> Edit Profile
                        </button>
                    )}
                    <button onClick={() => setShowQr(!showQr)} className="px-3 py-2 text-sm rounded-lg border border-brand-border text-brand-muted hover:bg-brand-bg flex items-center gap-1.5 transition-colors">
                        <QrCode className="h-4 w-4" /> QR Code
                    </button>
                    <button
                        onClick={() => {
                            const url = `${window.location.origin}/public/farmers/${farmer.id}`;
                            navigator.clipboard?.writeText(url);
                            alert('Public profile link copied to clipboard');
                        }}
                        className="px-3 py-2 text-sm rounded-lg border border-brand-border text-brand-muted hover:bg-brand-bg flex items-center gap-1.5 transition-colors"
                    >
                        <Share2 className="h-4 w-4" /> Share
                    </button>

                    {/* Routine secondary actions: identity verification (ADMIN only) + deactivate/reactivate. */}
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-lg border border-brand-border text-brand-muted hover:bg-brand-bg transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-1 w-60 bg-white border border-brand-border rounded-lg shadow-card z-20 text-sm overflow-hidden">
                                {/* Identity Verification actions — ADMIN only. This verifies the
                                    farmer's IDENTITY only; it does not validate farm boundaries,
                                    land rights, or EUDR requirements. */}
                                {canManageVerification && (
                                    <>
                                        <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Identity Verification</p>
                                        {farmer.identityStatus !== 'Verified' && (
                                            <button
                                                onClick={() => { setShowMenu(false); setVerificationReason(''); setVerificationModal({ status: 'Verified' }); }}
                                                className="w-full text-left px-3 py-2 hover:bg-green-50 text-green-700 font-medium transition-colors flex items-center gap-1.5"
                                            >
                                                <ShieldCheck className="h-3.5 w-3.5" /> Mark Identity Verified
                                            </button>
                                        )}
                                        {farmer.identityStatus !== 'Conflict' && (
                                            <button
                                                onClick={() => { setShowMenu(false); setVerificationReason(''); setVerificationModal({ status: 'Conflict' }); }}
                                                className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 font-medium transition-colors flex items-center gap-1.5"
                                            >
                                                <ShieldAlert className="h-3.5 w-3.5" /> Flag Identity Conflict
                                            </button>
                                        )}
                                        {farmer.identityStatus !== 'Unverified' && (
                                            <button
                                                onClick={() => { setShowMenu(false); setVerificationReason(''); setVerificationModal({ status: 'Unverified' }); }}
                                                className="w-full text-left px-3 py-2 hover:bg-brand-bg text-brand-muted font-medium transition-colors flex items-center gap-1.5"
                                            >
                                                <ShieldQuestion className="h-3.5 w-3.5" /> Revert to Unverified
                                            </button>
                                        )}
                                    </>
                                )}
                                <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-muted border-t border-brand-border">Account</p>
                                <button
                                    onClick={() => { setShowMenu(false); handleToggleActive(); }}
                                    className={`w-full text-left px-3 py-2 hover:bg-brand-bg transition-colors ${isActive ? 'text-red-600' : 'text-brand-green'}`}
                                >
                                    {isActive ? 'Deactivate Farmer' : 'Reactivate Farmer'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Destructive action — deliberately a standalone, visually distinct
                        (red outline, separated by a left border) button rather than
                        buried in the routine dropdown above, so it can't be triggered
                        by a stray click among routine actions. */}
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        title="Permanently delete this farmer"
                        className="ml-1 pl-3 border-l border-brand-border flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                    >
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete
                    </button>
                </div>
            </div>

            {showQr && (
                <div className="bg-brand-card rounded-xl border border-brand-border shadow-card p-5 flex items-center gap-4">
                    <div className="bg-white p-2 border border-brand-border rounded-lg">
                        {farmer.qrCode ? (
                            // Render the ACTUAL stored QR image (GeoJSON FeatureCollection
                            // payload — see backend GeoIdService.buildFarmerGeoJsonFeatureCollection)
                            // rather than re-deriving a plain-URL QR client-side: the two would
                            // encode different content, and only the real stored image matches
                            // what's on the physical printed ID card / what WHIMO's scanner needs.
                            <img src={farmer.qrCode} alt="Farmer QR Code" className="w-24 h-24" />
                        ) : (
                            // Fallback for farmers registered before qrCode generation existed
                            // on their registration path and not yet backfilled — shows a
                            // profile-URL QR so the panel never renders a blank box, though this
                            // legacy format will NOT scan as valid GeoJSON in WHIMO/LACRA Trace.
                            <QRCodeCanvas value={`${window.location.origin}/public/farmers/${farmer.id}`} size={96} level="M" includeMargin />
                        )}
                    </div>
                    <div className="text-sm text-brand-muted">
                        {farmer.qrCode
                            ? "Scan with LACRA Trace / WHIMO to read this farmer's registered farm geometry, or open the link below for the public verification profile."
                            : "Scan to open this farmer's public verification profile."}
                        <br />
                        <span className="font-mono text-xs text-gray-400">{window.location.origin}/public/farmers/{farmer.id}</span>
                    </div>
                </div>
            )}

            {/* Identity Verification confirmation modal — Verify / Flag Conflict / Revert.
                ADMIN-only action (see canManageVerification above and the backend's
                PATCH /farmers/:id/verification, which re-enforces this independently
                of the UI). Reason is required for Conflict and for reversing an
                existing Verified status. */}
            {verificationModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            {verificationModal.status === 'Verified' && <ShieldCheck className="h-5 w-5 text-green-600" />}
                            {verificationModal.status === 'Conflict' && <ShieldAlert className="h-5 w-5 text-red-600" />}
                            {verificationModal.status === 'Unverified' && <ShieldQuestion className="h-5 w-5 text-yellow-600" />}
                            <h3 className="text-lg font-bold text-brand-text">
                                {verificationModal.status === 'Verified' && 'Mark Identity Verified'}
                                {verificationModal.status === 'Conflict' && 'Flag Identity Conflict'}
                                {verificationModal.status === 'Unverified' && 'Revert to Unverified'}
                            </h3>
                        </div>
                        <p className="text-sm text-brand-muted">
                            {verificationModal.status === 'Verified' && (
                                <>This confirms <strong>{farmer.firstName} {farmer.lastName}</strong>'s identity is verified — not their farm boundaries, land rights, or EUDR requirements, which are tracked separately.</>
                            )}
                            {verificationModal.status === 'Conflict' && (
                                <>Use this when identity information is contradictory or suspicious — e.g. mismatched documents or a suspected duplicate identity. Missing documents alone should stay "Unverified" instead.</>
                            )}
                            {verificationModal.status === 'Unverified' && farmer.identityStatus === 'Verified' && (
                                <>This reverses an existing Verified status. The farmer will need to go through identity review again.</>
                            )}
                            {verificationModal.status === 'Unverified' && farmer.identityStatus !== 'Verified' && (
                                <>This clears the Conflict flag and returns the record to Unverified, pending further review.</>
                            )}
                        </p>
                        <div>
                            <label className="block text-xs font-semibold text-brand-muted mb-1">
                                Reason {isReasonRequired(verificationModal.status) ? <span className="text-red-500">(required)</span> : <span className="text-gray-400">(optional)</span>}
                            </label>
                            <textarea
                                value={verificationReason}
                                onChange={(e) => setVerificationReason(e.target.value)}
                                rows={3}
                                placeholder={
                                    verificationModal.status === 'Conflict'
                                        ? 'e.g. National ID photo does not match the name on file...'
                                        : verificationModal.status === 'Unverified' && farmer.identityStatus === 'Verified'
                                            ? 'e.g. Farmer disputed their recorded date of birth...'
                                            : 'Optional note for the audit log...'
                                }
                                className="w-full border border-brand-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                onClick={() => { setVerificationModal(null); setVerificationReason(''); }}
                                disabled={verifying}
                                className="px-4 py-2 text-sm rounded-lg border border-brand-border text-brand-muted hover:bg-brand-bg transition-colors disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmVerification}
                                disabled={verifying || (isReasonRequired(verificationModal.status) && !verificationReason.trim())}
                                className={`px-4 py-2 text-sm rounded-lg text-white flex items-center gap-1.5 transition-colors disabled:opacity-60 ${
                                    verificationModal.status === 'Conflict' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-green hover:bg-brand-green-hover'
                                }`}
                            >
                                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------------- */}
            {/* Tab navigation                                              */}
            {/* ---------------------------------------------------------- */}
            <Tabs items={TAB_ITEMS} activeKey={activeTab} onChange={(k) => setActiveTab(k as ProfileTab)} />

            {/* ============================================================ */}
            {/* OVERVIEW                                                      */}
            {/* ============================================================ */}
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Essential personal details */}
                        <SectionCard title="Personal Details" className="lg:col-span-2">
                            <div className="flex gap-4">
                                <div className="flex-none">
                                    <SafeImage
                                        src={resolveFileUrl(farmer.profilePhoto)}
                                        alt="Farmer"
                                        className="h-24 w-24 rounded-lg object-cover border border-gray-200"
                                        fallback={
                                            <div className="h-24 w-24 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 text-xs text-center px-1">No Photo</div>
                                        }
                                    />
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-3">
                                    {isEditing ? (
                                        <div className="col-span-2 flex gap-2">
                                            <input className={inputCls} value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} placeholder="First name" />
                                            <input className={inputCls} value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} placeholder="Last name" />
                                        </div>
                                    ) : (
                                        <div className="col-span-2"><Field label="Full Name" value={`${farmer.firstName} ${farmer.lastName}`} /></div>
                                    )}
                                    <Field label="Phone Number" value={isEditing ? <input className={inputCls} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /> : farmer.phoneNumber} />
                                    <Field label="Gender" value={isEditing ? (
                                        <select className={inputCls} value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}>
                                            <option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                                        </select>
                                    ) : farmer.gender} />
                                    <Field label="Nationality" value={isEditing ? <input className={inputCls} value={editForm.nationality} onChange={e => setEditForm({ ...editForm, nationality: e.target.value })} /> : farmer.nationality} />
                                    <Field label="Cooperative" value={isEditing ? <input className={inputCls} value={editForm.cooperativeName} onChange={e => setEditForm({ ...editForm, cooperativeName: e.target.value })} /> : farmer.cooperativeName} />
                                    <Field label="County" value={isEditing ? <input className={inputCls} value={editForm.region} onChange={e => setEditForm({ ...editForm, region: e.target.value })} /> : farmer.region} />
                                    <Field label="District" value={isEditing ? <input className={inputCls} value={editForm.district} onChange={e => setEditForm({ ...editForm, district: e.target.value })} /> : farmer.district} />
                                    <Field label="Town / Village" value={isEditing ? <input className={inputCls} value={editForm.community} onChange={e => setEditForm({ ...editForm, community: e.target.value })} /> : farmer.community} />
                                    <Field label="Residential GPS" value={farmer.latitude && farmer.longitude ? `${farmer.latitude}, ${farmer.longitude}` : undefined} mono />
                                </div>
                            </div>
                        </SectionCard>

                        {/* Outstanding tasks — triage aid only, never a verification/compliance decision by itself. */}
                        <SectionCard title="Outstanding Tasks" icon={<Info className="h-4 w-4 text-gray-400" />}>
                            {outstandingTasks.length === 0 ? (
                                <p className="text-sm text-brand-green flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Nothing outstanding — record looks complete.</p>
                            ) : (
                                <ul className="space-y-2.5">
                                    {outstandingTasks.map((task) => (
                                        <li key={task.id} className="flex items-start gap-2 text-sm">
                                            <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${task.severity === 'high' ? 'text-red-500' : task.severity === 'medium' ? 'text-orange-500' : 'text-yellow-500'}`} />
                                            <span className="text-brand-text">{task.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </SectionCard>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Farm summaries — condensed stats; the full registered-farms
                            list with per-farm "View Farm" actions lives in Farms & Maps. */}
                        <SectionCard title="Farm Summary" icon={<Sprout className="h-4 w-4 text-gray-400" />} className="lg:col-span-2">
                            {farmer.farms.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No farms registered for this farmer.</p>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        <div className="bg-brand-bg rounded-lg p-3 text-center">
                                            <p className="text-xl font-bold text-brand-text">{farmer.farms.length}</p>
                                            <p className="text-[11px] text-brand-muted uppercase tracking-wide">Farm{farmer.farms.length !== 1 ? 's' : ''}</p>
                                        </div>
                                        <div className="bg-brand-bg rounded-lg p-3 text-center">
                                            <p className="text-xl font-bold text-brand-text">{totalDeclaredAreaHa > 0 ? totalDeclaredAreaHa.toFixed(1) : '\u2014'}</p>
                                            <p className="text-[11px] text-brand-muted uppercase tracking-wide">Total Hectares</p>
                                        </div>
                                        <div className="bg-brand-bg rounded-lg p-3 text-center">
                                            <p className="text-xl font-bold text-brand-text">{farmCommoditiesFlat.length}</p>
                                            <p className="text-[11px] text-brand-muted uppercase tracking-wide">Commodities</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {farmer.farms.map((f) => (
                                            <button
                                                key={f.id}
                                                onClick={() => { setSelectedFarmId(f.id); setActiveTab('farms'); }}
                                                className="px-2.5 py-1 rounded-full text-xs font-medium bg-brand-green/10 text-brand-green hover:bg-brand-green/20 transition-colors flex items-center gap-1"
                                            >
                                                <Sprout className="h-3 w-3" /> {f.name}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setActiveTab('farms')}
                                        className="text-xs font-medium text-brand-green hover:text-brand-green-hover"
                                    >
                                        View all farms &amp; boundaries &rarr;
                                    </button>
                                </>
                            )}
                        </SectionCard>

                        {/* Traceability Summary — farm/batch-linked summary data, kept
                            alongside the other "farm summaries" content on Overview
                            rather than under Compliance & Risk (it is not a risk or
                            compliance assessment) or Farms & Maps (it is batch/custody
                            data, not farm/boundary data). */}
                        <SectionCard title="Traceability" icon={<Package className="h-4 w-4 text-gray-400" />}>
                            {batches.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No batches recorded for this farmer yet.</p>
                            ) : (
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">Last Transaction</p>
                                        <p className="text-brand-text">{fmtDate(batches[0].createdAt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">Current Quantity</p>
                                        <p className="text-brand-text">{batches[0].weightKg} kg ({batches[0].cropType})</p>
                                    </div>
                                    {custody && (
                                        <div>
                                            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Current Holder</p>
                                            <p className="text-brand-text">{custody.currentHolder}</p>
                                        </div>
                                    )}
                                    <Link to={`/custody/batch/${batches[0].id}`} className="inline-block mt-1 text-xs font-medium text-brand-green border border-brand-green/30 bg-brand-green/5 rounded-lg px-3 py-1.5 hover:bg-brand-green/10 transition-colors">
                                        View Full Traceability
                                    </Link>
                                </div>
                            )}
                        </SectionCard>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* IDENTITY & DOCUMENTS                                          */}
            {/* ============================================================ */}
            {activeTab === 'identity' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Identity information */}
                    <SectionCard title="Identity Information">
                        <div className="flex gap-4">
                            <div className="flex-none space-y-2">
                                <div>
                                    <p className="text-[10px] text-gray-400 mb-0.5">ID Photo</p>
                                    <SafeImage
                                        src={resolveFileUrl(farmer.idPhoto)}
                                        alt="ID document"
                                        className="h-24 w-24 rounded-lg object-cover border border-gray-200"
                                        fallback={<div className="h-24 w-24 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 text-xs text-center px-1">No ID Photo</div>}
                                    />
                                </div>
                                {farmer.signature && (
                                    <div>
                                        <p className="text-[10px] text-gray-400 mb-0.5">Signature</p>
                                        <SafeImage
                                            src={resolveFileUrl(farmer.signature)}
                                            alt="Signature"
                                            className="h-10 w-24 object-contain bg-gray-50 border border-gray-200 rounded"
                                            fallback={<div className="h-10 w-24 flex items-center justify-center text-gray-400 bg-gray-50 border border-gray-200 rounded text-[10px]">No Signature</div>}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 grid grid-cols-2 gap-3">
                                <Field label="National ID" value={isEditing ? <input className={inputCls} value={editForm.nationalId} onChange={e => setEditForm({ ...editForm, nationalId: e.target.value })} /> : farmer.nationalId} />
                                <Field label="ID Type" value={farmer.idType === 'Other' ? (farmer.idTypeOther || 'Other') : farmer.idType} />
                                <Field label="Date of Birth" value={fmtDate(farmer.dob)} />
                                <Field label="Clan / Other ID" value={farmer.otherId} />
                                <div className="col-span-2 flex items-center justify-between pt-1 border-t border-brand-border">
                                    <span className="text-[11px] font-medium text-brand-muted uppercase tracking-wide">Consent Recorded</span>
                                    {/* consent is a real, non-nullable boolean on the backend, but a
                                        `false` here means either "declined" OR "never collected" —
                                        the backend itself conflates these two cases, so this is
                                        labelled honestly rather than implying a confirmed refusal. */}
                                    {farmer.consent === true ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>
                                    ) : farmer.consent === false ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600"><AlertTriangle className="h-3.5 w-3.5" /> Not recorded</span>
                                    ) : (
                                        <TriStateBadge state="unknown" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Verification details */}
                    <SectionCard title="Verification Details" badge={statusBadge()}>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-brand-muted">Current Status</span>{statusBadge()}</div>
                            <Field label="Reason for Current Status" value={farmer.identityStatusReason} />
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Verified By" value={farmer.identityVerifiedByName} />
                                <Field label="Verified At" value={farmer.identityVerifiedAt ? fmtDateTime(farmer.identityVerifiedAt) : undefined} />
                            </div>
                            <div className="pt-2 border-t border-brand-border">
                                <p className="text-[11px] font-medium text-brand-muted uppercase tracking-wide mb-2">Verification Decision History</p>
                                {loadingAuditLog ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                ) : auditLog.filter(a => isVerificationDecision(a.action)).length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">No verification decisions recorded yet.</p>
                                ) : (
                                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                                        {auditLog.filter(a => isVerificationDecision(a.action)).map((row) => (
                                            <li key={row.id} className="text-xs border-l-2 border-brand-green/40 pl-2">
                                                <p className="font-medium text-brand-text">{AUDIT_ACTION_LABELS[row.action] || row.action}</p>
                                                {row.notes && <p className="text-brand-muted">{row.notes}</p>}
                                                <p className="text-gray-400">{row.performedByName || 'Unknown'} &middot; {fmtDateTime(row.createdAt)}</p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </SectionCard>

                    {/* Supporting documents — farm-scoped, so clearly labelled with
                        whichever farm is currently selected. */}
                    <SectionCard title="Supporting Documents" icon={<FolderOpen className="h-4 w-4 text-gray-400" />} className="lg:col-span-2">
                        <FarmContextLabel farm={selectedFarm} />
                        {farmer.farms.length > 1 && (
                            <div className="mb-3">
                                <FarmSelector farms={farmer.farms} selectedFarmId={selectedFarmId} onChange={setSelectedFarmId} />
                            </div>
                        )}
                        {loadingFarmData ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        ) : documents.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">No documents uploaded for this farm yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {documents.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                                        <span className="flex items-center gap-2 text-brand-text"><FileText className="h-3.5 w-3.5 text-gray-400" /> {doc.type}</span>
                                        <span className="flex items-center gap-2">
                                            <span className={`text-xs font-semibold ${doc.status === 'Valid' ? 'text-green-600' : doc.status === 'Invalid' ? 'text-red-600' : 'text-yellow-600'}`}>{doc.status}</span>
                                            <a href={doc.documentUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-brand-muted"><Download className="h-3.5 w-3.5" /></a>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* ============================================================ */}
            {/* FARMS & MAPS                                                  */}
            {/* ============================================================ */}
            {activeTab === 'farms' && (
                <div className="space-y-4">
                    {/* Explicit farm selector for multi-farm farmers. */}
                    {farmer.farms.length > 1 && (
                        <div className="flex items-center gap-2 text-sm bg-brand-card border border-brand-border rounded-xl px-4 py-3">
                            <span className="text-brand-muted">Viewing farm:</span>
                            <FarmSelector farms={farmer.farms} selectedFarmId={selectedFarmId} onChange={setSelectedFarmId} />
                        </div>
                    )}

                    {/* Compact registered-farms summary — replaces the old ~13-column
                        table. Only the fields needed to identify and triage each farm
                        from this list are shown; every other detail (additional
                        commodities, cropping system, estimated production, calculated
                        vs. declared area, commodity eligibility, date mapped) remains
                        fully available on the farm detail screen via "View Farm". */}
                    <SectionCard
                        title="Registered Farms"
                        icon={<Sprout className="h-4 w-4 text-gray-400" />}
                        badge={<span className="text-xs font-semibold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">{farmer.farms.length} farm{farmer.farms.length !== 1 ? 's' : ''}</span>}
                    >
                        {farmer.farms.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">No farms registered for this farmer.</p>
                        ) : (
                            <div className="overflow-x-auto -mx-1 rounded-lg border border-brand-border">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] uppercase tracking-wide text-brand-muted bg-brand-bg border-b border-brand-border">
                                            <th className="px-3 py-2 font-medium">Farm</th>
                                            <th className="px-3 py-2 font-medium">Location</th>
                                            <th className="px-3 py-2 font-medium">Commodity</th>
                                            <th className="px-3 py-2 font-medium">Area</th>
                                            <th className="px-3 py-2 font-medium">Status</th>
                                            <th className="px-3 py-2 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-brand-border bg-white">
                                        {farmer.farms.map((f) => {
                                            const calcArea = calcAreaHaFor(f);
                                            const areaDisplay = f.totalAreaHa ? `${f.totalAreaHa} ha` : (calcArea != null ? `${calcArea.toFixed(2)} ha` : '\u2014');
                                            const summary = getFarmCommoditySummary(f);
                                            return (
                                                <tr key={f.id} className={`transition-colors hover:bg-brand-bg/60 ${f.id === selectedFarm?.id ? 'bg-brand-green/5' : ''}`}>
                                                    <td className="px-3 py-2.5">
                                                        <p className="font-medium text-brand-text">{f.name}</p>
                                                        <p className="font-mono text-[11px] text-brand-muted">{f.id.slice(0, 8).toUpperCase()}</p>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-gray-500">{formatFarmLocationLine(f, farmer)}</td>
                                                    <td className="px-3 py-2.5">
                                                        {summary.primary ? (
                                                            <span className="inline-flex items-center gap-1 text-gray-700">
                                                                <Sprout className="h-3.5 w-3.5 text-green-600" /> {summary.primary}
                                                                {summary.additional.length > 0 && <span className="text-gray-400">+{summary.additional.length}</span>}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">{'\u2014'}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-gray-500">{areaDisplay}</td>
                                                    <td className="px-3 py-2.5"><RiskPill level={f.riskLevel} /></td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        <Link to={`/farms/${f.id}`} className="text-brand-green hover:text-brand-green-hover font-medium text-xs whitespace-nowrap">
                                                            View Farm
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="mt-4 pt-4 border-t border-brand-border">
                            <button
                                onClick={() => navigate(`/farmers/mapping/confirm-identity/${farmer.id}`)}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-green text-white text-sm font-semibold hover:bg-brand-green-hover transition-colors"
                            >
                                <PlusCircle className="h-4 w-4" /> Add Another Farm
                            </button>
                        </div>
                    </SectionCard>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Selected-farm boundary + mapping details */}
                        <SectionCard title="Farm Boundary & Mapping Details">
                            <FarmContextLabel farm={selectedFarm} />
                            {!selectedFarm || geo.points.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No boundary captured for this farm.</p>
                            ) : (
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="h-56 w-full md:w-1/2 rounded-lg overflow-hidden border border-brand-border flex-none">
                                        <FarmMap location={selectedFarm.location} height="100%" areaHa={selectedFarm.totalAreaHa} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="max-h-44 overflow-y-auto border border-brand-border rounded-lg">
                                            <table className="w-full text-xs">
                                                <thead className="bg-brand-bg sticky top-0">
                                                    <tr>
                                                        <th className="text-left px-2 py-1.5 font-medium text-brand-muted">Point</th>
                                                        <th className="text-left px-2 py-1.5 font-medium text-brand-muted">Latitude</th>
                                                        <th className="text-left px-2 py-1.5 font-medium text-brand-muted">Longitude</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {geo.points.map((p, idx) => (
                                                        <tr key={idx} className="border-t border-brand-border">
                                                            <td className="px-2 py-1.5 text-brand-muted">{idx + 1}</td>
                                                            <td className="px-2 py-1.5 font-mono text-brand-text">{p.lat.toFixed(6)}°N</td>
                                                            <td className="px-2 py-1.5 font-mono text-brand-text">{p.lng.toFixed(6)}°W</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="flex justify-between text-xs text-brand-muted mt-2">
                                            <span>Total Points: <b className="text-brand-text">{geo.points.length}</b></span>
                                            <span>Area: <b className="text-brand-text">{geo.areaHa?.toFixed(2) ?? '-'} ha</b></span>
                                            <span>Perimeter: <b className="text-brand-text">{geo.perimeterM?.toFixed(2) ?? '-'} m</b></span>
                                        </div>
                                        {selectedFarm.boundaryEvidence && selectedFarm.boundaryEvidence.length > 0 && (
                                            <p className="text-xs text-brand-muted mt-2">
                                                {selectedFarm.boundaryEvidence.length} geotagged boundary photo{selectedFarm.boundaryEvidence.length !== 1 ? 's' : ''} captured
                                                {selectedFarm.gpsAccuracyM != null ? ` · GPS accuracy ~${selectedFarm.gpsAccuracyM.toFixed(1)}m` : ''}
                                            </p>
                                        )}
                                        <button
                                            onClick={() => {
                                                const blob = new Blob([JSON.stringify(selectedFarm.location, null, 2)], { type: 'application/geo+json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url; a.download = `${selectedFarm.name.replace(/\s+/g, '_')}.geojson`; a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="mt-3 text-xs font-medium text-brand-green border border-brand-green/30 bg-brand-green/5 rounded-lg px-3 py-1.5 hover:bg-brand-green/10 flex items-center gap-1.5 transition-colors"
                                        >
                                            <Download className="h-3.5 w-3.5" /> View / Export GeoJSON
                                        </button>
                                    </div>
                                </div>
                            )}
                        </SectionCard>

                        {/* Farm photos */}
                        <SectionCard title="Farm Photos">
                            <FarmContextLabel farm={selectedFarm} />
                            {!farmer.farmSelfie && (!selectedFarm?.farmPhotos || selectedFarm.farmPhotos.length === 0) ? (
                                <p className="text-sm text-gray-400 italic">No farm photos captured yet.</p>
                            ) : (
                                <>
                                    {farmer.farmSelfie && (
                                        <div className="mb-3">
                                            <p className="text-[11px] font-medium text-brand-muted mb-1.5">Farmer on Farm</p>
                                            <div className="relative rounded-lg overflow-hidden border border-brand-border w-28 aspect-square">
                                                <SafeImage
                                                    src={resolveFileUrl(farmer.farmSelfie)}
                                                    alt="Farmer on farm"
                                                    className="w-full h-full object-cover"
                                                    fallbackLabel="Photo unavailable"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {selectedFarm?.farmPhotos && selectedFarm.farmPhotos.length > 0 && (
                                        <>
                                            {farmer.farmSelfie && (
                                                <p className="text-[11px] font-medium text-brand-muted mb-1.5">Additional Farm Photos</p>
                                            )}
                                            <div className="grid grid-cols-3 gap-2">
                                                {(showAllPhotos ? selectedFarm.farmPhotos : selectedFarm.farmPhotos.slice(0, 6)).map((url, idx) => (
                                                    <div key={idx} className="relative rounded-lg overflow-hidden border border-brand-border aspect-square">
                                                        <SafeImage
                                                            src={resolveFileUrl(url)}
                                                            alt={`Farm photo ${idx + 1}`}
                                                            className="w-full h-full object-cover"
                                                            fallbackLabel="Photo unavailable"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            {selectedFarm.farmPhotos.length > 6 && (
                                                <button
                                                    onClick={() => setShowAllPhotos(v => !v)}
                                                    className="mt-3 text-xs font-medium text-brand-green flex items-center gap-1 hover:text-brand-green-hover transition-colors"
                                                >
                                                    <ImageIcon className="h-3.5 w-3.5" />
                                                    {showAllPhotos ? 'Show Fewer Photos' : `View All Photos (${selectedFarm.farmPhotos.length})`}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </SectionCard>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* COMPLIANCE & RISK                                             */}
            {/* ============================================================ */}
            {activeTab === 'compliance' && (
                <div className="space-y-4">
                    {/* Assessment results — environmental/satellite indicators,
                        overlap & duplicate checks, and the compliance checklist.
                        Every indicator that depends on a risk assessment having
                        actually run now distinguishes "not assessed" from a
                        confirmed negative, instead of defaulting to a false "No". */}
                    <SectionCard title="Assessment Results" icon={<Satellite className="h-4 w-4 text-gray-400" />} badge={<RiskPill level={overallRiskLevel} />}>
                        <FarmContextLabel farm={selectedFarm} />
                        {loadingFarmData ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Environmental / satellite indicators */}
                                <div className="space-y-2 text-sm">
                                    <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide mb-1">Environmental Indicators</p>
                                    <div className="flex justify-between items-center"><span className="text-brand-muted">Protected Area</span><TriStateBadge state={latestAssessment ? triState(latestAssessment.overlapResult === 'Protected Area') : 'unknown'} /></div>
                                    <div className="flex justify-between items-center"><span className="text-brand-muted">Forest Overlap</span><TriStateBadge state={latestAssessment ? triState(latestAssessment.overlapResult === 'Forest') : 'unknown'} /></div>
                                    <div className="flex justify-between items-center"><span className="text-brand-muted">Deforestation Risk</span><TriStateBadge state={latestAssessment ? triState(latestAssessment.deforestationRisk) : 'unknown'} /></div>
                                    <div className="flex justify-between items-center"><span className="text-brand-muted">Legality Risk</span><TriStateBadge state={latestAssessment ? triState(latestAssessment.legalityRisk) : 'unknown'} /></div>
                                    <div className="flex justify-between items-center"><span className="text-brand-muted">Traceability Risk</span><TriStateBadge state={latestAssessment ? triState(latestAssessment.traceabilityRisk) : 'unknown'} /></div>
                                    <div className="flex justify-between items-center pt-2 border-t border-brand-border">
                                        <span className="text-brand-muted">Meets EUDR Requirement</span>
                                        <TriStateBadge state={latestAssessment ? triState(!latestAssessment.deforestationRisk && latestAssessment.overlapResult === 'None') : 'unknown'} positiveIsGood />
                                    </div>
                                </div>

                                {/* Overlap & duplicate checks — Duplicate Farmer/Duplicate Farm
                                    used to be hardcoded `value={false}` with no real data behind
                                    them, always showing a false-confident green "No". They now
                                    reflect real signals (shared phone number / farm-overlap flag)
                                    and show "Not checked"/"unknown" rather than a fabricated "No"
                                    when nothing has actually been verified. */}
                                <div className="space-y-2 text-sm">
                                    <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide mb-1">Overlap &amp; Duplicate Checks</p>
                                    <div className="flex justify-between items-center"><span className="text-brand-muted">Farm Overlap (satellite)</span><TriStateBadge state={latestAssessment ? triState(latestAssessment.overlapResult === 'Farm') : 'unknown'} /></div>
                                    <div className="flex justify-between items-center"><span className="text-brand-muted">Protected Area Conflict</span><TriStateBadge state={latestAssessment ? triState(latestAssessment.overlapResult === 'Protected Area') : 'unknown'} /></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-brand-muted">Possible Duplicate Farmer</span>
                                        {allFarmers.length === 0 ? <TriStateBadge state="unknown" unknownLabel="Not checked" /> : (
                                            hasSharedPhone
                                                ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600"><AlertTriangle className="h-3.5 w-3.5" /> Review — shared phone number</span>
                                                : <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> No shared phone number found</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center"><span className="text-brand-muted">Possible Duplicate / Overlapping Farm</span><TriStateBadge state={triState(selectedFarm?.overlapsExistingFarm)} /></div>
                                </div>

                                {/* Compliance checklist */}
                                <div className="space-y-2 text-sm">
                                    <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide mb-1">Compliance Checklist</p>
                                    <ChecklistRow label="GPS verified" state={geo.points.length > 0 ? 'ok' : 'issue'} />
                                    <ChecklistRow label="Polygon verified" state={selectedFarm?.location?.type === 'Polygon' ? 'ok' : 'issue'} />
                                    <ChecklistRow label="Photos verified" state={(!!farmer.farmSelfie || (!!selectedFarm?.farmPhotos && selectedFarm.farmPhotos.length > 0)) ? 'ok' : 'issue'} />
                                    <ChecklistRow label="Documents verified" state={(documents.length > 0 && documents.every(d => d.status === 'Valid')) ? 'ok' : 'issue'} />
                                    <ChecklistRow label="Farm legally owned" state={selectedFarm?.ownershipType ? 'ok' : 'issue'} />
                                    <ChecklistRow label="No forest overlap" state={!latestAssessment ? 'unknown' : (latestAssessment.overlapResult !== 'Forest' ? 'ok' : 'issue')} />
                                    <ChecklistRow label="No protected area overlap" state={!latestAssessment ? 'unknown' : (latestAssessment.overlapResult !== 'Protected Area' ? 'ok' : 'issue')} />
                                    <ChecklistRow label="Identity verified" state={farmer.identityStatus === 'Verified' ? 'ok' : 'issue'} />
                                </div>
                            </div>
                        )}

                        {/* Real Open Foris Whisp EUDR satellite indicators */}
                        {latestAssessment?.whispData && (
                            <div className="pt-4 mt-4 border-t border-brand-border space-y-2 text-sm">
                                <span className="text-xs font-semibold text-brand-muted uppercase tracking-wide">Whisp Satellite Analysis</span>
                                <div className="flex justify-between items-center">
                                    <span className="text-brand-muted">EUFO 2020 Overlap</span>
                                    <span className={`text-xs font-semibold ${latestAssessment.whispData.eufo2020Ha > 0 ? 'text-red-700' : 'text-brand-green'}`}>
                                        {latestAssessment.whispData.eufo2020Ha.toFixed(3)} ha
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(['riskPerennialCrop', 'riskAnnualCrop', 'riskTimber'] as const).map((k) => {
                                        const label = k === 'riskPerennialCrop' ? 'Perennial' : k === 'riskAnnualCrop' ? 'Annual' : 'Timber';
                                        const val = latestAssessment.whispData![k];
                                        const cls = val === 'high' ? 'bg-red-100 text-red-800' : val === 'low' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-brand-muted';
                                        return (
                                            <span key={k} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${cls}`}>
                                                {label}: {val}
                                            </span>
                                        );
                                    })}
                                </div>
                                {latestAssessment.whispData.annualEvents.length > 0 ? (
                                    <p className="text-[11px] text-red-600">
                                        Disturbance detected: {latestAssessment.whispData.annualEvents.map(e => e.year).join(', ')}
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-brand-green">No annual disturbance/loss detected</p>
                                )}
                                {latestAssessment.whispData.commodityOverlaps.length > 0 && (
                                    <p className="text-[11px] text-brand-muted">
                                        Commodity overlap: {latestAssessment.whispData.commodityOverlaps.map(c => `${c.commodity} ${c.overlapHa.toFixed(2)}ha`).join(', ')}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="pt-3 mt-3 border-t border-brand-border flex items-center justify-between text-sm">
                            <span className="font-medium text-brand-text">Overall Risk Level</span>
                            <RiskPill level={overallRiskLevel} />
                        </div>
                        {selectedFarm?.lastRiskAssessmentDate && (
                            <p className="text-[11px] text-gray-400 pt-1">Last assessed: {fmtDate(selectedFarm.lastRiskAssessmentDate)}</p>
                        )}
                    </SectionCard>

                    {/* Data completeness — deliberately a SEPARATE card from the
                        assessment results above: this is a record-completeness
                        metric, not a risk/compliance finding, and must never be
                        visually blended with the real assessment results. */}
                    <SectionCard title="Data Completeness" icon={<Info className="h-4 w-4 text-gray-400" />}>
                        <p className="text-xs text-brand-muted mb-3">
                            How complete this record's captured fields are — a data-quality metric only, distinct from the risk/compliance assessment above.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                            {[
                                { label: 'Farmer Information', v: quality.farmerInfo },
                                { label: 'Farm Information', v: quality.farmInfo },
                                { label: 'GPS & Polygon', v: quality.gps },
                                { label: 'Photos', v: quality.photos },
                                { label: 'Documents', v: quality.documents },
                            ].map((row, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between text-xs text-brand-muted mb-1"><span>{row.label}</span><span className="font-medium text-brand-text">{row.v}%</span></div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-brand-green rounded-full" style={{ width: `${row.v}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-3 mt-3 border-t border-brand-border flex items-center justify-between">
                            <span className="text-sm font-medium text-brand-text">Overall Completeness Score</span>
                            <span className="text-xl font-bold text-brand-green">{quality.overall}%</span>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* ============================================================ */}
            {/* ACTIVITY                                                      */}
            {/* ============================================================ */}
            {activeTab === 'activity' && (
                <SectionCard title="Activity History" icon={<HistoryIcon className="h-4 w-4 text-gray-400" />}>
                    {loadingAuditLog ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading audit history…</div>
                    ) : auditLogError ? (
                        <div className="text-sm text-red-600">{auditLogError}</div>
                    ) : auditLog.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No audit history recorded for this farmer yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {auditLog.map((row) => {
                                const isDecision = isVerificationDecision(row.action);
                                return (
                                    <li key={row.id} className={`border-l-2 pl-3 py-0.5 ${isDecision ? 'border-brand-green' : 'border-slate-300'}`}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-medium text-brand-text">{AUDIT_ACTION_LABELS[row.action] || row.action}</span>
                                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${isDecision ? 'bg-brand-green/10 text-brand-green' : 'bg-slate-100 text-slate-500'}`}>
                                                {isDecision ? 'Verification Decision' : 'Correction'}
                                            </span>
                                        </div>
                                        {row.fieldName && (row.previousValue != null || row.newValue != null) && (
                                            <p className="text-xs text-brand-muted mt-0.5">
                                                <span className="font-mono">{row.fieldName}</span>: "{row.previousValue || '\u2014'}" &rarr; "{row.newValue || '\u2014'}"
                                            </p>
                                        )}
                                        {row.notes && <p className="text-xs text-brand-muted mt-0.5">{row.notes}</p>}
                                        <p className="text-[11px] text-gray-400 mt-0.5">{row.performedByName || 'Unknown user'} &middot; {fmtDateTime(row.createdAt)}</p>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </SectionCard>
            )}

            {/* Footer bar — metadata only; Deactivate/Reactivate lives solely
                in the header's routine-actions dropdown above (no longer
                duplicated here). */}
            <div className="bg-brand-card rounded-xl border border-brand-border shadow-card px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-brand-muted">
                <div>
                    Created by {farmer.enumeratorName || 'N/A'}{farmer.enumeratorId ? ` (${farmer.enumeratorId})` : ''}
                    <br />
                    Created on {fmtDateTime(farmer.createdAt)}
                </div>
                <span>Last Updated {fmtDateTime(farmer.updatedAt)}</span>
            </div>
        </div>
    );
};

/** Small, reusable farm `<select>` — used by both the Farms & Maps tab's
 * explicit selector and the farm-scoped panels in other tabs (Documents). */
const FarmSelector: React.FC<{ farms: Farm[]; selectedFarmId: string | null; onChange: (id: string) => void }> = ({ farms, selectedFarmId, onChange }) => (
    <div className="relative inline-block">
        <select
            value={selectedFarmId ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="appearance-none border border-brand-border rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-brand-text bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        >
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <ChevronDown className="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
);

export default FarmerProfile;

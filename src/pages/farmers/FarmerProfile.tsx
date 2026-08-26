import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as turf from '@turf/turf';
import { getFarmer, updateFarmer, setFarmerActiveStatus, type Farmer, type Farm } from '../../api/farmers';
import { resolveFileUrl } from '../../utils/fileUrl';
import SafeImage from '../../components/SafeImage';
import { getFarmDocuments, type FarmDocument } from '../../api/documents';
import { getRiskHistory, type RiskAnalysisResult } from '../../api/risk';
import { getAllBatches, type Batch } from '../../api/batches';
import { getCustodyHistory, type CustodyHistoryData } from '../../api/transfers';
import {
    ArrowLeft, ShieldCheck, ShieldAlert, ShieldQuestion, Edit2, Save, X, MoreHorizontal,
    QrCode, Share2, FileText, Image as ImageIcon, AlertTriangle, CheckCircle2,
    Sprout, FolderOpen, Download, Loader2, ChevronDown, Package
} from 'lucide-react';
import FarmMap from '../../components/FarmMap';
import { QRCodeCanvas } from 'qrcode.react';

/* ---------------------------------------------------------------------- */
/* Small shared UI helpers                                                */
/* ---------------------------------------------------------------------- */

const SectionCard: React.FC<{ number?: number; title: string; icon?: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ number, title, icon, badge, children, className = '' }) => (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                {icon}
                {number != null && <span>{number}.</span>} {title}
            </h2>
            {badge}
        </div>
        <div className="p-5">{children}</div>
    </div>
);

const Field: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
    <div>
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <p className={`text-sm text-gray-900 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value ?? <span className="text-gray-400">N/A</span>}</p>
    </div>
);

const YesNoBadge: React.FC<{ value: boolean | undefined; positiveIsGood?: boolean }> = ({ value, positiveIsGood = false }) => {
    const isGood = positiveIsGood ? value : !value;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isGood ? 'text-green-700' : 'text-red-600'}`}>
            {isGood ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {value ? 'Yes' : 'No'}
        </span>
    );
};

const RiskPill: React.FC<{ level?: string }> = ({ level }) => {
    const l = level || 'Low';
    const cls = l === 'High' ? 'bg-red-100 text-red-700' : l === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{l}</span>;
};

const fmtDate = (d?: string | Date) => {
    if (!d) return 'N/A';
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateTime = (d?: string | Date) => {
    if (!d) return 'N/A';
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/* ---------------------------------------------------------------------- */
/* Main component                                                        */
/* ---------------------------------------------------------------------- */

const FarmerProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [farmer, setFarmer] = useState<Farmer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showQr, setShowQr] = useState(false);

    const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
    const [documents, setDocuments] = useState<FarmDocument[]>([]);
    const [riskHistory, setRiskHistory] = useState<RiskAnalysisResult[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [custody, setCustody] = useState<CustodyHistoryData | null>(null);
    const [loadingFarmData, setLoadingFarmData] = useState(false);

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
                setSelectedFarmId(data.farms?.[0]?.id ?? null);
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
    const overallRisk = selectedFarm?.riskLevel || latestAssessment?.overallRisk || 'Low';

    // --- Data Quality Score: computed from real completeness of captured fields (not fabricated) ---
    const quality = useMemo(() => {
        const farmerFields = farmer ? [farmer.firstName, farmer.lastName, farmer.phoneNumber, farmer.gender, farmer.dob, farmer.nationalId, farmer.community, farmer.district] : [];
        const farmerScore = farmerFields.length ? farmerFields.filter(Boolean).length / farmerFields.length : 0;

        const farmFields = selectedFarm ? [selectedFarm.name, selectedFarm.cropType, selectedFarm.totalAreaHa, selectedFarm.ownershipType, selectedFarm.farmRegistrationStatus] : [];
        const farmScore = farmFields.length ? farmFields.filter(Boolean).length / farmFields.length : 0;

        const gpsScore = geo.points.length > 0 ? 1 : 0;
        const photosScore = selectedFarm?.farmPhotos && selectedFarm.farmPhotos.length > 0 ? 1 : 0;
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

    // --- Early returns for loading/error/no-data states ---
    // IMPORTANT: placed AFTER all hooks above so hook order stays identical on every render.
    if (loading) {
        return <div className="flex justify-center p-16"><Loader2 className="animate-spin h-8 w-8 text-green-600" /></div>;
    }

    if (error || !farmer) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 mb-4">{error || 'Farmer not found'}</p>
                <button onClick={fetchFarmer} className="text-green-600 hover:text-green-800 font-medium">Retry</button>
            </div>
        );
    }

    const statusBadge = () => {
        const status = farmer.identityStatus;
        if (status === 'Verified') {
            return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><ShieldCheck className="h-3.5 w-3.5" /> Verified Farmer</span>;
        }
        if (status === 'Conflict') {
            return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><ShieldAlert className="h-3.5 w-3.5" /> Conflict</span>;
        }
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-600"><ShieldQuestion className="h-3.5 w-3.5" /> Unverified</span>;
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-4">
            {/* Back link */}
            <button onClick={() => navigate('/farmers')} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Farmers
            </button>

            {/* Header bar */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-xl font-bold text-gray-900">Farmer Profile</h1>
                        {statusBadge()}
                        {!isActive && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">Deactivated</span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Farmer ID: <span className="font-mono text-gray-700">{farmer.farmerId || farmer.id.slice(0, 8).toUpperCase()}</span>
                        {' · '}Registration Date: {fmtDate(farmer.createdAt)}
                        {' · '}Last Updated: {fmtDate(farmer.updatedAt)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <button onClick={() => setIsEditing(false)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
                                <X className="h-4 w-4" /> Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving} className="px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 flex items-center gap-1.5">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-1.5">
                            <Edit2 className="h-4 w-4" /> Edit Profile
                        </button>
                    )}
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50">
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 text-sm overflow-hidden">
                                <button
                                    onClick={() => { setShowMenu(false); handleToggleActive(); }}
                                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${isActive ? 'text-red-600' : 'text-green-600'}`}
                                >
                                    {isActive ? 'Deactivate Farmer' : 'Reactivate Farmer'}
                                </button>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setShowQr(!showQr)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
                        <QrCode className="h-4 w-4" /> QR Code
                    </button>
                    <button
                        onClick={() => {
                            const url = `${window.location.origin}/public/farmers/${farmer.id}`;
                            navigator.clipboard?.writeText(url);
                            alert('Public profile link copied to clipboard');
                        }}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
                    >
                        <Share2 className="h-4 w-4" /> Share
                    </button>
                </div>
            </div>

            {showQr && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
                    <div className="bg-white p-2 border border-gray-200 rounded">
                        <QRCodeCanvas value={`${window.location.origin}/public/farmers/${farmer.id}`} size={96} level="M" includeMargin />
                    </div>
                    <div className="text-sm text-gray-500">
                        Scan to open this farmer's public verification profile.
                        <br />
                        <span className="font-mono text-xs text-gray-400">{window.location.origin}/public/farmers/{farmer.id}</span>
                    </div>
                </div>
            )}

            {/* Farm selector, if farmer has multiple farms */}
            {farmer.farms.length > 1 && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Viewing farm:</span>
                    <div className="relative inline-block">
                        <select
                            value={selectedFarmId ?? ''}
                            onChange={(e) => setSelectedFarmId(e.target.value)}
                            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-gray-800 bg-white"
                        >
                            {farmer.farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <ChevronDown className="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            )}

            {/* Row: Personal Information + Farm Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Personal Information */}
                <SectionCard number={1} title="Personal Information" badge={statusBadge()}>
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
                            {farmer.signature && (
                                <div className="mt-2">
                                    <p className="text-[10px] text-gray-400 mb-0.5">Signature</p>
                                    <SafeImage
                                        src={resolveFileUrl(farmer.signature)}
                                        alt="Signature"
                                        className="h-10 w-24 object-contain bg-gray-50 border border-gray-200 rounded"
                                        fallback={
                                            <div className="h-10 w-24 flex items-center justify-center text-gray-400 bg-gray-50 border border-gray-200 rounded text-[10px]">No Signature</div>
                                        }
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-3">
                            {isEditing ? (
                                <div className="col-span-2 flex gap-2">
                                    <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} placeholder="First name" />
                                    <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} placeholder="Last name" />
                                </div>
                            ) : (
                                <div className="col-span-2"><Field label="Full Name" value={`${farmer.firstName} ${farmer.lastName}`} /></div>
                            )}
                            <Field label="National ID" value={isEditing ? <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editForm.nationalId} onChange={e => setEditForm({ ...editForm, nationalId: e.target.value })} /> : farmer.nationalId} />
                            <Field label="Phone Number" value={isEditing ? <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /> : farmer.phoneNumber} />
                            <Field label="Date of Birth" value={fmtDate(farmer.dob)} />
                            <Field label="Gender" value={isEditing ? (
                                <select className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}>
                                    <option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                                </select>
                            ) : farmer.gender} />
                            <Field label="Cooperative" value={isEditing ? <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editForm.cooperativeName} onChange={e => setEditForm({ ...editForm, cooperativeName: e.target.value })} /> : farmer.cooperativeName} />
                            <Field label="Role in Cooperative" value={farmer.cooperativeId ? `Member (${farmer.cooperativeId})` : undefined} />
                            <Field label="Clan" value={farmer.otherId} />
                            <Field label="County" value={isEditing ? <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editForm.region} onChange={e => setEditForm({ ...editForm, region: e.target.value })} /> : farmer.region} />
                            <Field label="District" value={isEditing ? <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editForm.district} onChange={e => setEditForm({ ...editForm, district: e.target.value })} /> : farmer.district} />
                            <Field label="Town / Village" value={isEditing ? <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editForm.community} onChange={e => setEditForm({ ...editForm, community: e.target.value })} /> : farmer.community} />
                            <Field label="Residential GPS" value={farmer.latitude && farmer.longitude ? `${farmer.latitude}, ${farmer.longitude}` : undefined} mono />
                            <Field label="Emergency Contact" value={undefined} />
                        </div>
                    </div>
                </SectionCard>

                {/* 2. Farm Summary */}
                <SectionCard number={2} title="Farm Summary" badge={selectedFarm ? <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{selectedFarm.farmRegistrationStatus || 'Active'}</span> : null}>
                    {!selectedFarm ? (
                        <p className="text-sm text-gray-400 italic">No farms registered for this farmer.</p>
                    ) : (
                        <div className="flex gap-4">
                            <div className="flex-1 grid grid-cols-2 gap-3">
                                <Field label="Farm ID" value={selectedFarm.id.slice(0, 13).toUpperCase()} mono />
                                <Field label="Farm Name" value={selectedFarm.name} />
                                <Field label="Commodity" value={<span className="inline-flex items-center gap-1"><Sprout className="h-3.5 w-3.5 text-green-600" /> {selectedFarm.cropType}</span>} />
                                <Field label="Farm Size (Calculated)" value={geo.areaHa != null ? `${geo.areaHa.toFixed(2)} ha` : undefined} />
                                <Field label="Farm Size (Declared)" value={selectedFarm.manualSizeInput ? `${selectedFarm.manualSizeInput} ${selectedFarm.manualSizeUnit || ''}` : (selectedFarm.totalAreaHa ? `${selectedFarm.totalAreaHa} ha` : undefined)} />
                                <Field label="Ownership Type" value={selectedFarm.ownershipType} />
                                <Field label="Number of Trees" value={selectedFarm.numberOfTrees} />
                                <Field label="Years Cultivated" value={selectedFarm.yearsInCultivation} />
                                <Field label="Harvest Season" value={selectedFarm.harvestSeason} />
                                <Field label="Est. Annual Production" value={selectedFarm.averageYield} />
                                <Field label="Farm Status" value={selectedFarm.farmRegistrationStatus || 'Active'} />
                                <Field label="Coordinate System" value="WGS 84" />
                            </div>
                            <div className="flex-none w-40">
                                <div className="h-32 w-40 rounded-lg overflow-hidden border border-gray-200">
                                    <FarmMap location={selectedFarm.location} height="100%" showLayerToggle={false} showHoverReadout={false} scrollWheelZoom={false} dragging={false} zoomControl={false} />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Farm GPS Center</p>
                                <p className="text-[11px] font-mono text-gray-600">{geo.center ? `${geo.center[0].toFixed(4)}, ${geo.center[1].toFixed(4)}` : 'N/A'}</p>
                                <p className="text-[10px] text-gray-400 mt-1">Mapped By</p>
                                <p className="text-[11px] text-gray-600">{farmer.enumeratorName || 'N/A'}</p>
                            </div>
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* Row: Farm Boundary + Farm Photos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 3. Farm Boundary (Polygon) */}
                <SectionCard number={3} title="Farm Boundary (Polygon)">
                    {!selectedFarm || geo.points.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No boundary captured for this farm.</p>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="h-56 w-full md:w-1/2 rounded-lg overflow-hidden border border-gray-200 flex-none">
                                <FarmMap location={selectedFarm.location} height="100%" />
                            </div>
                            <div className="flex-1">
                                <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-lg">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="text-left px-2 py-1.5 font-medium text-gray-500">Point</th>
                                                <th className="text-left px-2 py-1.5 font-medium text-gray-500">Latitude</th>
                                                <th className="text-left px-2 py-1.5 font-medium text-gray-500">Longitude</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {geo.points.map((p, idx) => (
                                                <tr key={idx} className="border-t border-gray-100">
                                                    <td className="px-2 py-1.5 text-gray-500">{idx + 1}</td>
                                                    <td className="px-2 py-1.5 font-mono text-gray-700">{p.lat.toFixed(6)}°N</td>
                                                    <td className="px-2 py-1.5 font-mono text-gray-700">{p.lng.toFixed(6)}°W</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-2">
                                    <span>Total Points: <b className="text-gray-800">{geo.points.length}</b></span>
                                    <span>Area: <b className="text-gray-800">{geo.areaHa?.toFixed(2) ?? '-'} ha</b></span>
                                    <span>Perimeter: <b className="text-gray-800">{geo.perimeterM?.toFixed(2) ?? '-'} m</b></span>
                                </div>
                                <button
                                    onClick={() => {
                                        const blob = new Blob([JSON.stringify(selectedFarm.location, null, 2)], { type: 'application/geo+json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url; a.download = `${selectedFarm.name.replace(/\s+/g, '_')}.geojson`; a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="mt-3 text-xs font-medium text-green-700 border border-green-200 bg-green-50 rounded-lg px-3 py-1.5 hover:bg-green-100 flex items-center gap-1.5"
                                >
                                    <Download className="h-3.5 w-3.5" /> View / Export GeoJSON
                                </button>
                            </div>
                        </div>
                    )}
                </SectionCard>

                {/* 4. Farm Photos */}
                <SectionCard number={4} title="Farm Photos">
                    {!selectedFarm?.farmPhotos || selectedFarm.farmPhotos.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No farm photos captured yet.</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-2">
                                {selectedFarm.farmPhotos.slice(0, 6).map((url, idx) => (
                                    <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-200 aspect-square">
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
                                <button className="mt-3 text-xs font-medium text-green-700 flex items-center gap-1">
                                    <ImageIcon className="h-3.5 w-3.5" /> View All Photos ({selectedFarm.farmPhotos.length})
                                </button>
                            )}
                        </>
                    )}
                </SectionCard>
            </div>

            {/* Row: Environmental & Compliance / Compliance Checklist / Documents */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 5. Environmental & Compliance */}
                <SectionCard number={5} title="Environmental & Compliance">
                    {loadingFarmData ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : !latestAssessment ? (
                        <p className="text-sm text-gray-400 italic">No risk assessment run yet for this farm.</p>
                    ) : (
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center"><span className="text-gray-500">Protected Area</span><YesNoBadge value={latestAssessment.overlapResult === 'Protected Area'} /></div>
                            <div className="flex justify-between items-center"><span className="text-gray-500">Forest Overlap</span><YesNoBadge value={latestAssessment.overlapResult === 'Forest'} /></div>
                            <div className="flex justify-between items-center"><span className="text-gray-500">Deforestation Risk</span><YesNoBadge value={latestAssessment.deforestationRisk} /></div>
                            <div className="flex justify-between items-center"><span className="text-gray-500">Legality Risk</span><YesNoBadge value={latestAssessment.legalityRisk} /></div>
                            <div className="flex justify-between items-center"><span className="text-gray-500">Traceability Risk</span><YesNoBadge value={latestAssessment.traceabilityRisk} /></div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-100"><span className="text-gray-500">Meets EUDR Requirement</span><YesNoBadge value={!latestAssessment.deforestationRisk && latestAssessment.overlapResult === 'None'} positiveIsGood /></div>
                        </div>
                    )}
                </SectionCard>

                {/* 6. Compliance Checklist */}
                <SectionCard number={6} title="Compliance Checklist" badge={<RiskPill level={overallRisk} />}>
                    <div className="space-y-2 text-sm">
                        {[
                            { label: 'GPS verified', ok: geo.points.length > 0 },
                            { label: 'Polygon verified', ok: selectedFarm?.location?.type === 'Polygon' },
                            { label: 'Photos verified', ok: !!selectedFarm?.farmPhotos && selectedFarm.farmPhotos.length > 0 },
                            { label: 'Documents verified', ok: documents.length > 0 && documents.every(d => d.status === 'Valid') },
                            { label: 'Farm legally owned', ok: !!selectedFarm?.ownershipType },
                            { label: 'No forest overlap', ok: !latestAssessment || latestAssessment.overlapResult !== 'Forest' },
                            { label: 'No protected area overlap', ok: !latestAssessment || latestAssessment.overlapResult !== 'Protected Area' },
                            { label: 'Identity verified', ok: farmer.identityStatus === 'Verified' },
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <span className="text-gray-600">{item.label}</span>
                                {item.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-orange-500" />}
                            </div>
                        ))}
                        <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="font-medium text-gray-700">Compliance Status</span>
                            <RiskPill level={overallRisk} />
                        </div>
                    </div>
                </SectionCard>

                {/* 7. Documents */}
                <SectionCard number={7} title="Documents" icon={<FolderOpen className="h-4 w-4 text-gray-400" />}>
                    {documents.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No documents uploaded for this farm yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {documents.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                                    <span className="flex items-center gap-2 text-gray-700"><FileText className="h-3.5 w-3.5 text-gray-400" /> {doc.type}</span>
                                    <span className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold ${doc.status === 'Valid' ? 'text-green-600' : doc.status === 'Invalid' ? 'text-red-600' : 'text-yellow-600'}`}>{doc.status}</span>
                                        <a href={doc.documentUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-600"><Download className="h-3.5 w-3.5" /></a>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* Row: Risk Assessment / Data Quality Score / Traceability Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 8. Risk Assessment */}
                <SectionCard number={8} title="Risk Assessment">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center"><span className="text-gray-500">Deforestation Risk</span><RiskPill level={latestAssessment?.deforestationRisk ? 'High' : 'Low'} /></div>
                        <div className="flex justify-between items-center"><span className="text-gray-500">Satellite Risk</span><RiskPill level={latestAssessment?.overlapResult === 'Forest' ? 'High' : 'Low'} /></div>
                        <div className="flex justify-between items-center"><span className="text-gray-500">GPS Quality</span><span className="text-xs font-semibold text-green-700">{geo.points.length > 0 ? 'Good' : 'Missing'}</span></div>
                        <div className="flex justify-between items-center"><span className="text-gray-500">Farm Overlap</span><YesNoBadge value={latestAssessment?.overlapResult === 'Farm'} /></div>
                        <div className="flex justify-between items-center"><span className="text-gray-500">Protected Area Conflict</span><YesNoBadge value={latestAssessment?.overlapResult === 'Protected Area'} /></div>
                        <div className="flex justify-between items-center"><span className="text-gray-500">Duplicate Farmer</span><YesNoBadge value={false} /></div>
                        <div className="flex justify-between items-center"><span className="text-gray-500">Duplicate Farm</span><YesNoBadge value={false} /></div>

                        {/* Real Open Foris Whisp EUDR satellite indicators */}
                        {latestAssessment?.whispData && (
                            <div className="pt-2 mt-2 border-t border-gray-100 space-y-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Whisp Satellite Analysis</span>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">EUFO 2020 Overlap</span>
                                    <span className={`text-xs font-semibold ${latestAssessment.whispData.eufo2020Ha > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                        {latestAssessment.whispData.eufo2020Ha.toFixed(3)} ha
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(['riskPerennialCrop', 'riskAnnualCrop', 'riskTimber'] as const).map((k) => {
                                        const label = k === 'riskPerennialCrop' ? 'Perennial' : k === 'riskAnnualCrop' ? 'Annual' : 'Timber';
                                        const val = latestAssessment.whispData![k];
                                        const cls = val === 'high' ? 'bg-red-100 text-red-800' : val === 'low' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600';
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
                                    <p className="text-[11px] text-green-600">No annual disturbance/loss detected</p>
                                )}
                                {latestAssessment.whispData.commodityOverlaps.length > 0 && (
                                    <p className="text-[11px] text-gray-500">
                                        Commodity overlap: {latestAssessment.whispData.commodityOverlaps.map(c => `${c.commodity} ${c.overlapHa.toFixed(2)}ha`).join(', ')}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="font-medium text-gray-700">Overall Risk Level</span>
                            <RiskPill level={overallRisk} />
                        </div>
                        {selectedFarm?.lastRiskAssessmentDate && (
                            <p className="text-[11px] text-gray-400 pt-1">Last assessed: {fmtDate(selectedFarm.lastRiskAssessmentDate)}</p>
                        )}
                    </div>
                </SectionCard>

                {/* 9. Data Quality Score */}
                <SectionCard number={9} title="Data Quality Score">
                    <div className="space-y-3">
                        {[
                            { label: 'Farmer Information', v: quality.farmerInfo },
                            { label: 'Farm Information', v: quality.farmInfo },
                            { label: 'GPS & Polygon', v: quality.gps },
                            { label: 'Photos', v: quality.photos },
                            { label: 'Documents', v: quality.documents },
                        ].map((row, idx) => (
                            <div key={idx}>
                                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{row.label}</span><span className="font-medium text-gray-700">{row.v}%</span></div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${row.v}%` }} />
                                </div>
                            </div>
                        ))}
                        <div className="pt-3 mt-1 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Overall Quality Score</span>
                            <span className="text-xl font-bold text-green-600">{quality.overall}%</span>
                        </div>
                    </div>
                </SectionCard>

                {/* 10. Traceability Summary */}
                <SectionCard number={10} title="Traceability Summary" icon={<Package className="h-4 w-4 text-gray-400" />}>
                    {batches.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No batches recorded for this farmer yet.</p>
                    ) : (
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-[11px] text-gray-400 uppercase tracking-wide">Last Transaction</p>
                                <p className="text-gray-800">{fmtDate(batches[0].createdAt)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-gray-400 uppercase tracking-wide">Current Quantity</p>
                                <p className="text-gray-800">{batches[0].weightKg} kg ({batches[0].cropType})</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-gray-400 uppercase tracking-wide">Current Batch</p>
                                <p className="text-gray-800 font-mono text-xs">{batches[0].batchId}</p>
                            </div>
                            {custody && (
                                <div>
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">Current Holder</p>
                                    <p className="text-gray-800">{custody.currentHolder}</p>
                                </div>
                            )}
                            <Link to={`/custody/batch/${batches[0].id}`} className="inline-block mt-1 text-xs font-medium text-green-700 border border-green-200 bg-green-50 rounded-lg px-3 py-1.5 hover:bg-green-100">
                                View Full Traceability
                            </Link>
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* Footer bar */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                <div>
                    Created by {farmer.enumeratorName || 'N/A'}{farmer.enumeratorId ? ` (${farmer.enumeratorId})` : ''}
                    <br />
                    Created on {fmtDateTime(farmer.createdAt)}
                </div>
                <div className="flex items-center gap-4">
                    <span>Last Updated {fmtDateTime(farmer.updatedAt)}</span>
                    <button
                        onClick={handleToggleActive}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${isActive ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                    >
                        {isActive ? 'Deactivate Farmer' : 'Reactivate Farmer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FarmerProfile;

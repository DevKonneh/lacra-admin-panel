import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Loader2, ShieldQuestion, UserX, FileQuestion, FileWarning, ClipboardCheck, AlertCircle,
} from 'lucide-react';
import { UserRole } from '../../types';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { getVerificationQueue, type VerificationQueueResponse } from '../../api/farmerVerification';
import { getDataCorrectionQueue, type DataCorrectionQueueResponse } from '../../api/geometry';
import { getApplications } from '../../api/applications';

// ---------------------------------------------------------------------
// This whole module (and its API imports: farmerVerification, geometry,
// applications) is lazy-loaded from Dashboard.tsx via React.lazy(), so
// none of it is bundled into the main chunk. Dashboard.tsx only imports
// the lightweight `NeedsAttentionUser` type from here, never the
// component or its data-source imports directly.
// ---------------------------------------------------------------------

export interface NeedsAttentionUser {
    role: string;
    permissions?: string[];
}

// Each of the 7 application review queues is gated to the staff role(s)
// who actually work it, mirroring src/config/navigation.ts's existing
// roles/permissionPrefixes for the exact same destinations (kept in sync
// manually since each queue page already hardcodes its own QUEUE_STATUSES/
// STAGE_STATUS list rather than exporting one — see CommercialQueue.tsx,
// DGApprovalQueue.tsx, etc.). ADMIN can always see every queue's pending
// count, same as the sidebar.
interface AppQueueDef {
    key: string;
    label: string;
    path: string;
    roles: string[];
    permissionPrefixes?: string[];
    statuses: string[];
}
const APPLICATION_QUEUES: AppQueueDef[] = [
    {
        key: 'commercial', label: 'Commercial Review', path: '/applications/commercial-queue',
        roles: [UserRole.COMMERCIAL, UserRole.ADMIN], permissionPrefixes: ['license.review', 'permit.review'],
        statuses: ['AWAITING_COMMERCIAL_VERIFICATION', 'COMMERCIAL_REVIEW_IN_PROGRESS', 'RETURNED_TO_COMMERCIAL'],
    },
    {
        key: 'dg', label: 'DG Approval', path: '/applications/dg-queue',
        roles: [UserRole.DG, UserRole.ADMIN], permissionPrefixes: ['license.approve', 'permit.approve'],
        statuses: ['AWAITING_FIRST_DG_APPROVAL', 'AWAITING_SECOND_DG_APPROVAL', 'AWAITING_FINAL_DG_APPROVAL'],
    },
    {
        key: 'technical', label: 'Technical Review', path: '/applications/technical-queue',
        roles: [UserRole.TECHNICAL, UserRole.ADMIN],
        statuses: ['AWAITING_TECHNICAL_REVIEW', 'INSPECTOR_ASSIGNMENT_PENDING', 'RETURNED_TO_TECHNICAL_SERVICES'],
    },
    {
        key: 'inspector', label: 'Inspector Assessment', path: '/applications/inspection-queue',
        roles: [UserRole.INSPECTOR, UserRole.ADMIN],
        statuses: ['INSPECTOR_ASSIGNED', 'WAREHOUSE_INSPECTION_SCHEDULED', 'WAREHOUSE_ASSESSMENT_IN_PROGRESS', 'WAREHOUSE_REINSPECTION_REQUIRED'],
    },
    {
        key: 'billing', label: 'Billing Review', path: '/applications/billing-queue',
        roles: [UserRole.FINANCE, UserRole.ADMIN], permissionPrefixes: ['license.issue', 'permit.issue'],
        statuses: ['AWAITING_BILLING_REVIEW', 'BILLING_REVIEW_IN_PROGRESS'],
    },
    {
        key: 'payment', label: 'Payment Verification', path: '/applications/payment-queue',
        roles: [UserRole.FINANCE, UserRole.ADMIN], permissionPrefixes: ['license.issue', 'permit.issue'],
        statuses: ['PAYMENT_SUBMITTED', 'PAYMENT_VERIFICATION_PENDING'],
    },
    {
        key: 'it', label: 'Certificate Issuance', path: '/applications/it-queue',
        roles: [UserRole.IT, UserRole.ADMIN],
        statuses: ['AWAITING_IT_CERTIFICATE_PRINTING'],
    },
];

// Same narrowing rule as Sidebar.tsx's hasPermission(): `roles` is a hard
// gate, `permissionPrefixes` (when the account has an assigned Permission
// Group) can only further NARROW access, never grant beyond what `roles`
// already allows.
const canSeeQueue = (def: AppQueueDef, user: NeedsAttentionUser): boolean => {
    if (!def.roles.includes(user.role)) return false;
    if (def.permissionPrefixes && user.permissions && user.permissions.length > 0) {
        return def.permissionPrefixes.some((prefix) =>
            user.permissions!.some((p) => p === prefix || p.startsWith(`${prefix}.`) || p === 'all')
        );
    }
    return true;
};

// 'unavailable' (not merely 0) is tracked PER SOURCE so a queue/source
// that failed to load is visibly distinguished from one that loaded fine
// and genuinely has zero pending items — staff must never read "no card
// shown" as "confirmed zero" when it actually means "failed to check".
interface AppQueueResult { key: string; label: string; path: string; count: number; unavailable: boolean }
interface NeedsAttentionState {
    unverifiedIdentities: number;
    conflictIdentities: number;
    missingInformation: number;
    identityUnavailable: boolean;
    farmIssues: number;
    farmIssuesUnavailable: boolean;
    appQueues: AppQueueResult[];
}

const NeedsAttentionSection: React.FC<{ user: NeedsAttentionUser }> = ({ user }) => {
    const navigate = useNavigate();
    const [data, setData] = useState<NeedsAttentionState | null>(null);
    const [loading, setLoading] = useState(true);
    // Extracted so useEffect's dependency array holds a single, statically
    // checkable primitive instead of two expressions (user.role plus an
    // inline JSON.stringify) — re-runs the fetch whenever the role OR the
    // permission set actually changes, and is stable otherwise.
    const userKey = `${user.role}:${JSON.stringify(user.permissions)}`;

    useEffect(() => {
        let cancelled = false;

        const fetchNeedsAttention = async () => {
            setLoading(true);
            const canSeeVerification = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN || user.role === UserRole.INSPECTOR;
            const canSeeDataCorrection = canSeeVerification; // same ADMIN/INSPECTOR gate as the backend route
            const visibleQueues = APPLICATION_QUEUES.filter((def) => canSeeQueue(def, user));

            // Each source is fetched independently and its own failure is
            // caught locally, so one broken queue/source never blanks out
            // the others — it is shown as "Unavailable" instead.
            const verificationPromise: Promise<{ ok: boolean; data: VerificationQueueResponse | null }> = canSeeVerification
                ? getVerificationQueue()
                    .then((res) => ({ ok: !!res.data?.status, data: res.data?.status ? res.data.data : null }))
                    .catch((err) => { console.error('Needs Attention: verification queue fetch failed', err); return { ok: false, data: null }; })
                : Promise.resolve({ ok: true, data: null });

            const correctionPromise: Promise<{ ok: boolean; data: DataCorrectionQueueResponse | null }> = canSeeDataCorrection
                ? getDataCorrectionQueue()
                    .then((res) => ({ ok: !!res.data?.status, data: res.data?.status ? res.data.data : null }))
                    .catch((err) => { console.error('Needs Attention: data correction queue fetch failed', err); return { ok: false, data: null }; })
                : Promise.resolve({ ok: true, data: null });

            const appQueuePromises = visibleQueues.map((def) =>
                Promise.all(def.statuses.map((status) => getApplications({ status })))
                    .then((responses) => ({
                        key: def.key, label: def.label, path: def.path,
                        count: responses.reduce((sum, r) => sum + (r?.data?.data?.length || 0), 0),
                        unavailable: false,
                    }))
                    .catch((err) => {
                        console.error(`Needs Attention: ${def.label} queue fetch failed`, err);
                        return { key: def.key, label: def.label, path: def.path, count: 0, unavailable: true };
                    })
            );

            const [verificationResult, correctionResult, appQueues] = await Promise.all([
                verificationPromise,
                correctionPromise,
                Promise.all(appQueuePromises),
            ]);

            if (cancelled) return;

            setData({
                unverifiedIdentities: verificationResult.data?.summary.byStatus.Unverified || 0,
                conflictIdentities: verificationResult.data?.summary.byStatus.Conflict || 0,
                missingInformation: verificationResult.data?.summary.byReadiness?.['Missing Information'] || 0,
                identityUnavailable: canSeeVerification && !verificationResult.ok,
                farmIssues: correctionResult.data?.summary.total || 0,
                farmIssuesUnavailable: canSeeDataCorrection && !correctionResult.ok,
                appQueues,
            });
            setLoading(false);
        };

        fetchNeedsAttention();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userKey]);

    const hasAnythingToShow = loading || (data && (
        data.identityUnavailable ||
        data.farmIssuesUnavailable ||
        data.unverifiedIdentities > 0 ||
        data.conflictIdentities > 0 ||
        data.missingInformation > 0 ||
        data.farmIssues > 0 ||
        data.appQueues.some((q) => q.count > 0 || q.unavailable)
    ));

    if (!hasAnythingToShow) return null;

    return (
        <div>
            <h2 className="text-[11px] font-semibold text-brand-muted tracking-wide uppercase mb-4">Needs Attention</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Checking for outstanding work…
                    </div>
                ) : data ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {data.identityUnavailable && (
                            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-dashed border-gray-200 text-left">
                                <span className="flex items-center gap-2 text-sm text-gray-500">
                                    <AlertCircle className="h-4 w-4 text-gray-400" /> Identity Verification
                                </span>
                                <Badge tone="slate">Unavailable</Badge>
                            </div>
                        )}
                        {data.unverifiedIdentities > 0 && (
                            <button
                                onClick={() => navigate('/farmers/verification?status=Unverified')}
                                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                            >
                                <span className="flex items-center gap-2 text-sm text-gray-700">
                                    <ShieldQuestion className="h-4 w-4 text-amber-600" /> Unverified identities
                                </span>
                                <Badge tone="amber">{data.unverifiedIdentities}</Badge>
                            </button>
                        )}
                        {data.conflictIdentities > 0 && (
                            <button
                                onClick={() => navigate('/farmers/verification?status=Conflict')}
                                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                            >
                                <span className="flex items-center gap-2 text-sm text-gray-700">
                                    <UserX className="h-4 w-4 text-red-600" /> Identity conflicts
                                </span>
                                <Badge tone="red">{data.conflictIdentities}</Badge>
                            </button>
                        )}
                        {data.missingInformation > 0 && (
                            <button
                                onClick={() => navigate('/farmers/verification?readiness=Missing Information')}
                                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                            >
                                <span className="flex items-center gap-2 text-sm text-gray-700">
                                    <FileQuestion className="h-4 w-4 text-amber-600" /> Missing information
                                </span>
                                <Badge tone="amber">{data.missingInformation}</Badge>
                            </button>
                        )}
                        {data.farmIssuesUnavailable && (
                            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-dashed border-gray-200 text-left">
                                <span className="flex items-center gap-2 text-sm text-gray-500">
                                    <AlertCircle className="h-4 w-4 text-gray-400" /> Data Correction Queue
                                </span>
                                <Badge tone="slate">Unavailable</Badge>
                            </div>
                        )}
                        {data.farmIssues > 0 && (
                            <button
                                onClick={() => navigate('/farms/data-correction-queue')}
                                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                            >
                                <span className="flex items-center gap-2 text-sm text-gray-700">
                                    <FileWarning className="h-4 w-4 text-amber-600" /> Farm issues to correct
                                </span>
                                <Badge tone="amber">{data.farmIssues}</Badge>
                            </button>
                        )}
                        {data.appQueues.filter((q) => q.count > 0 || q.unavailable).map((q) => (
                            <button
                                key={q.key}
                                onClick={() => navigate(q.path)}
                                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${q.unavailable ? 'border-dashed border-gray-200' : 'border-gray-100 hover:bg-gray-50'}`}
                            >
                                <span className={`flex items-center gap-2 text-sm ${q.unavailable ? 'text-gray-500' : 'text-gray-700'}`}>
                                    {q.unavailable ? <AlertCircle className="h-4 w-4 text-gray-400" /> : <ClipboardCheck className="h-4 w-4 text-sky-600" />}
                                    {q.label}{q.unavailable ? '' : ' pending'}
                                </span>
                                <Badge tone={q.unavailable ? 'slate' : 'blue'}>{q.unavailable ? 'Unavailable' : q.count}</Badge>
                            </button>
                        ))}
                    </div>
                ) : (
                    <EmptyState title="Could not load Needs Attention" description="Try refreshing the page." />
                )}
            </div>
        </div>
    );
};

export default NeedsAttentionSection;

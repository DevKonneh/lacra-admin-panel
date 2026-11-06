import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    getVerificationQueue,
    setFarmerVerificationStatus,
    bulkSetFarmerVerificationStatus,
    type VerificationQueueResponse,
    type VerificationQueueItem,
    type IdentityStatus,
    type DataReadiness,
} from '../../api/farmerVerification';
import { resolveFileUrl } from '../../utils/fileUrl';
import SafeImage from '../../components/SafeImage';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import {
    Loader2, AlertTriangle, RefreshCw, ShieldCheck, ShieldAlert, ShieldQuestion,
    CheckCircle2, HelpCircle, User, Layers, Info, Search, X, ChevronLeft, ChevronRight,
    ListFilter, ClipboardList, CheckCircle, XCircle,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { buttonClasses } from '../../components/ui/buttonStyles';
import { COUNTY_NAMES } from '../../data/liberiaCounties';

/**
 * Identity Verification Queue — ADMIN-facing worklist of every farmer
 * whose identityStatus is "Unverified" or "Conflict", built for reviewing
 * larger numbers of records (search, county filter, pagination, explicit
 * bulk selection). Mirrors the Data Correction Queue's layout/interaction
 * pattern (table + status filter chips + bulk action) and the Farmer
 * Registry's search/filter/pagination pattern, applied to identity
 * verification instead of farm geometry or general browsing.
 *
 * IMPORTANT — two SEPARATE indicators are shown per row, intentionally
 * never merged into one, and kept VISUALLY distinct in the filter bar
 * (different label, chip shape, and color palette per dimension):
 *   - Identity Status: the actual decision (Unverified / Verified /
 *     Conflict), changed only by an authorised admin action below.
 *   - Data Readiness: an automated triage signal only ("Ready for
 *     Review" / "Missing Information" / "Potential Issue"). It means the
 *     record LOOKS complete/consistent enough to review quickly — it is
 *     NOT itself a verification decision, and (see ELIGIBILITY NOTE below)
 *     does NOT by itself block or require anything beyond the existing
 *     reason rules.
 *
 * ELIGIBILITY NOTE (inspected against the backend before writing this —
 * see FarmerController.setVerificationStatus/bulkSetVerificationStatus/
 * computeDataReadiness): there is NO backend rule that blocks verifying a
 * farmer whose data readiness is "Missing Information" or "Potential
 * Issue" — readiness is a triage aid only. The ONLY reason-required rules
 * that exist are: (1) a reason is required when flagging Conflict, and
 * (2) a reason is required when reversing an existing Verified status
 * back to Unverified. There is no separate "exception" workflow for
 * verifying an incomplete record today, so this screen does not invent
 * one — it simply surfaces the missing items so an admin can make an
 * informed decision, consistent with the existing rules, and strongly
 * encourages (without requiring, since the backend doesn't require it)
 * a reason whenever readiness is not "Ready for Review".
 *
 * This verifies IDENTITY ONLY — it says nothing about farm boundaries,
 * land rights, or EUDR requirements (see the separate Data Correction
 * Queue / Risk Analysis for those).
 */

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const READINESS_META: Record<DataReadiness, { color: string; icon: React.ReactNode }> = {
    'Ready for Review': { color: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    'Missing Information': { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: <HelpCircle className="h-3.5 w-3.5" /> },
    'Potential Issue': { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

const STATUS_META: Record<string, { color: string; icon: React.ReactNode }> = {
    Unverified: { color: 'bg-yellow-50 text-yellow-700 border-yellow-100', icon: <ShieldQuestion className="h-3.5 w-3.5" /> },
    Conflict: { color: 'bg-red-50 text-red-600 border-red-100', icon: <ShieldAlert className="h-3.5 w-3.5" /> },
};

/**
 * Which Farmer Profile tab holds the evidence relevant to a given data
 * readiness bucket, so the "Review" action can deep-link straight to it
 * instead of always landing on Overview. Missing-item fields (profile
 * photo, ID photo, signature, National ID, consent) all live on the
 * Identity & Documents tab; the one "Potential Issue" signal the backend
 * currently computes (shared phone number) is surfaced on Compliance &
 * Risk's "Possible Duplicate Farmer" field.
 */
const reviewTabFor = (readiness: DataReadiness): 'identity' | 'compliance' =>
    readiness === 'Potential Issue' ? 'compliance' : 'identity';

const VerificationQueue: React.FC = () => {
    const { user } = useAuth();
    // ADMIN + INSPECTOR can both VIEW this queue (inspectors use their
    // existing correction permissions to go fix flagged records). Only
    // ADMIN sees the Verify/Flag Conflict/Revert/bulk action controls —
    // the backend independently enforces this on every write endpoint
    // regardless of what this flag shows, so hiding these buttons is a
    // UX convenience, not the actual security boundary.
    const canManageVerification = user?.role === UserRole.ADMIN;

    // Every piece of view state round-trips through the URL (same pattern
    // as the Farmer Registry), so search/filter/page state survives a
    // visit to a farmer's profile and back.
    const [searchParams, setSearchParams] = useSearchParams();
    const searchTerm = searchParams.get('q') || '';
    const statusFilter = (searchParams.get('status') as 'Unverified' | 'Conflict' | null) || undefined;
    const readinessFilter = (searchParams.get('readiness') as DataReadiness | null) || undefined;
    const countyFilter = searchParams.get('county') || 'All';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = (parseInt(searchParams.get('size') || '25', 10) as typeof PAGE_SIZE_OPTIONS[number]) || 25;

    const setParam = (key: string, value: string | null, resetPage = true) => {
        const next = new URLSearchParams(searchParams);
        if (!value || value === 'All') next.delete(key);
        else next.set(key, value);
        if (resetPage) next.delete('page');
        setSearchParams(next);
    };

    const [data, setData] = useState<VerificationQueueResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Single-row action modal (Verify / Flag Conflict)
    const [rowModal, setRowModal] = useState<{ farmer: VerificationQueueItem; status: IdentityStatus } | null>(null);
    const [rowReason, setRowReason] = useState('');
    const [rowSubmitting, setRowSubmitting] = useState(false);

    // Bulk action confirmation summary
    const [bulkModal, setBulkModal] = useState<{ status: 'Verified' | 'Conflict' } | null>(null);
    const [bulkReason, setBulkReason] = useState('');
    const [bulkSubmitting, setBulkSubmitting] = useState(false);

    // Bulk action result — shown as a dismissible in-page panel (not a
    // blocking alert()) so individual successes and failures stay visible
    // and reviewable, including farmer names for anything that failed.
    const [bulkResult, setBulkResult] = useState<{
        status: 'Verified' | 'Conflict';
        successCount: number;
        failureCount: number;
        results: { farmerId: string; success: boolean; message: string }[];
    } | null>(null);

    const fetchQueue = async () => {
        try {
            setLoading(true);
            setError(null);
            // Only identityStatus is filtered server-side (matches the
            // existing backend contract); search/county/readiness refine
            // client-side below so they can be combined freely without
            // extra round trips.
            const res = await getVerificationQueue({ status: statusFilter });
            if (res.data.status) {
                setData(res.data.data);
            } else {
                setError(res.data.message || 'Failed to load the Identity Verification queue.');
            }
        } catch (err: any) {
            console.error('Error fetching verification queue', err);
            if (err?.response?.status === 401) {
                setError('Your session has expired. Please log in again.');
            } else if (err?.response?.status === 403) {
                setError('You do not have permission to view the Identity Verification queue.');
            } else {
                setError('Failed to load the Identity Verification queue. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    // --- Selection behavior across pagination and filter changes --------
    // Explicit rule (so it's predictable, not incidental):
    //   - Selection PERSISTS across page changes and page-size changes —
    //     an admin paging through 200 farmers can select records on page 1,
    //     then page 3, then bulk-act on all of them together.
    //   - Selection is CLEARED whenever any filter dimension changes
    //     (search, county, identity status, or data readiness) — because
    //     the set of records the admin is looking at has changed, and
    //     silently carrying over a selection the admin can no longer see
    //     risks an accidental bulk action on the wrong set of farmers.
    //   - "Select all" (the header checkbox) selects/deselects only the
    //     rows on the CURRENT page, never the entire filtered set across
    //     pages, to avoid an admin unintentionally selecting hundreds of
    //     records at once.
    useEffect(() => {
        setSelected(new Set());
    }, [searchTerm, countyFilter, statusFilter, readinessFilter]);

    // Drop any selections that no longer exist at all after a refetch
    // (e.g. a farmer was deleted elsewhere) — a safety net on top of the
    // explicit filter-change rule above, not a replacement for it.
    useEffect(() => {
        if (!data) return;
        setSelected(prev => {
            const validIds = new Set(data.farmers.map(f => f.id));
            const next = new Set<string>();
            prev.forEach(id => { if (validIds.has(id)) next.add(id); });
            return next;
        });
    }, [data]);

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const isReasonRequired = (farmer: VerificationQueueItem, status: IdentityStatus) => {
        if (status === 'Conflict') return true;
        if (status === 'Unverified' && farmer.identityStatus === 'Verified') return true;
        return false;
    };

    const handleConfirmRowAction = async () => {
        if (!rowModal) return;
        if (isReasonRequired(rowModal.farmer, rowModal.status) && !rowReason.trim()) {
            alert('A reason is required for this action.');
            return;
        }
        setRowSubmitting(true);
        try {
            const res = await setFarmerVerificationStatus(rowModal.farmer.id, rowModal.status, rowReason.trim() || undefined);
            if (res.data.status) {
                setRowModal(null);
                setRowReason('');
                await fetchQueue();
            } else {
                alert(res.data.message || 'Failed to update verification status');
            }
        } catch (err: any) {
            console.error('Error updating verification status', err);
            alert(err?.response?.data?.message || 'Failed to update verification status');
        } finally {
            setRowSubmitting(false);
        }
    };

    const handleConfirmBulkAction = async () => {
        if (!bulkModal) return;
        if (bulkModal.status === 'Conflict' && !bulkReason.trim()) {
            alert('A reason is required when flagging Conflict in bulk.');
            return;
        }
        setBulkSubmitting(true);
        try {
            const res = await bulkSetFarmerVerificationStatus(Array.from(selected), bulkModal.status, bulkReason.trim() || undefined);
            if (res.data.status) {
                const { successCount, failureCount, results } = res.data.data;
                setBulkResult({ status: bulkModal.status, successCount, failureCount, results });
                setBulkModal(null);
                setBulkReason('');
                setSelected(new Set());
                await fetchQueue();
            } else {
                alert(res.data.message || 'Bulk update failed');
            }
        } catch (err: any) {
            console.error('Error in bulk verification action', err);
            alert(err?.response?.data?.message || 'Bulk update failed');
        } finally {
            setBulkSubmitting(false);
        }
    };

    // --- Client-side search / county / readiness refinement + pagination ---
    // (status is already applied server-side in fetchQueue above)
    const filteredFarmers = useMemo(() => {
        if (!data) return [];
        const term = searchTerm.trim().toLowerCase();
        return data.farmers.filter((f) => {
            const matchesSearch = !term ||
                f.firstName.toLowerCase().includes(term) ||
                f.lastName.toLowerCase().includes(term) ||
                f.farmerId?.toLowerCase().includes(term) ||
                f.phoneNumber?.toLowerCase().includes(term);
            const matchesCounty = countyFilter === 'All' || (f.region || '').toLowerCase() === countyFilter.toLowerCase();
            const matchesReadiness = !readinessFilter || f.dataReadiness === readinessFilter;
            return matchesSearch && matchesCounty && matchesReadiness;
        });
    }, [data, searchTerm, countyFilter, readinessFilter]);

    const isFiltered = Boolean(searchTerm || statusFilter || readinessFilter || countyFilter !== 'All');
    const clearAllFilters = () => setSearchParams({});

    const totalPages = Math.max(1, Math.ceil(filteredFarmers.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageRows = filteredFarmers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const rangeStart = filteredFarmers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const rangeEnd = Math.min(currentPage * pageSize, filteredFarmers.length);

    const allOnPageSelected = pageRows.length > 0 && pageRows.every(f => selected.has(f.id));
    const toggleSelectPage = () => {
        setSelected(prev => {
            const next = new Set(prev);
            if (allOnPageSelected) {
                pageRows.forEach(f => next.delete(f.id));
            } else {
                pageRows.forEach(f => next.add(f.id));
            }
            return next;
        });
    };

    // Looked up from the FULL (pre-pagination) filtered list so the bulk
    // confirmation summary shows correct names even for farmers selected
    // on a different page than the one currently displayed.
    const selectedFarmers = data ? data.farmers.filter(f => selected.has(f.id)) : [];
    const selectedOffPageCount = selected.size - pageRows.filter(f => selected.has(f.id)).length;

    return (
        <div className="space-y-6">
            <PageHeader
                breadcrumb={[{ label: 'Farmer Registry', to: '/farmers' }, { label: 'Verification Queue' }]}
                title="Identity Verification"
                description="Review and act on identity verification requests. This does not approve farms or overall compliance."
                actions={
                    canManageVerification && selected.size > 0 ? (
                        <>
                            <span className="text-sm text-brand-muted self-center">
                                {selected.size} selected
                                {selectedOffPageCount > 0 && <span className="text-xs text-gray-400"> ({selectedOffPageCount} on other pages)</span>}
                            </span>
                            <button
                                onClick={() => setBulkModal({ status: 'Verified' })}
                                className={buttonClasses('primary')}
                            >
                                <ShieldCheck className="h-4 w-4" /> Verify Selected
                            </button>
                            <button
                                onClick={() => setBulkModal({ status: 'Conflict' })}
                                className={buttonClasses('danger')}
                            >
                                <ShieldAlert className="h-4 w-4" /> Flag Conflict
                            </button>
                        </>
                    ) : undefined
                }
            />

            {/* Shortened scope note, with the fuller explanation behind an
                accessible <details> disclosure (same pattern already used
                elsewhere in the admin panel, e.g. CommercialApplicationReview's
                document history). Keeps the page scannable while still making
                the full mechanics available to anyone who wants them. */}
            <details className="text-xs text-brand-muted bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 -mt-2">
                <summary className="cursor-pointer select-none inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-800 font-medium">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" /> What does Identity Verification cover?
                </summary>
                <div className="mt-2 pl-5 space-y-1.5">
                    <p>
                        Verifying identity confirms <strong>who the farmer is</strong> — it does not validate their
                        farm boundaries, land rights, or EUDR requirements (see the Data Correction Queue / Risk
                        Analysis for those).
                    </p>
                    <p>
                        <strong>Identity Status</strong> (Unverified / Verified / Conflict) is the actual decision,
                        changed only by an administrator. <strong>Data Readiness</strong> (Ready for Review / Missing
                        Information / Potential Issue) is a separate, automated triage signal only — it shows whether
                        a record looks complete enough to review quickly, it is never itself a verification decision.
                    </p>
                    <p>
                        A record with <strong>Missing Information</strong> or a <strong>Potential Issue</strong> can
                        still be verified or flagged — readiness does not block either action. A reason is required
                        only when flagging a Conflict, or when reversing an existing Verified status back to
                        Unverified; it is strongly recommended (though not required) whenever readiness is not
                        "Ready for Review", so the decision is explained in the audit trail.
                    </p>
                </div>
            </details>

            {/* Toolbar: search + county + two visually distinct filter
                dimensions (Identity Status vs Data Readiness). */}
            <div className="bg-white rounded-lg border border-gray-200 p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-wrap">
                    <div className="relative flex-1 min-w-[220px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-500" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50/60 placeholder-gray-400 text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                            placeholder="Search by name, Farmer ID, or phone"
                            value={searchTerm}
                            onChange={(e) => setParam('q', e.target.value || null)}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setParam('q', null)}
                                aria-label="Clear search"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <select
                        value={countyFilter}
                        onChange={(e) => setParam('county', e.target.value)}
                        className="border border-gray-200 bg-gray-50/60 rounded-lg py-2 px-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        aria-label="Filter by county"
                    >
                        <option value="All">All Counties</option>
                        {COUNTY_NAMES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    {isFiltered && (
                        <button
                            onClick={clearAllFilters}
                            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 underline px-1.5 whitespace-nowrap"
                        >
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </button>
                    )}
                </div>

                {/* Identity Status — the decision dimension. Square-ish
                    (rounded-md) chips, kept visually separate from the
                    readiness pills below via its own labeled row and a
                    distinct shape. */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-28 flex-shrink-0">Identity Status</span>
                    <button
                        onClick={() => setParam('status', null)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${!statusFilter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                        All ({data?.summary.total ?? '—'})
                    </button>
                    {(['Unverified', 'Conflict'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setParam('status', s)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                            {STATUS_META[s].icon} {s} ({data?.summary.byStatus[s] ?? '—'})
                        </button>
                    ))}
                </div>

                {/* Data Readiness — the triage dimension. Pill-shaped
                    (rounded-full) chips with its own label, so the two
                    dimensions never read as one combined filter. */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-28 flex-shrink-0">Data Readiness</span>
                    <button
                        onClick={() => setParam('readiness', null)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${!readinessFilter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                        All
                    </button>
                    {(['Ready for Review', 'Missing Information', 'Potential Issue'] as const).map((r) => (
                        <button
                            key={r}
                            onClick={() => setParam('readiness', r)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${readinessFilter === r ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                            {READINESS_META[r].icon} {r} ({data?.summary.byReadiness[r] ?? '—'})
                        </button>
                    ))}
                </div>
            </div>

            {/* Result count strip */}
            {!loading && !error && data && (
                <div className="px-1 flex items-center gap-1.5 text-xs text-gray-500">
                    <ListFilter className="h-3.5 w-3.5 text-gray-500" />
                    Showing <span className="font-semibold text-gray-700">{filteredFarmers.length}</span>
                    {isFiltered && <> of <span className="font-semibold text-gray-700">{data.farmers.length}</span> total</>} farmer{filteredFarmers.length !== 1 ? 's' : ''} needing review
                    {isFiltered && <span className="text-gray-400">(filtered)</span>}
                </div>
            )}

            {/* Bulk action result panel — individual successes/failures,
                dismissible, with farmer names resolved from the full list. */}
            {bulkResult && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {bulkResult.failureCount === 0 ? (
                                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                            ) : (
                                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                            )}
                            <p className="text-sm font-semibold text-gray-900">
                                {bulkResult.successCount} of {bulkResult.results.length} farmer(s) set to {bulkResult.status}
                                {bulkResult.failureCount > 0 && `, ${bulkResult.failureCount} failed`}
                            </p>
                        </div>
                        <button onClick={() => setBulkResult(null)} className="text-gray-400 hover:text-gray-600" aria-label="Dismiss">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <ul className="text-xs divide-y divide-gray-100 border border-gray-100 rounded-md overflow-hidden max-h-48 overflow-y-auto">
                        {bulkResult.results.map((r) => {
                            const farmerName = [...(data?.farmers ?? [])].find(f => f.id === r.farmerId);
                            return (
                                <li key={r.farmerId} className="px-3 py-1.5 flex items-center justify-between gap-2">
                                    <span className="text-gray-700 truncate">
                                        {farmerName ? `${farmerName.firstName} ${farmerName.lastName}` : r.farmerId}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 font-medium flex-shrink-0 ${r.success ? 'text-green-700' : 'text-red-600'}`}>
                                        {r.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} {r.message}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col justify-center items-center py-16 gap-3">
                        <Loader2 className="animate-spin h-8 w-8 text-green-600" />
                        <p className="text-sm text-gray-500">Loading records…</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button onClick={fetchQueue} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try Again
                        </button>
                    </div>
                ) : !data || filteredFarmers.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
                        <ClipboardList className="h-8 w-8 text-gray-300" />
                        <p>No farmers currently need identity review{isFiltered ? ' matching these filters' : ''}.</p>
                        {isFiltered && (
                            <button onClick={clearAllFilters} className="text-xs font-medium text-brand-green hover:text-brand-green-hover underline">
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    {canManageVerification && (
                                        <th className="px-4 py-2.5 text-left">
                                            <input
                                                type="checkbox"
                                                checked={allOnPageSelected}
                                                onChange={toggleSelectPage}
                                                className="rounded border-gray-300"
                                                title="Select all on this page"
                                            />
                                        </th>
                                    )}
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Farmer</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Identity Status</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Data Readiness</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Details</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Farms</th>
                                    <th className="px-6 py-2.5 text-right text-[11px] font-semibold text-gray-500 tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {pageRows.map((farmer) => {
                                    const statusMeta = STATUS_META[farmer.identityStatus] || STATUS_META.Unverified;
                                    const readinessMeta = READINESS_META[farmer.dataReadiness];
                                    const reviewTarget = `/farmers/${farmer.id}?tab=${reviewTabFor(farmer.dataReadiness)}`;
                                    return (
                                        <tr key={farmer.id} className="hover:bg-green-50/20 transition-colors">
                                            {canManageVerification && (
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(farmer.id)}
                                                        onChange={() => toggleSelect(farmer.id)}
                                                        className="rounded border-gray-300"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Link to={reviewTarget} className="flex items-center gap-2.5 group">
                                                    <SafeImage
                                                        src={resolveFileUrl(farmer.profilePhoto)}
                                                        alt={`${farmer.firstName} ${farmer.lastName}`}
                                                        className="h-8 w-8 rounded-full object-cover border border-gray-200 flex-none"
                                                        fallback={
                                                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-none">
                                                                <User className="h-4 w-4" />
                                                            </div>
                                                        }
                                                    />
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900 group-hover:text-green-600 group-hover:underline">
                                                            {farmer.firstName} {farmer.lastName}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {[farmer.community, farmer.district].filter(Boolean).join(' • ') || farmer.farmerId}
                                                        </div>
                                                    </div>
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full border ${statusMeta.color}`}>
                                                    {statusMeta.icon} {farmer.identityStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full border ${readinessMeta.color}`}>
                                                    {readinessMeta.icon} {farmer.dataReadiness}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-gray-600 max-w-xs">
                                                {farmer.missingFields.length > 0 && (
                                                    <div>Missing: {farmer.missingFields.join(', ')}</div>
                                                )}
                                                {farmer.potentialIssues.map((issue, i) => (
                                                    <div key={i} className="text-amber-700">{issue}</div>
                                                ))}
                                                {farmer.identityStatus === 'Conflict' && farmer.identityStatusReason && (
                                                    <div className="text-red-600 mt-1">Conflict reason: {farmer.identityStatusReason}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-gray-500" /> {farmer.farmCount}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-3">
                                                    {/* Primary action: opens the farmer's evidence and
                                                        readiness checklist, deep-linked to the tab most
                                                        relevant to this record's readiness bucket. */}
                                                    <Link
                                                        to={reviewTarget}
                                                        className={buttonClasses('primary', 'sm')}
                                                    >
                                                        Review
                                                    </Link>
                                                    {canManageVerification && farmer.identityStatus !== 'Verified' && (
                                                        <button
                                                            onClick={() => { setRowReason(''); setRowModal({ farmer, status: 'Verified' }); }}
                                                            className="text-green-700 hover:text-green-900 font-semibold text-xs"
                                                        >
                                                            Verify
                                                        </button>
                                                    )}
                                                    {canManageVerification && farmer.identityStatus !== 'Conflict' && (
                                                        <button
                                                            onClick={() => { setRowReason(''); setRowModal({ farmer, status: 'Conflict' }); }}
                                                            className="text-red-600 hover:text-red-800 font-semibold text-xs"
                                                        >
                                                            Flag Conflict
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {!loading && !error && filteredFarmers.length > 0 && (
                    <div className="px-3.5 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-500">
                            <span>Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => { setParam('size', e.target.value, false); setParam('page', null); }}
                                className="rounded-md border border-gray-300 py-1 pl-2 pr-6 text-sm"
                            >
                                {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <span className="text-gray-500">
                            Showing {rangeStart}–{rangeEnd} of {filteredFarmers.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={currentPage <= 1}
                                onClick={() => setParam('page', String(currentPage - 1), false)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" /> Previous
                            </button>
                            <span className="text-gray-500">Page {currentPage} of {totalPages}</span>
                            <button
                                disabled={currentPage >= totalPages}
                                onClick={() => setParam('page', String(currentPage + 1), false)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
                            >
                                Next <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Single-row action modal */}
            {rowModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div role="dialog" aria-modal="true" aria-label={rowModal.status === 'Verified' ? 'Mark Identity Verified' : 'Flag Identity Conflict'} className="bg-white rounded-lg border border-gray-200 shadow-card max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            {rowModal.status === 'Verified' ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldAlert className="h-5 w-5 text-red-600" />}
                            <h3 className="text-lg font-bold text-gray-900">
                                {rowModal.status === 'Verified' ? 'Mark Identity Verified' : 'Flag Identity Conflict'}
                            </h3>
                        </div>
                        <p className="text-sm text-gray-600">
                            {rowModal.farmer.firstName} {rowModal.farmer.lastName}
                            {rowModal.status === 'Verified'
                                ? ' — this confirms their identity only, not their farm boundaries or EUDR requirements.'
                                : ' — use this for contradictory or suspicious identity information. Missing documents alone should stay Unverified.'}
                        </p>
                        {/* Eligibility explanation — readiness never blocks this action
                            (see ELIGIBILITY NOTE at the top of this file); this is shown
                            so the admin understands WHY they can still proceed, and sees
                            exactly what's missing before deciding. */}
                        {rowModal.status === 'Verified' && rowModal.farmer.dataReadiness !== 'Ready for Review' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 space-y-1">
                                <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Data Readiness: {rowModal.farmer.dataReadiness}</p>
                                <p>
                                    This farmer can still be verified — data readiness is a triage signal only, not a
                                    verification eligibility gate. Consider recording a reason below explaining why
                                    you're verifying despite{rowModal.farmer.dataReadiness === 'Missing Information' ? ' the missing items' : ' this signal'}.
                                </p>
                                {rowModal.farmer.missingFields.length > 0 && <p>Missing: {rowModal.farmer.missingFields.join(', ')}</p>}
                                {rowModal.farmer.potentialIssues.map((issue, i) => <p key={i}>{issue}</p>)}
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                                Reason {isReasonRequired(rowModal.farmer, rowModal.status)
                                    ? <span className="text-red-500">(required)</span>
                                    : rowModal.status === 'Verified' && rowModal.farmer.dataReadiness !== 'Ready for Review'
                                        ? <span className="text-amber-600">(recommended)</span>
                                        : <span className="text-gray-500">(optional)</span>}
                            </label>
                            <textarea
                                value={rowReason}
                                onChange={(e) => setRowReason(e.target.value)}
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green"
                                placeholder={rowModal.status === 'Conflict' ? 'e.g. National ID does not match name on file...' : 'Optional note for the audit log...'}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setRowModal(null); setRowReason(''); }} disabled={rowSubmitting} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:opacity-60">
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmRowAction}
                                disabled={rowSubmitting || (isReasonRequired(rowModal.farmer, rowModal.status) && !rowReason.trim())}
                                className={`px-4 py-2 text-sm rounded-lg text-white flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60 ${rowModal.status === 'Conflict' ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600' : 'bg-brand-green hover:bg-brand-green-hover focus-visible:ring-brand-green'}`}
                            >
                                {rowSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk action confirmation summary */}
            {bulkModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div role="dialog" aria-modal="true" aria-label={bulkModal.status === 'Verified' ? `Verify ${selected.size} Farmer(s)` : `Flag ${selected.size} Farmer(s) as Conflict`} className="bg-white rounded-lg border border-gray-200 shadow-card max-w-lg w-full p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            {bulkModal.status === 'Verified' ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldAlert className="h-5 w-5 text-red-600" />}
                            <h3 className="text-lg font-bold text-gray-900">
                                {bulkModal.status === 'Verified' ? `Verify ${selected.size} Farmer(s)` : `Flag ${selected.size} Farmer(s) as Conflict`}
                            </h3>
                        </div>
                        <p className="text-sm text-gray-600">Review the selection below before confirming. Each record is checked individually and logged to the audit trail.</p>
                        {bulkModal.status === 'Verified' && selectedFarmers.some(f => f.dataReadiness !== 'Ready for Review') && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                                <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Some selected farmers are not "Ready for Review"</p>
                                <p className="mt-0.5">They can still be verified — readiness is a triage signal only. Consider recording a reason below.</p>
                            </div>
                        )}
                        <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
                            {selectedFarmers.map(f => (
                                <div key={f.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                                    <span className="text-gray-800 truncate">{f.firstName} {f.lastName}</span>
                                    <span className="text-xs text-gray-500 flex-shrink-0 flex items-center gap-1.5">
                                        {f.dataReadiness !== 'Ready for Review' && (
                                            <span className="text-amber-600" title={f.dataReadiness}><AlertTriangle className="h-3 w-3" /></span>
                                        )}
                                        {f.identityStatus} &rarr; {bulkModal.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                                Reason {bulkModal.status === 'Conflict' ? <span className="text-red-500">(required, applied to all selected)</span> : <span className="text-gray-500">(optional, applied to all selected)</span>}
                            </label>
                            <textarea
                                value={bulkReason}
                                onChange={(e) => setBulkReason(e.target.value)}
                                rows={2}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setBulkModal(null); setBulkReason(''); }} disabled={bulkSubmitting} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:opacity-60">
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmBulkAction}
                                disabled={bulkSubmitting || (bulkModal.status === 'Conflict' && !bulkReason.trim())}
                                className={`px-4 py-2 text-sm rounded-lg text-white flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60 ${bulkModal.status === 'Conflict' ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600' : 'bg-brand-green hover:bg-brand-green-hover focus-visible:ring-brand-green'}`}
                            >
                                {bulkSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirm {bulkModal.status === 'Verified' ? 'Verification' : 'Conflict Flag'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VerificationQueue;

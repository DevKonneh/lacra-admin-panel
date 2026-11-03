import React, { useEffect, useState } from 'react';
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
    CheckCircle2, HelpCircle, User, Layers,
} from 'lucide-react';

/**
 * Identity Verification Queue — ADMIN-facing worklist of every farmer
 * whose identityStatus is "Unverified" or "Conflict". Mirrors the Data
 * Correction Queue's layout/interaction pattern (table + status filter
 * chips + bulk action), applied to identity verification instead of farm
 * geometry.
 *
 * IMPORTANT — two SEPARATE indicators are shown per row, intentionally
 * never merged into one:
 *   - Data Readiness: an automated triage signal only ("Ready for
 *     Review" / "Missing Information" / "Potential Issue"). It means the
 *     record LOOKS complete/consistent enough to review quickly — it is
 *     NOT itself a verification decision. A fully "Ready for Review"
 *     record can still turn out to belong to the wrong person.
 *   - Identity Status: the actual decision (Unverified / Verified /
 *     Conflict), changed only by an authorised admin action below.
 *
 * This verifies IDENTITY ONLY — it says nothing about farm boundaries,
 * land rights, or EUDR requirements (see the separate Data Correction
 * Queue / Risk Analysis for those).
 */

const READINESS_META: Record<DataReadiness, { color: string; icon: React.ReactNode }> = {
    'Ready for Review': { color: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    'Missing Information': { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: <HelpCircle className="h-3.5 w-3.5" /> },
    'Potential Issue': { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

const STATUS_META: Record<string, { color: string; icon: React.ReactNode }> = {
    Unverified: { color: 'bg-yellow-50 text-yellow-700 border-yellow-100', icon: <ShieldQuestion className="h-3.5 w-3.5" /> },
    Conflict: { color: 'bg-red-50 text-red-600 border-red-100', icon: <ShieldAlert className="h-3.5 w-3.5" /> },
};

const VerificationQueue: React.FC = () => {
    const { user } = useAuth();
    // ADMIN + INSPECTOR can both VIEW this queue (inspectors use their
    // existing correction permissions to go fix flagged records). Only
    // ADMIN sees the Verify/Flag Conflict/Revert/bulk action controls —
    // the backend independently enforces this on every write endpoint
    // regardless of what this flag shows, so hiding these buttons is a
    // UX convenience, not the actual security boundary.
    const canManageVerification = user?.role === UserRole.ADMIN;

    const [searchParams, setSearchParams] = useSearchParams();
    const statusFilter = (searchParams.get('status') as 'Unverified' | 'Conflict' | null) || undefined;
    const readinessFilter = (searchParams.get('readiness') as DataReadiness | null) || undefined;

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

    const fetchQueue = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getVerificationQueue({ status: statusFilter, readiness: readinessFilter });
            if (res.data.status) {
                setData(res.data.data);
                // Drop any selections that no longer appear in the refreshed list
                // (e.g. just verified, or filtered out).
                setSelected(prev => {
                    const validIds = new Set(res.data.data.farmers.map(f => f.id));
                    const next = new Set<string>();
                    prev.forEach(id => { if (validIds.has(id)) next.add(id); });
                    return next;
                });
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
    }, [statusFilter, readinessFilter]);

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (!data) return;
        if (selected.size === data.farmers.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(data.farmers.map(f => f.id)));
        }
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
                const failures = results.filter(r => !r.success);
                let msg = `${successCount} of ${selected.size} farmer(s) set to ${bulkModal.status}.`;
                if (failureCount > 0) {
                    msg += `\n\n${failureCount} could not be updated:\n` + failures.map(f => `- ${f.farmerId}: ${f.message}`).join('\n');
                }
                alert(msg);
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

    const selectedFarmers = data ? data.farmers.filter(f => selected.has(f.id)) : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Identity Verification</h1>
                    <p className="text-sm text-brand-muted mt-1 max-w-2xl">
                        Farmers whose identity has not yet been verified, or whose identity has a flagged conflict.
                        Verifying identity confirms <strong>who the farmer is</strong> — it does not validate their
                        farm boundaries, land rights, or EUDR requirements (see the Data Correction Queue / Risk
                        Analysis for those).
                    </p>
                </div>
                {canManageVerification && selected.size > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-brand-muted">{selected.size} selected</span>
                        <button
                            onClick={() => setBulkModal({ status: 'Verified' })}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-brand-green text-white hover:bg-brand-green-hover transition-colors"
                        >
                            <ShieldCheck className="h-4 w-4" /> Verify Selected
                        </button>
                        <button
                            onClick={() => setBulkModal({ status: 'Conflict' })}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 transition-colors"
                        >
                            <ShieldAlert className="h-4 w-4" /> Flag Conflict
                        </button>
                    </div>
                )}
            </div>

            {/* Filter chips */}
            {data && (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSearchParams(readinessFilter ? { readiness: readinessFilter } : {})}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${!statusFilter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                        All ({data.summary.total})
                    </button>
                    {(['Unverified', 'Conflict'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setSearchParams({ ...(readinessFilter ? { readiness: readinessFilter } : {}), status: s })}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                            {STATUS_META[s].icon} {s} ({data.summary.byStatus[s]})
                        </button>
                    ))}
                    <span className="mx-1 text-gray-300">|</span>
                    {(['Ready for Review', 'Missing Information', 'Potential Issue'] as const).map((r) => (
                        <button
                            key={r}
                            onClick={() => setSearchParams({ ...(statusFilter ? { status: statusFilter } : {}), readiness: r })}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${readinessFilter === r ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                            {READINESS_META[r].icon} {r} ({data.summary.byReadiness[r]})
                        </button>
                    ))}
                    {(statusFilter || readinessFilter) && (
                        <button onClick={() => setSearchParams({})} className="px-3 py-1.5 rounded-full text-xs font-semibold text-brand-muted hover:text-brand-text underline">
                            Clear filters
                        </button>
                    )}
                </div>
            )}

            <div className="bg-white shadow-md rounded-xl border border-gray-100 overflow-hidden">
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
                ) : !data || data.farmers.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-500">
                        No farmers currently need identity review{statusFilter ? ` (status: ${statusFilter})` : ''}{readinessFilter ? ` (readiness: ${readinessFilter})` : ''}.
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
                                                checked={selected.size > 0 && selected.size === data.farmers.length}
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-300"
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
                                {data.farmers.map((farmer) => {
                                    const statusMeta = STATUS_META[farmer.identityStatus] || STATUS_META.Unverified;
                                    const readinessMeta = READINESS_META[farmer.dataReadiness];
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
                                                <Link to={`/farmers/${farmer.id}`} className="flex items-center gap-2.5 group">
                                                    <SafeImage
                                                        src={resolveFileUrl(farmer.profilePhoto)}
                                                        alt={`${farmer.firstName} ${farmer.lastName}`}
                                                        className="h-8 w-8 rounded-full object-cover border border-gray-200 flex-none"
                                                        fallback={
                                                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-none">
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
                                                <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-gray-400" /> {farmer.farmCount}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-3">
                                                    {canManageVerification && farmer.identityStatus !== 'Verified' && (
                                                        <button
                                                            onClick={() => { setRowReason(''); setRowModal({ farmer, status: 'Verified' }); }}
                                                            className="text-green-700 hover:text-green-900 font-semibold"
                                                        >
                                                            Verify
                                                        </button>
                                                    )}
                                                    {canManageVerification && farmer.identityStatus !== 'Conflict' && (
                                                        <button
                                                            onClick={() => { setRowReason(''); setRowModal({ farmer, status: 'Conflict' }); }}
                                                            className="text-red-600 hover:text-red-800 font-semibold"
                                                        >
                                                            Flag Conflict
                                                        </button>
                                                    )}
                                                    <Link to={`/farmers/${farmer.id}`} className="text-gray-500 hover:text-gray-800">
                                                        {canManageVerification ? 'View' : 'View / Correct Data'}
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Single-row action modal */}
            {rowModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
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
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                                Reason {isReasonRequired(rowModal.farmer, rowModal.status) ? <span className="text-red-500">(required)</span> : <span className="text-gray-400">(optional)</span>}
                            </label>
                            <textarea
                                value={rowReason}
                                onChange={(e) => setRowReason(e.target.value)}
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
                                placeholder={rowModal.status === 'Conflict' ? 'e.g. National ID does not match name on file...' : 'Optional note for the audit log...'}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setRowModal(null); setRowReason(''); }} disabled={rowSubmitting} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmRowAction}
                                disabled={rowSubmitting || (isReasonRequired(rowModal.farmer, rowModal.status) && !rowReason.trim())}
                                className={`px-4 py-2 text-sm rounded-lg text-white flex items-center gap-1.5 disabled:opacity-60 ${rowModal.status === 'Conflict' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-green hover:bg-brand-green-hover'}`}
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
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            {bulkModal.status === 'Verified' ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldAlert className="h-5 w-5 text-red-600" />}
                            <h3 className="text-lg font-bold text-gray-900">
                                {bulkModal.status === 'Verified' ? `Verify ${selected.size} Farmer(s)` : `Flag ${selected.size} Farmer(s) as Conflict`}
                            </h3>
                        </div>
                        <p className="text-sm text-gray-600">Review the selection below before confirming. Each record is checked individually and logged to the audit trail.</p>
                        <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
                            {selectedFarmers.map(f => (
                                <div key={f.id} className="px-3 py-2 text-sm flex items-center justify-between">
                                    <span className="text-gray-800">{f.firstName} {f.lastName}</span>
                                    <span className="text-xs text-gray-400">{f.identityStatus} → {bulkModal.status}</span>
                                </div>
                            ))}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                                Reason {bulkModal.status === 'Conflict' ? <span className="text-red-500">(required, applied to all selected)</span> : <span className="text-gray-400">(optional)</span>}
                            </label>
                            <textarea
                                value={bulkReason}
                                onChange={(e) => setBulkReason(e.target.value)}
                                rows={2}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setBulkModal(null); setBulkReason(''); }} disabled={bulkSubmitting} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmBulkAction}
                                disabled={bulkSubmitting || (bulkModal.status === 'Conflict' && !bulkReason.trim())}
                                className={`px-4 py-2 text-sm rounded-lg text-white flex items-center gap-1.5 disabled:opacity-60 ${bulkModal.status === 'Conflict' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-green hover:bg-brand-green-hover'}`}
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

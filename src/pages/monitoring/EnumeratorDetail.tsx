import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getEnumeratorDetail, type EnumeratorDetail as EnumeratorDetailType, type FieldStatus } from '../../api/monitoring';
import PageHeader from '../../components/ui/PageHeader';
import { ArrowLeft, Loader2, AlertTriangle, RefreshCw, MapPin, CheckCircle2, LogOut, HelpCircle, RotateCw, AlertCircle, Clock, ShieldCheck, ShieldAlert, ShieldX, Map as MapIcon, MapPinOff } from 'lucide-react';

const FIELD_STATUS_META: Record<FieldStatus, { color: string; icon: React.ReactNode; label: string }> = {
    CHECKED_IN: { color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Checked In' },
    CHECKED_OUT: { color: 'bg-gray-50 text-gray-600 border-gray-200', icon: <LogOut className="h-3.5 w-3.5" />, label: 'Checked Out' },
    NEVER_CHECKED_IN: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <HelpCircle className="h-3.5 w-3.5" />, label: 'Never Checked In' },
};

function formatDateTime(iso?: string | null): string {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Never';
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/**
 * CMIS Monitoring — single enumerator detail. 403s if the current user
 * (ADMIN or the enumerator's own FIELD_SUPERVISOR) does not have live
 * access — e.g. a supervisor who has since been reassigned away from this
 * enumerator, or a supervisor trying to view someone else's report via a
 * direct URL. The backend re-checks this on every request, so there is no
 * stale/cached access window here.
 */
const EnumeratorDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<EnumeratorDetailType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [forbidden, setForbidden] = useState(false);

    const fetchData = async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            setForbidden(false);
            const res = await getEnumeratorDetail(id);
            if (res.data.status) {
                setData(res.data.data);
            } else {
                setError(res.data.message || 'Failed to load enumerator detail.');
            }
        } catch (err: any) {
            if (err?.response?.status === 403) {
                setForbidden(true);
            } else if (err?.response?.status === 404) {
                setError('Enumerator not found.');
            } else {
                setError('Failed to load enumerator detail. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link
                    to="/monitoring/enumerators"
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                    title="Back to Enumerators"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <PageHeader
                    breadcrumb={[{ label: 'Field Progress' }, { label: 'Enumerators', to: '/monitoring/enumerators' }, { label: data?.name || 'Detail' }]}
                    title={data?.name || 'Enumerator Detail'}
                    description={data?.email}
                />
            </div>

            {loading ? (
                <div className="flex flex-col justify-center items-center py-16 gap-3">
                    <Loader2 className="animate-spin h-8 w-8 text-green-600" />
                    <p className="text-sm text-gray-500">Loading…</p>
                </div>
            ) : forbidden ? (
                <div className="bg-white rounded-lg border border-gray-200 flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                    <p className="text-sm font-medium text-gray-900">
                        You do not have permission to view this enumerator.
                    </p>
                    <p className="text-xs text-gray-500 max-w-sm">
                        This can happen if this enumerator has no supervisor assigned, or has been
                        reassigned to a different field supervisor.
                    </p>
                </div>
            ) : error ? (
                <div className="bg-white rounded-lg border border-gray-200 flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                    <p className="text-sm font-medium text-gray-900">{error}</p>
                    <button onClick={fetchData} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try Again
                    </button>
                </div>
            ) : data ? (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Field Status</p>
                            <span className={`px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full border ${FIELD_STATUS_META[data.fieldStatus].color}`}>
                                {FIELD_STATUS_META[data.fieldStatus].icon} {FIELD_STATUS_META[data.fieldStatus].label}
                            </span>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Assigned Area</p>
                            <p className="text-sm text-gray-800">
                                {[data.assignedDistrict, data.assignedCounty].filter(Boolean).join(', ') || <span className="text-gray-400">Not set</span>}
                            </p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Records Captured</p>
                            <p className="text-sm text-gray-800">{data.recordCounts.farmers} farmers &middot; {data.recordCounts.farms} farms</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sync Status</p>
                            {data.syncStatus ? (
                                data.syncStatus.lastSyncError ? (
                                    <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {data.syncStatus.lastSyncError}</p>
                                ) : data.syncStatus.lastPendingCount && data.syncStatus.lastPendingCount > 0 ? (
                                    <p className="text-sm text-amber-700 flex items-center gap-1"><RotateCw className="h-3.5 w-3.5" /> {data.syncStatus.lastPendingCount} pending</p>
                                ) : (
                                    <p className="text-sm text-green-700 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Synced</p>
                                )
                            ) : (
                                <p className="text-sm text-gray-400">No sync data reported</p>
                            )}
                        </div>
                    </div>

                    {/* Review progress: farmer identity verification + farm geometry
                        validation, counted ONLY across this enumerator's own
                        registered farmers/farms. Two independent breakdowns —
                        deliberately never blended into one compliance percentage,
                        matching this codebase's existing reporting convention. */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5" /> Farmer Identity Verification
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-gray-700"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Verified</span>
                                    <span className="font-semibold text-gray-900">{data.reviewProgress.identityStatus.Verified}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-gray-700"><ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Unverified</span>
                                    <span className="font-semibold text-gray-900">{data.reviewProgress.identityStatus.Unverified}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-gray-700"><ShieldX className="h-3.5 w-3.5 text-red-600" /> Conflict</span>
                                    <span className="font-semibold text-gray-900">{data.reviewProgress.identityStatus.Conflict}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <MapIcon className="h-3.5 w-3.5" /> Farm Geometry Validation
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-gray-700"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Valid</span>
                                    <span className="font-semibold text-gray-900">{data.reviewProgress.geometryStatus.Valid}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-gray-700"><RotateCw className="h-3.5 w-3.5 text-amber-600" /> Needs Review</span>
                                    <span className="font-semibold text-gray-900">{data.reviewProgress.geometryStatus['Needs Review']}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-gray-700"><AlertCircle className="h-3.5 w-3.5 text-red-600" /> Invalid</span>
                                    <span className="font-semibold text-gray-900">{data.reviewProgress.geometryStatus.Invalid}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-gray-700"><MapPinOff className="h-3.5 w-3.5 text-gray-400" /> Missing</span>
                                    <span className="font-semibold text-gray-900">{data.reviewProgress.geometryStatus.Missing}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Last reported location */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Last Reported Location</p>
                        {data.lastReportedLocation ? (
                            <p className="text-sm text-gray-800 flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                {data.lastReportedLocation.latitude.toFixed(6)}, {data.lastReportedLocation.longitude.toFixed(6)}
                                <span className="text-gray-400 ml-1">
                                    captured {formatDateTime(data.lastReportedLocation.capturedAt)} ({data.lastReportedLocation.sourceEventType})
                                </span>
                            </p>
                        ) : (
                            <p className="text-sm text-gray-400">No location reported with valid coordinates yet.</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                            This is the "Reported field area" (observed), kept separate from the declared
                            "Assigned area" shown above.
                        </p>
                    </div>

                    {/* Field event timeline */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <h2 className="text-sm font-semibold text-gray-800">Field Activity Timeline</h2>
                        </div>
                        <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                            {data.timeline.length === 0 ? (
                                <div className="px-5 py-8 text-center text-sm text-gray-400">No field events recorded yet.</div>
                            ) : (
                                data.timeline.map((ev) => (
                                    <div key={ev.id} className="px-5 py-3 flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-sm text-gray-800 font-medium">{ev.type}</p>
                                            {ev.latitude !== null && ev.longitude !== null && (
                                                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" /> {ev.latitude.toFixed(5)}, {ev.longitude.toFixed(5)}
                                                </p>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 flex-shrink-0 text-right">
                                            {formatDateTime(ev.capturedAt)}
                                            <br />
                                            <span className="text-gray-300">received {formatDateTime(ev.receivedAt)}</span>
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default EnumeratorDetail;

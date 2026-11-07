import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEnumerators, type EnumeratorSummary, type FieldStatus } from '../../api/monitoring';
import PageHeader from '../../components/ui/PageHeader';
import { Loader2, AlertTriangle, RefreshCw, MapPin, Users as UsersIcon, CheckCircle2, LogOut, HelpCircle, RotateCw, AlertCircle, ShieldCheck, Map as MapIcon } from 'lucide-react';

/**
 * CMIS Monitoring — Enumerators ("Field Progress").
 *
 * ADMIN sees every enumerator (INSPECTOR-role user); FIELD_SUPERVISOR sees
 * only their own direct reports. Both the list and the scoping itself are
 * resolved live server-side on every request (MonitoringAccessService),
 * so a supervisor reassigned away from an enumerator stops seeing them
 * immediately — nothing is cached client-side here either (every mount
 * re-fetches), so reassignment is reflected the moment the page is viewed.
 *
 * Shows actual record counts (farmers/farms) per enumerator only —
 * assignment targets and completion percentages are explicitly deferred
 * per the approved Monitoring spec, not shown here or anywhere else yet.
 */

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

const SyncBadge: React.FC<{ e: EnumeratorSummary }> = ({ e }) => {
    const s = e.syncStatus;
    if (!s) {
        return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><HelpCircle className="h-3.5 w-3.5" /> No sync data</span>;
    }
    if (s.lastSyncError) {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-red-600" title={s.lastSyncError}>
                <AlertCircle className="h-3.5 w-3.5" /> Sync error
            </span>
        );
    }
    if (s.lastPendingCount && s.lastPendingCount > 0) {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <RotateCw className="h-3.5 w-3.5" /> {s.lastPendingCount} pending
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Synced {s.lastSuccessfulSyncAt ? formatDateTime(s.lastSuccessfulSyncAt) : ''}
        </span>
    );
};

/**
 * Compact review-progress chips for the list view: farmer identity
 * verification (Verified/Unverified/Conflict) and farm geometry
 * validation (Valid/Needs Review/Invalid/Missing), counted ONLY across
 * this enumerator's own registered farmers/farms. Deliberately shown as
 * two separate mini-breakdowns, not a single blended percentage — see
 * ReviewProgress's doc comment in api/monitoring.ts for why.
 */
const ReviewProgressCell: React.FC<{ e: EnumeratorSummary }> = ({ e }) => {
    const rp = e.reviewProgress;
    if (!rp) return <span className="text-xs text-gray-400">No data</span>;
    const { identityStatus, geometryStatus } = rp;
    return (
        <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1 text-gray-600" title="Farmer identity verification">
                <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-green-700">{identityStatus.Verified} verified</span>
                <span className="text-gray-300">&middot;</span>
                <span className="text-amber-700">{identityStatus.Unverified} unverified</span>
                {identityStatus.Conflict > 0 && (
                    <>
                        <span className="text-gray-300">&middot;</span>
                        <span className="text-red-600">{identityStatus.Conflict} conflict</span>
                    </>
                )}
            </div>
            <div className="flex items-center gap-1 text-gray-600" title="Farm geometry validation">
                <MapIcon className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-green-700">{geometryStatus.Valid} valid</span>
                <span className="text-gray-300">&middot;</span>
                <span className="text-amber-700">{geometryStatus['Needs Review']} review</span>
                {(geometryStatus.Invalid > 0 || geometryStatus.Missing > 0) && (
                    <>
                        <span className="text-gray-300">&middot;</span>
                        <span className="text-red-600">{geometryStatus.Invalid + geometryStatus.Missing} invalid/missing</span>
                    </>
                )}
            </div>
        </div>
    );
};

const EnumeratorList: React.FC = () => {
    const [rows, setRows] = useState<EnumeratorSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getEnumerators();
            if (res.data.status) {
                setRows(res.data.data);
            } else {
                setError(res.data.message || 'Failed to load enumerators.');
            }
        } catch (err: any) {
            if (err?.response?.status === 403) {
                setError('You do not have permission to view field enumerators.');
            } else {
                setError('Failed to load enumerators. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="space-y-6">
            <PageHeader
                breadcrumb={[{ label: 'Field Progress' }, { label: 'Enumerators' }]}
                title="Enumerators"
                description="Field activity, presence, location, and sync status for field enumerators you supervise."
            />

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col justify-center items-center py-16 gap-3">
                        <Loader2 className="animate-spin h-8 w-8 text-green-600" />
                        <p className="text-sm text-gray-500">Loading…</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button onClick={fetchData} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try Again
                        </button>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
                        <UsersIcon className="h-8 w-8 text-gray-300" />
                        <p>No enumerators are currently visible to your account.</p>
                        <p className="text-xs text-gray-400 max-w-sm">
                            Enumerators without an assigned field supervisor are visible to admins only.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Enumerator</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Territory</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Field Status</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Last Location</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Records</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Review Progress</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Sync</th>
                                    <th className="px-6 py-2.5 text-right text-[11px] font-semibold text-gray-500 tracking-wide">Details</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {rows.map((e) => {
                                    const meta = FIELD_STATUS_META[e.fieldStatus];
                                    return (
                                        <tr key={e.id} className="hover:bg-green-50/20 transition-colors">
                                            <td className="px-6 py-3.5 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{e.name}</div>
                                                <div className="text-xs text-gray-500">{e.email}</div>
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                                {[e.assignedDistrict, e.assignedCounty].filter(Boolean).join(', ') || <span className="text-gray-400">Not set</span>}
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap">
                                                <span className={`px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full border ${meta.color}`}>
                                                    {meta.icon} {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-xs text-gray-600">
                                                {e.lastReportedLocation ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                                        {e.lastReportedLocation.latitude.toFixed(4)}, {e.lastReportedLocation.longitude.toFixed(4)}
                                                        <span className="text-gray-400 ml-1">({formatDateTime(e.lastReportedLocation.capturedAt)})</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">No location reported</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                                {e.recordCounts.farmers} farmers &middot; {e.recordCounts.farms} farms
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap">
                                                <ReviewProgressCell e={e} />
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap">
                                                <SyncBadge e={e} />
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm font-medium">
                                                <Link to={`/monitoring/enumerators/${e.id}`} className="text-brand-green hover:text-brand-green-hover font-semibold text-xs">
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnumeratorList;

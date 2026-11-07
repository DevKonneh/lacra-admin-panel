import React, { useEffect, useState } from 'react';
import { getUserActivity, type UserActivityEntry, type PresenceStatus } from '../../api/monitoring';
import PageHeader from '../../components/ui/PageHeader';
import { roleLabel } from '../admin/userHelpers';
import { formatDateTime } from '../admin/userHelpers';
import { Loader2, AlertTriangle, RefreshCw, Circle } from 'lucide-react';

/**
 * CMIS Monitoring — User Activity (ADMIN only).
 *
 * Staff-wide presence (Online/Idle/Offline), derived server-side from
 * per-tab heartbeat sessions (see MonitoringController.derivePresence()).
 * Deliberately NOT shown to FIELD_SUPERVISOR accounts — this view covers
 * every staff account across the whole system, not just an enumerator's
 * direct reports (the backend route itself is ADMIN-only and returns 403
 * for anyone else; this page is simply never linked to from a supervisor's
 * navigation in the first place).
 */

const PRESENCE_META: Record<PresenceStatus, { color: string; dot: string; label: string }> = {
    ONLINE: { color: 'text-green-700 bg-green-50 border-green-200', dot: 'text-green-500 fill-green-500', label: 'Online' },
    IDLE: { color: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'text-amber-500 fill-amber-500', label: 'Idle' },
    OFFLINE: { color: 'text-gray-500 bg-gray-50 border-gray-200', dot: 'text-gray-400 fill-gray-400', label: 'Offline' },
};

const UserActivity: React.FC = () => {
    const [rows, setRows] = useState<UserActivityEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getUserActivity();
            if (res.data.status) {
                setRows(res.data.data);
            } else {
                setError(res.data.message || 'Failed to load user activity.');
            }
        } catch (err: any) {
            if (err?.response?.status === 403) {
                setError('You do not have permission to view staff-wide user activity.');
            } else {
                setError('Failed to load user activity. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const counts = rows.reduce(
        (acc, r) => {
            acc[r.presence] = (acc[r.presence] || 0) + 1;
            return acc;
        },
        { ONLINE: 0, IDLE: 0, OFFLINE: 0 } as Record<PresenceStatus, number>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                breadcrumb={[{ label: 'Field Progress' }, { label: 'User Activity' }]}
                title="User Activity"
                description="Staff-wide presence across the system, derived from live heartbeat sessions. Admin only."
            />

            <div className="flex flex-wrap gap-2">
                {(['ONLINE', 'IDLE', 'OFFLINE'] as PresenceStatus[]).map((p) => (
                    <span key={p} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${PRESENCE_META[p].color}`}>
                        <Circle className={`h-2 w-2 ${PRESENCE_META[p].dot}`} /> {PRESENCE_META[p].label}: {counts[p]}
                    </span>
                ))}
            </div>

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
                    <div className="py-16 text-center text-sm text-gray-500">No staff accounts found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Name</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Role</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Presence</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Last Login</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {rows.map((u) => (
                                    <tr key={u.id} className="hover:bg-green-50/20 transition-colors">
                                        <td className="px-6 py-3.5 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{u.name}</div>
                                            <div className="text-xs text-gray-500">{u.email}</div>
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{roleLabel(u.role)}</td>
                                        <td className="px-6 py-3.5 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border ${PRESENCE_META[u.presence].color}`}>
                                                <Circle className={`h-2 w-2 ${PRESENCE_META[u.presence].dot}`} /> {PRESENCE_META[u.presence].label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-500">{formatDateTime(u.lastLoginAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserActivity;

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getDataCorrectionQueue, revalidateFarmGeometry, revalidateAllFarmGeometry, type DataCorrectionQueueResponse } from '../../api/geometry';
import { Loader2, AlertTriangle, MapPin, RefreshCw, ShieldAlert, HelpCircle, FileWarning } from 'lucide-react';

const STATUS_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    Invalid: { color: 'bg-red-100 text-red-800 border-red-200', icon: <ShieldAlert className="h-3.5 w-3.5" />, label: 'Invalid' },
    'Needs Review': { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <HelpCircle className="h-3.5 w-3.5" />, label: 'Needs Review' },
    Missing: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: <FileWarning className="h-3.5 w-3.5" />, label: 'Missing' },
};

/**
 * Admin/Inspector-facing worklist of farms whose GPS boundary needs
 * attention before that farm can be trusted for compliance analysis.
 * This is the drill-down target for "Clicking Needs Correction opens the
 * Data Correction Queue" on the Dashboard. Read-only + re-validate-only —
 * NEVER deletes or modifies a farm's actual boundary coordinates (see
 * FarmController.getDataCorrectionQueue()/revalidateGeometry() on the
 * backend for the full rationale).
 */
const DataCorrectionQueue: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const statusFilter = searchParams.get('status') || '';

    const [data, setData] = useState<DataCorrectionQueueResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revalidatingId, setRevalidatingId] = useState<string | null>(null);
    const [revalidatingAll, setRevalidatingAll] = useState(false);

    const fetchQueue = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getDataCorrectionQueue(statusFilter || undefined);
            if (response.data.status) {
                setData(response.data.data);
            } else {
                setError(response.data.message || 'Failed to load the Data Correction Queue.');
            }
        } catch (err: unknown) {
            console.error('Error fetching data correction queue', err);
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401) {
                setError('Your session has expired. Please log in again.');
            } else if (status === 403) {
                setError('You do not have permission to view the Data Correction Queue.');
            } else {
                setError('Failed to load the Data Correction Queue. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const handleRevalidate = async (farmId: string) => {
        try {
            setRevalidatingId(farmId);
            await revalidateFarmGeometry(farmId);
            await fetchQueue();
        } catch (err) {
            console.error('Error re-validating farm geometry', err);
            alert('Failed to re-validate this farm\'s geometry. Please try again.');
        } finally {
            setRevalidatingId(null);
        }
    };

    const handleRevalidateAll = async () => {
        try {
            setRevalidatingAll(true);
            await revalidateAllFarmGeometry();
            await fetchQueue();
        } catch (err) {
            console.error('Error re-validating all farm geometry', err);
            alert('Failed to re-validate all farms. Please try again.');
        } finally {
            setRevalidatingAll(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Data Correction Queue</h1>
                    <p className="text-sm text-brand-muted mt-1">
                        Farms whose GPS boundary is invalid, unusual, or was never validated. These farms are blocked from
                        compliance certification until corrected. Coordinates are never modified or deleted here.
                    </p>
                </div>
                <button
                    onClick={handleRevalidateAll}
                    disabled={revalidatingAll || loading}
                    className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 text-sm font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                    {revalidatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {revalidatingAll ? 'Re-validating all…' : 'Re-validate All Farms'}
                </button>
            </div>

            {/* Status filter chips */}
            {data && (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSearchParams(statusFilter ? {} : {})}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${!statusFilter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                        All ({data.summary.total})
                    </button>
                    {(['Invalid', 'Needs Review', 'Missing'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setSearchParams({ status: s })}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
                                statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {STATUS_META[s].icon} {s} ({data.summary.byStatus[s]})
                        </button>
                    ))}
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
                        <button
                            onClick={fetchQueue}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Try Again
                        </button>
                    </div>
                ) : !data || data.farms.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-500">
                        No farms currently need geometry correction{statusFilter ? ` (status: ${statusFilter})` : ''}.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Farm</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Farmer</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Status</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Declared Area</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Calculated Area</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Diff</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">GPS Accuracy</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Points</th>
                                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-gray-500 tracking-wide">Overlap</th>
                                    <th className="px-6 py-2.5 text-right text-[11px] font-semibold text-gray-500 tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {data.farms.map((farm) => {
                                    const meta = STATUS_META[farm.geometryStatus || 'Missing'] || STATUS_META.Missing;
                                    return (
                                        <tr key={farm.id} className="hover:bg-red-50/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Link to={`/farms/${farm.id}`} className="text-sm font-medium text-gray-900 hover:text-green-600 hover:underline">
                                                    {farm.name}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Link to={`/farmers/${farm.farmer.id}`} className="text-sm text-blue-600 hover:underline">
                                                    {farm.farmer.firstName} {farm.farmer.lastName}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full border ${meta.color}`}>
                                                    {meta.icon} {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {farm.totalAreaHa != null ? `${farm.totalAreaHa.toFixed(2)} ha` : '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {farm.calculatedAreaHa != null ? `${farm.calculatedAreaHa.toFixed(2)} ha` : 'Not calculated'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {farm.areaDifferenceHa != null ? (
                                                    <span className={Math.abs(farm.areaDifferencePercent || 0) > 20 ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                                                        {farm.areaDifferenceHa.toFixed(2)} ha ({(farm.areaDifferencePercent ?? 0).toFixed(1)}%)
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {farm.gpsAccuracyM != null ? `±${farm.gpsAccuracyM.toFixed(1)} m` : 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {farm.coordinateCount ?? '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {farm.overlapsExistingFarm ? (
                                                    <span className="text-red-600 font-medium">Overlaps</span>
                                                ) : (
                                                    <span className="text-gray-400">None</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleRevalidate(farm.id)}
                                                        disabled={revalidatingId === farm.id}
                                                        className="inline-flex items-center gap-1 text-green-700 hover:text-green-900 font-semibold disabled:opacity-60"
                                                    >
                                                        {revalidatingId === farm.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                                        Re-validate
                                                    </button>
                                                    <Link to={`/map?farmId=${farm.id}`} className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1">
                                                        <MapPin className="h-3.5 w-3.5" /> Map
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
        </div>
    );
};

export default DataCorrectionQueue;

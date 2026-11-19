import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '../api/client';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Loader2, RefreshCw, Info, Satellite } from 'lucide-react';
import {
    STREET_TILE,
    STREET_ATTRIBUTION,
    SATELLITE_TILE,
    SATELLITE_LABELS_TILE,
    SATELLITE_ATTRIBUTION,
    SATELLITE_MAX_NATIVE_ZOOM,
    SATELLITE_MAX_ZOOM,
    SATELLITE_TILE_SIZE,
    SATELLITE_ZOOM_OFFSET,
} from '../config/mapTiles';

/** Shape returned by GET /satellite/temporal. */
interface TemporalAnalysis {
    region?: string;
    riskLevel?: string | null;
    trend?: string | null;
    /** FALSE means no national time series exists — render an unavailable state. */
    historyAvailable?: boolean;
    history?: { year: string; forestCover: number; deforestationRate: number }[];
    unavailableReason?: string | null;
    stats?: { totalForests?: number; highRiskForests?: number };
}

interface SatelliteAlertRecord {
    id: string;
    type: string;
    status?: string;
    detectedAt: string;
    farm?: { name?: string } | null;
}

/**
 * Satellite assessment.
 *
 * Framing note: this screen used to be titled "Advanced Satellite Analysis" and
 * presented a national forest-cover trend (85%→82.8%), a "STABLE (Monitored)"
 * trend verdict and a "deforestation rate has decreased to 0.2%" claim. NONE of
 * those figures were computed — they were hardcoded in SatelliteController and
 * rendered as if measured.
 *
 * This system performs satellite assessment PER FARM, on demand, via Open Foris
 * Whisp. There is no national time series, so that panel now reports the data as
 * unavailable instead of inventing it.
 *
 * A Whisp result is evidence FOR an EUDR due-diligence file. It is not a
 * compliance certificate and does not by itself establish compliance.
 */
const SatelliteAnalysis: React.FC = () => {
    const [data, setData] = useState<TemporalAnalysis | null>(null);
    const [alerts, setAlerts] = useState<SatelliteAlertRecord[]>([]);
    const [satelliteMode, setSatelliteMode] = useState(true);

    const [overviewLoading, setOverviewLoading] = useState(true);
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const [alertsLoading, setAlertsLoading] = useState(true);
    const [alertsError, setAlertsError] = useState<string | null>(null);

    const loadOverview = async () => {
        try {
            setOverviewLoading(true);
            setOverviewError(null);
            const res = await apiClient.get('/satellite/temporal');
            if (res.data?.status) {
                setData(res.data.data);
            } else {
                setOverviewError(res.data?.message || 'Could not load satellite overview.');
            }
        } catch (err) {
            console.error('Error fetching satellite overview', err);
            setOverviewError('Could not load the satellite overview. Please check your connection and try again.');
        } finally {
            setOverviewLoading(false);
        }
    };

    const loadAlerts = async () => {
        try {
            setAlertsLoading(true);
            setAlertsError(null);
            const res = await apiClient.get('/satellite/alerts');
            if (res.data?.status) {
                setAlerts(res.data.data || []);
            } else {
                setAlertsError(res.data?.message || 'Could not load satellite alerts.');
            }
        } catch (err) {
            console.error('Error fetching satellite alerts', err);
            setAlertsError('Could not load satellite alerts. Please check your connection and try again.');
        } finally {
            setAlertsLoading(false);
        }
    };

    useEffect(() => {
        loadOverview();
        loadAlerts();
    }, []);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-gray-200 shadow rounded">
                    <p className="font-bold">{label}</p>
                    <p className="text-sm text-green-600">Cover: {payload[0].value}%</p>
                </div>
            );
        }
        return null;
    };

    const statusChipClass = (status?: string) => {
        switch ((status || '').toUpperCase()) {
            case 'REVIEWED':
                return 'bg-sky-100 text-sky-800 border-sky-200';
            case 'DISMISSED':
                return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'PENDING':
            default:
                return 'bg-amber-100 text-amber-800 border-amber-200';
        }
    };

    const pendingCount = alerts.filter((a) => (a.status || 'PENDING').toUpperCase() === 'PENDING').length;
    const historyAvailable = Boolean(data?.historyAvailable) && (data?.history?.length ?? 0) > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Satellite className="h-6 w-6 text-green-700" />
                    Satellite Assessment
                </h1>
                <p className="text-sm text-gray-600 mt-1 max-w-3xl">
                    On-demand satellite assessment of individual farm parcels via Open Foris Whisp
                    (FAO / Google Earth Engine). Run it from a farm&apos;s risk analysis page.
                </p>
                <p className="text-xs text-gray-500 mt-2 max-w-3xl">
                    A satellite result is evidence for an EUDR due-diligence file. It is not a
                    compliance certificate and does not by itself establish compliance.
                </p>
            </div>

            {/* National overview — reports UNAVAILABLE rather than inventing figures. */}
            <div className="bg-white shadow rounded-lg p-6 mb-8">
                {overviewLoading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading satellite overview...
                    </div>
                ) : overviewError ? (
                    <div className="flex flex-col items-start gap-3">
                        <div className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="h-5 w-5" />
                            <p className="text-sm">{overviewError}</p>
                        </div>
                        <button
                            onClick={loadOverview}
                            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> Try Again
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-gray-900">
                                National overview
                            </h3>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                Not available
                            </span>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-amber-900">
                                        National forest-cover trend is not available
                                    </p>
                                    <p className="text-xs text-amber-800 mt-1">
                                        {data?.unavailableReason ||
                                            'No national forest-cover time series is stored in this system, so no trend or national deforestation rate can be shown here.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Only genuinely-computed numbers are shown, and they are
                            labelled as a reference dataset, not national coverage. */}
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                <div className="text-2xl font-bold text-gray-900">
                                    {data?.stats?.totalForests ?? 0}
                                </div>
                                <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-1">
                                    Forest / protected-area reference polygons loaded
                                </div>
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                <div className="text-2xl font-bold text-gray-900">
                                    {data?.stats?.highRiskForests ?? 0}
                                </div>
                                <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-1">
                                    Of those flagged high risk
                                </div>
                            </div>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-2">
                            These are counts of LACRA&apos;s own reference dataset used for overlap checks —
                            not a measure of national forest cover.
                        </p>

                        {/* Forward-compatible: only render a chart when a real series exists. */}
                        {historyAvailable && (
                            <div className="h-80 w-full mt-6">
                                <h4 className="text-sm font-medium text-gray-500 mb-4">Forest Cover Trend</h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data!.history}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="year" />
                                        <YAxis />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="forestCover" stroke="#10b981" fill="#ecfdf5" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Alerts */}
            <div className="bg-white shadow rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-medium text-gray-900">
                        Satellite alerts
                        {!alertsLoading && !alertsError && ` (${alerts.length})`}
                    </h3>
                    {pendingCount > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            {pendingCount} awaiting review
                        </span>
                    )}
                </div>

                {alertsLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 py-4">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading alerts...
                    </div>
                ) : alertsError ? (
                    <div className="flex flex-col items-start gap-3 py-2">
                        <div className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="h-5 w-5" />
                            <p className="text-sm">{alertsError}</p>
                        </div>
                        <button
                            onClick={loadAlerts}
                            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> Try Again
                        </button>
                    </div>
                ) : alerts.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">
                        No satellite alerts have been raised. Alerts are created when a farm is
                        assessed as high risk.
                    </p>
                ) : (
                    <>
                        <ul className="space-y-2 mt-3">
                            {alerts.slice(0, 10).map((a) => (
                                <li
                                    key={a.id}
                                    className="flex flex-wrap items-center gap-3 p-2 rounded bg-gray-50 border border-gray-200"
                                >
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-900">
                                        {a.type}
                                    </span>
                                    <span className="text-sm text-gray-800">
                                        {a.farm?.name || 'Unknown farm'} — {new Date(a.detectedAt).toLocaleDateString()}
                                    </span>
                                    <span
                                        className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium border ${statusChipClass(a.status)}`}
                                    >
                                        {(a.status || 'PENDING').toUpperCase()}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {/* Honest statement of a real lifecycle gap, rather than
                            showing acknowledge/resolve controls that do nothing. */}
                        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-gray-600">
                                    <span className="font-medium text-gray-800">Acknowledging alerts is not yet available.</span>{' '}
                                    Alerts are stored with a status (PENDING / REVIEWED / DISMISSED), but no
                                    workflow exists in this system to record a reviewer, a decision or a
                                    resolution note. Until that is added, an alert stays PENDING
                                    indefinitely and this list is the only record of it.
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden h-80">
                <div className="p-3 flex justify-between items-center border-b">
                    <h3 className="font-medium">Satellite Imagery Overlay</h3>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={satelliteMode} onChange={e => setSatelliteMode(e.target.checked)} />
                        Satellite layer
                    </label>
                </div>
                <MapContainer center={[6.5, -9.5]} zoom={6} maxZoom={SATELLITE_MAX_ZOOM} className="h-full">
                    {satelliteMode ? (
                        <>
                            <TileLayer attribution={SATELLITE_ATTRIBUTION} url={SATELLITE_TILE} maxZoom={SATELLITE_MAX_ZOOM} maxNativeZoom={SATELLITE_MAX_NATIVE_ZOOM} tileSize={SATELLITE_TILE_SIZE} zoomOffset={SATELLITE_ZOOM_OFFSET} />
                            <TileLayer url={SATELLITE_LABELS_TILE} opacity={0.85} maxZoom={SATELLITE_MAX_ZOOM} maxNativeZoom={SATELLITE_MAX_NATIVE_ZOOM} tileSize={SATELLITE_TILE_SIZE} zoomOffset={SATELLITE_ZOOM_OFFSET} />
                        </>
                    ) : (
                        <TileLayer attribution={STREET_ATTRIBUTION} url={STREET_TILE} maxZoom={19} />
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default SatelliteAnalysis;

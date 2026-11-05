import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFarmers, type Farmer } from '../api/farmers';
import { assessRisk, type RiskAnalysisResult } from '../api/risk';
import { getComplianceCalculationDetails, type ComplianceCalculationDetails, type DashboardFilterParams } from '../api/reports';
import { AlertTriangle, CheckCircle, User, MapPin, FileText, BarChart3, Copy, Loader2, Calculator, RefreshCw, Clock } from 'lucide-react';
import { MapContainer, TileLayer, Polygon, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// GeoJSON `coordinates` is recursively nested (Point: [lng, lat], Polygon:
// [[[lng, lat], ...]], MultiPolygon: [[[[lng, lat], ...]], ...]) and the
// underlying Farm.location.coordinates field (api/farmers.ts) is typed
// `any` to accommodate all three shapes. We narrow it locally here with a
// small recursive alias instead of using `any` directly, so the map
// preview logic below stays type-checked without touching the shared
// (protected) Farm type.
type GeoJsonCoordinate = number | GeoJsonCoordinate[];

/**
 * "Clicking the compliance percentage opens its calculation details" —
 * this panel is the drill-down target for the Dashboard's "LACRA
 * Compliance" card ("View Calculation" -> /risk-analysis?complianceDetails=1
 * plus any active dashboard filters). It fetches the exact numerator/
 * denominator/rule behind complianceRate from the SAME filtered backend
 * endpoint the dashboard number came from, so the two can never disagree.
 */
const ComplianceCalculationPanel: React.FC<{ filters: DashboardFilterParams }> = ({ filters }) => {
    const [details, setDetails] = useState<ComplianceCalculationDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDetails = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getComplianceCalculationDetails(filters);
            if (response.data.status) {
                setDetails(response.data.data);
            } else {
                setError(response.data.message || 'Failed to load calculation details.');
            }
        } catch (err) {
            console.error('Error fetching compliance calculation details', err);
            setError('Failed to load calculation details. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(filters)]);

    return (
        <div className="bg-white shadow-md rounded-xl border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
                    <Calculator className="h-4.5 w-4.5 text-green-700" /> Assessed Low Risk, Valid Geometry — Calculation Details
                </h2>
                <button
                    onClick={fetchDetails}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-900 disabled:opacity-60"
                >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="space-y-2 animate-pulse">
                    <div className="h-4 w-3/4 bg-gray-200 rounded" />
                    <div className="h-8 w-1/3 bg-gray-200 rounded" />
                    <div className="h-4 w-1/2 bg-gray-200 rounded" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                    <p className="text-sm text-gray-700">{error}</p>
                    <button onClick={fetchDetails} className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">Try Again</button>
                </div>
            ) : details ? (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3">{details.rule}</p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-green-700">{details.numerator}</div>
                            <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-1">Assessed Low Risk,<br />Valid Geometry (numerator)</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{details.denominator}</div>
                            <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-1">{details.denominatorLabel || 'Total Farms'}<br />(denominator)</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-amber-600">{details.nonCompliantFarms}</div>
                            <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-1">Non-Compliant<br />Farms</div>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-100 rounded-lg py-3">
                        <span className="text-sm text-gray-700">Compliance Rate =</span>
                        <span className="text-sm font-mono text-gray-900">{details.numerator} ÷ {details.denominator}</span>
                        <span className="text-sm text-gray-700">=</span>
                        <span className="text-lg font-bold text-green-700">{details.complianceRate}%</span>
                    </div>

                    {/* Assessment coverage — a SEPARATE metric from the compliance
                        rate above, never blended into it. A low compliance rate can
                        mean either "many farms failed assessment" or "many farms
                        simply haven't been assessed yet" — this disambiguates. */}
                    <div className="border-t border-gray-100 pt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-semibold text-gray-900">Assessment Coverage (separate metric)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-xl font-bold text-gray-900">{details.assessedFarms}</div>
                                <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-1">Assessed Farms</div>
                            </div>
                            <div>
                                <div className="text-xl font-bold text-gray-500">{details.assessmentPendingFarms}</div>
                                <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-1">Assessment Pending</div>
                            </div>
                            <div>
                                <div className="text-xl font-bold text-sky-700">{details.assessmentCoverageRate}%</div>
                                <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-1">Coverage Rate</div>
                            </div>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-2">
                            Assessment Coverage = Assessed Farms ÷ {details.denominatorLabel || 'Total Farms'} ({details.assessedFarms} ÷ {details.denominator}). This is independent of the compliance RESULT above — it only measures whether an assessment has been completed, not whether the farm passed it.
                        </p>
                    </div>

                    {Object.values(details.filtersApplied || {}).some(Boolean) && (
                        <p className="text-[11px] text-gray-400">
                            Filters applied: {Object.entries(details.filtersApplied)
                                .filter(([, v]) => v)
                                .map(([k, v]) => `${k}=${v}`)
                                .join(', ')}
                        </p>
                    )}
                </div>
            ) : null}
        </div>
    );
};

const formatDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleString() : '—');
const DataRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-100 last:border-0">
        <span className="text-gray-500 text-sm shrink-0">{label}</span>
        <span className="text-gray-900 text-sm text-right">{value ?? '—'}</span>
    </div>
);
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            {icon}
            {title}
        </h3>
        {children}
    </div>
);
const RiskBadge: React.FC<{ value: boolean; label: string }> = ({ value, label }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${value ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
        {value ? 'Yes' : 'No'}: {label}
    </span>
);

const CopyableCoords: React.FC<{ label: string; text: string }> = ({ label, text }) => {
    const [copied, setCopied] = React.useState(false);
    const copy = () => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    if (!text) return null;
    return (
        <div className="py-1.5 border-b border-gray-100">
            <span className="text-gray-500 text-sm block mb-1">{label}</span>
            <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-gray-900 bg-white border border-gray-200 rounded px-2 py-1.5 font-mono break-all select-all">
                    {text}
                </code>
                <button type="button" onClick={copy} className="shrink-0 p-1.5 rounded hover:bg-gray-200 text-gray-600" title="Copy">
                    {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
            </div>
        </div>
    );
};

const RiskAnalysis: React.FC = () => {
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [riskResult, setRiskResult] = useState<RiskAnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    // Dashboard drill-down support: /risk-analysis?riskLevel=High pre-filters
    // the farmer list to those whose (first/cached) farm risk level matches,
    // so "Clicking High Risk opens the affected farms and risk reasons"
    // lands the user directly on the relevant subset instead of the full list.
    const [searchParams] = useSearchParams();
    const riskLevelFilter = searchParams.get('riskLevel');

    // "Clicking the compliance percentage opens its calculation details":
    // /risk-analysis?complianceDetails=1 (plus any dashboard filters carried
    // over by the drill-down) shows the numerator/denominator/rule panel
    // above the farmer list instead of/alongside it.
    const showComplianceDetails = searchParams.get('complianceDetails') === '1';
    const complianceFilters: DashboardFilterParams = {
        dateFrom: searchParams.get('dateFrom') || undefined,
        dateTo: searchParams.get('dateTo') || undefined,
        county: searchParams.get('county') || undefined,
        district: searchParams.get('district') || undefined,
        commodity: searchParams.get('commodity') || undefined,
        gender: searchParams.get('gender') || undefined,
        complianceStatus: (searchParams.get('complianceStatus') as DashboardFilterParams['complianceStatus']) || undefined,
        verificationStatus: (searchParams.get('verificationStatus') as DashboardFilterParams['verificationStatus']) || undefined,
    };

    const fetchFarmers = async () => {
        try {
            setListLoading(true);
            setListError(null);
            const response = await getFarmers();
            if (response.data.status) {
                setFarmers(response.data.data);
            } else {
                setListError(response.data.message || 'Failed to load farmers.');
            }
        } catch (error) {
            console.error("Error fetching farmers", error);
            setListError('Failed to load farmers. Please check your connection and try again.');
        } finally {
            setListLoading(false);
        }
    };

    useEffect(() => {
        fetchFarmers();
    }, []);

    const displayedFarmers = riskLevelFilter
        ? farmers.filter((f) => f.farms?.some((farm) => farm.riskLevel === riskLevelFilter))
        : farmers;

    const handleCheckRisk = async (farmer: Farmer) => {
        setSelectedFarmer(farmer);
        setRiskResult(null);
        setLoading(true);
        // Check risk for the first farm for MVP simplicity
        if (farmer.farms && farmer.farms.length > 0) {
            try {
                const response = await assessRisk(farmer.farms[0].id);
                if (response.data.status) {
                    setRiskResult(response.data.data);
                }
            } catch (error) {
                console.error("Error assessing risk", error);
                alert("Failed to assess risk");
            }
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            {showComplianceDetails && <ComplianceCalculationPanel filters={complianceFilters} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Farmer List */}
                <div className="bg-white shadow-md rounded-xl border border-gray-100 p-6">
                    <h2 className="text-[15px] font-semibold text-gray-900 mb-4">
                        {riskLevelFilter ? `Farmers with ${riskLevelFilter}-Risk Farms` : 'Select a Farmer'}
                    </h2>
                    {listLoading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="animate-spin h-6 w-6 text-green-600" />
                        </div>
                    ) : listError ? (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                            <p className="text-sm text-gray-700">{listError}</p>
                            <button onClick={fetchFarmers} className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">Try Again</button>
                        </div>
                    ) : displayedFarmers.length === 0 ? (
                        <p className="text-gray-500">
                            {riskLevelFilter ? `No farmers currently have a ${riskLevelFilter}-risk farm.` : 'No farmers registered yet.'}
                        </p>
                    ) : (
                        <ul className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
                            {displayedFarmers.map(farmer => (
                                <li key={farmer.id} className="py-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 p-2 rounded" onClick={() => handleCheckRisk(farmer)}>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{farmer.firstName} {farmer.lastName}</p>
                                        <p className="text-sm text-gray-500">{farmer.email || farmer.phoneNumber}</p>
                                        <p className="text-xs text-gray-400">
                                            {farmer.farms.length} Farm(s)
                                            {farmer.farms?.some((f) => f.riskLevel === 'High') && <span className="ml-1.5 text-red-600 font-medium">• High Risk</span>}
                                        </p>
                                    </div>
                                    <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">Analyze</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Analysis Result */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-medium mb-4">Risk Analysis Report</h2>
                    {loading && <p className="text-gray-500">Analyzing geospatial data...</p>}
                    {!loading && selectedFarmer && !riskResult && <p className="text-gray-500">Select a farmer to view risk analysis.</p>}

                    {!loading && riskResult && (
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                            {/* Overall risk banner */}
                            <div className={`border-l-4 p-4 rounded-r ${riskResult.overallRisk === 'High' ? 'bg-red-50 border-red-500' : (riskResult.overallRisk === 'Medium' ? 'bg-orange-50 border-orange-500' : 'bg-green-50 border-green-500')}`}>
                                <div className="flex items-center">
                                    {riskResult.overallRisk === 'High' ? <AlertTriangle className="h-6 w-6 text-red-500 mr-2" /> : (riskResult.overallRisk === 'Medium' ? <AlertTriangle className="h-6 w-6 text-orange-500 mr-2" /> : <CheckCircle className="h-6 w-6 text-green-500 mr-2" />)}
                                    <h3 className={`text-lg font-medium ${riskResult.overallRisk === 'High' ? 'text-red-800' : (riskResult.overallRisk === 'Medium' ? 'text-orange-800' : 'text-green-800')}`}>
                                        {riskResult.overallRisk === 'High' ? 'High Risk Detected' : (riskResult.overallRisk === 'Medium' ? 'Medium Risk Detected' : 'Compliant')}
                                    </h3>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <RiskBadge value={riskResult.deforestationRisk} label="Deforestation" />
                                    <RiskBadge value={riskResult.legalityRisk} label="Legality" />
                                    <RiskBadge value={riskResult.traceabilityRisk} label="Traceability" />
                                    {riskResult.overlapResult && riskResult.overlapResult !== 'None' && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                            Overlap: {riskResult.overlapResult}
                                        </span>
                                    )}
                                </div>
                                {riskResult.overlappingAreas && riskResult.overlappingAreas.length > 0 && (
                                    <p className="text-xs text-red-600 mt-2">Overlapping areas: {riskResult.overlappingAreas.join(', ')}</p>
                                )}
                            </div>

                            {/* Deforestation narrative - plain-language, evidence-cited explanation of WHY */}
                            {(riskResult.details?.narrative || riskResult.details?.notes) && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2 mb-2">
                                        <FileText className="h-4 w-4" />
                                        Why this verdict? (satellite evidence)
                                    </h3>
                                    <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">
                                        {riskResult.details?.narrative || riskResult.details?.notes}
                                    </p>
                                </div>
                            )}

                            {/* Assessment details */}
                            <Section title="Assessment details" icon={<FileText className="h-4 w-4" />}>
                                <div className="space-y-1">
                                    <DataRow label="Assessed at" value={formatDate(riskResult.details?.assessedAt)} />
                                    {riskResult.details?.commodities?.length ? (
                                        <DataRow label="Commodities" value={riskResult.details.commodities.join(', ')} />
                                    ) : null}
                                    {riskResult.whispAnalysisId && <DataRow label="Whisp analysis ID" value={riskResult.whispAnalysisId} />}
                                    {riskResult.id && <DataRow label="Assessment ID" value={riskResult.id} />}
                                    {riskResult.createdAt && <DataRow label="Created" value={formatDate(riskResult.createdAt)} />}
                                </div>
                            </Section>

                            {/* Whisp data — real Open Foris Whisp satellite EUDR indicators */}
                            {riskResult.whispData && (
                                <Section title="Whisp analysis (Open Foris / EUDR)" icon={<BarChart3 className="h-4 w-4" />}>
                                    <div className="space-y-1">
                                        <DataRow label="Job/Result ID" value={riskResult.whispData.resultId} />
                                        <DataRow label="Area (Whisp-computed)" value={`${riskResult.whispData.areaHa.toFixed(3)} ${riskResult.whispData.unit}`} />
                                        <DataRow label="Country" value={[riskResult.whispData.country, riskResult.whispData.adminLevel1].filter(Boolean).join(' / ')} />
                                        {riskResult.whispData.centroid && (
                                            <DataRow label="Centroid (lat, lon)" value={`${riskResult.whispData.centroid.lat}, ${riskResult.whispData.centroid.lon}`} />
                                        )}
                                        <DataRow
                                            label="EUFO 2020 overlap"
                                            value={
                                                <span className={riskResult.whispData.eufo2020Ha > 0 ? 'text-red-700 font-semibold' : 'text-green-700'}>
                                                    {riskResult.whispData.eufo2020Ha.toFixed(3)} ha
                                                </span>
                                            }
                                        />
                                        <DataRow label="In waterbody" value={riskResult.whispData.inWaterbody ? 'Yes' : 'No'} />

                                        {/* Commodity-category risk (pre-computed by Whisp) */}
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {(['riskPerennialCrop', 'riskAnnualCrop', 'riskTimber'] as const).map((k) => {
                                                const label = k === 'riskPerennialCrop' ? 'Perennial crop' : k === 'riskAnnualCrop' ? 'Annual crop' : 'Timber';
                                                const val = riskResult.whispData![k];
                                                const cls = val === 'high' ? 'bg-red-100 text-red-800' : val === 'low' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600';
                                                return (
                                                    <span key={k} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
                                                        {label} risk: {val}
                                                    </span>
                                                );
                                            })}
                                        </div>

                                        {/* Commodity overlap datasets */}
                                        {riskResult.whispData.commodityOverlaps?.length ? (
                                            <DataRow
                                                label="Commodity overlap"
                                                value={
                                                    <ul className="list-disc list-inside text-sm text-gray-900 space-y-0.5">
                                                        {riskResult.whispData.commodityOverlaps.map((c, i) => (
                                                            <li key={i}>{c.commodity} ({c.datasetKey}): {c.overlapHa.toFixed(3)} ha</li>
                                                        ))}
                                                    </ul>
                                                }
                                            />
                                        ) : null}

                                        {/* Annual disturbance / loss / alert timeline */}
                                        {riskResult.whispData.annualEvents?.length ? (
                                            <DataRow
                                                label="Annual disturbance timeline"
                                                value={
                                                    <ul className="list-disc list-inside text-sm text-gray-900 space-y-0.5">
                                                        {riskResult.whispData.annualEvents.map((e, i) => {
                                                            const parts: string[] = [];
                                                            if (e.gfcLossHa) parts.push(`GFC loss ${e.gfcLossHa.toFixed(3)} ha`);
                                                            if (e.tmfDeforestationHa) parts.push(`TMF deforestation ${e.tmfDeforestationHa.toFixed(3)} ha`);
                                                            if (e.tmfDegradationHa) parts.push(`TMF degradation ${e.tmfDegradationHa.toFixed(3)} ha`);
                                                            if (e.raddAlertHa) parts.push(`RADD alert ${e.raddAlertHa.toFixed(3)} ha`);
                                                            if (e.gladLAlertHa) parts.push(`GLAD-L alert ${e.gladLAlertHa.toFixed(3)} ha`);
                                                            if (e.gladS2AlertHa) parts.push(`GLAD-S2 alert ${e.gladS2AlertHa.toFixed(3)} ha`);
                                                            return <li key={i}><span className={e.year > 2020 ? 'text-red-700 font-medium' : ''}>{e.year}</span>: {parts.join(', ')}</li>;
                                                        })}
                                                    </ul>
                                                }
                                            />
                                        ) : (
                                            <DataRow label="Annual disturbance timeline" value="No disturbance/loss detected" />
                                        )}

                                        {/* EUDR compliance indicator flags */}
                                        <div className="pt-2 mt-1 border-t border-gray-100">
                                            <span className="text-gray-500 text-sm block mb-1">EUDR indicators</span>
                                            <div className="grid grid-cols-2 gap-1">
                                                {Object.entries({
                                                    'Tree cover': riskResult.whispData.indicators.treecover,
                                                    'Commodities present': riskResult.whispData.indicators.commodities,
                                                    'Disturbance before 2020': riskResult.whispData.indicators.disturbanceBefore2020,
                                                    'Disturbance after 2020': riskResult.whispData.indicators.disturbanceAfter2020,
                                                    'Primary forest (2020)': riskResult.whispData.indicators.primary2020,
                                                    'Nat. regen. forest (2020)': riskResult.whispData.indicators.natRegForest2020,
                                                    'Planted plantation (2020)': riskResult.whispData.indicators.plantedPlantations2020,
                                                    'Planted plantation after 2020': riskResult.whispData.indicators.plantedPlantationsAfter2020,
                                                    'Tree cover after 2020': riskResult.whispData.indicators.treecoverAfter2020,
                                                    'Agriculture after 2020': riskResult.whispData.indicators.agriAfter2020,
                                                    'Logging concession before 2020': riskResult.whispData.indicators.loggingConcessionBefore2020,
                                                }).map(([label, val]) => val ? (
                                                    <span key={label} className={`text-[11px] px-1.5 py-0.5 rounded ${val === 'yes' ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                                                        {label}: {val}
                                                    </span>
                                                ) : null)}
                                            </div>
                                        </div>

                                        {riskResult.whispData.whispVersion && (
                                            <p className="text-[11px] text-gray-400 pt-2">
                                                Whisp v{riskResult.whispData.whispVersion} · processed {formatDate(riskResult.whispData.processedAt)}
                                            </p>
                                        )}
                                    </div>
                                </Section>
                            )}

                            {/* Farm */}
                            {riskResult.farm && (
                                <Section title="Farm" icon={<MapPin className="h-4 w-4" />}>
                                    <div className="space-y-1">
                                        <DataRow label="Name" value={riskResult.farm.name} />
                                        <DataRow label="Crop type" value={riskResult.farm.cropType} />
                                        <DataRow label="Risk level" value={riskResult.farm.riskLevel} />
                                        <DataRow label="Total area (ha)" value={riskResult.farm.totalAreaHa != null ? String(riskResult.farm.totalAreaHa) : undefined} />
                                        <DataRow label="Ownership" value={riskResult.farm.ownershipType} />
                                        <DataRow label="Registration" value={riskResult.farm.farmRegistrationStatus} />
                                        <DataRow label="Last risk assessment" value={formatDate(riskResult.farm.lastRiskAssessmentDate)} />
                                        <DataRow label="Manual size" value={riskResult.farm.manualSizeInput ? `${riskResult.farm.manualSizeInput} ${riskResult.farm.manualSizeUnit || ''}`.trim() : undefined} />
                                        <DataRow label="Use chemicals" value={riskResult.farm.useChemicals != null ? (riskResult.farm.useChemicals ? 'Yes' : 'No') : undefined} />
                                        <DataRow label="Extension services" value={riskResult.farm.extensionServices != null ? (riskResult.farm.extensionServices ? 'Yes' : 'No') : undefined} />
                                        {riskResult.farm.farmNotes && <DataRow label="Notes" value={riskResult.farm.farmNotes} />}
                                        {(() => {
                                            const loc = riskResult.farm!.location;
                                            if (!loc?.coordinates) return null;
                                            const coords = loc.coordinates as number[][] | number[];
                                            const points: string[] = [];
                                            if (loc.type === 'Point' && Array.isArray(coords) && coords.length >= 2) {
                                                points.push(`${coords[1]}, ${coords[0]}`);
                                            } else if (loc.type === 'Polygon' && Array.isArray(coords[0])) {
                                                const ring = coords[0] as unknown as number[][];
                                                ring.forEach((c: number[]) => points.push(`${c[1]}, ${c[0]}`));
                                            }
                                            return points.length ? <CopyableCoords label="Boundary coordinates (lat, lon)" text={points.join('\n')} /> : null;
                                        })()}
                                        <DataRow label="Created" value={formatDate(riskResult.farm.createdAt)} />
                                        <DataRow label="Updated" value={formatDate(riskResult.farm.updatedAt)} />
                                    </div>
                                </Section>
                            )}

                            {/* Farmer */}
                            {riskResult.farm?.farmer && (
                                <Section title="Farmer" icon={<User className="h-4 w-4" />}>
                                    <div className="space-y-1">
                                        <DataRow label="Name" value={`${riskResult.farm.farmer.firstName} ${riskResult.farm.farmer.lastName}`} />
                                        <DataRow label="Email" value={riskResult.farm.farmer.email} />
                                        <DataRow label="Phone" value={riskResult.farm.farmer.phoneNumber} />
                                        <DataRow label="National ID" value={riskResult.farm.farmer.nationalId} />
                                        <DataRow label="Gender" value={riskResult.farm.farmer.gender} />
                                        <DataRow label="DOB" value={riskResult.farm.farmer.dob ? formatDate(riskResult.farm.farmer.dob) : undefined} />
                                        <DataRow label="Nationality" value={riskResult.farm.farmer.nationality} />
                                        <DataRow label="Community" value={riskResult.farm.farmer.community} />
                                        <DataRow label="District" value={riskResult.farm.farmer.district} />
                                        <DataRow label="Region" value={riskResult.farm.farmer.region} />
                                        <DataRow label="Address" value={riskResult.farm.farmer.address} />
                                        <DataRow label="Identity status" value={riskResult.farm.farmer.identityStatus} />
                                        <DataRow label="Enumerator" value={riskResult.farm.farmer.enumeratorName} />
                                        <DataRow label="Directions" value={riskResult.farm.farmer.directions} />
                                        <CopyableCoords label="Coordinates (lat, lon)" text={[riskResult.farm.farmer.latitude, riskResult.farm.farmer.longitude].filter(Boolean).join(', ') || ''} />
                                        <DataRow label="Created" value={formatDate(riskResult.farm.farmer.createdAt)} />
                                    </div>
                                </Section>
                            )}
                        </div>
                    )}

                    {/* Mini Map Preview */}
                    {(() => {
                        const farmWithLoc = riskResult?.farm?.location ? riskResult.farm : selectedFarmer?.farms?.[0];
                        return farmWithLoc?.location ? (
                        <div className="mt-6 h-64 w-full rounded-md overflow-hidden border border-gray-200">
                            {(() => {
                                const loc = farmWithLoc.location;
                                // Narrowed GeoJSON coordinates (see GeoJsonCoordinate above) instead
                                // of `any` — the shape still varies by geometry type, so we index
                                // into it defensively below exactly as before.
                                const coords = loc.coordinates as GeoJsonCoordinate[];

                                // Calculate center based on geometry type
                                const getCenter = (): [number, number] => {
                                    if (loc.type === 'Point') {
                                        return [coords[1] as number, coords[0] as number];
                                    }
                                    if (loc.type === 'Polygon' && coords[0]) {
                                        // Calculate centroid of the polygon
                                        const points = coords[0] as GeoJsonCoordinate[];
                                        if (points.length === 0) return [5.6037, -0.1870];

                                        let latSum = 0;
                                        let lonSum = 0;
                                        points.forEach((p) => {
                                            const pair = p as number[];
                                            lonSum += pair[0];
                                            latSum += pair[1];
                                        });
                                        return [latSum / points.length, lonSum / points.length];
                                    }
                                    // Default (Ghana)
                                    return [5.6037, -0.1870];
                                };

                                const center = getCenter();

                                // Determine color based on risk
                                const riskColor = riskResult?.overallRisk === 'High' ? 'red' : (riskResult?.overallRisk === 'Medium' ? 'orange' : 'green');

                                return (
                                    <MapContainer center={center} zoom={10} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                        {loc.type === 'Point' && (
                                            <CircleMarker
                                                center={[coords[1] as number, coords[0] as number]}
                                                radius={10}
                                                pathOptions={{ color: riskColor }}
                                            />
                                        )}
                                        {loc.type === 'Polygon' && (
                                            <Polygon
                                                positions={(coords[0] as GeoJsonCoordinate[]).map((c) => {
                                                    const pair = c as number[];
                                                    return [pair[1], pair[0]] as [number, number];
                                                })}
                                                color={riskColor}
                                            />
                                        )}
                                        {/* MultiPolygon support if needed */}
                                        {loc.type === 'MultiPolygon' && (loc.coordinates as GeoJsonCoordinate[][]).map((poly, i: number) => (
                                            <Polygon
                                                key={i}
                                                positions={(poly[0] as GeoJsonCoordinate[]).map((c) => {
                                                    const pair = c as number[];
                                                    return [pair[1], pair[0]] as [number, number];
                                                })}
                                                color={riskColor}
                                            />
                                        ))}

                                    </MapContainer>
                                );
                            })()}
                        </div>
                        ) : null;
                    })()}
                </div>
            </div>
        </div>
    );
};

export default RiskAnalysis;

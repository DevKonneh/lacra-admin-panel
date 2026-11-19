import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, CircleMarker, Marker, Popup, useMap, useMapEvents, ScaleControl } from 'react-leaflet';
import * as turf from '@turf/turf';
import { getFarms, type FarmWithFarmer } from '../api/farms';
import {
    Satellite, Map as MapIcon, Crosshair, MapPinned, Sprout, MapPin, Loader2,
    Users, Search, X, ChevronDown, ChevronRight, ShieldCheck, ShieldAlert,
    AlertTriangle, ExternalLink, Ruler, Menu, ListFilter, Clock,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { LIBERIA_COUNTIES } from '../data/liberiaCounties';
import {
    effectiveRiskLevel, isAssessed, isStaleAssessment, daysSince, type RiskLevel,
} from '../utils/riskStatus';
import {
    STREET_TILE,
    STREET_ATTRIBUTION,
    SATELLITE_TILE,
    SATELLITE_LABELS_TILE,
    SATELLITE_ATTRIBUTION,
    SATELLITE_MAX_NATIVE_ZOOM,
    SATELLITE_MAX_ZOOM,
    SATELLITE_MAX_AUTO_FIT_ZOOM,
    SATELLITE_TILE_SIZE,
    SATELLITE_ZOOM_OFFSET,
} from '../config/mapTiles';

type LatLng = [number, number];

const MAX_AUTO_FIT_ZOOM = SATELLITE_MAX_AUTO_FIT_ZOOM;

// Feature caps that keep the national map usable with large datasets. Both
// are stated in the UI when they bite, so "fewer pins than farms" is never
// mistaken for "these farms have no geometry".
const FEATURE_CAP = 750;
const LIST_PAGE = 150;

// ---------------------------------------------------------------------------
// Risk styling — single source of truth for the EUDR-style color language
// used across pins, polygons, badges and the legend.
//
// NOTE: callers pass the EFFECTIVE risk level (null when never assessed),
// via effectiveRiskLevel() — never Farm.riskLevel directly, which defaults
// to 'Low' in the database and would paint an unassessed farm green.
// ---------------------------------------------------------------------------
const RISK_STYLE: Record<string, { stroke: string; fill: string; badgeBg: string; badgeText: string; dot: string; label: string }> = {
    Low: { stroke: '#15803d', fill: '#22c55e', badgeBg: 'bg-green-100', badgeText: 'text-green-800', dot: '#22c55e', label: 'Low Risk' },
    Medium: { stroke: '#b45309', fill: '#f59e0b', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800', dot: '#f59e0b', label: 'Medium Risk' },
    High: { stroke: '#b91c1c', fill: '#ef4444', badgeBg: 'bg-red-100', badgeText: 'text-red-800', dot: '#ef4444', label: 'High Risk' },
    Unknown: { stroke: '#475569', fill: '#94a3b8', badgeBg: 'bg-slate-100', badgeText: 'text-slate-700', dot: '#94a3b8', label: 'Not Assessed' },
};
const riskStyle = (risk?: string | null) => RISK_STYLE[risk || 'Unknown'] || RISK_STYLE.Unknown;

/** Leaves visited before 2020, matching Whisp's EUDR baseline year. */
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'Never');

// Colored, pulsing centroid pin (parametrized by risk color) — reused for both
// Point-only farms and the centroid of Polygon-boundary farms so every farm,
// regardless of how it was captured, is equally visible and clickable.
const pinIconCache: Record<string, L.DivIcon> = {};
const coloredPinIcon = (color: string, highlighted: boolean) => {
    const key = `${color}-${highlighted}`;
    if (pinIconCache[key]) return pinIconCache[key];
    const size = highlighted ? 32 : 26;
    const dot = highlighted ? 20 : 16;
    const icon = L.divIcon({
        className: '',
        html: `
            <div style="position:relative;width:${size}px;height:${size}px;">
                <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.35;animation:farmPinPulse 1.8s ease-out infinite;"></div>
                <div style="position:absolute;top:${(size - dot) / 2}px;left:${(size - dot) / 2}px;width:${dot}px;height:${dot}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 6px rgba(0,0,0,.45);"></div>
            </div>
            <style>@keyframes farmPinPulse { 0% { transform: scale(0.6); opacity:.55; } 100% { transform: scale(2.4); opacity:0; } }</style>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
    pinIconCache[key] = icon;
    return icon;
};

interface FarmGeo {
    farm: FarmWithFarmer;
    center: LatLng;
    /** Every outer ring to draw (1 for Polygon, N for MultiPolygon). */
    rings: LatLng[][];
    /** Primary ring used for fit-to-view; null for point-only farms. */
    polygonPositions: LatLng[] | null;
    geometryLabel: string;
}

const ringToLatLngs = (ring: any[]): LatLng[] => ring.map((pt: any) => [pt[1], pt[0]] as LatLng);

/**
 * Converts a farm's stored GeoJSON into Leaflet render data.
 *
 * GeoJSON is ALWAYS [longitude, latitude]; Leaflet is [lat, lng], so every
 * ring is swapped exactly once here (pt[1], pt[0]). Doing the swap in one
 * place keeps map positions consistent with the coordinates shown in the
 * popup and in the Farm Details panel.
 *
 * MultiPolygon is supported because Farm.location is a free Geometry
 * column server-side; previously a MultiPolygon farm fell through and was
 * silently treated as "not mapped" on the national map.
 */
const getFarmGeo = (farm: FarmWithFarmer): FarmGeo | null => {
    const loc: any = farm.location;
    if (!loc || !loc.coordinates) return null;
    try {
        if (loc.type === 'Polygon') {
            const ring = ringToLatLngs(loc.coordinates[0]);
            const centroid = turf.centroid(loc as any);
            const center: LatLng = [centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]];
            return { farm, center, rings: [ring], polygonPositions: ring, geometryLabel: 'GPS Polygon' };
        }
        if (loc.type === 'MultiPolygon') {
            const rings = (loc.coordinates || [])
                .map((poly: any) => ringToLatLngs(poly[0]))
                .filter((r: LatLng[]) => r.length > 0);
            if (rings.length === 0) return null;
            const centroid = turf.centroid(loc as any);
            const center: LatLng = [centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]];
            // Fit to the ring enclosing the most vertices (best proxy for the main part).
            const primary = rings.reduce((a: LatLng[], b: LatLng[]) => (b.length > a.length ? b : a), rings[0]);
            return { farm, center, rings, polygonPositions: primary, geometryLabel: `GPS Multi-polygon (${rings.length})` };
        }
        if (loc.type === 'Point') {
            const center: LatLng = [loc.coordinates[1], loc.coordinates[0]];
            return { farm, center, rings: [], polygonPositions: null, geometryLabel: 'Single GPS Point' };
        }
    } catch {
        return null;
    }
    return null;
};

const HoverTracker: React.FC<{ onMove: (latlng: LatLng | null) => void }> = ({ onMove }) => {
    useMapEvents({
        mousemove: (e) => onMove([e.latlng.lat, e.latlng.lng]),
        mouseout: () => onMove(null),
    });
    return null;
};

// Reports the current viewport so the map can render only what's visible.
// Without this, every farm's polygon + marker is mounted at once, which
// becomes unusable at national scale.
const ViewportTracker: React.FC<{ onChange: (b: L.LatLngBounds) => void }> = ({ onChange }) => {
    const map = useMap();
    useEffect(() => {
        const emit = () => onChange(map.getBounds());
        emit();
        map.on('moveend', emit);
        map.on('zoomend', emit);
        return () => {
            map.off('moveend', emit);
            map.off('zoomend', emit);
        };
    }, [map, onChange]);
    return null;
};

// ---------------------------------------------------------------------------
// Imperative map controller: flies the camera and opens the right popup
// whenever the user picks a farmer / farm from the sidebar, or resets view.
// ---------------------------------------------------------------------------
interface MapControllerProps {
    geos: FarmGeo[];
    selectedFarmId: string | null;
    selectedFarmerId: string | null;
    resetTrigger: number;
    layerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
}
const MapController: React.FC<MapControllerProps> = ({ geos, selectedFarmId, selectedFarmerId, resetTrigger, layerRefs }) => {
    const map = useMap();

    useEffect(() => {
        if (geos.length === 0) return;

        if (selectedFarmId) {
            const geo = geos.find(g => g.farm.id === selectedFarmId);
            if (geo) {
                if (geo.polygonPositions) {
                    map.flyToBounds(geo.polygonPositions, { padding: [60, 60], maxZoom: MAX_AUTO_FIT_ZOOM });
                } else {
                    map.flyTo(geo.center, MAX_AUTO_FIT_ZOOM, { duration: 0.9 });
                }
                setTimeout(() => layerRefs.current[selectedFarmId]?.openPopup(), 350);
            }
            return;
        }

        if (selectedFarmerId) {
            const farmerGeos = geos.filter(g => g.farm.farmer.id === selectedFarmerId);
            if (farmerGeos.length > 0) {
                const allPts: LatLng[] = [];
                farmerGeos.forEach(g => {
                    if (g.polygonPositions) allPts.push(...g.polygonPositions);
                    else allPts.push(g.center);
                });
                if (allPts.length === 1) {
                    map.flyTo(allPts[0], MAX_AUTO_FIT_ZOOM, { duration: 0.9 });
                } else {
                    map.flyToBounds(allPts, { padding: [60, 60], maxZoom: MAX_AUTO_FIT_ZOOM });
                }
                setTimeout(() => layerRefs.current[farmerGeos[0].farm.id]?.openPopup(), 350);
            }
            return;
        }

        // Nothing selected -> fit to everything (initial load or explicit reset)
        const allPts: LatLng[] = [];
        geos.forEach(g => {
            if (g.polygonPositions) allPts.push(...g.polygonPositions);
            else allPts.push(g.center);
        });
        if (allPts.length > 0) {
            map.fitBounds(allPts, { padding: [40, 40], maxZoom: MAX_AUTO_FIT_ZOOM });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFarmId, selectedFarmerId, resetTrigger, geos.length]);

    return null;
};

/** Assessment-status filter values shown in the sidebar. */
type AssessmentFilter = 'All' | 'Not Assessed' | 'Stale' | 'Assessed';

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const MapView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [farms, setFarms] = useState<FarmWithFarmer[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [layer, setLayer] = useState<'satellite' | 'street'>('satellite');
    const [hoverLatLng, setHoverLatLng] = useState<LatLng | null>(null);
    const { result: hoverPlace, loading: hoverPlaceLoading } = useReverseGeocode(hoverLatLng);

    const [searchTerm, setSearchTerm] = useState('');
    const [riskFilter, setRiskFilter] = useState<'All' | RiskLevel | 'Not Assessed'>('All');
    const [countyFilter, setCountyFilter] = useState('All');
    const [districtFilter, setDistrictFilter] = useState('All');
    const [assessmentFilter, setAssessmentFilter] = useState<AssessmentFilter>('All');
    const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
    const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
    const [expandedFarmerId, setExpandedFarmerId] = useState<string | null>(null);
    const [resetTrigger, setResetTrigger] = useState(0);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [listLimit, setListLimit] = useState(LIST_PAGE);
    const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);

    const layerRefs = useRef<Record<string, L.Marker | null>>({});

    useEffect(() => {
        const fetchFarms = async () => {
            try {
                setLoading(true);
                setLoadError(null);
                const response = await getFarms();
                if (response.data.status) {
                    setFarms(response.data.data);
                } else {
                    setLoadError(response.data.message || 'Failed to load farms.');
                }
            } catch (error) {
                console.error('Error fetching farms', error);
                setLoadError('Failed to load farms for the map. Please check your connection and try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchFarms();
    }, []);

    // Deep-link support: /map?farmId=xxx (used by "View on Map" from the Farms list)
    useEffect(() => {
        const farmId = searchParams.get('farmId');
        if (farmId && farms.length > 0) {
            const farm = farms.find(f => f.id === farmId);
            if (farm) {
                setSelectedFarmId(farmId);
                setSelectedFarmerId(farm.farmer.id);
                setExpandedFarmerId(farm.farmer.id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [farms.length]);

    const geos = useMemo(() => farms.map(getFarmGeo).filter((g): g is FarmGeo => g !== null), [farms]);
    const geoByFarmId = useMemo(() => {
        const m = new Map<string, FarmGeo>();
        geos.forEach(g => m.set(g.farm.id, g));
        return m;
    }, [geos]);

    // County filter narrows the district list so the two dropdowns can't
    // be set to an impossible pair.
    const countyNames = useMemo(
        () => Array.from(new Set(farms.map(f => f.farmer?.region).filter(Boolean))).sort() as string[],
        [farms],
    );
    const districtOptions = useMemo(() => {
        const source = countyFilter === 'All'
            ? LIBERIA_COUNTIES.flatMap(c => c.districts)
            : (LIBERIA_COUNTIES.find(c => c.county === countyFilter)?.districts || []);
        const present = new Set(
            farms
                .filter(f => countyFilter === 'All' || f.farmer?.region === countyFilter)
                .map(f => f.farmer?.district)
                .filter(Boolean) as string[],
        );
        // Union of the reference list and any values actually in the data, so
        // a district spelled differently on a record is still selectable.
        return Array.from(new Set([...source, ...present])).sort();
    }, [countyFilter, farms]);

    // Applies every sidebar filter. Shared by the list AND the map so the
    // pins on screen always match the list on the left.
    const passesFilters = (farm: FarmWithFarmer): boolean => {
        const level = effectiveRiskLevel(farm);
        const matchesRisk =
            riskFilter === 'All'
            || (riskFilter === 'Not Assessed' ? !isAssessed(farm) : level === riskFilter);
        const matchesCounty = countyFilter === 'All' || (farm.farmer?.region || '') === countyFilter;
        const matchesDistrict = districtFilter === 'All' || (farm.farmer?.district || '') === districtFilter;
        const matchesAssessment =
            assessmentFilter === 'All'
            || (assessmentFilter === 'Assessed' && isAssessed(farm))
            || (assessmentFilter === 'Not Assessed' && !isAssessed(farm))
            || (assessmentFilter === 'Stale' && isStaleAssessment(farm));
        return matchesRisk && matchesCounty && matchesDistrict && matchesAssessment;
    };

    // Group farms by farmer for the sidebar
    const farmerGroups = useMemo(() => {
        const map = new Map<string, { farmer: FarmWithFarmer['farmer']; farms: FarmWithFarmer[] }>();
        farms.forEach(f => {
            const existing = map.get(f.farmer.id);
            if (existing) existing.farms.push(f);
            else map.set(f.farmer.id, { farmer: f.farmer, farms: [f] });
        });
        return Array.from(map.values());
    }, [farms]);

    const filteredFarmerGroups = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return farmerGroups
            .map(group => ({ ...group, farms: group.farms.filter(passesFilters) }))
            .filter(group => {
                if (group.farms.length === 0) return false;
                if (!term) return true;
                const farmerName = `${group.farmer.firstName} ${group.farmer.lastName}`.toLowerCase();
                const farmNameMatch = group.farms.some(f => f.name.toLowerCase().includes(term));
                return farmerName.includes(term) || farmNameMatch;
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [farmerGroups, searchTerm, riskFilter, countyFilter, districtFilter, assessmentFilter]);

    // Paged sidebar rendering — thousands of farmer rows in the DOM would
    // stall the page even though they're inside a scroll container.
    const visibleFarmerGroups = filteredFarmerGroups.slice(0, listLimit);
    const hiddenFarmerCount = filteredFarmerGroups.length - visibleFarmerGroups.length;

    // Farms whose geometry passes the sidebar filters and (once known) whose
    // centroid/ring lies in the current viewport. Selected farms are always
    // included so a deep-linked farm can't disappear after a pan.
    const visibleGeos = useMemo(() => {
        const passed = geos.filter(g => passesFilters(g.farm));
        if (!bounds) return passed.slice(0, FEATURE_CAP);
        const inBounds = passed.filter(g => bounds.contains(g.center));
        if (selectedFarmId) {
            const sel = passed.find(g => g.farm.id === selectedFarmId);
            if (sel && !inBounds.includes(sel)) inBounds.unshift(sel);
        }
        return inBounds;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geos, bounds, riskFilter, countyFilter, districtFilter, assessmentFilter, selectedFarmId]);

    const truncatedByViewport = !bounds && geos.filter(g => passesFilters(g.farm)).length > FEATURE_CAP;

    // Top stats. "Low Risk" counts ONLY farms with a completed assessment —
    // an unassessed farm is reported separately as "Not Assessed" instead of
    // being absorbed into the Low bucket by the DB default.
    const stats = useMemo(() => {
        const totalFarmers = farmerGroups.length;
        const totalFarms = farms.length;
        const mapped = geos.length;
        const polygonCount = geos.filter(g => g.polygonPositions).length;
        const pointCount = geos.filter(g => !g.polygonPositions).length;
        const byRisk = { Low: 0, Medium: 0, High: 0, Unknown: 0 } as Record<string, number>;
        let notAssessed = 0;
        let stale = 0;
        farms.forEach(f => {
            const level = effectiveRiskLevel(f);
            if (!level) {
                byRisk.Unknown += 1;
                notAssessed += 1;
                return;
            }
            byRisk[level] += 1;
            if (isStaleAssessment(f)) stale += 1;
        });
        const coveragePct = totalFarms > 0 ? Math.round((mapped / totalFarms) * 100) : 0;
        return { totalFarmers, totalFarms, mapped, polygonCount, pointCount, byRisk, notAssessed, stale, coveragePct };
    }, [farms, farmerGroups, geos]);

    const handleSelectFarmer = (farmerId: string) => {
        setSelectedFarmerId(farmerId);
        setSelectedFarmId(null);
        setExpandedFarmerId(prev => (prev === farmerId ? prev : farmerId));
        if (window.innerWidth < 1024) setMobileSidebarOpen(false);
    };
    const handleSelectFarm = (farm: FarmWithFarmer) => {
        setSelectedFarmId(farm.id);
        setSelectedFarmerId(farm.farmer.id);
        if (window.innerWidth < 1024) setMobileSidebarOpen(false);
    };
    const handleReset = () => {
        setSelectedFarmId(null);
        setSelectedFarmerId(null);
        setResetTrigger(t => t + 1);
    };

    const activeFilterCount = [
        searchTerm.trim() !== '',
        riskFilter !== 'All',
        countyFilter !== 'All',
        districtFilter !== 'All',
        assessmentFilter !== 'All',
    ].filter(Boolean).length;

    const clearFilters = () => {
        setSearchTerm('');
        setRiskFilter('All');
        setCountyFilter('All');
        setDistrictFilter('All');
        setAssessmentFilter('All');
        setListLimit(LIST_PAGE);
    };

    const defaultCenter: LatLng = [6.3156, -10.8074]; // Monrovia, Liberia

    // ---- Sidebar content (shared between desktop static column and mobile drawer) ----
    const sidebarContent = (
        <div className="flex flex-col h-full bg-white">
            <div className="p-3 border-b border-brand-border space-y-2.5">
                <div className="flex items-center justify-between">
                    <h2 className="font-extrabold text-sm text-brand-text flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-brand-green" /> All Farmers
                        <span className="ml-1 text-[11px] font-bold text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded-full">
                            {filteredFarmerGroups.length}
                        </span>
                    </h2>
                    <button
                        type="button"
                        onClick={() => setMobileSidebarOpen(false)}
                        className="lg:hidden p-1 text-brand-muted hover:text-brand-text"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="relative">
                    <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setListLimit(LIST_PAGE); }}
                        placeholder="Search farmer or farm name..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs border border-brand-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-green focus:border-brand-green"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* County / district filters. District options follow the
                    selected county so an impossible pair can't be picked. */}
                <div className="grid grid-cols-2 gap-1.5">
                    <select
                        aria-label="Filter by county"
                        value={countyFilter}
                        onChange={(e) => {
                            setCountyFilter(e.target.value);
                            setDistrictFilter('All');
                            setListLimit(LIST_PAGE);
                        }}
                        className="w-full px-1.5 py-1 text-[11px] border border-brand-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-green"
                    >
                        <option value="All">All counties</option>
                        {countyNames.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                        aria-label="Filter by district"
                        value={districtFilter}
                        onChange={(e) => { setDistrictFilter(e.target.value); setListLimit(LIST_PAGE); }}
                        className="w-full px-1.5 py-1 text-[11px] border border-brand-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-green"
                    >
                        <option value="All">All districts</option>
                        {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                    <ListFilter className="h-3 w-3 text-gray-400 mr-0.5" />
                    {(['All', 'Low', 'Medium', 'High', 'Not Assessed'] as const).map(opt => {
                        const active = riskFilter === opt;
                        const style = opt === 'All' ? null : riskStyle(opt);
                        return (
                            <button
                                key={opt}
                                onClick={() => { setRiskFilter(opt as any); setListLimit(LIST_PAGE); }}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${active
                                    ? 'bg-brand-green text-white border-brand-green'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand-green/40'
                                    }`}
                            >
                                {style && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ background: active ? '#fff' : style.dot }} />}
                                {opt}
                            </button>
                        );
                    })}
                </div>

                {/* "Find farms that need review" — not assessed and stale
                    assessments are the two queues staff actually work. */}
                <div className="flex items-center gap-1 flex-wrap">
                    <Clock className="h-3 w-3 text-gray-400 mr-0.5" />
                    {([
                        { key: 'All', label: 'Any assessment' },
                        { key: 'Not Assessed', label: 'Never assessed' },
                        { key: 'Stale', label: 'Stale (>12mo)' },
                        { key: 'Assessed', label: 'Assessed' },
                    ] as const).map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => { setAssessmentFilter(opt.key); setListLimit(LIST_PAGE); }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${assessmentFilter === opt.key
                                ? 'bg-brand-brown text-white border-brand-brown'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-brown/40'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="text-[11px] text-gray-500 hover:text-gray-800 underline">
                        Clear {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {loading && (
                    <div className="flex items-center justify-center py-10 text-gray-400 text-xs gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading farmers...
                    </div>
                )}
                {!loading && loadError && (
                    <div className="text-center py-8 px-3 space-y-2">
                        <AlertTriangle className="h-5 w-5 text-red-500 mx-auto" />
                        <p className="text-[11px] text-gray-600">{loadError}</p>
                    </div>
                )}
                {!loading && !loadError && filteredFarmerGroups.length === 0 && (
                    <div className="text-center text-gray-400 text-xs py-10">No farmers match your filters.</div>
                )}
                {!loading && !loadError && visibleFarmerGroups.map(({ farmer, farms: fFarms }) => {
                    const isExpanded = expandedFarmerId === farmer.id;
                    const isSelected = selectedFarmerId === farmer.id && !selectedFarmId;
                    // Worst assessed risk among this farmer's farms; 'Not Assessed'
                    // when none have been assessed (never defaulted to Low).
                    const worstRisk = fFarms.reduce<string>((worst, f) => {
                        const level = effectiveRiskLevel(f);
                        if (!level) return worst;
                        const order = ['Low', 'Medium', 'High'];
                        if (worst === 'Unknown' || !worst) return level;
                        return order.indexOf(level) > order.indexOf(worst) ? level : worst;
                    }, 'Unknown');
                    const style = riskStyle(worstRisk);
                    const initials = `${farmer.firstName?.[0] || ''}${farmer.lastName?.[0] || ''}`.toUpperCase();
                    const mappedCount = fFarms.filter(f => geoByFarmId.has(f.id)).length;

                    return (
                        <div key={farmer.id} className={`rounded-lg border transition-colors ${isSelected ? 'border-brand-green bg-brand-green/5' : 'border-gray-100 hover:border-brand-green/30'}`}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (mappedCount > 0) handleSelectFarmer(farmer.id);
                                    else setExpandedFarmerId(isExpanded ? null : farmer.id);
                                }}
                                className="w-full flex items-center gap-2 p-2 text-left"
                            >
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white flex-none"
                                    style={{ background: style.dot }}
                                >
                                    {initials || <Users className="h-3.5 w-3.5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-brand-text truncate">{farmer.firstName} {farmer.lastName}</p>
                                    <p className="text-[10.5px] text-brand-muted truncate">
                                        {fFarms.length} farm{fFarms.length !== 1 ? 's' : ''} &middot; {mappedCount}/{fFarms.length} on map
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setExpandedFarmerId(isExpanded ? null : farmer.id); }}
                                    className="p-0.5 text-gray-400 hover:text-brand-green flex-none"
                                >
                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>
                            </button>

                            {isExpanded && (
                                <div className="pl-3 pr-2 pb-2 space-y-1">
                                    {fFarms.map(f => {
                                        const fMapped = geoByFarmId.has(f.id);
                                        const level = effectiveRiskLevel(f);
                                        const fStyle = riskStyle(level);
                                        const fSelected = selectedFarmId === f.id;
                                        return (
                                            <button
                                                key={f.id}
                                                type="button"
                                                disabled={!fMapped}
                                                onClick={() => fMapped && handleSelectFarm(f)}
                                                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-colors ${fSelected ? 'bg-brand-green text-white' : fMapped ? 'hover:bg-brand-green/8 text-brand-text' : 'text-gray-300 cursor-not-allowed'
                                                    }`}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full flex-none"
                                                    style={{ background: fMapped ? fStyle.dot : '#e2e8f0' }}
                                                />
                                                <span className="flex-1 truncate font-semibold">{f.name}</span>
                                                {!fMapped && <span className="text-[9px] italic flex-none">not mapped</span>}
                                                {fMapped && !level && <span className="text-[9px] flex-none opacity-80">not assessed</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {hiddenFarmerCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setListLimit(l => l + LIST_PAGE)}
                        className="w-full text-[11px] font-bold text-brand-green hover:bg-brand-green/8 rounded-lg py-2"
                    >
                        Show {Math.min(hiddenFarmerCount, LIST_PAGE)} more ({hiddenFarmerCount} still hidden)
                    </button>
                )}
            </div>

            <div className="p-2.5 border-t border-brand-border">
                <button
                    type="button"
                    onClick={handleReset}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-brand-green hover:bg-brand-green/8 rounded-lg py-1.5 transition-colors"
                >
                    <Crosshair className="h-3.5 w-3.5" /> Reset View — Show All
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-3">
            {/* Header strip: EUDR framing + national stats */}
            <div className="bg-white border border-brand-border rounded-xl p-3.5 shadow-card">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-brand-green/10 ring-1 ring-brand-brown/15 flex items-center justify-center flex-none">
                            <ShieldCheck className="h-4.5 w-4.5 text-brand-green" />
                        </div>
                        <div>
                            <h1 className="font-extrabold text-sm text-brand-text leading-tight">National Farm Mapping &amp; Traceability</h1>
                            <p className="text-[11.5px] text-brand-muted leading-tight">EUDR-aligned view — geolocated farm boundaries, crop data &amp; deforestation risk status</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setMobileSidebarOpen(true)}
                        className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-green text-white text-xs font-bold"
                    >
                        <Menu className="h-3.5 w-3.5" /> Farmers ({stats.totalFarmers})
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    <StatCard icon={<Users className="h-3.5 w-3.5" />} label="Farmers" value={stats.totalFarmers} color="brand-green" />
                    <StatCard icon={<Sprout className="h-3.5 w-3.5" />} label="Farms" value={stats.totalFarms} color="brand-green" />
                    <StatCard icon={<MapPinned className="h-3.5 w-3.5" />} label="Mapped" value={`${stats.coveragePct}%`} color="brand-green" />
                    <StatCard icon={<Clock className="h-3.5 w-3.5" />} label="Not Assessed" value={stats.notAssessed} color="slate-500" />
                    <StatCard icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Low Risk" value={stats.byRisk.Low} color="green-600" />
                    <StatCard icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Medium Risk" value={stats.byRisk.Medium} color="amber-600" />
                    <StatCard icon={<ShieldAlert className="h-3.5 w-3.5" />} label="High Risk" value={stats.byRisk.High} color="red-600" />
                </div>
                <p className="text-[10.5px] text-brand-muted mt-2">
                    Low / Medium / High count only farms with a <span className="font-semibold">completed</span> assessment.
                    Farms that have never been assessed are counted separately as Not Assessed — a farm is never shown as Low Risk before one has run.
                </p>
                {stats.stale > 0 && (
                    <p className="text-[11px] text-amber-700 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {stats.stale} assessed farm{stats.stale !== 1 ? 's are' : ' is'} older than 12 months — re-assess before relying on the result.
                    </p>
                )}
            </div>

            {/* Sidebar + Map */}
            <div className="flex gap-3 h-[calc(100vh-15rem)] min-h-[420px]">
                {/* Desktop static sidebar */}
                <div className="hidden lg:block w-[300px] flex-none rounded-xl border border-brand-border shadow-card overflow-hidden">
                    {sidebarContent}
                </div>

                {/* Mobile drawer */}
                {mobileSidebarOpen && (
                    <>
                        <div className="fixed inset-0 z-[1400] bg-slate-900/40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
                        <div className="fixed top-0 left-0 h-screen w-[85%] max-w-[320px] z-[1500] shadow-2xl lg:hidden">
                            {sidebarContent}
                        </div>
                    </>
                )}

                {/* Map */}
                <div className="relative flex-1 rounded-xl overflow-hidden shadow-lg border border-gray-200">
                    <MapContainer center={defaultCenter} zoom={7} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                        {layer === 'satellite' ? (
                            <>
                                <TileLayer attribution={SATELLITE_ATTRIBUTION} url={SATELLITE_TILE} maxZoom={SATELLITE_MAX_ZOOM} maxNativeZoom={SATELLITE_MAX_NATIVE_ZOOM} tileSize={SATELLITE_TILE_SIZE} zoomOffset={SATELLITE_ZOOM_OFFSET} />
                                <TileLayer url={SATELLITE_LABELS_TILE} opacity={0.85} maxZoom={SATELLITE_MAX_ZOOM} maxNativeZoom={SATELLITE_MAX_NATIVE_ZOOM} tileSize={SATELLITE_TILE_SIZE} zoomOffset={SATELLITE_ZOOM_OFFSET} />
                            </>
                        ) : (
                            <TileLayer
                                attribution={STREET_ATTRIBUTION}
                                url={STREET_TILE}
                                maxZoom={19}
                            />
                        )}

                        <ScaleControl position="bottomleft" imperial={false} />
                        <HoverTracker onMove={setHoverLatLng} />
                        <ViewportTracker onChange={setBounds} />
                        <MapController geos={geos} selectedFarmId={selectedFarmId} selectedFarmerId={selectedFarmerId} resetTrigger={resetTrigger} layerRefs={layerRefs} />

                        {visibleGeos.map(({ farm, center, rings, polygonPositions, geometryLabel }) => {
                            const level = effectiveRiskLevel(farm);
                            const style = riskStyle(level);
                            const highlighted = farm.id === selectedFarmId || (!!selectedFarmerId && farm.farmer.id === selectedFarmerId);
                            const stale = isStaleAssessment(farm);
                            const ageDays = daysSince(farm.lastRiskAssessmentDate);

                            return (
                                <React.Fragment key={farm.id}>
                                    {rings.map((ring, i) => (
                                        <Polygon
                                            key={`${farm.id}-ring-${i}`}
                                            positions={ring}
                                            pathOptions={{
                                                color: style.stroke,
                                                weight: highlighted ? 4 : 2.5,
                                                fillColor: style.fill,
                                                fillOpacity: highlighted ? 0.45 : 0.28,
                                                dashArray: highlighted ? undefined : '5 4',
                                            }}
                                            eventHandlers={{ click: () => handleSelectFarm(farm) }}
                                        />
                                    ))}
                                    {!polygonPositions && (
                                        <CircleMarker
                                            center={center}
                                            radius={highlighted ? 26 : 20}
                                            pathOptions={{ color: style.stroke, fillColor: style.fill, fillOpacity: 0.32, weight: highlighted ? 3 : 2 }}
                                            eventHandlers={{ click: () => handleSelectFarm(farm) }}
                                        />
                                    )}
                                    <Marker
                                        position={center}
                                        icon={coloredPinIcon(style.dot, highlighted)}
                                        ref={(el) => { layerRefs.current[farm.id] = el; }}
                                        eventHandlers={{ click: () => handleSelectFarm(farm) }}
                                    >
                                        <Popup>
                                            <div className="text-sm min-w-[230px]">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <p className="font-bold flex items-center gap-1 text-brand-text">
                                                        <Sprout className="h-3.5 w-3.5 text-green-600" /> {farm.name}
                                                    </p>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText}`}>
                                                        {style.label}
                                                    </span>
                                                </div>
                                                <p className="text-gray-700"><span className="font-semibold">Owner:</span> {farm.farmer.firstName} {farm.farmer.lastName}</p>
                                                <p className="text-gray-700"><span className="font-semibold">Crop:</span> {farm.cropType || '—'}</p>
                                                {farm.totalAreaHa && <p className="text-gray-700"><span className="font-semibold">Size:</span> {farm.totalAreaHa} ha</p>}
                                                {(farm.farmer.region || farm.farmer.district) && (
                                                    <p className="text-gray-700">
                                                        <span className="font-semibold">Location:</span>{' '}
                                                        {[farm.farmer.district, farm.farmer.region].filter(Boolean).join(', ')}
                                                    </p>
                                                )}

                                                {/* Assessment state, spelled out — geometry type,
                                                    whether an assessment exists, and when it last ran. */}
                                                <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-0.5">
                                                    <p className="text-gray-700"><span className="font-semibold">Boundary:</span> {geometryLabel}</p>
                                                    <p className="text-gray-700">
                                                        <span className="font-semibold">Assessment:</span>{' '}
                                                        {level ? `${style.label} (completed)` : 'Not assessed yet'}
                                                    </p>
                                                    <p className="text-gray-700">
                                                        <span className="font-semibold">Last assessed:</span> {fmtDate(farm.lastRiskAssessmentDate)}
                                                        {stale && <span className="ml-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">Stale{ageDays ? ` (${Math.floor(ageDays / 30)}mo old)` : ''}</span>}
                                                    </p>
                                                    {farm.geometryStatus && (
                                                        <p className="text-gray-700">
                                                            <span className="font-semibold">Geometry check:</span>{' '}
                                                            <span className={
                                                                farm.geometryStatus === 'Valid' ? 'text-green-700 font-semibold'
                                                                    : farm.geometryStatus === 'Invalid' ? 'text-red-700 font-semibold'
                                                                        : 'text-amber-700 font-semibold'
                                                            }>{farm.geometryStatus}</span>
                                                        </p>
                                                    )}
                                                </div>

                                                <p className="text-gray-500 text-[11px] font-mono mt-1">{center[0].toFixed(5)}, {center[1].toFixed(5)}</p>
                                                <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-gray-100">
                                                    <Link to={`/farms/${farm.id}`} className="text-[11px] font-bold text-brand-green hover:underline inline-flex items-center gap-1">
                                                        <ExternalLink className="h-3 w-3" /> Farm Details
                                                    </Link>
                                                    <Link to={`/risk-analysis?farmId=${farm.id}`} className="text-[11px] font-bold text-amber-600 hover:underline inline-flex items-center gap-1">
                                                        <ShieldAlert className="h-3 w-3" /> Risk Report
                                                    </Link>
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                </React.Fragment>
                            );
                        })}
                    </MapContainer>

                    {/* Layer toggle */}
                    <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur rounded-xl shadow-card border border-brand-border flex text-xs font-semibold overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setLayer('satellite')}
                            className={`flex items-center gap-1 px-3 py-2 transition-colors ${layer === 'satellite' ? 'bg-brand-green text-white' : 'text-gray-600 hover:bg-brand-green/8'}`}
                        >
                            <Satellite className="h-3.5 w-3.5" /> Satellite
                        </button>
                        <button
                            type="button"
                            onClick={() => setLayer('street')}
                            className={`flex items-center gap-1 px-3 py-2 transition-colors ${layer === 'street' ? 'bg-brand-green text-white' : 'text-gray-600 hover:bg-brand-green/8'}`}
                        >
                            <MapIcon className="h-3.5 w-3.5" /> Street
                        </button>
                    </div>

                    {/* Feature-cap notice: explains why fewer pins than farms
                        are on screen, so it is never read as missing geometry. */}
                    {truncatedByViewport && (
                        <div className="absolute top-14 right-3 z-[1000] bg-amber-50/95 backdrop-blur rounded-lg border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-800 max-w-[220px]">
                            Showing the first {FEATURE_CAP} farms — zoom in or filter to see the rest.
                        </div>
                    )}

                    {/* Legend — restyled as a proper branded card (was a plain
                        gray-bordered box); 2-column grid keeps it compact so it
                        doesn't grow tall enough to crowd the hover-readout
                        chip in the opposite corner on short map heights. */}
                    <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur rounded-xl shadow-card border border-brand-border px-3 py-2.5 text-[11px] max-w-[220px]">
                        <p className="font-extrabold text-brand-brown mb-1.5 flex items-center gap-1"><Ruler className="h-3 w-3" /> Risk Legend</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                            {(['Low', 'Medium', 'High', 'Unknown'] as const).map(r => {
                                const s = riskStyle(r);
                                return (
                                    <div key={r} className="flex items-center gap-1.5 text-gray-600 whitespace-nowrap">
                                        <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: s.dot }} />
                                        {s.label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Live hover coordinate + resolved place-name readout */}
                    <div className="absolute bottom-3 right-3 z-[1000] bg-brand-brown/90 text-white text-[11px] rounded-md px-3 py-1.5 flex flex-col items-end gap-0.5 pointer-events-none max-w-[280px]">
                        {hoverLatLng ? (
                            <>
                                <span className="flex items-center gap-1.5 font-mono">
                                    <Crosshair className="h-3 w-3 text-green-400 flex-shrink-0" />
                                    {hoverLatLng[0].toFixed(6)}, {hoverLatLng[1].toFixed(6)}
                                </span>
                                <span className="flex items-center gap-1.5 text-green-300 text-right leading-tight">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    {hoverPlaceLoading && !hoverPlace ? (
                                        <span className="flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Locating...</span>
                                    ) : (
                                        <span className="truncate">{hoverPlace?.label || 'Unknown location'}</span>
                                    )}
                                </span>
                            </>
                        ) : (
                            <span className="flex items-center gap-1.5 font-mono">
                                <Crosshair className="h-3 w-3 text-green-400" />
                                Hover map to see location
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const STAT_COLOR_CLASS: Record<string, string> = {
    'brand-green': 'text-brand-green',
    'slate-500': 'text-slate-500',
    'green-600': 'text-green-600',
    'amber-600': 'text-amber-600',
    'red-600': 'text-red-600',
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: string }> = ({ icon, label, value, color }) => (
    <div className="rounded-lg border border-brand-border bg-brand-bg/60 px-2.5 py-2 flex flex-col gap-0.5" title={`${label}: ${value}`}>
        {/* Colour comes from a static lookup map, not an interpolated class
            name — Tailwind only generates classes it can see literally. */}
        <div className={`flex items-center gap-1 ${STAT_COLOR_CLASS[color] || 'text-brand-muted'}`}>
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
        </div>
        <span className="text-lg font-extrabold text-brand-text leading-none">{value}</span>
    </div>
);

export default MapView;

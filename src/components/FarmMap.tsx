import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Marker, useMap, useMapEvents, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { Satellite, Map as MapIcon, Crosshair, Ruler, MapPin, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useReverseGeocode } from '../hooks/useReverseGeocode';

type LatLng = [number, number];

interface FarmMapProps {
    location: any; // GeoJSON Point or Polygon
    height?: string;
    className?: string;
    /** Show the satellite / street toggle control (default true) */
    showLayerToggle?: boolean;
    /** Show the live lat/lng readout that follows the cursor (default true) */
    showHoverReadout?: boolean;
    /** Allow scroll-to-zoom (default true) */
    scrollWheelZoom?: boolean;
    /** Allow dragging the map (default true) */
    dragging?: boolean;
    zoomControl?: boolean;
    defaultLayer?: 'satellite' | 'street';
}

// Esri's free satellite imagery has no real coverage for many rural areas beyond
// zoom ~18 (tiles come back as blank "Map data not yet available" placeholders).
// Capping the auto-fit zoom keeps the view on real imagery instead of blank tiles,
// even for very small (e.g. 50m x 50m) farm boundaries.
const MAX_AUTO_FIT_ZOOM = 18;

const FitBounds: React.FC<{ positions: LatLng[] }> = ({ positions }) => {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 1) {
            map.fitBounds(positions, { padding: [28, 28], maxZoom: MAX_AUTO_FIT_ZOOM });
        }
    }, [map, positions]);
    return null;
};

// Tracks the cursor location on the map and reports it up via onMove
const HoverTracker: React.FC<{ onMove: (latlng: LatLng | null) => void }> = ({ onMove }) => {
    useMapEvents({
        mousemove: (e) => onMove([e.latlng.lat, e.latlng.lng]),
        mouseout: () => onMove(null),
    });
    return null;
};

// Custom pulsing pin icon for the farm centroid (nicer than the default leaflet marker)
const pinIcon = L.divIcon({
    className: '',
    html: `
        <div style="position:relative;width:26px;height:26px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:#22c55e;opacity:.35;animation:farmPinPulse 1.8s ease-out infinite;"></div>
            <div style="position:absolute;top:5px;left:5px;width:16px;height:16px;border-radius:50%;background:#0f7a3a;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>
        </div>
        <style>
            @keyframes farmPinPulse { 0% { transform: scale(0.6); opacity:.55; } 100% { transform: scale(2.2); opacity:0; } }
        </style>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
});

const STREET_TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const SATELLITE_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_LABELS_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

const FarmMap: React.FC<FarmMapProps> = ({
    location,
    height = '100%',
    className = '',
    showLayerToggle = true,
    showHoverReadout = true,
    scrollWheelZoom = true,
    dragging = true,
    zoomControl = true,
    defaultLayer = 'satellite',
}) => {
    const [layer, setLayer] = useState<'satellite' | 'street'>(defaultLayer);
    const [hoverLatLng, setHoverLatLng] = useState<LatLng | null>(null);
    const { result: hoverPlace, loading: hoverPlaceLoading } = useReverseGeocode(hoverLatLng);

    const { center, polygonPositions, hasLocation, areaHa } = useMemo(() => {
        if (!location || !location.coordinates) {
            return { center: null as LatLng | null, polygonPositions: null as LatLng[] | null, hasLocation: false, areaHa: null as number | null };
        }
        const coords = location.coordinates as any;
        let c: LatLng;
        let poly: LatLng[] | null = null;
        let area: number | null = null;

        if (location.type === 'Polygon') {
            const ring: LatLng[] = coords[0].map((pt: any) => [pt[1], pt[0]] as LatLng);
            poly = ring;
            try {
                const centroid = turf.centroid(location as any);
                c = [centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]];
                area = turf.area(location as any) / 10000; // sqm -> ha
            } catch {
                c = ring[0] ?? [0, 0];
            }
        } else {
            c = [coords[1], coords[0]];
        }
        return { center: c, polygonPositions: poly, hasLocation: true, areaHa: area };
    }, [location]);

    if (!hasLocation || !center) {
        return (
            <div className={`h-full w-full flex flex-col items-center justify-center gap-2 text-gray-400 bg-gradient-to-br from-gray-50 to-gray-100 ${className}`} style={{ height }}>
                <MapIcon className="h-8 w-8 opacity-40" />
                <span className="text-sm">No location captured for this farm</span>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${className}`} style={{ height }}>
            <MapContainer
                center={center}
                zoom={17}
                scrollWheelZoom={scrollWheelZoom}
                dragging={dragging}
                zoomControl={zoomControl}
                style={{ height: '100%', width: '100%' }}
            >
                {layer === 'satellite' ? (
                    <>
                        {/* maxNativeZoom caps real tile requests at 18 and lets Leaflet upscale
                            that imagery for closer zooms, instead of requesting non-existent
                            z19+ tiles that come back as blank "Map data not yet available" placeholders. */}
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url={SATELLITE_TILE}
                            maxZoom={20}
                            maxNativeZoom={18}
                        />
                        <TileLayer url={SATELLITE_LABELS_TILE} opacity={0.85} maxZoom={20} maxNativeZoom={18} />
                    </>
                ) : (
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url={STREET_TILE}
                        maxZoom={19}
                    />
                )}

                {location.type === 'Point' && (
                    <>
                        <CircleMarker center={center} radius={22} pathOptions={{ color: '#F59E0B', fillColor: '#FBBF24', fillOpacity: 0.35, weight: 2 }} />
                        <Marker position={center} icon={pinIcon} />
                    </>
                )}

                {polygonPositions && (
                    <>
                        <Polygon
                            positions={polygonPositions}
                            pathOptions={{ color: '#eab308', weight: 3, fillColor: '#22c55e', fillOpacity: 0.28, dashArray: '6 4' }}
                        />
                        <Marker position={center} icon={pinIcon} />
                        <FitBounds positions={polygonPositions} />
                    </>
                )}

                <ScaleControl position="bottomleft" imperial={false} />
                {showHoverReadout && <HoverTracker onMove={setHoverLatLng} />}
            </MapContainer>

            {/* Layer toggle */}
            {showLayerToggle && (
                <div className="absolute top-2 right-2 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 flex text-xs font-semibold overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setLayer('satellite')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${layer === 'satellite' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Satellite className="h-3.5 w-3.5" /> Satellite
                    </button>
                    <button
                        type="button"
                        onClick={() => setLayer('street')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${layer === 'street' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <MapIcon className="h-3.5 w-3.5" /> Street
                    </button>
                </div>
            )}

            {/* Area badge */}
            {areaHa !== null && (
                <div className="absolute top-2 left-2 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-800">
                    <Ruler className="h-3.5 w-3.5 text-green-600" /> {areaHa.toFixed(2)} ha
                </div>
            )}

            {/* Live hover coordinate + resolved place-name readout */}
            {showHoverReadout && (
                <div className="absolute bottom-2 right-2 z-[1000] bg-slate-900/85 text-white text-[11px] rounded-md px-2.5 py-1.5 flex flex-col items-end gap-0.5 pointer-events-none max-w-[260px]">
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
            )}
        </div>
    );
};

export default FarmMap;

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import * as turf from '@turf/turf';
import { Satellite, Map as MapIcon, Crosshair, LocateFixed, MapPin, Loader2 } from 'lucide-react';
import { useReverseGeocode } from '../hooks/useReverseGeocode';

const STREET_TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const SATELLITE_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_LABELS_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

// Fix default marker icon paths for Vite bundling
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface PolygonResult {
    geojson: any; // GeoJSON Polygon Feature
    areaHa: number;
    areaAc: number;
}

interface DrawControlProps {
    onCreated: (result: PolygonResult) => void;
    onDeleted: () => void;
    initialGeoJson?: any;
}

const DrawControl: React.FC<DrawControlProps> = ({ onCreated, onDeleted, initialGeoJson }) => {
    const map = useMap();
    const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

    useEffect(() => {
        if (!map) return;

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawnItemsRef.current = drawnItems;

        // If there's an initial polygon, render it and fit bounds
        if (initialGeoJson) {
            try {
                const layer = L.geoJSON(initialGeoJson, {
                    style: { color: '#0f7a3a', weight: 2 }
                });
                layer.eachLayer((l) => drawnItems.addLayer(l));
                const bounds = layer.getBounds();
                if (bounds.isValid()) {
                    // Cap at 18: Esri's free satellite tiles have no real coverage past this
                    // zoom in many rural areas, so zooming further just shows blank tiles.
                    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
                }
            } catch (e) {
                console.warn('Failed to render initial polygon', e);
            }
        }

        const drawControl = new (L.Control as any).Draw({
            edit: {
                featureGroup: drawnItems,
                remove: true,
                // NOTE: must be an object (or `false`), not boolean `true` - leaflet-draw
                // does `options.edit.featureGroup = ...` internally, which throws
                // "Cannot create property 'selectedPathOptions' on boolean 'true'" if this
                // is a primitive boolean instead of an object.
                edit: {},
            },
            draw: {
                marker: false,
                circle: false,
                circlemarker: false,
                polyline: false,
                rectangle: false,
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                    shapeOptions: {
                        color: '#0f7a3a',
                        weight: 2,
                    },
                },
            },
        });

        map.addControl(drawControl);

        const computeAndEmit = (layer: any) => {
            const geojson = layer.toGeoJSON();
            const areaM2 = turf.area(geojson);
            const areaHa = parseFloat((areaM2 / 10000).toFixed(4));
            const areaAc = parseFloat((areaHa * 2.47105).toFixed(4));
            onCreated({ geojson, areaHa, areaAc });
        };

        const handleCreated = (e: any) => {
            const layer = e.layer;
            drawnItems.clearLayers();
            drawnItems.addLayer(layer);
            computeAndEmit(layer);
        };

        const handleEdited = (e: any) => {
            e.layers.eachLayer((layer: any) => {
                computeAndEmit(layer);
            });
        };

        const handleDeleted = () => {
            onDeleted();
        };

        map.on((L as any).Draw.Event.CREATED, handleCreated);
        map.on((L as any).Draw.Event.EDITED, handleEdited);
        map.on((L as any).Draw.Event.DELETED, handleDeleted);

        return () => {
            map.removeControl(drawControl);
            map.removeLayer(drawnItems);
            map.off((L as any).Draw.Event.CREATED, handleCreated);
            map.off((L as any).Draw.Event.EDITED, handleEdited);
            map.off((L as any).Draw.Event.DELETED, handleDeleted);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    return null;
};

interface LocateProps {
    onLocated: (lat: number, lng: number) => void;
}

const LocateMe: React.FC<LocateProps> = ({ onLocated }) => {
    const map = useMap();
    return (
        <button
            type="button"
            className="absolute top-2.5 right-2.5 z-[1000] bg-white/95 backdrop-blur hover:bg-green-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-green-700 shadow-md flex items-center gap-1.5 transition-colors"
            onClick={() => {
                if (!navigator.geolocation) {
                    alert('Geolocation not supported by this browser');
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude, longitude } = pos.coords;
                        map.setView([latitude, longitude], 18);
                        onLocated(latitude, longitude);
                    },
                    (err) => alert('Unable to get GPS location: ' + err.message)
                );
            }}
        >
            <LocateFixed className="h-3.5 w-3.5" /> My Location
        </button>
    );
};

// Tracks the cursor location on the map and reports it up via onMove
const HoverTracker: React.FC<{ onMove: (latlng: [number, number] | null) => void }> = ({ onMove }) => {
    useMapEvents({
        mousemove: (e) => onMove([e.latlng.lat, e.latlng.lng]),
        mouseout: () => onMove(null),
    });
    return null;
};

interface PolygonMapSelectorProps {
    onPolygonChange: (result: PolygonResult | null) => void;
    initialGeoJson?: any;
    defaultCenter?: [number, number];
    height?: string;
}

const PolygonMapSelector: React.FC<PolygonMapSelectorProps> = ({
    onPolygonChange,
    initialGeoJson,
    defaultCenter,
    height = '420px',
}) => {
    const [gpsMarker, setGpsMarker] = useState<[number, number] | null>(null);
    const [layer, setLayer] = useState<'satellite' | 'street'>('satellite');
    const [hoverLatLng, setHoverLatLng] = useState<[number, number] | null>(null);
    const { result: hoverPlace, loading: hoverPlaceLoading } = useReverseGeocode(hoverLatLng);

    // Determine sensible default center: initial polygon centroid > provided default > Monrovia, Liberia
    let center: [number, number] = defaultCenter || [6.3156, -10.8074];
    if (initialGeoJson) {
        try {
            const centroid = turf.centroid(initialGeoJson);
            const [lng, lat] = centroid.geometry.coordinates;
            center = [lat, lng];
        } catch (e) {
            // ignore, fall back to default
        }
    }

    return (
        <div style={{ position: 'relative', height, width: '100%' }} className="rounded-lg overflow-hidden border border-gray-200">
            <MapContainer center={center} zoom={initialGeoJson ? 17 : 13} maxZoom={20} style={{ height: '100%', width: '100%' }}>
                {layer === 'satellite' ? (
                    <>
                        <TileLayer attribution='Tiles &copy; Esri' url={SATELLITE_TILE} maxZoom={20} maxNativeZoom={18} />
                        <TileLayer url={SATELLITE_LABELS_TILE} opacity={0.85} maxZoom={20} maxNativeZoom={18} />
                    </>
                ) : (
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url={STREET_TILE}
                        maxZoom={19}
                    />
                )}
                <DrawControl
                    initialGeoJson={initialGeoJson}
                    onCreated={onPolygonChange}
                    onDeleted={() => onPolygonChange(null)}
                />
                <LocateMe onLocated={(lat, lng) => setGpsMarker([lat, lng])} />
                {gpsMarker && <Marker position={gpsMarker} />}
                <ScaleControl position="bottomleft" imperial={false} />
                <HoverTracker onMove={setHoverLatLng} />
            </MapContainer>

            {/* Layer toggle (top-center, to avoid the leaflet-draw toolbar on the left and the locate button on the right) */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 flex text-xs font-semibold overflow-hidden">
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

            {/* Helper hint */}
            <div className="absolute bottom-2.5 left-2.5 z-[1000] bg-slate-900/80 text-white text-[11px] px-2.5 py-1.5 rounded-md shadow-md max-w-[220px]">
                Use the polygon tool (top-left of map) to draw the farm boundary
            </div>

            {/* Live hover coordinate + resolved place-name readout */}
            <div className="absolute bottom-2.5 right-2.5 z-[1000] bg-slate-900/85 text-white text-[11px] rounded-md px-2.5 py-1.5 flex flex-col items-end gap-0.5 pointer-events-none max-w-[260px]">
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
    );
};

export default PolygonMapSelector;

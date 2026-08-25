import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, useMap, useMapEvents, ScaleControl } from 'react-leaflet';
import { getFarms, type FarmWithFarmer } from '../api/farms';
import { Satellite, Map as MapIcon, Crosshair, MapPinned, Sprout, MapPin, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useReverseGeocode } from '../hooks/useReverseGeocode';

// Fix Leaflet/Vite icon issue
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

type LatLng = [number, number];

const STREET_TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const SATELLITE_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_LABELS_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

const HoverTracker: React.FC<{ onMove: (latlng: LatLng | null) => void }> = ({ onMove }) => {
    useMapEvents({
        mousemove: (e) => onMove([e.latlng.lat, e.latlng.lng]),
        mouseout: () => onMove(null),
    });
    return null;
};

const MapView: React.FC = () => {
    const [farms, setFarms] = useState<FarmWithFarmer[]>([]);
    const [layer, setLayer] = useState<'satellite' | 'street'>('satellite');
    const [hoverLatLng, setHoverLatLng] = useState<LatLng | null>(null);
    const { result: hoverPlace, loading: hoverPlaceLoading } = useReverseGeocode(hoverLatLng);

    useEffect(() => {
        const fetchFarms = async () => {
            try {
                const response = await getFarms();
                if (response.data.status) {
                    setFarms(response.data.data);
                }
            } catch (error) {
                console.error("Error fetching farms", error);
            }
        };
        fetchFarms();
    }, []);

    // Default center: Monrovia, Liberia (used only when there are no farms yet)
    const defaultCenter: LatLng = [6.3156, -10.8074];

    // Collect all polygon positions across farms so we can fit the map to real data
    const allPositions: LatLng[] = [];
    farms.forEach((farm) => {
        if (farm.location && farm.location.type === 'Polygon') {
            farm.location.coordinates[0].forEach((c: any) => allPositions.push([c[1], c[0]]));
        }
    });

    // Esri's free satellite imagery has no real coverage for many rural areas beyond
    // zoom ~18 (tiles come back blank). Capping the auto-fit zoom keeps the view on
    // real imagery even when only a single, very small farm boundary is plotted.
    const FitAllBounds: React.FC<{ positions: LatLng[] }> = ({ positions }) => {
        const map = useMap();
        useEffect(() => {
            if (positions.length > 0) {
                map.fitBounds(positions, { padding: [40, 40], maxZoom: 18 });
            }
        }, [map, positions.length]);
        return null;
    };

    const polygonCount = farms.filter(f => f.location?.type === 'Polygon').length;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500">
                    <MapPinned className="h-4 w-4 text-green-600" />
                    {polygonCount} farm{polygonCount !== 1 ? 's' : ''} plotted with GPS boundaries
                </span>
            </div>

            <div className="relative h-[calc(100vh-10rem)] w-full rounded-xl overflow-hidden shadow-lg border border-gray-200">
                <MapContainer center={defaultCenter} zoom={7} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
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
                    {allPositions.length > 0 && <FitAllBounds positions={allPositions} />}
                    <ScaleControl position="bottomleft" imperial={false} />
                    <HoverTracker onMove={setHoverLatLng} />

                    {farms.map((farm) => {
                        if (farm.location && farm.location.type === 'Polygon') {
                            // GeoJSON coordinates are [lon, lat], Leaflet needs [lat, lon]
                            const positions = farm.location.coordinates[0].map((c: any) => [c[1], c[0]] as LatLng);

                            return (
                                <Polygon
                                    key={farm.id}
                                    positions={positions}
                                    pathOptions={{ color: '#eab308', weight: 2.5, fillColor: '#22c55e', fillOpacity: 0.32, dashArray: '5 4' }}
                                >
                                    <Popup>
                                        <div className="text-sm">
                                            <p className="font-bold flex items-center gap-1"><Sprout className="h-3.5 w-3.5 text-green-600 inline" /> {farm.name}</p>
                                            <p><span className="font-semibold">Crop:</span> {farm.cropType}</p>
                                            <p><span className="font-semibold">Owner:</span> {farm.farmer.firstName} {farm.farmer.lastName}</p>
                                            {farm.totalAreaHa && <p><span className="font-semibold">Area:</span> {farm.totalAreaHa} ha</p>}
                                        </div>
                                    </Popup>
                                </Polygon>
                            );
                        }
                        return null;
                    })}
                </MapContainer>

                {/* Layer toggle */}
                <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 flex text-xs font-semibold overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setLayer('satellite')}
                        className={`flex items-center gap-1 px-3 py-2 transition-colors ${layer === 'satellite' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Satellite className="h-3.5 w-3.5" /> Satellite
                    </button>
                    <button
                        type="button"
                        onClick={() => setLayer('street')}
                        className={`flex items-center gap-1 px-3 py-2 transition-colors ${layer === 'street' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <MapIcon className="h-3.5 w-3.5" /> Street
                    </button>
                </div>

                {/* Live hover coordinate + resolved place-name readout */}
                <div className="absolute bottom-3 right-3 z-[1000] bg-slate-900/85 text-white text-[11px] rounded-md px-3 py-1.5 flex flex-col items-end gap-0.5 pointer-events-none max-w-[280px]">
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
    );
};

export default MapView;

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issue
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapSelectorProps {
    onLocationSelect: (coords: [number, number]) => void;
}

const LocationMarker: React.FC<MapSelectorProps> = ({ onLocationSelect }) => {
    const [position, setPosition] = useState<L.LatLng | null>(null);
    useMapEvents({
        click(e) {
            setPosition(e.latlng);
            onLocationSelect([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position === null ? null : (
        <Marker position={position}></Marker>
    );
};

/**
 * Default map centre: Monrovia, Liberia.
 *
 * This was [5.6037, -0.1870] — Accra, GHANA. LACRA is a Liberian agency, so an
 * enumerator opening this picker landed in the wrong country and could place a
 * farm hundreds of kilometres away from its true location. Matches the live
 * picker (PolygonMapSelector) and MapView, both of which already use Monrovia.
 *
 * NOTE: this component is currently unused — the active farm pickers are
 * PolygonMapSelector. It is corrected here so it cannot reintroduce the
 * wrong-country default if it is ever wired up again.
 */
const DEFAULT_CENTER: [number, number] = [6.3156, -10.8074];

const MapSelector: React.FC<MapSelectorProps> = ({ onLocationSelect }) => {
    return (
        <MapContainer center={DEFAULT_CENTER} zoom={8} scrollWheelZoom={false} style={{ height: '400px', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker onLocationSelect={onLocationSelect} />
        </MapContainer>
    );
};

export default MapSelector;

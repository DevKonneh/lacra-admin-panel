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

const MapSelector: React.FC<MapSelectorProps> = ({ onLocationSelect }) => {
    return (
        <MapContainer center={[5.6037, -0.1870]} zoom={8} scrollWheelZoom={false} style={{ height: '400px', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker onLocationSelect={onLocationSelect} />
        </MapContainer>
    );
};

export default MapSelector;

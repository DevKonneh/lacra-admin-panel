import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '../api/client';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const SatelliteAnalysis: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [satelliteMode, setSatelliteMode] = useState(true);

    useEffect(() => {
        apiClient.get('/satellite/temporal').then(res => {
            if (res.data.status) setData(res.data.data);
        });
        apiClient.get('/satellite/alerts').then(res => {
            if (res.data.status) setAlerts(res.data.data);
        });
    }, []);

    if (!data) return <div className="p-8">Loading Satellite Data...</div>;

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


    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Advanced Satellite Analysis</h1>

            <div className="bg-white shadow rounded-lg p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Region: {data.region}</h3>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        Risk: {data.riskLevel}
                    </span>
                </div>

                <div className="h-80 w-full">
                    <h4 className="text-sm font-medium text-gray-500 mb-4">Forest Cover Trend (2020-2024)</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.history}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="year" />
                            <YAxis domain={[80, 90]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="forestCover" stroke="#10b981" fill="#ecfdf5" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                <div className="flex">
                    <div className="ml-3">
                        <p className="text-sm text-blue-700">
                            <strong>Analysis:</strong> The forest cover trend is {data.trend}. Deforestation rate has decreased to {data.history[data.history.length - 1].deforestationRate}% in the last year.
                        </p>
                    </div>
                </div>
            </div>

            {alerts.length > 0 && (
                <div className="bg-white shadow rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Satellite Alerts ({alerts.length})</h3>
                    <ul className="space-y-2">
                        {alerts.slice(0, 10).map((a: any) => (
                            <li key={a.id} className="flex items-center gap-3 p-2 rounded bg-amber-50 border border-amber-200">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-200">{a.type}</span>
                                <span className="text-sm">{a.farm?.name} - {new Date(a.detectedAt).toLocaleDateString()}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="bg-white shadow rounded-lg overflow-hidden h-80">
                <div className="p-3 flex justify-between items-center border-b">
                    <h3 className="font-medium">Satellite Imagery Overlay</h3>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={satelliteMode} onChange={e => setSatelliteMode(e.target.checked)} />
                        Satellite layer
                    </label>
                </div>
                <MapContainer center={[6.5, -9.5]} zoom={6} className="h-full">
                    {satelliteMode ? (
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    ) : (
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default SatelliteAnalysis;

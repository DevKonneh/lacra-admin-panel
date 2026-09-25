import React, { useEffect, useState } from 'react';
import {
    Cloud, CloudRain, CloudDrizzle, CloudLightning, Sun, CloudSun,
    Droplets, Wind, Thermometer, Loader2, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { getFarmWeather, type FarmWeatherResult } from '../api/weather';

interface FarmWeatherPanelProps {
    farmId: string;
}

// Maps WMO weather codes (see WeatherService.ts on the backend) to a
// representative icon. Grouped by category rather than one-icon-per-code,
// since the exact WMO code granularity (e.g. "slight" vs "moderate" rain)
// isn't meaningfully different to show with a different icon.
const weatherIcon = (code: number, className: string) => {
    if (code === 0 || code === 1) return <Sun className={className} />;
    if (code === 2) return <CloudSun className={className} />;
    if (code === 3 || code === 45 || code === 48) return <Cloud className={className} />;
    if ([51, 53, 55, 56, 57].includes(code)) return <CloudDrizzle className={className} />;
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return <CloudRain className={className} />;
    if ([95, 96, 99].includes(code)) return <CloudLightning className={className} />;
    return <Cloud className={className} />;
};

const dayLabel = (isoDate: string, index: number) => {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    return new Date(isoDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
};

const FarmWeatherPanel: React.FC<FarmWeatherPanelProps> = ({ farmId }) => {
    const [weather, setWeather] = useState<FarmWeatherResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWeather = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getFarmWeather(farmId);
            if (res.data.status) {
                setWeather(res.data.data);
            } else {
                setError(res.data.message || 'Failed to load weather');
            }
        } catch (err: any) {
            setError(
                err?.response?.data?.message ||
                'Failed to load weather data. This farm may not have a GPS location captured yet.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (farmId) fetchWeather();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [farmId]);

    if (loading) {
        return (
            <div className="bg-white shadow-md rounded-xl p-6 flex items-center justify-center gap-2 text-gray-400 border border-gray-100">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading weather...</span>
            </div>
        );
    }

    if (error || !weather) {
        return (
            <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Cloud className="h-4 w-4 text-blue-500" /> Weather Forecast
                    </h3>
                    <button onClick={fetchWeather} className="text-gray-400 hover:text-gray-600">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">{error || 'Weather data unavailable'}</p>
            </div>
        );
    }

    const { current, daily, advisories } = weather;

    return (
        <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-sky-600" /> Weather Forecast
                </h3>
                <button onClick={fetchWeather} className="text-gray-400 hover:text-gray-600" title="Refresh">
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Current conditions */}
            <div className="p-4 flex items-center gap-4 border-b border-gray-100">
                {weatherIcon(current.weatherCode, 'h-10 w-10 text-sky-500 flex-shrink-0')}
                <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900">{Math.round(current.temperatureC)}&deg;C</span>
                        <span className="text-sm text-gray-500">{current.weatherLabel}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> {current.relativeHumidityPercent}%</span>
                        <span className="flex items-center gap-1"><Wind className="h-3 w-3" /> {Math.round(current.windSpeedKmh)} km/h</span>
                    </div>
                </div>
            </div>

            {/* Advisories - only shown when relevant */}
            {(advisories.heavyRainExpected || advisories.droughtRisk || advisories.heatStress) && (
                <div className="px-4 py-3 border-b border-gray-100 space-y-1.5">
                    {advisories.heavyRainExpected && (
                        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2.5 py-1.5">
                            <CloudRain className="h-3.5 w-3.5 flex-shrink-0" />
                            Heavy rain expected this week - plan harvest/drying accordingly.
                        </div>
                    )}
                    {advisories.droughtRisk && (
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                            Dry spell: little to no rain forecast for 7 days.
                        </div>
                    )}
                    {advisories.heatStress && (
                        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5">
                            <Thermometer className="h-3.5 w-3.5 flex-shrink-0" />
                            High temperatures forecast - monitor crops for heat stress.
                        </div>
                    )}
                </div>
            )}

            {/* 7-day forecast strip */}
            <div className="grid grid-cols-7 divide-x divide-gray-100">
                {daily.map((day, i) => (
                    <div key={day.date} className="flex flex-col items-center py-3 px-1 text-center">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{dayLabel(day.date, i)}</span>
                        {weatherIcon(day.weatherCode, 'h-5 w-5 text-sky-500 my-1.5')}
                        <span className="text-xs font-bold text-gray-800">{Math.round(day.tempMaxC)}&deg;</span>
                        <span className="text-[10px] text-gray-400">{Math.round(day.tempMinC)}&deg;</span>
                        {day.precipitationSumMm > 0.5 && (
                            <span className="text-[10px] text-blue-500 mt-1 flex items-center gap-0.5">
                                <Droplets className="h-2.5 w-2.5" />{Math.round(day.precipitationSumMm)}mm
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <div className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100 bg-gray-50/50">
                Data by Open-Meteo &middot; {weather.timezone}
            </div>
        </div>
    );
};

export default FarmWeatherPanel;

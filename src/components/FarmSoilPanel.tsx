import React, { useEffect, useState } from 'react';
import {
    Layers, Loader2, RefreshCw, Info,
} from 'lucide-react';
import { getFarmSoilProfile, type SoilProfileResult } from '../api/soil';

interface FarmSoilPanelProps {
    farmId: string;
}

const FarmSoilPanel: React.FC<FarmSoilPanelProps> = ({ farmId }) => {
    const [soil, setSoil] = useState<SoilProfileResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSoil = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getFarmSoilProfile(farmId);
            if (res.data.status) {
                setSoil(res.data.data);
            } else {
                setError(res.data.message || 'Failed to load soil profile');
            }
        } catch (err: any) {
            setError(
                err?.response?.data?.message ||
                'Failed to load soil data. This farm may not have a GPS location captured yet.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (farmId) fetchSoil();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [farmId]);

    if (loading) {
        return (
            <div className="bg-white shadow-md rounded-xl p-6 flex items-center justify-center gap-2 text-gray-400 border border-gray-100">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading soil profile...</span>
            </div>
        );
    }

    if (error || !soil) {
        return (
            <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-amber-600" /> Soil Profile
                    </h3>
                    <button onClick={fetchSoil} className="text-gray-400 hover:text-gray-600">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">{error || 'Soil data unavailable'}</p>
            </div>
        );
    }

    const phZoneLabel = soil.phH2O < 5.5 ? 'Acidic' : soil.phH2O > 7.5 ? 'Alkaline' : 'Near-neutral';
    const phZoneColor = soil.phH2O < 5.5 ? 'text-orange-600' : soil.phH2O > 7.5 ? 'text-purple-600' : 'text-green-600';

    return (
        <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-amber-700" /> Soil Profile
                </h3>
                <button onClick={fetchSoil} className="text-gray-400 hover:text-gray-600" title="Refresh">
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Texture class headline */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-gray-900">{soil.textureClass}</span>
                    <span className="text-xs text-gray-400">estimated soil texture ({soil.depthLabel} topsoil)</span>
                </div>

                {/* Clay / Sand / Silt composition bar */}
                <div className="mt-3">
                    <div className="flex h-3 rounded-full overflow-hidden border border-gray-200">
                        <div className="bg-orange-400" style={{ width: `${soil.clayPercent}%` }} title={`Clay: ${soil.clayPercent}%`} />
                        <div className="bg-yellow-300" style={{ width: `${soil.sandPercent}%` }} title={`Sand: ${soil.sandPercent}%`} />
                        <div className="bg-stone-300" style={{ width: `${soil.siltPercent}%` }} title={`Silt: ${soil.siltPercent}%`} />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400 inline-block" /> Clay {soil.clayPercent}%</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-300 inline-block" /> Sand {soil.sandPercent}%</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-stone-300 inline-block" /> Silt {soil.siltPercent}%</span>
                    </div>
                </div>
            </div>

            {/* pH + fertility stats */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                <div className="p-3 text-center">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Soil pH</p>
                    <p className={`text-lg font-bold mt-0.5 ${phZoneColor}`}>{soil.phH2O}</p>
                    <p className={`text-[10px] ${phZoneColor}`}>{phZoneLabel}</p>
                </div>
                <div className="p-3 text-center">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Organic Carbon</p>
                    <p className="text-lg font-bold text-gray-800 mt-0.5">{soil.organicCarbonGKg}</p>
                    <p className="text-[10px] text-gray-400">g/kg</p>
                </div>
                <div className="p-3 text-center">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Bulk Density</p>
                    <p className="text-lg font-bold text-gray-800 mt-0.5">{soil.bulkDensityKgDm3 ?? '\u2014'}</p>
                    <p className="text-[10px] text-gray-400">g/cm&sup3;</p>
                </div>
            </div>

            {/* Farm-relevant interpretation notes */}
            {soil.notes.length > 0 && (
                <div className="px-4 py-3 space-y-1.5">
                    {soil.notes.map((note, i) => (
                        <p key={i} className="text-xs text-gray-600 leading-relaxed">{note}</p>
                    ))}
                </div>
            )}

            <div className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100 bg-gray-50/50 flex items-start gap-1.5">
                <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
                <span>
                    Estimated from ISRIC SoilGrids global soil map (250m resolution) &mdash; a modeled estimate for
                    planning purposes, not a substitute for an on-site soil sample test.
                </span>
            </div>
        </div>
    );
};

export default FarmSoilPanel;

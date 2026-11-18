import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, QrCode, Loader2, User, Phone, MapPin, Sprout, Layers } from 'lucide-react';
import { searchFarmers, type FarmerSearchResult } from '../../../api/farmers';
import { resolveFileUrl } from '../../../utils/fileUrl';
import SafeImage from '../../../components/SafeImage';
import QrScannerModal from '../../../components/QrScannerModal';

/**
 * Step 2 of the "Add Farm to Existing Farmer" flow: search for the returning
 * farmer by Farmer ID, phone, National ID, name, or county/district/
 * community, OR scan their QR identity card. Selecting a result advances to
 * FarmerActionScreen (view / add farm / not-correct-farmer).
 */
const FindFarmerScreen: React.FC = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<FarmerSearchResult[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showScanner, setShowScanner] = useState(false);

    const runSearch = async (params: { query?: string; qrPayload?: string }) => {
        setLoading(true);
        setError(null);
        try {
            const res = await searchFarmers(params);
            if (res.data.status) {
                setResults(res.data.data);
            } else {
                setError(res.data.message || 'Search failed');
                setResults([]);
            }
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Search failed. Check your connection.');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        runSearch({ query: query.trim() });
    };

    const handleQrScan = (payload: string) => {
        setShowScanner(false);
        runSearch({ qrPayload: payload });
    };

    const selectFarmer = (farmerId: string) => {
        navigate(`/farmers/mapping/farmer/${farmerId}`);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center">
                <button onClick={() => navigate('/farmers/mapping/start')} className="mr-4 text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Find Farmer</h1>
                    <p className="text-sm text-gray-500">Search for the returning farmer before adding a new farm.</p>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6 space-y-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Farmer ID, phone, National ID, name, county, district or community"
                            className="w-full border border-gray-300 rounded-md shadow-sm py-2.5 pl-9 pr-3 text-sm focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Search
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                        title="Scan Farmer QR Code"
                    >
                        <QrCode className="h-4 w-4" /> Scan QR
                    </button>
                </form>

                {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
                )}

                {results !== null && (
                    <div className="pt-2">
                        {results.length === 0 ? (
                            <p className="text-sm text-gray-500 italic py-6 text-center">
                                No matching farmer found. Double-check the details, or register this person as a new farmer instead.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-gray-500">{results.length} match{results.length !== 1 ? 'es' : ''} found</p>
                                {results.map((f) => (
                                    <button
                                        key={f.id}
                                        onClick={() => selectFarmer(f.id)}
                                        className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50/40 transition-colors text-left"
                                    >
                                        <SafeImage
                                            src={resolveFileUrl(f.profilePhoto)}
                                            alt={f.fullName}
                                            className="h-14 w-14 rounded-full object-cover border border-gray-200 flex-none"
                                            fallback={
                                                <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-none">
                                                    <User className="h-6 w-6" />
                                                </div>
                                            }
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-gray-900">{f.fullName}</span>
                                                {f.farmerId && (
                                                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{f.farmerId}</span>
                                                )}
                                                {f.isActive === false && (
                                                    <span className="text-xs font-medium text-red-700 bg-red-50 px-1.5 py-0.5 rounded">Inactive</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                                                {f.phoneNumber && (
                                                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {f.phoneNumber}</span>
                                                )}
                                                {(f.county || f.community) && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" /> {[f.county, f.community].filter(Boolean).join(' \u2022 ')}
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {f.farmCount} farm{f.farmCount !== 1 ? 's' : ''}</span>
                                                {f.commodities.length > 0 && (
                                                    <span className="inline-flex items-center gap-1"><Sprout className="h-3 w-3" /> {f.commodities.join(', ')}</span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showScanner && (
                <QrScannerModal onScan={handleQrScan} onClose={() => setShowScanner(false)} />
            )}
        </div>
    );
};

export default FindFarmerScreen;

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, PlusCircle, XCircle, User, Phone, MapPin, Sprout, Layers, Loader2 } from 'lucide-react';
import { getFarmer, type Farmer } from '../../../api/farmers';
import { resolveFileUrl } from '../../../utils/fileUrl';
import SafeImage from '../../../components/SafeImage';

/**
 * Step 3 of the "Add Farm to Existing Farmer" flow: once a search match has
 * been picked, confirm at a glance this is the right person, then choose
 * one of: View Farmer (full profile) / Add New Farm (continue the mapping
 * flow, linked to this Farmer ID) / This Is Not the Correct Farmer (go back
 * to search).
 */
const FarmerActionScreen: React.FC = () => {
    const { farmerId } = useParams<{ farmerId: string }>();
    const navigate = useNavigate();
    const [farmer, setFarmer] = useState<Farmer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!farmerId) return;
        (async () => {
            setLoading(true);
            try {
                const res = await getFarmer(farmerId);
                if (res.data.status) {
                    setFarmer(res.data.data);
                } else {
                    setError(res.data.message || 'Farmer not found');
                }
            } catch (e: any) {
                setError(e?.response?.data?.message || 'Failed to load farmer');
            } finally {
                setLoading(false);
            }
        })();
    }, [farmerId]);

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto py-16 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error || !farmer) {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
                <p className="text-red-600">{error || 'Farmer not found'}</p>
                <button onClick={() => navigate('/farmers/mapping/find')} className="text-green-700 underline text-sm">
                    Back to search
                </button>
            </div>
        );
    }

    const commodities = Array.from(new Set((farmer.farms || []).map(f => f.cropType)));

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center">
                <button onClick={() => navigate('/farmers/mapping/find')} className="mr-4 text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Confirm Farmer</h1>
                    <p className="text-sm text-gray-500">Is this the correct farmer?</p>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center gap-4">
                    <SafeImage
                        src={resolveFileUrl(farmer.profilePhoto)}
                        alt={`${farmer.firstName} ${farmer.lastName}`}
                        className="h-20 w-20 rounded-full object-cover border border-gray-200 flex-none"
                        fallback={
                            <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-none">
                                <User className="h-8 w-8" />
                            </div>
                        }
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-gray-900">{farmer.firstName} {farmer.lastName}</h2>
                            {farmer.farmerId && (
                                <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{farmer.farmerId}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                            {farmer.phoneNumber && (
                                <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {farmer.phoneNumber}</span>
                            )}
                            {(farmer.region || farmer.community) && (
                                <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" /> {[farmer.region, farmer.community].filter(Boolean).join(' \u2022 ')}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                                <Layers className="h-3.5 w-3.5" /> {farmer.farms?.length || 0} registered farm{(farmer.farms?.length || 0) !== 1 ? 's' : ''}
                            </span>
                            {commodities.length > 0 && (
                                <span className="inline-flex items-center gap-1"><Sprout className="h-3.5 w-3.5" /> {commodities.join(', ')}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3">
                    <button
                        onClick={() => navigate(`/farmers/${farmer.id}`)}
                        className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors text-left"
                    >
                        <Eye className="h-5 w-5 text-blue-600 flex-none" />
                        <div>
                            <p className="font-medium text-gray-900">View Farmer</p>
                            <p className="text-xs text-gray-500">Open the full farmer profile and registered farms.</p>
                        </div>
                    </button>
                    <button
                        onClick={() => navigate(`/farmers/mapping/confirm-identity/${farmer.id}`)}
                        className="flex items-center gap-3 p-4 rounded-lg border border-green-300 bg-green-50 hover:border-green-500 hover:bg-green-100 transition-colors text-left"
                    >
                        <PlusCircle className="h-5 w-5 text-green-700 flex-none" />
                        <div>
                            <p className="font-medium text-gray-900">Add New Farm</p>
                            <p className="text-xs text-gray-600">Map another farm for this farmer. Personal information will not be re-collected.</p>
                        </div>
                    </button>
                    <button
                        onClick={() => navigate('/farmers/mapping/find')}
                        className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-red-400 hover:bg-red-50/40 transition-colors text-left"
                    >
                        <XCircle className="h-5 w-5 text-red-500 flex-none" />
                        <div>
                            <p className="font-medium text-gray-900">This Is Not the Correct Farmer</p>
                            <p className="text-xs text-gray-500">Go back and search again.</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FarmerActionScreen;

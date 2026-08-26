import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getFarm, type FarmWithFarmer } from '../../api/farms';
import { ArrowLeft, Loader2, MapPin, Calendar, FileText, User, Sprout, Ruler, Camera } from 'lucide-react';
import FarmMap from '../../components/FarmMap';
import FarmRiskPanel from '../../components/FarmRiskPanel';
import { resolveFileUrl } from '../../utils/fileUrl';
import SafeImage from '../../components/SafeImage';

interface FarmDocument {
    id: string;
    type: string;
    status: string;
    uploadedAt: string;
}

const FarmDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [farm, setFarm] = useState<FarmWithFarmer | null>(null);
    const [documents] = useState<FarmDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFarm = async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const res = await getFarm(id);
            if (res.data.status) {
                setFarm(res.data.data);
            } else {
                setError(res.data.message || 'Failed to load farm details');
            }
        } catch (err: any) {
            console.error('Failed to fetch farm details', err);
            setError('Failed to load farm details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchFarm();
        // Documents endpoint is optional / may not exist yet — fail silently
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-green-600" /></div>;
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <button onClick={fetchFarm} className="text-green-600 hover:text-green-800 font-medium">Retry</button>
            </div>
        );
    }

    if (!farm) {
        return <div className="p-8 text-center text-gray-500">Farm not found</div>;
    }

    const areaLabel = farm.totalAreaHa ? `${farm.totalAreaHa} ha` : 'Not measured';
    const boundaryType = farm.location?.type === 'Polygon' ? 'GPS Polygon Boundary' : farm.location?.type === 'Point' ? 'Single GPS Point' : 'Not captured';

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 shadow-lg">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,white,transparent_45%)]" />
                <div className="relative flex items-center justify-between px-6 py-6 flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/farms')} className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="h-14 w-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-sm">
                            <Sprout className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white leading-tight">{farm.name}</h1>
                            <p className="text-sm text-green-100">
                                Owner:{' '}
                                {farm.farmer ? (
                                    <Link to={`/farmers/${farm.farmer.id}`} className="text-white hover:underline font-semibold">
                                        {farm.farmer.firstName} {farm.farmer.lastName}
                                    </Link>
                                ) : 'Unknown'}
                            </p>
                        </div>
                    </div>
                    <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold border backdrop-blur-sm ${
                        farm.riskLevel === 'High' ? 'bg-red-500/20 text-red-100 border-red-300/40' :
                        farm.riskLevel === 'Medium' ? 'bg-orange-500/20 text-orange-100 border-orange-300/40' :
                        'bg-white/20 text-white border-white/40'
                    }`}>
                        Risk: {farm.riskLevel || 'Low'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Map */}
                <div className="lg:col-span-2 bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-green-600" /> Farm Boundary Map
                        </h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{boundaryType}</span>
                    </div>
                    <div className="h-96">
                        <FarmMap location={farm.location} height="100%" boundaryEvidence={farm.boundaryEvidence} areaHa={farm.totalAreaHa} />
                    </div>
                </div>

                {/* Key Stats */}
                <div className="space-y-4">
                    <div className="bg-white shadow-md rounded-xl p-4 grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100/60 rounded-xl border border-blue-100">
                            <p className="text-xl font-bold text-blue-700">{farm.cropType}</p>
                            <p className="text-xs text-blue-500/80 mt-0.5">Crop Type</p>
                        </div>
                        <div className="p-3 bg-gradient-to-br from-orange-50 to-orange-100/60 rounded-xl border border-orange-100">
                            <p className="text-xl font-bold text-orange-700">{areaLabel}</p>
                            <p className="text-xs text-orange-500/80 mt-0.5">Total Area</p>
                        </div>
                        <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100/60 rounded-xl border border-purple-100">
                            <p className="text-xl font-bold text-purple-700">{farm.numberOfTrees ?? '-'}</p>
                            <p className="text-xs text-purple-500/80 mt-0.5">Number of Trees</p>
                        </div>
                        <div className="p-3 bg-gradient-to-br from-green-50 to-green-100/60 rounded-xl border border-green-100">
                            <p className="text-xl font-bold text-green-700">{farm.yearsInCultivation ?? '-'}</p>
                            <p className="text-xs text-green-500/80 mt-0.5">Years Cultivated</p>
                        </div>
                    </div>

                    <div className="bg-white shadow-md rounded-xl p-4 text-sm space-y-2">
                        <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-gray-500">Ownership</span>
                            <span className="font-medium text-gray-900">{farm.ownershipType || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-gray-500">Registration Status</span>
                            <span className="font-medium text-gray-900">{farm.farmRegistrationStatus || 'Pending'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-gray-500">Harvest Season</span>
                            <span className="font-medium text-gray-900">{farm.harvestSeason || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-gray-500">Average Yield</span>
                            <span className="font-medium text-gray-900">{farm.averageYield || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-gray-500">Uses Chemicals?</span>
                            <span className="font-medium text-gray-900">{farm.useChemicals ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Extension Services?</span>
                            <span className="font-medium text-gray-900">{farm.extensionServices ? 'Yes' : 'No'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Farm Photos */}
            <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Farm Photos</h3>
                </div>
                <div className="p-6">
                    {farm.farmPhotos && farm.farmPhotos.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {farm.farmPhotos.map((url, idx) => (
                                <SafeImage
                                    key={idx}
                                    src={resolveFileUrl(url)}
                                    alt={`Farm photo ${idx + 1}`}
                                    className="h-32 w-full object-cover rounded-lg border border-gray-200"
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No farm photos uploaded yet.</p>
                    )}
                </div>
            </div>

            {/* EUDR Boundary Evidence: geotagged photo per captured boundary point */}
            {farm.boundaryEvidence && farm.boundaryEvidence.length > 0 && (
                <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-100">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Camera className="h-4 w-4 text-blue-600" />
                            <h3 className="text-lg font-medium leading-6 text-gray-900">Boundary Evidence (EUDR)</h3>
                        </div>
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                            {farm.boundaryEvidence.length} geotagged points
                        </span>
                    </div>
                    <div className="p-6">
                        <p className="text-xs text-gray-500 mb-4">
                            Each boundary corner was captured with a live GPS fix and a photo taken on-site,
                            matching EUDR due-diligence evidence requirements. Points are also plotted on the
                            map above (numbered blue markers).
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[...farm.boundaryEvidence]
                                .sort((a, b) => a.sequence - b.sequence)
                                .map((p) => (
                                    <div key={p.sequence} className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                        <SafeImage
                                            src={resolveFileUrl(p.photoUrl)}
                                            alt={`Boundary point ${p.sequence}`}
                                            className="h-32 w-full object-cover"
                                        />
                                        <span className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[11px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow">
                                            {p.sequence}
                                        </span>
                                        <div className="p-2 text-[11px] text-gray-600 space-y-0.5">
                                            <p className="font-mono truncate">{p.lat.toFixed(6)}, {p.lng.toFixed(6)}</p>
                                            {p.accuracy !== undefined && <p>Accuracy: ±{p.accuracy.toFixed(1)}m</p>}
                                            {p.timestamp && <p>{new Date(p.timestamp).toLocaleString()}</p>}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {farm.farmAddress && (
                <div className="bg-white shadow-md rounded-xl p-6 flex items-start gap-3 border border-gray-100">
                    <Ruler className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-gray-700">Farm Address / Location Description</p>
                        <p className="text-sm text-gray-600 mt-1">{farm.farmAddress}</p>
                    </div>
                </div>
            )}

            {/* Documents Section */}
            <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Compliance Documents</h3>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="h-4 w-4" /> Registered {new Date(farm.createdAt).toLocaleDateString()}
                    </span>
                </div>
                <ul className="divide-y divide-gray-200">
                    {documents.length > 0 ? documents.map(doc => (
                        <li key={doc.id} className="px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center">
                                <FileText className="h-5 w-5 text-gray-400 mr-3" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{doc.type}</p>
                                    <p className="text-xs text-gray-500">Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${doc.status === 'Valid' ? 'bg-green-100 text-green-800' :
                                doc.status === 'Invalid' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'}`}>
                                {doc.status}
                            </span>
                        </li>
                    )) : (
                        <li className="px-6 py-4 text-sm text-gray-500">No documents uploaded</li>
                    )}
                </ul>
            </div>

            <FarmRiskPanel
                farmId={farm.id}
                riskLevel={farm.riskLevel}
                lastAssessmentDate={farm.lastRiskAssessmentDate}
                onAssessmentComplete={fetchFarm}
            />
        </div>
    );
};

export default FarmDetails;

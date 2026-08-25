import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Package, Calendar, Leaf, Scale, User, MapPin, ChevronRight } from 'lucide-react';


interface PublicFarmerSummary {
    id: string;
    firstName: string;
    lastName: string;
    community: string;
    district: string;
    region: string;
    profilePhoto: string;
}

interface PublicBatch {
    id: string;
    batchId: string;
    weightKg: number;
    cropType: string;
    status: string;
    createdAt: string;
    farmers: PublicFarmerSummary[];
}

const PublicBatchDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [batch, setBatch] = useState<PublicBatch | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (id) {
            apiClient.get(`/public/batches/${id}`)
                .then(res => {
                    const responseData = res.data;
                    if (responseData && (responseData as any).status) {
                        setBatch((responseData as any).data);
                    } else if (responseData) {
                        setBatch((responseData as any).data || responseData);
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching public batch", err);
                    setError('Failed to load batch details.');
                    setLoading(false);
                });
        }
    }, [id]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading batch details...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!batch) return <div className="p-8 text-center text-gray-500">Batch not found.</div>;

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header Card */}
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="bg-green-600 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-white">
                            <Package className="h-8 w-8" />
                            <div>
                                <h1 className="text-xl font-bold">Batch Details</h1>
                                <p className="text-green-100 text-sm font-mono">{batch.batchId}</p>
                            </div>
                        </div>
                        <div className="text-white text-right">
                            <div className="text-sm opacity-80">Status</div>
                            <div className="font-bold uppercase tracking-wide bg-white/20 px-2 py-1 rounded text-xs inline-block mt-1">{batch.status}</div>
                        </div>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        <div className="flex flex-col items-center justify-center p-2 text-center">
                            <Leaf className="h-6 w-6 text-green-500 mb-2" />
                            <span className="text-sm text-gray-500 uppercase font-semibold">Crop</span>
                            <span className="text-lg font-bold text-gray-900">{batch.cropType}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-2 text-center">
                            <Scale className="h-6 w-6 text-blue-500 mb-2" />
                            <span className="text-sm text-gray-500 uppercase font-semibold">Total Weight</span>
                            <span className="text-lg font-bold text-gray-900">{batch.weightKg} kg</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-2 text-center">
                            <Calendar className="h-6 w-6 text-orange-500 mb-2" />
                            <span className="text-sm text-gray-500 uppercase font-semibold">Created Date</span>
                            <span className="text-lg font-bold text-gray-900">{new Date(batch.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* Farmers List */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b flex items-center justify-between">
                        <span>Contributing Farmers</span>
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{batch.farmers.length} Farmers</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {batch.farmers.map((farmer) => (
                            <Link to={`/public/farmers/${farmer.id}`} key={farmer.id} className="block group">
                                <div className="border border-gray-200 rounded-lg p-4 hover:border-green-400 hover:shadow-md transition-all flex items-center gap-4">
                                    {farmer.profilePhoto ? (
                                        <img src={farmer.profilePhoto} alt="Profile" className="h-12 w-12 rounded-full object-cover bg-gray-100" />
                                    ) : (
                                        <div className="h-12 w-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                                            <User className="h-6 w-6" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-green-700">
                                            {farmer.firstName} {farmer.lastName}
                                        </h3>
                                        <div className="flex items-center text-xs text-gray-500 mt-1">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            <span className="truncate">{farmer.community}, {farmer.district}</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-green-500" />
                                </div>
                            </Link>
                        ))}
                    </div>
                    {batch.farmers.length === 0 && (
                        <div className="text-center py-8 text-gray-400 italic">
                            No farmers linked to this batch.
                        </div>
                    )}
                </div>

                <div className="text-center pt-8 border-t border-gray-200">
                    <p className="text-xs text-gray-400">
                        Public Supply Chain Verification • LACRA Platform <br />
                        Generated on {new Date().toLocaleDateString()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PublicBatchDetails;

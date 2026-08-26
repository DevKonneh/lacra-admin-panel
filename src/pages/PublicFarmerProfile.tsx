import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../api/client';
import { resolveFileUrl } from '../utils/fileUrl';
import SafeImage from '../components/SafeImage';
import { User, Map, CheckCircle, ShieldCheck, Sprout } from 'lucide-react';
import FarmMap from '../components/FarmMap';
import lacraLogo from '../assets/lacra_logo.jpg';

interface PublicFarm {
    name: string;
    cropType: string;
    totalAreaHa: number;
    location: any;
    riskLevel: string;
    farmRegistrationStatus: string;
    ownershipType?: string;
    numberOfTrees?: number;
    yearsInCultivation?: number;
    harvestSeason?: string;
    averageYield?: number;
    useChemicals?: boolean;
    extensionServices?: boolean;
    farmAddress?: string;
}

interface PublicFarmer {
    id: string;
    farmerId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
    nationalId?: string;
    gender?: string;
    dob?: string;
    nationality?: string;
    otherId?: string;
    address?: string;
    community: string;
    district: string;
    region: string;
    cooperativeName?: string;
    cooperativeId?: string;
    enumeratorName?: string;
    enumeratorId?: string;
    profilePhoto: string;
    idPhoto?: string;
    signature?: string;
    consent?: boolean;
    identityStatus: string;
    directions?: string;
    latitude?: string;
    longitude?: string;
    farms: PublicFarm[];
}

const PublicFarmerProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [farmer, setFarmer] = useState<PublicFarmer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (id) {
            apiClient.get(`/public/farmers/${id}`)
                .then(res => {
                    const responseData = res.data;
                    if (responseData && (responseData as any).status) {
                        setFarmer((responseData as any).data);
                    } else if (responseData) {
                        // Fallback in case of inconsistent public API vs Internal
                        setFarmer((responseData as any).data || responseData);
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching public profile", err);
                    setError('Failed to load farmer profile.');
                    setLoading(false);
                });
        }
    }, [id]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading public profile...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!farmer) return <div className="p-8 text-center text-gray-500">Farmer not found.</div>;

    return (
        <div className="min-h-screen bg-brand-bg py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header Banner */}
                <div className="relative overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 shadow-lg rounded-2xl p-6">
                    <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_85%_15%,white,transparent_45%)] pointer-events-none" />
                    <div className="absolute -right-10 -bottom-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
                    <div className="relative flex flex-col sm:flex-row items-center gap-3 justify-center sm:justify-start mb-4">
                        <img src={lacraLogo} alt="LACRA" className="h-9 w-9 rounded-full border-2 border-white/70 shadow-sm bg-white object-cover" />
                        <p className="text-green-100 text-xs font-semibold uppercase tracking-wider">Liberia Agriculture Commodity Regulatory Authority &bull; Public Verification</p>
                    </div>
                    <div className="relative flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                        <div className="relative flex-none">
                            <SafeImage
                                src={resolveFileUrl(farmer.profilePhoto)}
                                alt="Profile"
                                className="h-24 w-24 rounded-full object-cover border-4 border-white/80 shadow-md"
                                fallback={
                                    <div className="h-24 w-24 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center text-white border-4 border-white/80 shadow-md">
                                        <User className="h-10 w-10" />
                                    </div>
                                }
                            />
                            <div className={`absolute bottom-0 right-0 h-6 w-6 rounded-full border-2 border-white flex items-center justify-center ${farmer.identityStatus === 'Verified' ? 'bg-green-400' : 'bg-gray-300'}`}>
                                {farmer.identityStatus === 'Verified' && <CheckCircle className="h-4 w-4 text-white" />}
                            </div>
                        </div>

                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-white">{farmer.firstName} {farmer.lastName}</h1>
                            <p className="text-green-100 text-sm">Farmer ID: <span className="font-mono bg-white/15 px-1.5 py-0.5 rounded text-white">{farmer.farmerId || 'N/A'}</span></p>
                            <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
                                <span className="px-3 py-1 bg-white/15 backdrop-blur-sm text-white text-xs font-medium rounded-full border border-white/25">
                                    {farmer.community}, {farmer.district}
                                </span>
                                <span className="px-3 py-1 bg-white/15 backdrop-blur-sm text-white text-xs font-medium rounded-full border border-white/25">
                                    {farmer.region}
                                </span>
                                {farmer.identityStatus === 'Verified' && (
                                    <span className="px-3 py-1 bg-green-400/90 text-green-900 text-xs font-semibold rounded-full border border-white/25 flex items-center gap-1">
                                        <ShieldCheck className="h-3.5 w-3.5" /> Verified Identity
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Personal Information Grid */}
                <div className="bg-white shadow-md rounded-xl border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> Personal Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                        <div>
                            <span className="block text-gray-500">Phone</span>
                            <span className="font-medium">{farmer.phoneNumber || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Email</span>
                            <span className="font-medium">{farmer.email || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Gender</span>
                            <span className="font-medium">{farmer.gender || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Date of Birth</span>
                            <span className="font-medium">{farmer.dob ? new Date(farmer.dob).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Nationality</span>
                            <span className="font-medium">{farmer.nationality || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Address</span>
                            <span className="font-medium">{farmer.address || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">National ID</span>
                            <span className="font-medium">{farmer.nationalId || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Other ID (e.g. LASSRA)</span>
                            <span className="font-medium">{farmer.otherId || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Cooperative</span>
                            <span className="font-medium">{farmer.cooperativeName || 'N/A'} {farmer.cooperativeId ? `(${farmer.cooperativeId})` : ''}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Enumerator</span>
                            <span className="font-medium">{farmer.enumeratorName || 'N/A'} {farmer.enumeratorId ? `(${farmer.enumeratorId})` : ''}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">GPS Location</span>
                            <span className="font-medium">{farmer.latitude && farmer.longitude ? `${farmer.latitude}, ${farmer.longitude}` : 'N/A'}</span>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <span className="block text-gray-500">Directions</span>
                            <span className="font-medium italic">{farmer.directions || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* Identity & Documents */}
                <div className="bg-white shadow-md rounded-xl border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> Identity & Verification
                    </h2>
                    <div className="flex flex-wrap gap-8 justify-center md:justify-start">
                        <div className="text-center">
                            <span className="block text-gray-500 mb-2">ID Photo</span>
                            <SafeImage
                                src={resolveFileUrl(farmer.idPhoto)}
                                alt="ID Document"
                                className="h-32 w-auto border rounded shadow-sm"
                                fallback={
                                    <div className="h-32 w-48 bg-gray-100 flex items-center justify-center text-gray-400 rounded border border-dashed">No ID Photo</div>
                                }
                            />
                        </div>
                        <div className="text-center">
                            <span className="block text-gray-500 mb-2">Signature</span>
                            <SafeImage
                                src={resolveFileUrl(farmer.signature)}
                                alt="Signature"
                                className="h-20 w-auto border rounded shadow-sm bg-white"
                                fallback={
                                    <div className="h-20 w-48 bg-gray-100 flex items-center justify-center text-gray-400 rounded border border-dashed">No Signature</div>
                                }
                            />
                        </div>
                        <div className="flex items-center">
                            <div className={`px-4 py-2 rounded-lg border ${farmer.consent ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                <span className="font-bold">Consent Status:</span> {farmer.consent ? 'Granted' : 'Not Granted'}
                            </div>
                        </div>
                    </div>
                </div>


                {/* Farms Section */}
                <div>
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Sprout className="h-5 w-5 text-green-600" /> Registered Farms ({farmer.farms.length})
                    </h2>
                    <div className="space-y-4">
                        {farmer.farms.length === 0 ? (
                            <p className="text-gray-500 italic">No registered farms publicly visible.</p>
                        ) : (
                            farmer.farms.map((farm, idx) => (
                                <div key={idx} className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-100">
                                    <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex justify-between items-center">
                                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                            <Map className="h-4 w-4 text-gray-500" /> {farm.name}
                                        </h3>
                                        <div className="flex gap-2">
                                            <span className="text-xs font-semibold px-2 py-1 bg-white border border-gray-200 rounded text-gray-600">{farm.cropType}</span>
                                            <span className="text-xs font-semibold px-2 py-1 bg-white border border-gray-200 rounded text-gray-600">{farm.ownershipType}</span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="h-64 rounded-lg overflow-hidden border border-gray-200 relative">
                                                <FarmMap location={farm.location} height="100%" areaHa={farm.totalAreaHa} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                                <div className="col-span-2 border-b border-gray-100 mb-2 pb-1 font-semibold text-gray-700">Farm Metrics</div>

                                                <div className="text-gray-500">Total Area</div>
                                                <div className="font-medium text-right">{farm.totalAreaHa} ha</div>

                                                <div className="text-gray-500">Risk Level</div>
                                                <div className={`font-medium text-right ${farm.riskLevel === 'Low' ? 'text-green-600' : farm.riskLevel === 'High' ? 'text-red-600' : 'text-yellow-600'}`}>
                                                    {farm.riskLevel || 'Not Assessed'}
                                                </div>

                                                <div className="text-gray-500">Trees</div>
                                                <div className="font-medium text-right">{farm.numberOfTrees || '-'}</div>

                                                <div className="text-gray-500">Years Cultivated</div>
                                                <div className="font-medium text-right">{farm.yearsInCultivation || '-'}</div>

                                                <div className="text-gray-500">Harvest Season</div>
                                                <div className="font-medium text-right">{farm.harvestSeason || '-'}</div>

                                                <div className="text-gray-500">Avg Yield</div>
                                                <div className="font-medium text-right">{farm.averageYield || '-'}</div>

                                                <div className="col-span-2 border-t border-gray-100 mt-2 pt-2 pb-1 font-semibold text-gray-700">Practices</div>

                                                <div className="text-gray-500">Chemicals Used?</div>
                                                <div className="font-medium text-right">{farm.useChemicals ? 'Yes' : 'No'}</div>

                                                <div className="text-gray-500">Extension Services?</div>
                                                <div className="font-medium text-right">{farm.extensionServices ? 'Yes' : 'No'}</div>

                                                {farm.farmAddress && (
                                                    <div className="col-span-2 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                                                        {farm.farmAddress}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="text-center pt-8 border-t border-gray-200 flex flex-col items-center gap-2">
                    <img src={lacraLogo} alt="LACRA" className="h-10 w-10 rounded-full border border-gray-200 shadow-sm object-cover" />
                    <p className="text-xs text-gray-400">
                        Public Verification Page &bull; LACRA Platform<br />
                        <span className="italic">"From Seed to Table: Regulating for Excellence"</span><br />
                        Generated on {new Date().toLocaleDateString()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PublicFarmerProfile;

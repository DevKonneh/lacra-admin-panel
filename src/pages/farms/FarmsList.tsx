import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFarms, type FarmWithFarmer } from '../../api/farms';
import { Search, MapPin, ExternalLink, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';



const FarmsList: React.FC = () => {
    const [farms, setFarms] = useState<FarmWithFarmer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const { user } = useAuth();
    // const [showAddModal, setShowAddModal] = useState(false);
    // const { register, handleSubmit, setValue, reset } = useForm<NewFarmForm>();
    // const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchFarms = async () => {
            try {
                const response = await getFarms();
                if (response.data.status) {
                    setFarms(response.data.data);
                }
            } catch (error) {
                console.error("Error fetching farms", error);
            }
        };
        fetchFarms();
    }, []);

    // Simplified filtering: backend now handles the main role-based filtering, 
    // but we keep search filtering on the client side for the data returned.
    const filteredFarms = farms.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.farmer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.farmer.lastName.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <p className="text-sm text-brand-muted">
                    <span className="font-semibold text-brand-text">{farms.length}</span> registered farm{farms.length !== 1 ? 's' : ''}
                </p>
                {user?.role === UserRole.FARMER && (
                    <Link to="/farms/new" className="inline-flex items-center px-3.5 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-brand-green hover:bg-brand-green-hover transition-colors">
                        <Plus className="h-4 w-4 mr-2" /> Add Farm
                    </Link>
                )}
            </div>

            <div className="bg-white shadow-md rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            placeholder="Search by farm or farmer name"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farm Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farmer</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Crop Type</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location Type</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Map</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredFarms.map((farm) => (
                                <tr key={farm.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0">
                                                <MapPin className="h-6 w-6 text-green-500" />
                                            </div>
                                            <div className="ml-4">
                                                <Link to={`/farms/${farm.id}`} className="text-sm font-medium text-gray-900 hover:text-green-600 hover:underline">
                                                    {farm.name}
                                                </Link>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Link to={`/farmers/${farm.farmer.id}`} className="text-sm text-blue-600 hover:underline">
                                            {farm.farmer.firstName} {farm.farmer.lastName}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                            {farm.cropType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {farm.location?.type === 'Polygon' ? (
                                            <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                                <MapPin className="h-3.5 w-3.5" /> GPS Polygon
                                            </span>
                                        ) : farm.location?.type === 'Point' ? (
                                            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                                                <MapPin className="h-3.5 w-3.5" /> Point Only
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">Not mapped</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Link to={`/map?farmId=${farm.id}`} className="text-green-600 hover:text-green-900 inline-flex items-center">
                                            <ExternalLink className="h-4 w-4 mr-1" /> View on Map
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FarmsList;

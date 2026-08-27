import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFarmers, downloadFarmersFarmsCsv, type Farmer } from '../../api/farmers';
import { resolveFileUrl } from '../../utils/fileUrl';
import SafeImage from '../../components/SafeImage';
import { useAuth } from '../../context/AuthContext';
import { Search, User, MapPin, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Sprout, AlertTriangle, Download } from 'lucide-react';

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (status === 'Verified') {
        return (
            <span className="px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
            </span>
        );
    }
    if (status === 'Conflict') {
        return (
            <span className="px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                <ShieldAlert className="h-3.5 w-3.5" /> Conflict
            </span>
        );
    }
    return (
        <span className="px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
            <ShieldQuestion className="h-3.5 w-3.5" /> Unverified
        </span>
    );
};

const FarmersList: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [genderFilter, setGenderFilter] = useState<string>('All');
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    const handleExportCsv = async () => {
        try {
            setExporting(true);
            setExportError(null);
            await downloadFarmersFarmsCsv();
        } catch (err: any) {
            console.error('Error exporting farmers/farms CSV', err);
            if (err?.response?.status === 403) {
                setExportError('You do not have permission to generate this report.');
            } else {
                setExportError('Failed to generate report. Please try again.');
            }
        } finally {
            setExporting(false);
        }
    };

    const fetchFarmers = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getFarmers();
            if (response.data.status) {
                setFarmers(response.data.data);
            } else {
                setError(response.data.message || 'Failed to load farmers.');
            }
        } catch (err: any) {
            console.error("Error fetching farmers", err);
            if (err?.response?.status === 401) {
                setError('Your session has expired. Please log in again.');
            } else {
                setError('Failed to load farmers. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFarmers();
    }, []);

    const filteredFarmers = farmers.filter(f => {
        const matchesSearch =
            f.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.farmerId?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGender = genderFilter === 'All' || f.gender === genderFilter;
        return matchesSearch && matchesGender;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Farmers Directory</h1>
                    <p className="text-sm text-gray-500">{farmers.length} registered farmer{farmers.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button
                                type="button"
                                onClick={handleExportCsv}
                                disabled={exporting}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {exporting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                {exporting ? 'Generating…' : 'Generate Farmer Report'}
                            </button>
                        )}
                        <Link to="/farmers/register" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                            + Register New Farmer
                        </Link>
                    </div>
                    {exportError && (
                        <p className="text-xs text-red-600">{exportError}</p>
                    )}
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            placeholder="Search by name or Farmer ID"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={genderFilter}
                        onChange={(e) => setGenderFilter(e.target.value)}
                        className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    >
                        <option value="All">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <Loader2 className="animate-spin h-8 w-8 text-green-600" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button
                            onClick={fetchFarmers}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Farmer</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Farms</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Verification</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredFarmers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                                            No farmers found matching your criteria.
                                        </td>
                                    </tr>
                                ) : filteredFarmers.map((farmer) => (
                                    <tr key={farmer.id} className="hover:bg-green-50/40 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <SafeImage
                                                        src={resolveFileUrl(farmer.profilePhoto)}
                                                        alt={`${farmer.firstName} ${farmer.lastName}`}
                                                        className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm"
                                                        fallback={
                                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-sm">
                                                                <User className="h-5 w-5" />
                                                            </div>
                                                        }
                                                    />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{farmer.firstName} {farmer.lastName}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{farmer.farmerId || 'N/A'}</div>
                                                    {farmer.gender && (
                                                        <span className="text-xs text-gray-400">{farmer.gender}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{farmer.phoneNumber}</div>
                                            <div className="text-sm text-gray-500">{farmer.email || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 flex items-center gap-1">
                                                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                                {farmer.community || 'N/A'}
                                            </div>
                                            <div className="text-xs text-gray-500">{farmer.district}{farmer.district && farmer.region ? ', ' : ''}{farmer.region}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2.5 py-0.5 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                                <Sprout className="h-3 w-3" /> {farmer.farms?.length || 0} Farm{(farmer.farms?.length || 0) !== 1 ? 's' : ''}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <StatusBadge status={farmer.identityStatus} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Link to={`/farmers/${farmer.id}`} className="inline-flex items-center gap-1 text-green-700 hover:text-green-900 font-semibold">View Profile &rarr;</Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FarmersList;

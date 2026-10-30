import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllLicenses, getMyLicenses } from '../../api/licenses';
import { useAuth } from '../../context/AuthContext';
import { FileText, Plus, Search, AlertTriangle } from 'lucide-react';

// Skeleton row shown while licenses are loading, so the table never
// flashes "0 licenses" / an empty state before the real data arrives.
const SkeletonRow: React.FC = () => (
    <tr>
        <td className="px-6 py-4"><div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-3.5 w-20 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4 text-right"><div className="h-3.5 w-12 bg-gray-200 rounded animate-pulse ml-auto" /></td>
    </tr>
);

const LicenseList: React.FC = () => {
    const { user } = useAuth();
    const [licenses, setLicenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadLicenses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadLicenses = async () => {
        try {
            setLoading(true);
            setError(null);
            // Admin sees all, others see theirs (controller logic handles this mostly, but good to be explicit if needed)
            const response = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL' || user?.role === 'DG'
                ? await getAllLicenses()
                : await getMyLicenses();

            if (response.data.status) {
                setLicenses(response.data.data);
            } else {
                setError(response.data.message || 'Failed to load licenses.');
            }
        } catch (err: any) {
            console.error('Error fetching licenses', err);
            if (err?.response?.status === 401) {
                setError('Your session has expired. Please log in again.');
            } else {
                setError('Failed to load licenses. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const filteredLicenses = licenses.filter(l =>
        (l.licenseNumber?.toLowerCase()?.includes(searchTerm.toLowerCase()) || '') ||
        (l.holderName?.toLowerCase()?.includes(searchTerm.toLowerCase()) || '')
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'LICENSE_ISSUED': return 'bg-green-100 text-green-800';
            case 'DG_APPROVED': return 'bg-blue-100 text-blue-800';
            case 'RECOMMENDED_TO_DG': return 'bg-indigo-100 text-indigo-800';
            case 'SUBMITTED': return 'bg-yellow-100 text-yellow-800';
            case 'RETURNED_FOR_CORRECTION': return 'bg-orange-100 text-orange-800';
            case 'DG_REJECTED': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">License Management</h1>
                    <p className="text-sm text-gray-500">View and manage export licenses</p>
                </div>
                <Link to="/licenses/apply" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Application
                </Link>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            placeholder="Search by license number or holder name"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {error ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button
                            onClick={loadLicenses}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">License Number</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holder</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid Until</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <>
                                    <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
                                </>
                            ) : filteredLicenses.map(license => (
                                <tr key={license.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <FileText size={18} className="text-gray-400 mr-2" />
                                            <span className="text-sm font-medium text-gray-900">{license.licenseNumber || 'Pending'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {license.holderName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(license.status)}`}>
                                            {license.status?.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {license.validTo ? new Date(license.validTo).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Link to={`/licenses/${license.id}`} className="text-green-600 hover:text-green-900">View</Link>
                                    </td>
                                </tr>
                            ))}
                            {!loading && filteredLicenses.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                        No licenses found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                )}
            </div>
        </div>
    );
};

export default LicenseList;

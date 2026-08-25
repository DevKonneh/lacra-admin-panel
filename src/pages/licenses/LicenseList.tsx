import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllLicenses, getMyLicenses } from '../../api/licenses';
import { useAuth } from '../../context/AuthContext';
import { FileText, Plus, Search } from 'lucide-react';

const LicenseList: React.FC = () => {
    const { user } = useAuth();
    const [licenses, setLicenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadLicenses();
    }, []);

    const loadLicenses = async () => {
        try {
            // Admin sees all, others see theirs (controller logic handles this mostly, but good to be explicit if needed)
            const response = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL' || user?.role === 'DG'
                ? await getAllLicenses()
                : await getMyLicenses();

            if (response.data.status) {
                setLicenses(response.data.data);
            }
        } catch (err) {
            console.error(err);
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

    if (loading) return <div>Loading...</div>;

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
                            {filteredLicenses.map(license => (
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
                            {filteredLicenses.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                        No licenses found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LicenseList;

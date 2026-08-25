import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllPermits } from '../../api/permits'; // You might need a getMyPermits too if separate endpoint
import { FileBadge, Plus, Search } from 'lucide-react';

const PermitList: React.FC = () => {
    const [permits, setPermits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadPermits();
    }, []);

    const loadPermits = async () => {
        try {
            // Similarly assuming getAllPermits handles role-based filtering on backend or we filter here
            const response = await getAllPermits();
            // The API response body is in response.data
            // The actual array of permits is in response.data.data
            if (response.data && Array.isArray(response.data.data)) {
                setPermits(response.data.data);
            } else {
                setPermits([]);
            }
        } catch (err) {
            console.error(err);
            setPermits([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredPermits = permits.filter(p =>
        (p.permitNumber?.toLowerCase()?.includes(searchTerm.toLowerCase()) || '') ||
        (p.business?.name?.toLowerCase()?.includes(searchTerm.toLowerCase()) || '')
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PERMIT_ISSUED': return 'bg-green-100 text-green-800';
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
                    <h1 className="text-2xl font-bold text-gray-900">Permit Management</h1>
                    <p className="text-sm text-gray-500">Manage trading permits for Local Buyers, Agencies, and Cooperatives</p>
                </div>
                <Link to="/permits/apply" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Permit Application
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
                            placeholder="Search by permit number or business name"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permit Number</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid Until</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredPermits.map(permit => (
                                <tr key={permit.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <FileBadge size={18} className="text-gray-400 mr-2" />
                                            <span className="text-sm font-medium text-gray-900">{permit.permitNumber || 'DRAFT'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {permit.business?.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(permit.status)}`}>
                                            {permit.status?.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {permit.validTo ? new Date(permit.validTo).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Link to={`/permits/${permit.id}`} className="text-green-600 hover:text-green-900">View</Link>
                                    </td>
                                </tr>
                            ))}
                            {filteredPermits.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                        No permits found.
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

export default PermitList;

import React, { useEffect, useState } from 'react';
import { getAllLicenses, decideLicense, suspendLicense } from '../../api/licenses';
import type { License } from '../../api/licenses';

// Maps the real LicenseStatus pipeline values (DRAFT, SUBMITTED,
// RETURNED_FOR_CORRECTION, RECOMMENDED_TO_DG, DG_APPROVED, DG_REJECTED,
// LICENSE_ISSUED, SUSPENDED, EXPIRED) to a badge color. PENDING/ACTIVE/
// REJECTED are kept for backward compatibility with any older records but
// are not produced by the current workflow.
const statusColor = (status: string) => {
    switch (status) {
        case 'LICENSE_ISSUED':
        case 'ACTIVE':
            return 'bg-green-100 text-green-800';
        case 'DG_APPROVED':
            return 'bg-blue-100 text-blue-800';
        case 'RECOMMENDED_TO_DG':
            return 'bg-indigo-100 text-indigo-800';
        case 'SUBMITTED':
        case 'PENDING':
            return 'bg-yellow-100 text-yellow-800';
        case 'RETURNED_FOR_CORRECTION':
            return 'bg-orange-100 text-orange-800';
        case 'DG_REJECTED':
        case 'REJECTED':
        case 'SUSPENDED':
        case 'EXPIRED':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const AdminLicenseList: React.FC = () => {
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actioningId, setActioningId] = useState<string | null>(null);

    useEffect(() => {
        loadLicenses();
    }, []);

    const loadLicenses = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getAllLicenses();
            if (res.data.status) {
                setLicenses(res.data.data);
            } else {
                setError(res.data.message || 'Failed to load licenses.');
            }
        } catch (err) {
            console.error('Error loading licenses', err);
            setError('Failed to load licenses. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDgDecision = async (id: string, decision: 'DG_APPROVED' | 'DG_REJECTED') => {
        setActioningId(id);
        try {
            await decideLicense(id, decision);
            await loadLicenses();
        } catch (err) {
            console.error('Error recording DG decision', err);
            alert('Error updating license. Please try again.');
        } finally {
            setActioningId(null);
        }
    };

    const handleSuspend = async (id: string) => {
        if (!window.confirm('Suspend this license? The holder will no longer be able to operate under it.')) {
            return;
        }
        setActioningId(id);
        try {
            await suspendLicense(id);
            await loadLicenses();
        } catch (err) {
            console.error('Error suspending license', err);
            alert('Error suspending license. Please try again.');
        } finally {
            setActioningId(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">License Requests (Admin)</h1>
                <p className="text-sm text-gray-500">
                    Licenses recommended by Commercial review await a DG decision below. Issued licenses can be suspended if needed.
                </p>
            </div>

            {error ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6 bg-white shadow rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{error}</p>
                    <button
                        onClick={loadLicenses}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                    >
                        Try Again
                    </button>
                </div>
            ) : (
                <div className="flex flex-col">
                    <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                            <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holder</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">Loading licenses...</td>
                                            </tr>
                                        ) : licenses.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No licenses found.</td>
                                            </tr>
                                        ) : licenses.map((license) => (
                                            <tr key={license.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{license.licenseNumber}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{license.type}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{license.holderName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(license.status)}`}>
                                                        {license.status?.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{license.user?.email}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {license.status === 'RECOMMENDED_TO_DG' && (
                                                        <>
                                                            <button
                                                                disabled={actioningId === license.id}
                                                                onClick={() => handleDgDecision(license.id, 'DG_APPROVED')}
                                                                className="text-green-600 hover:text-green-900 mr-4 disabled:opacity-50">
                                                                Approve
                                                            </button>
                                                            <button
                                                                disabled={actioningId === license.id}
                                                                onClick={() => handleDgDecision(license.id, 'DG_REJECTED')}
                                                                className="text-red-600 hover:text-red-900 disabled:opacity-50">
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {(license.status === 'LICENSE_ISSUED' || license.status === 'ACTIVE') && (
                                                        <button
                                                            disabled={actioningId === license.id}
                                                            onClick={() => handleSuspend(license.id)}
                                                            className="text-red-600 hover:text-red-900 disabled:opacity-50">
                                                            Suspend
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLicenseList;

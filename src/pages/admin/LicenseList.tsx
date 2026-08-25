import React, { useEffect, useState } from 'react';
import { getAllLicenses, approveLicense } from '../../api/licenses';
import type { License } from '../../api/licenses';

const AdminLicenseList: React.FC = () => {
    const [licenses, setLicenses] = useState<License[]>([]);

    useEffect(() => {
        loadLicenses();
    }, []);

    const loadLicenses = async () => {
        try {
            const res = await getAllLicenses();
            if (res.data.status) {
                setLicenses(res.data.data);
            }
        } catch (error) {
            console.error("Error loading licenses", error);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await approveLicense(id, status);
            await loadLicenses();
        } catch (error) {
            alert("Error updating license");
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">License Requests (Admin)</h1>

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
                                    {licenses.map((license) => (
                                        <tr key={license.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{license.licenseNumber}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{license.type}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{license.holderName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                    ${license.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                                        license.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-red-100 text-red-800'}`}>
                                                    {license.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{license.user?.email}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {license.status === 'PENDING' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateStatus(license.id, 'ACTIVE')}
                                                            className="text-green-600 hover:text-green-900 mr-4">
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateStatus(license.id, 'REJECTED')}
                                                            className="text-red-600 hover:text-red-900">
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {license.status === 'ACTIVE' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(license.id, 'SUSPENDED')}
                                                        className="text-red-600 hover:text-red-900">
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
        </div>
    );
};

export default AdminLicenseList;

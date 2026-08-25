import React, { useEffect, useState } from 'react';
import { applyLicense, getMyLicenses } from '../../api/licenses';
import type { License } from '../../api/licenses';

const LicenseDashboard: React.FC = () => {
    const [licenses, setLicenses] = useState<License[]>([]);
    const [type, setType] = useState('LOCAL_BUYER');
    const [holderName, setHolderName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadLicenses();
    }, []);

    const loadLicenses = async () => {
        try {
            const res = await getMyLicenses();
            if (res.data.status) {
                setLicenses(res.data.data);
            }
        } catch (error) {
            console.error("Error loading licenses", error);
        }
    };

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await applyLicense({ type, holderName });
            await loadLicenses();
            setHolderName('');
            alert('Application Submitted successfully');
        } catch (error) {
            alert('Error applying for license');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">My Licenses</h1>

            {/* Application Form */}
            <div className="bg-white shadow sm:rounded-lg mb-8 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Apply for New License</h3>
                <form onSubmit={handleApply} className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">License Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                        >
                            <option value="LOCAL_BUYER">Local Buyer</option>
                            <option value="COOPERATIVE">Cooperative</option>
                            <option value="AGENCY">Agency</option>
                            <option value="EXPORTER">Exporter</option>
                        </select>
                    </div>

                    <div className="sm:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Business/Holder Name</label>
                        <input
                            type="text"
                            required
                            value={holderName}
                            onChange={(e) => setHolderName(e.target.value)}
                            className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                    </div>

                    <div className="sm:col-span-6">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                            {loading ? 'Submitting...' : 'Apply Now'}
                        </button>
                    </div>
                </form>
            </div>

            {/* List */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {licenses.map((license) => (
                        <li key={license.id}>
                            <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-green-600 truncate">{license.licenseNumber}</p>
                                    <div className="ml-2 flex-shrink-0 flex">
                                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${license.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                                license.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'}`}>
                                            {license.status}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-2 sm:flex sm:justify-between">
                                    <div className="sm:flex">
                                        <p className="flex items-center text-sm text-gray-500">
                                            {license.type} - {license.holderName}
                                        </p>
                                    </div>
                                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                        <p>
                                            {license.validFrom ? `Valid: ${new Date(license.validFrom).toLocaleDateString()} - ${new Date(license.validTo!).toLocaleDateString()}` : 'Validity Pending'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                    {licenses.length === 0 && (
                        <li className="px-4 py-4 sm:px-6 text-center text-gray-500">No licenses found. Apply above.</li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default LicenseDashboard;

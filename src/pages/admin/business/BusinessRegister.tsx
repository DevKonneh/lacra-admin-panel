import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerBusiness } from '../../../api/business'; // Assuming this import path
import { Save, ArrowLeft } from 'lucide-react';

const BusinessRegister: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: 'EXPORTER', // Default
        registrationNumber: '',
        kycDocuments: [] as string[] // Placeholder
    });
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await registerBusiness(formData);
            if (res.data.status) {
                navigate('/admin/business'); // Or redirect to dashboard
            } else {
                setError(res.data.message || 'Failed to register business');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to register business');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} className="text-gray-500" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Register New Business</h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
                {error && <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

                <div className="grid grid-cols-1 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Business Name</label>
                        <input
                            type="text"
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Business Type</label>
                        <select
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border"
                        >
                            <option value="EXPORTER">Exporter (Eligible for Export License)</option>
                            <option value="LOCAL_BUYER">Local Buyer (Eligible for Permit)</option>
                            <option value="AGENCY">Agency (Eligible for Permit)</option>
                            <option value="COOPERATIVE">Cooperative (Eligible for Permit)</option>
                            <option value="TRANSPORTER">Transporter (Eligible for Permit)</option>
                            <option value="WAREHOUSE">Warehouse (Eligible for Permit)</option>
                        </select>
                        <p className="mt-2 text-sm text-gray-500">
                            {formData.type === 'EXPORTER'
                                ? 'Exporters can apply for Licenses to ship commodities internationally.'
                                : formData.type === 'TRANSPORTER'
                                ? 'Transporters can apply for Permits to move commodities along the supply chain.'
                                : formData.type === 'WAREHOUSE'
                                ? 'Warehouses can apply for Permits to store commodities.'
                                : 'This business type can apply for Permits to trade locally.'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Registration Number</label>
                        <input
                            type="text"
                            name="registrationNumber"
                            required
                            value={formData.registrationNumber}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border"
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? 'Registering...' : 'Register Business'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default BusinessRegister;

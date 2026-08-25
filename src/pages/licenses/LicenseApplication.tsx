import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { applyLicense } from '../../api/licenses';
import { getMyBusiness } from '../../api/business';
import { Save, ArrowLeft, AlertCircle } from 'lucide-react';

const LicenseApplication: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [checkingEligibility, setCheckingEligibility] = useState(true);
    const [business, setBusiness] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        checkEligibility();
    }, []);

    const checkEligibility = async () => {
        try {
            const res = await getMyBusiness();
            if (res.data.status) {
                const biz = res.data.data;
                setBusiness(biz);
                if (biz.eligibility !== 'LICENSE_ALLOWED') {
                    setError('Your business profile is not eligible for Export Licenses. Please correct your business type in the registry.');
                }
            }
        } catch (err) {
            setError('Could not fetch business profile. Please ensure you have registered your business.');
        } finally {
            setCheckingEligibility(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await applyLicense({
                type: 'EXPORTER',
                holderName: business?.name
            });
            navigate('/licenses');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to submit application');
        } finally {
            setLoading(false);
        }
    };

    if (checkingEligibility) return <div>Checking eligibility...</div>;

    if (error) {
        return (
            <div className="max-w-3xl mx-auto mt-10 p-6 bg-red-50 rounded-lg border border-red-200 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-red-800">Eligibility Error</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <div className="mt-6">
                    <button onClick={() => navigate('/admin/business')} className="text-red-700 underline font-medium hover:text-red-800">
                        Go to Business Registry
                    </button>
                    <span className="mx-2 text-gray-400">|</span>
                    <button onClick={() => navigate(-1)} className="text-gray-600 underline hover:text-gray-800">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} className="text-gray-500" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">New License Application</h1>
            </div>

            <div className="bg-white shadow rounded-lg p-6 space-y-6">
                <div className="bg-green-50 border-l-4 border-green-400 p-4">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-green-800">Eligible Applicant</h3>
                            <p className="text-sm text-green-700 mt-1">
                                Creating application for <strong>{business?.name}</strong> ({business?.registrationNumber})
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-gray-600">
                    By submitting this application, you are requesting a new License to export commodities.
                    The application will be created in <strong>DRAFT</strong> status. You can upload additional documents before final submission.
                </p>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? 'Processing...' : 'Create Draft Application'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LicenseApplication;

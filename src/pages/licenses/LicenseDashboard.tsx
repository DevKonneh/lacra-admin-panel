import React, { useEffect, useState } from 'react';
import { applyLicense, getMyLicenses } from '../../api/licenses';
import type { License } from '../../api/licenses';
import { CheckCircle2, Clock, XCircle, HelpCircle, Inbox } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { buttonClasses } from '../../components/ui/buttonStyles';
import Badge from '../../components/ui/Badge';
import type { BadgeTone } from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

// Icon+text+color status badge so status is never shown by color alone.
const STATUS_META: Record<string, { tone: BadgeTone; icon: React.ReactNode }> = {
    ACTIVE: { tone: 'green', icon: <CheckCircle2 /> },
    LICENSE_ISSUED: { tone: 'green', icon: <CheckCircle2 /> },
    PENDING: { tone: 'amber', icon: <Clock /> },
    SUBMITTED: { tone: 'amber', icon: <Clock /> },
    REJECTED: { tone: 'red', icon: <XCircle /> },
    SUSPENDED: { tone: 'red', icon: <XCircle /> },
    EXPIRED: { tone: 'red', icon: <XCircle /> },
};
const getStatusMeta = (status: string) => STATUS_META[status] || { tone: 'slate' as BadgeTone, icon: <HelpCircle /> };

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
            <PageHeader
                breadcrumb={[{ label: 'Licensing' }]}
                title="My Licenses"
                description="Apply for a new license and track the status of your applications."
            />

            {/* Application Form */}
            <div className="bg-white border border-gray-200 rounded-lg mb-8 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Apply for New License</h3>
                <form onSubmit={handleApply} className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                        <label htmlFor="license-type" className="block text-sm font-medium text-gray-700">License Type</label>
                        <select
                            id="license-type"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green sm:text-sm rounded-md"
                        >
                            <option value="LOCAL_BUYER">Local Buyer</option>
                            <option value="COOPERATIVE">Cooperative</option>
                            <option value="AGENCY">Agency</option>
                            <option value="EXPORTER">Exporter</option>
                        </select>
                    </div>

                    <div className="sm:col-span-3">
                        <label htmlFor="license-holder-name" className="block text-sm font-medium text-gray-700">Business/Holder Name</label>
                        <input
                            id="license-holder-name"
                            type="text"
                            required
                            value={holderName}
                            onChange={(e) => setHolderName(e.target.value)}
                            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                    </div>

                    <div className="sm:col-span-6">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full ${buttonClasses('primary')} disabled:opacity-60`}
                        >
                            {loading ? 'Submitting...' : 'Apply Now'}
                        </button>
                    </div>
                </form>
            </div>

            {/* List */}
            <div className="bg-white border border-gray-200 overflow-hidden rounded-lg">
                {licenses.length === 0 ? (
                    <EmptyState
                        icon={<Inbox className="h-5 w-5" />}
                        title="No licenses found"
                        description="Apply above to submit your first license application."
                    />
                ) : (
                <ul className="divide-y divide-gray-200">
                    {licenses.map((license) => (
                        <li key={license.id}>
                            <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-brand-green truncate">{license.licenseNumber}</p>
                                    <div className="ml-2 flex-shrink-0 flex">
                                        <Badge tone={getStatusMeta(license.status).tone} icon={getStatusMeta(license.status).icon}>
                                            {license.status}
                                        </Badge>
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
                </ul>
                )}
            </div>
        </div>
    );
};

export default LicenseDashboard;

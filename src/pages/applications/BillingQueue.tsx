import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Search } from 'lucide-react';
import { getApplications, type ApplicationListItem } from '../../api/applications';
import ResponsiveTable, { type ColumnDef } from '../../components/forms/ResponsiveTable';
import { statusColor, statusLabel, categoryLabel, apiErrorMessage } from './statusHelpers';

// Finance Officer's Billing work queue: applications awaiting the start
// of billing review, PLUS applications already being worked on (invoice
// not yet approved). Same merged-in-memory pattern as CommercialQueue.tsx/
// TechnicalReviewQueue.tsx - one simple getApplications({status}) call
// per relevant status, merged and sorted client-side. RETURNED_TO_FINANCE
// is included here (not in PaymentQueue) since a DG return-to-finance at
// the final-approval stage over a billing discrepancy re-enters at
// invoice creation, not payment recording.
const QUEUE_STATUSES = [
    'AWAITING_BILLING_REVIEW',
    'BILLING_REVIEW_IN_PROGRESS',
    'RETURNED_TO_FINANCE',
];

const BillingQueue: React.FC = () => {
    const [applications, setApplications] = useState<ApplicationListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadQueue();
    }, []);

    const loadQueue = async () => {
        setLoading(true);
        setError('');
        try {
            const responses = await Promise.all(
                QUEUE_STATUSES.map((status) => getApplications({ status }))
            );
            const merged = responses.flatMap((r) => r.data.data || []);
            merged.sort((a, b) => new Date(a.submittedAt || a.createdAt).getTime() - new Date(b.submittedAt || b.createdAt).getTime());
            setApplications(merged);
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load the Billing queue.'));
            setApplications([]);
        } finally {
            setLoading(false);
        }
    };

    const filtered = applications.filter((a) =>
        (a.applicationNumber?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.applicantName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.county?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const columns: ColumnDef<ApplicationListItem>[] = [
        { header: 'Application #', render: (a) => <span className="font-medium text-slate-900">{a.applicationNumber}</span> },
        { header: 'Category', render: (a) => categoryLabel(a.category) },
        { header: 'Applicant', render: (a) => a.applicantName || '-' },
        { header: 'County', render: (a) => a.county || '-' },
        {
            header: 'Status',
            render: (a) => (
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(a.status)}`}>
                    {statusLabel(a.status)}
                </span>
            ),
        },
        { header: 'Submitted', render: (a) => a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '-' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Billing Queue</h1>
                <p className="text-sm text-gray-500">Applications awaiting invoice preparation and approval before routing to the applicant for payment.</p>
            </div>

            {error && <div className="rounded-lg border-l-4 border-red-400 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            placeholder="Search by application number, applicant name, or county"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="text-sm text-gray-500 py-6 text-center">Loading queue...</div>
                    ) : (
                        <ResponsiveTable
                            columns={columns}
                            rows={filtered}
                            rowKey={(a) => a.id}
                            actions={(a) => (
                                <Link to={`/applications/${a.id}`} className="text-green-600 hover:text-green-900 font-medium">
                                    Open
                                </Link>
                            )}
                            emptyIcon={<Receipt size={20} />}
                            emptyTitle="No applications awaiting billing"
                            emptyDescription="Applications approved by the Director-General (technical stage) will appear here for invoice preparation."
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default BillingQueue;

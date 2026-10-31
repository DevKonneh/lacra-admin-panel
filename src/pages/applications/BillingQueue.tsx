import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { getApplications, type ApplicationListItem } from '../../api/applications';
import ResponsiveTable, { type ColumnDef } from '../../components/forms/ResponsiveTable';
import QueueListPage from '../../components/forms/QueueListPage';
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
        <QueueListPage
            title="Billing Queue"
            description="Applications awaiting invoice preparation and approval before routing to the applicant for payment."
            icon={<Receipt size={20} />}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            searchPlaceholder="Search by application number, applicant name, or county"
            error={error}
            onRetry={loadQueue}
            resultCount={filtered.length}
            loading={loading}
        >
            <ResponsiveTable
                columns={columns}
                rows={filtered}
                rowKey={(a) => a.id}
                loading={loading}
                actions={(a) => (
                    <Link to={`/applications/${a.id}`} className="text-green-600 hover:text-green-900 font-medium">
                        Open
                    </Link>
                )}
                emptyIcon={<Receipt size={20} />}
                emptyTitle="No applications awaiting billing"
                emptyDescription="Applications approved by the Director-General (technical stage) will appear here for invoice preparation."
            />
        </QueueListPage>
    );
};

export default BillingQueue;

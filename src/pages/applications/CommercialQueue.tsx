import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { getApplications, type ApplicationListItem } from '../../api/applications';
import ResponsiveTable, { type ColumnDef } from '../../components/forms/ResponsiveTable';
import QueueListPage from '../../components/forms/QueueListPage';
import { statusColor, statusLabel, categoryLabel, apiErrorMessage } from './statusHelpers';

// Commercial and Marketing Officer's work queue: every application that is
// either newly submitted (AWAITING_COMMERCIAL_VERIFICATION) or already
// being worked on (COMMERCIAL_REVIEW_IN_PROGRESS) by this officer. Actions
// (start review / request correction / verify) are taken from the
// Application Detail page, reached via "Open" below - this list only
// surfaces what needs attention.
const QUEUE_STATUSES = ['AWAITING_COMMERCIAL_VERIFICATION', 'COMMERCIAL_REVIEW_IN_PROGRESS'];

const CommercialQueue: React.FC = () => {
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
            // Two simple (non-composite-index) queries, one per status,
            // merged in memory and sorted by submission date - avoids
            // relying on an `IN` clause / Firestore-style index concerns
            // and keeps each request trivial to reason about.
            const responses = await Promise.all(
                QUEUE_STATUSES.map((status) => getApplications({ status }))
            );
            const merged = responses.flatMap((r) => r.data.data || []);
            merged.sort((a, b) => new Date(a.submittedAt || a.createdAt).getTime() - new Date(b.submittedAt || b.createdAt).getTime());
            setApplications(merged);
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load the Commercial Verification queue.'));
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
            title="Commercial Verification Queue"
            description="Applications awaiting Commercial and Marketing review before routing to the Director-General."
            icon={<ClipboardList size={20} />}
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
                emptyIcon={<ClipboardList size={20} />}
                emptyTitle="No applications awaiting verification"
                emptyDescription="Newly submitted applications will appear here as soon as applicants submit them."
            />
        </QueueListPage>
    );
};

export default CommercialQueue;

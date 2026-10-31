import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { getApplications, type ApplicationListItem } from '../../api/applications';
import ResponsiveTable, { type ColumnDef } from '../../components/forms/ResponsiveTable';
import QueueListPage from '../../components/forms/QueueListPage';
import { statusColor, statusLabel, categoryLabel, apiErrorMessage } from './statusHelpers';

// IT Officer's work queue: applications approved for issuance and
// awaiting certificate printing, plus applications already printed and
// awaiting the final issuance step. Same merged-in-memory pattern as the
// other Phase 2-4 queues.
const QUEUE_STATUSES = [
    'AWAITING_IT_CERTIFICATE_PRINTING',
    'CERTIFICATE_PRINTED',
];

const ITQueue: React.FC = () => {
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
            setError(apiErrorMessage(err, 'Failed to load the IT Certificate queue.'));
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
            title="Certificate Printing Queue"
            description="Applications approved for issuance, awaiting certificate printing and final issuance to the applicant."
            icon={<Printer size={20} />}
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
                emptyIcon={<Printer size={20} />}
                emptyTitle="No applications awaiting certificate printing"
                emptyDescription="Applications given final approval by the Director-General will appear here."
            />
        </QueueListPage>
    );
};

export default ITQueue;

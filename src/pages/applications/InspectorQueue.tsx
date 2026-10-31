import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { getApplications, type ApplicationListItem } from '../../api/applications';
import ResponsiveTable, { type ColumnDef } from '../../components/forms/ResponsiveTable';
import QueueListPage from '../../components/forms/QueueListPage';
import { statusColor, statusLabel, categoryLabel, apiErrorMessage } from './statusHelpers';

// Inspector's work queue: applications assigned to an inspector and
// awaiting scheduling, or already scheduled/in-progress. Note this reads
// the full cross-inspector list (no per-inspector filter exists on the
// list endpoint yet) - acceptable for the current staff scale, matching
// the same simple-query-per-status pattern used by the other queues.
const QUEUE_STATUSES = [
    'INSPECTOR_ASSIGNED',
    'WAREHOUSE_INSPECTION_SCHEDULED',
    'WAREHOUSE_ASSESSMENT_IN_PROGRESS',
    'WAREHOUSE_REINSPECTION_REQUIRED',
];

const InspectorQueue: React.FC = () => {
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
            setError(apiErrorMessage(err, 'Failed to load the inspection queue.'));
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
            title="Warehouse Inspection Queue"
            description="Applications assigned for warehouse assessment: schedule, start, and submit findings."
            icon={<ClipboardCheck size={20} />}
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
                emptyIcon={<ClipboardCheck size={20} />}
                emptyTitle="No inspections assigned"
                emptyDescription="Applications assigned to you by Technical Services will appear here."
            />
        </QueueListPage>
    );
};

export default InspectorQueue;

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import { getApplications, type ApplicationListItem } from '../../api/applications';
import ResponsiveTable, { type ColumnDef } from '../../components/forms/ResponsiveTable';
import QueueListPage from '../../components/forms/QueueListPage';
import { statusColor, statusLabel, categoryLabel, apiErrorMessage } from './statusHelpers';

// Director-General's approval work queue, covering ALL THREE approval
// stages via tabs: the Commercial-stage first approval (applications
// verified by Commercial and Marketing), the Technical-stage second
// approval (applications whose warehouse assessment findings Technical
// Services has verified), and the Final approval (applications whose
// payment Finance has verified, added in Phase 4). Each tab loads its
// own status independently - kept as separate simple queries rather than
// one merged list, since a DG deliberately wants to work through one
// stage at a time.
type Stage = 'FIRST' | 'SECOND' | 'FINAL';

const STAGE_STATUS: Record<Stage, string> = {
    FIRST: 'AWAITING_FIRST_DG_APPROVAL',
    SECOND: 'AWAITING_SECOND_DG_APPROVAL',
    FINAL: 'AWAITING_FINAL_DG_APPROVAL',
};

const STAGE_TABS: { key: Stage; label: string }[] = [
    { key: 'FIRST', label: 'Commercial Stage (First Approval)' },
    { key: 'SECOND', label: 'Technical Stage (Second Approval)' },
    { key: 'FINAL', label: 'Final Approval' },
];

const DGApprovalQueue: React.FC = () => {
    const [stage, setStage] = useState<Stage>('FIRST');
    const [applications, setApplications] = useState<ApplicationListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadQueue(stage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stage]);

    const loadQueue = async (s: Stage) => {
        setLoading(true);
        setError('');
        try {
            const response = await getApplications({ status: STAGE_STATUS[s] });
            const list = (response.data.data || []).slice();
            list.sort((a, b) => new Date(a.submittedAt || a.createdAt).getTime() - new Date(b.submittedAt || b.createdAt).getTime());
            setApplications(list);
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load the DG Approval queue.'));
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

    const emptyDescription =
        stage === 'FIRST'
            ? 'Applications verified by Commercial and Marketing will appear here.'
            : stage === 'SECOND'
                ? 'Applications verified by Technical Services will appear here.'
                : 'Applications with payment verified by Finance will appear here.';

    return (
        <QueueListPage
            title="Director-General Approvals"
            description="Applications awaiting your approval before proceeding to the next stage."
            icon={<Gavel size={20} />}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            searchPlaceholder="Search by application number, applicant name, or county"
            error={error}
            onRetry={() => loadQueue(stage)}
            resultCount={filtered.length}
            loading={loading}
            tabs={
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex gap-6 overflow-x-auto">
                        {STAGE_TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setStage(tab.key)}
                                className={`py-2 px-1 border-b-2 text-sm font-medium whitespace-nowrap ${stage === tab.key ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            }
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
                emptyIcon={<Gavel size={20} />}
                emptyTitle="No applications awaiting approval"
                emptyDescription={emptyDescription}
            />
        </QueueListPage>
    );
};

export default DGApprovalQueue;

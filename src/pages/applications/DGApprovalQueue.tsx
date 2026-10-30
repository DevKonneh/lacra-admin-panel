import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Search } from 'lucide-react';
import { getApplications, type ApplicationListItem } from '../../api/applications';
import ResponsiveTable, { type ColumnDef } from '../../components/forms/ResponsiveTable';
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

const DGApprovalQueue: React.FC = () => {
    const [stage, setStage] = useState<Stage>('FIRST');
    const [applications, setApplications] = useState<ApplicationListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadQueue(stage);
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Director-General Approvals</h1>
                <p className="text-sm text-gray-500">Applications awaiting your approval before proceeding to the next stage.</p>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-6">
                    <button
                        onClick={() => setStage('FIRST')}
                        className={`py-2 px-1 border-b-2 text-sm font-medium ${stage === 'FIRST' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Commercial Stage (First Approval)
                    </button>
                    <button
                        onClick={() => setStage('SECOND')}
                        className={`py-2 px-1 border-b-2 text-sm font-medium ${stage === 'SECOND' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Technical Stage (Second Approval)
                    </button>
                    <button
                        onClick={() => setStage('FINAL')}
                        className={`py-2 px-1 border-b-2 text-sm font-medium ${stage === 'FINAL' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Final Approval
                    </button>
                </nav>
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
                            emptyIcon={<Gavel size={20} />}
                            emptyTitle="No applications awaiting approval"
                            emptyDescription={
                                stage === 'FIRST'
                                    ? 'Applications verified by Commercial and Marketing will appear here.'
                                    : stage === 'SECOND'
                                        ? 'Applications verified by Technical Services will appear here.'
                                        : 'Applications with payment verified by Finance will appear here.'
                            }
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DGApprovalQueue;

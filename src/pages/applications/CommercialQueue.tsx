import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { getApplications, type ApplicationListItem } from '../../api/applications';
import ResponsiveTable, { type ColumnDef } from '../../components/forms/ResponsiveTable';
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
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Commercial Verification Queue</h1>
                <p className="text-sm text-gray-500">Applications awaiting Commercial and Marketing review before routing to the Director-General.</p>
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
                            emptyIcon={<ClipboardList size={20} />}
                            emptyTitle="No applications awaiting verification"
                            emptyDescription="Newly submitted applications will appear here as soon as applicants submit them."
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommercialQueue;

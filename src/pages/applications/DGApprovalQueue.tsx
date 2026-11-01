import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Gavel, Search, X, ChevronDown, ChevronUp, ChevronsUpDown,
    AlertTriangle, SlidersHorizontal,
} from 'lucide-react';
import { getApplications, type ApplicationListItem } from '../../api/applications';
import { apiErrorMessage, categoryLabel, durationLabel, formatDateParts } from './statusHelpers';
import { COUNTY_NAMES } from '../../data/liberiaCounties';
import { CATEGORY_LABELS, COMMODITY_LABELS } from '../apply/types';

// Key used to stash the list's scroll position in sessionStorage right
// before navigating into an application - mirrors CommercialQueue.tsx's
// SCROLL_RESTORE_KEY exactly (see that file for the full rationale).
const SCROLL_RESTORE_KEY = 'dgQueue:scrollY';

// Key used to hand the decision page the full filtered+sorted list of
// application ids for the stage currently being viewed, so its Previous
// Application / Next Application controls can step through the queue in
// the exact order the DG was viewing it. Refreshed every time the active
// tab's filtered/sorted result set changes - see CommercialQueue.tsx's
// QUEUE_ORDER_KEY for the identical pattern.
export const DG_QUEUE_ORDER_KEY = 'dgQueue:orderedIds';

// The DG's three approval stages. Each maps 1:1 to exactly one backend
// ApplicationStatus (no multi-status merge needed, unlike the Commercial/
// Technical/Billing queues) - these are not new statuses, just the
// existing AWAITING_*_DG_APPROVAL values already used throughout the
// backend's dgApprove/dgApproveSecond/dgApproveFinal actions.
type Stage = 'FIRST' | 'SECOND' | 'FINAL';

const STAGE_STATUS: Record<Stage, string> = {
    FIRST: 'AWAITING_FIRST_DG_APPROVAL',
    SECOND: 'AWAITING_SECOND_DG_APPROVAL',
    FINAL: 'AWAITING_FINAL_DG_APPROVAL',
};

const STAGE_TABS: { key: Stage; label: string }[] = [
    { key: 'FIRST', label: 'Commercial Approval' },
    { key: 'SECOND', label: 'Technical Approval' },
    { key: 'FINAL', label: 'Final Approval' },
];

type SortMode = 'OLDEST' | 'NEWEST';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

// The timestamp the application actually entered its CURRENT DG stage -
// not the original submission date. Falls back to submittedAt/createdAt
// only for the rare case where the backend couldn't derive a matching
// history row (e.g. very old data predating this field), so the queue
// never silently drops a row from date-based sorting/filtering.
function stageReceivedAt(a: ApplicationListItem): string | undefined {
    return a.currentStageEnteredAt || a.submittedAt || a.createdAt;
}

const DGApprovalQueue: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [applicationsByStage, setApplicationsByStage] = useState<Record<Stage, ApplicationListItem[]>>({ FIRST: [], SECOND: [], FINAL: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const scrollRestoredRef = useRef(false);

    const stage = ((searchParams.get('stage') as Stage) && STAGE_STATUS[searchParams.get('stage') as Stage]) ? (searchParams.get('stage') as Stage) : 'FIRST';
    const searchTerm = searchParams.get('q') || '';
    const dateFrom = searchParams.get('from') || '';
    const dateTo = searchParams.get('to') || '';
    const categoryFilter = searchParams.get('category') || '';
    const countyFilter = searchParams.get('county') || '';
    const commodityFilter = searchParams.get('commodity') || '';
    const sortMode = (searchParams.get('sort') as SortMode) || 'OLDEST';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = (parseInt(searchParams.get('size') || '20', 10) as typeof PAGE_SIZE_OPTIONS[number]) || 20;

    const setParam = (key: string, value: string | null, resetPage = true) => {
        const next = new URLSearchParams(searchParams);
        if (!value) next.delete(key);
        else next.set(key, value);
        if (resetPage) next.delete('page');
        setSearchParams(next);
    };

    const setStage = (s: Stage) => {
        const next = new URLSearchParams(searchParams);
        next.set('stage', s);
        next.delete('page');
        setSearchParams(next);
    };

    useEffect(() => {
        loadQueue();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Restore scroll position once, after the queue has finished its first
    // load and rendered rows - identical pattern to CommercialQueue.tsx.
    useLayoutEffect(() => {
        if (loading || scrollRestoredRef.current) return;
        scrollRestoredRef.current = true;
        const saved = sessionStorage.getItem(SCROLL_RESTORE_KEY);
        if (saved) {
            const y = parseInt(saved, 10);
            if (!Number.isNaN(y)) {
                requestAnimationFrame(() => window.scrollTo(0, y));
            }
            sessionStorage.removeItem(SCROLL_RESTORE_KEY);
        }
    }, [loading]);

    const saveScrollPosition = () => {
        sessionStorage.setItem(SCROLL_RESTORE_KEY, String(window.scrollY));
    };

    // Loads all three stages up front (not just the active tab) so the
    // per-tab application counts required by the spec are always accurate,
    // even for tabs the DG hasn't clicked into yet.
    const loadQueue = async () => {
        setLoading(true);
        setError('');
        try {
            const stages: Stage[] = ['FIRST', 'SECOND', 'FINAL'];
            const responses = await Promise.all(stages.map((s) => getApplications({ status: STAGE_STATUS[s] })));
            const next = { FIRST: [], SECOND: [], FINAL: [] } as Record<Stage, ApplicationListItem[]>;
            stages.forEach((s, idx) => { next[s] = responses[idx].data.data || []; });
            setApplicationsByStage(next);
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load the Director-General Approvals queue.'));
            setApplicationsByStage({ FIRST: [], SECOND: [], FINAL: [] });
        } finally {
            setLoading(false);
        }
    };

    const applications = applicationsByStage[stage];

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const fromTime = dateFrom ? startOfDay(new Date(dateFrom)).getTime() : null;
        const toTime = dateTo ? (() => { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); return d.getTime(); })() : null;

        let result = applications.filter((a) => {
            if (categoryFilter && a.category !== categoryFilter) return false;
            if (countyFilter && a.county !== countyFilter) return false;
            if (commodityFilter && a.commodity !== commodityFilter) return false;

            // Date filter is keyed on when the application entered THIS DG
            // stage, not its original submission date - per the spec's
            // explicit "date received at the selected DG stage" requirement.
            const receivedTime = stageReceivedAt(a) ? new Date(stageReceivedAt(a)!).getTime() : null;
            if (fromTime != null && (receivedTime == null || receivedTime < fromTime)) return false;
            if (toTime != null && (receivedTime == null || receivedTime > toTime)) return false;

            if (term) {
                const haystack = [a.applicationNumber, a.applicantName, a.businessName, a.tin].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            return true;
        });

        // Default sort: Oldest Received First, keyed on the DG-stage-entry
        // timestamp (NOT submittedAt) - applicationNumber is the stable
        // secondary tiebreaker, matching CommercialQueue.tsx's approach.
        result = [...result].sort((a, b) => {
            const aTime = new Date(stageReceivedAt(a) || 0).getTime();
            const bTime = new Date(stageReceivedAt(b) || 0).getTime();
            if (sortMode === 'NEWEST') {
                if (bTime !== aTime) return bTime - aTime;
            } else if (aTime !== bTime) {
                return aTime - bTime;
            }
            return (a.applicationNumber || '').localeCompare(b.applicationNumber || '');
        });

        return result;
    }, [applications, searchTerm, dateFrom, dateTo, categoryFilter, countyFilter, commodityFilter, sortMode]);

    // Keep the decision page's Previous/Next Application navigation in
    // sync with the active tab's current filtered+sorted order.
    useEffect(() => {
        if (loading) return;
        try {
            sessionStorage.setItem(DG_QUEUE_ORDER_KEY, JSON.stringify(filtered.map((a) => a.id)));
        } catch {
            // sessionStorage can throw in rare privacy-mode/quota situations -
            // Previous/Next Application simply won't be available then.
        }
    }, [filtered, loading]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const activeChips: { key: string; label: string }[] = [];
    if (dateFrom || dateTo) activeChips.push({ key: 'daterange', label: `Received ${dateFrom || '...'} to ${dateTo || '...'}` });
    if (categoryFilter) activeChips.push({ key: 'category', label: categoryLabel(categoryFilter) });
    if (countyFilter) activeChips.push({ key: 'county', label: countyFilter });
    if (commodityFilter) activeChips.push({ key: 'commodity', label: COMMODITY_LABELS[commodityFilter as keyof typeof COMMODITY_LABELS] || commodityFilter });

    const removeChip = (key: string) => {
        const next = new URLSearchParams(searchParams);
        if (key === 'daterange') { next.delete('from'); next.delete('to'); }
        else next.delete(key);
        next.delete('page');
        setSearchParams(next);
    };

    const clearAllFilters = () => {
        const next = new URLSearchParams();
        next.set('stage', stage);
        if (searchTerm) next.set('q', searchTerm);
        setSearchParams(next);
    };

    const toggleSort = (mode: SortMode) => setParam('sort', mode === 'OLDEST' ? null : mode, false);
    const sortIcon = (mode: SortMode) => {
        if (sortMode !== mode) return <ChevronsUpDown size={13} className="text-slate-400" />;
        return mode === 'NEWEST' ? <ChevronDown size={13} /> : <ChevronUp size={13} />;
    };

    const hasFilters = activeChips.length > 0;
    const hasMoreFilters = !!(categoryFilter || countyFilter || commodityFilter);

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-brand-text">Director-General Approvals</h1>
                <p className="text-sm text-brand-muted mt-0.5">Review each department's findings and decide whether to approve or return the application.</p>
            </div>

            {/* Stage tabs, each showing its own application count */}
            <div className="border-b border-brand-border">
                <nav className="-mb-px flex gap-6 overflow-x-auto">
                    {STAGE_TABS.map((tab) => {
                        const active = stage === tab.key;
                        const count = applicationsByStage[tab.key].length;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setStage(tab.key)}
                                className={`py-2.5 px-1 border-b-2 text-sm font-medium whitespace-nowrap inline-flex items-center gap-1.5 ${active ? 'border-brand-green text-brand-green' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                {tab.label}
                                <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[11px] font-semibold ${active ? 'bg-brand-green/10 text-brand-green' : 'bg-slate-100 text-slate-500'}`}>
                                    {loading ? '-' : count}
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1"><p className="text-sm text-red-800">{error}</p></div>
                    <button onClick={loadQueue} className="flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50">
                        Try Again
                    </button>
                </div>
            ) : null}

            <div className="bg-brand-card shadow-card rounded-xl overflow-hidden border border-brand-border">
                <div className="p-3 border-b border-brand-border space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-9 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                placeholder="Search by application number, applicant name, business name, or TIN"
                                value={searchTerm}
                                onChange={(e) => setParam('q', e.target.value || null)}
                            />
                            {searchTerm && (
                                <button onClick={() => setParam('q', null)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        {!loading && !error && (
                            <span className="text-xs font-medium text-slate-500 flex-shrink-0 sm:text-right">
                                {filtered.length} {filtered.length === 1 ? 'application' : 'applications'}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-brand-muted mr-0.5">Received at this stage:</span>
                        <input type="date" value={dateFrom} onChange={(e) => setParam('from', e.target.value || null)} className="px-2 py-1 text-xs rounded-md border border-gray-300" aria-label="From date" />
                        <span className="text-xs text-brand-muted">to</span>
                        <input type="date" value={dateTo} onChange={(e) => setParam('to', e.target.value || null)} className="px-2 py-1 text-xs rounded-md border border-gray-300" aria-label="To date" />
                        {(dateFrom || dateTo) && (
                            <button onClick={() => removeChip('daterange')} className="text-xs text-slate-400 hover:text-slate-600" aria-label="Clear date filter"><X size={13} /></button>
                        )}

                        <span className="hidden sm:inline mx-1 text-slate-200">|</span>

                        <span className="text-xs font-medium text-brand-muted">Sort:</span>
                        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                            <button
                                onClick={() => toggleSort('OLDEST')}
                                className={`px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1 ${sortMode === 'OLDEST' || !sortMode ? 'bg-brand-green/10 text-brand-green' : 'bg-white text-slate-600 hover:bg-gray-50'}`}
                            >
                                Oldest Received First {sortIcon('OLDEST')}
                            </button>
                            <button
                                onClick={() => toggleSort('NEWEST')}
                                className={`px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1 border-l border-gray-300 ${sortMode === 'NEWEST' ? 'bg-brand-green/10 text-brand-green' : 'bg-white text-slate-600 hover:bg-gray-50'}`}
                            >
                                Newest Received First {sortIcon('NEWEST')}
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowMoreFilters((s) => !s)}
                            className={`ml-auto inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border ${hasMoreFilters ? 'border-brand-green text-brand-green bg-brand-green/5' : 'border-gray-300 bg-white text-slate-700 hover:bg-gray-50'}`}
                        >
                            <SlidersHorizontal size={12} /> More Filters {showMoreFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                    </div>

                    {showMoreFilters && (
                        <div className="rounded-lg border border-brand-border bg-brand-bg p-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-brand-muted mb-1">Category</label>
                                    <select value={categoryFilter} onChange={(e) => setParam('category', e.target.value || null)} className="w-full rounded-md border border-gray-300 p-2 text-sm">
                                        <option value="">All categories</option>
                                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-brand-muted mb-1">County</label>
                                    <select value={countyFilter} onChange={(e) => setParam('county', e.target.value || null)} className="w-full rounded-md border border-gray-300 p-2 text-sm">
                                        <option value="">All counties</option>
                                        {COUNTY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-brand-muted mb-1">Commodity</label>
                                    <select value={commodityFilter} onChange={(e) => setParam('commodity', e.target.value || null)} className="w-full rounded-md border border-gray-300 p-2 text-sm">
                                        <option value="">All commodities</option>
                                        {Object.entries(COMMODITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {hasFilters && (
                        <div className="flex flex-wrap items-center gap-2">
                            {activeChips.map((chip) => (
                                <span key={chip.key} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-brand-green/10 text-brand-green text-xs font-medium">
                                    {chip.label}
                                    <button onClick={() => removeChip(chip.key)} className="rounded-full hover:bg-brand-green/20 p-0.5">
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                            <button onClick={clearAllFilters} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2">
                                Clear Filters
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-2.5">
                    {loading ? (
                        <TableSkeleton />
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-10 px-4 text-center">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                <Gavel size={20} />
                            </div>
                            <p className="text-sm font-medium text-slate-700">
                                {applications.length === 0 ? 'No applications awaiting your decision at this stage' : 'No applications match your search or filters'}
                            </p>
                            <p className="text-xs text-slate-500 max-w-xs">
                                {applications.length === 0
                                    ? 'Applications will appear here once the responsible department recommends them for your approval.'
                                    : 'Try adjusting or clearing your filters.'}
                            </p>
                            {applications.length > 0 && hasFilters && (
                                <button onClick={clearAllFilters} className="mt-1 text-xs font-medium text-brand-green hover:underline">Clear Filters</button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
                                    <colgroup>
                                        <col className="w-[13%]" />
                                        <col className="w-[16%]" />
                                        <col className="w-[13%]" />
                                        <col className="w-[9%]" />
                                        <col className="w-[11%]" />
                                        <col className="w-[11%]" />
                                        <col className="w-[11%]" />
                                        <col className="w-[9%]" />
                                        <col className="w-[7%]" />
                                    </colgroup>
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Application Number</th>
                                            <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Applicant / Business</th>
                                            <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Category / Commodity</th>
                                            <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">County</th>
                                            <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Recommended By</th>
                                            <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                                <button onClick={() => toggleSort(sortMode === 'NEWEST' ? 'OLDEST' : 'NEWEST')} className="inline-flex items-center gap-1 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded">
                                                    Received by DG {sortIcon(sortMode)}
                                                </button>
                                            </th>
                                            <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Time Awaiting Decision</th>
                                            <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                                            <th className="px-3 py-1.5 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {pageRows.map((a) => (
                                            <QueueRow key={a.id} app={a} searchParams={searchParams} onNavigate={saveScrollPosition} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="lg:hidden space-y-2.5">
                                {pageRows.map((a) => (
                                    <QueueCard key={a.id} app={a} searchParams={searchParams} onNavigate={saveScrollPosition} />
                                ))}
                            </div>

                            <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <span>Rows per page:</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => { setParam('size', e.target.value); setParam('page', null); }}
                                        className="rounded-md border border-gray-300 py-1 pl-2 pr-6 text-sm"
                                    >
                                        {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={currentPage <= 1}
                                        onClick={() => setParam('page', String(currentPage - 1), false)}
                                        className="px-3 py-1.5 rounded-md border border-gray-300 text-slate-700 disabled:opacity-40 hover:bg-gray-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-slate-500">Page {currentPage} of {totalPages}</span>
                                    <button
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setParam('page', String(currentPage + 1), false)}
                                        className="px-3 py-1.5 rounded-md border border-gray-300 text-slate-700 disabled:opacity-40 hover:bg-gray-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const TableSkeleton: React.FC = () => (
    <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
            <tbody className="divide-y divide-slate-100 bg-white">
                {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                            <td key={j} className="px-4 py-3">
                                <div className="h-3.5 w-20 bg-slate-200 rounded animate-pulse" />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

// Every row in a DG stage tab is, by definition, awaiting that stage's
// decision - so unlike Commercial's multi-state badge, this is a single
// fixed short label per the spec ("Awaiting Decision").
const StatusBadge: React.FC = () => (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
        Awaiting Decision
    </span>
);

const QueueRow: React.FC<{ app: ApplicationListItem; searchParams: URLSearchParams; onNavigate: () => void }> = ({ app, searchParams, onNavigate }) => {
    const received = formatDateParts(stageReceivedAt(app));
    return (
        <tr className="hover:bg-slate-50 focus-within:bg-slate-50">
            <td className="px-3 py-1.5 font-medium text-slate-900 break-words" title={app.applicationNumber}>{app.applicationNumber}</td>
            <td className="px-3 py-1.5 text-slate-700 truncate">
                <div className="truncate" title={app.applicantName || 'Not provided'}>{app.applicantName || 'Not provided'}</div>
                {app.businessName && app.businessName !== app.applicantName && (
                    <div className="text-[11px] text-slate-400 truncate" title={app.businessName}>{app.businessName}</div>
                )}
            </td>
            <td className="px-3 py-1.5 text-slate-700 truncate">
                <div className="truncate">{categoryLabel(app.category)}</div>
                {app.commodity && <div className="text-[11px] text-slate-400 truncate">{COMMODITY_LABELS[app.commodity as keyof typeof COMMODITY_LABELS] || app.commodity}</div>}
            </td>
            <td className="px-3 py-1.5 text-slate-700 truncate">{app.county || 'Not provided'}</td>
            <td className="px-3 py-1.5 text-slate-700 truncate">{app.recommendedBy || <span className="text-slate-400">Not recorded</span>}</td>
            <td className="px-3 py-1.5 text-slate-700">
                <div className="truncate">{received.date}</div>
                {received.time && <div className="text-[11px] text-slate-400">{received.time}</div>}
            </td>
            <td className="px-3 py-1.5 text-slate-700 truncate">{durationLabel(stageReceivedAt(app))}</td>
            <td className="px-3 py-1.5"><StatusBadge /></td>
            <td className="px-3 py-1.5 text-right whitespace-nowrap">
                <Link
                    to={`/applications/dg/${app.id}?${searchParams.toString()}`}
                    onClick={onNavigate}
                    className="text-brand-green hover:text-brand-green-hover font-medium text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded"
                >
                    Review &amp; Decide
                </Link>
            </td>
        </tr>
    );
};

const QueueCard: React.FC<{ app: ApplicationListItem; searchParams: URLSearchParams; onNavigate: () => void }> = ({ app, searchParams, onNavigate }) => {
    const received = formatDateParts(stageReceivedAt(app));
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 break-words">{app.applicationNumber}</span>
                <StatusBadge />
            </div>
            <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Applicant / Business</dt><dd className="text-slate-800 text-right">{app.applicantName || app.businessName || 'Not provided'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Category / Commodity</dt><dd className="text-slate-800 text-right">{categoryLabel(app.category)}{app.commodity ? ` / ${COMMODITY_LABELS[app.commodity as keyof typeof COMMODITY_LABELS] || app.commodity}` : ''}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">County</dt><dd className="text-slate-800 text-right">{app.county || 'Not provided'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Recommended By</dt><dd className="text-slate-800 text-right">{app.recommendedBy || 'Not recorded'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Received by DG</dt><dd className="text-slate-800 text-right">{received.date}{received.time ? ` ${received.time}` : ''}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Time Awaiting Decision</dt><dd className="text-slate-800 text-right">{durationLabel(stageReceivedAt(app))}</dd></div>
            </dl>
            <div className="pt-1.5 border-t border-slate-100 flex justify-end">
                <Link to={`/applications/dg/${app.id}?${searchParams.toString()}`} onClick={onNavigate} className="text-brand-green hover:text-brand-green-hover font-medium text-sm">
                    Review &amp; Decide
                </Link>
            </div>
        </div>
    );
};

export default DGApprovalQueue;

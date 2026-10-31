import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    ClipboardCheck, Search, X, ChevronDown, ChevronUp, ChevronsUpDown,
    AlertTriangle, Clock, FileEdit, Send, Inbox,
} from 'lucide-react';
import { getApplications, type ApplicationListItem } from '../../api/applications';
import { apiErrorMessage, categoryLabel } from './statusHelpers';
import {
    commercialBadgeKey, commercialBadgeLabel, commercialBadgeColor,
    waitingTimeLabel, waitingTimeMs, type CommercialBadgeStatus,
} from './statusHelpers';
import { COUNTY_NAMES } from '../../data/liberiaCounties';
import { CATEGORY_LABELS, COMMODITY_LABELS } from '../apply/types';

// Every status the Commercial Verification queue surfaces. DG-stage and
// later statuses never reach this queue; "RETURNED_TO_COMMERCIAL" is
// included because the DG can send an application back for more work,
// which must re-appear here exactly like any other open item.
const QUEUE_STATUSES = [
    'AWAITING_COMMERCIAL_VERIFICATION',
    'COMMERCIAL_REVIEW_IN_PROGRESS',
    'APPLICANT_CORRECTION_REQUIRED',
    'RETURNED_TO_COMMERCIAL',
    'COMMERCIALLY_VERIFIED',
    'AWAITING_FIRST_DG_APPROVAL',
    'COMMERCIAL_STAGE_APPROVED',
];

type SortMode = 'OLDEST' | 'NEWEST' | 'LONGEST_WAITING';
type SummaryFilter = CommercialBadgeStatus | null;

const SUMMARY_CARDS: { key: SummaryFilter; label: string; icon: React.ReactNode; accent: string }[] = [
    { key: 'AWAITING_REVIEW', label: 'Awaiting Review', icon: <Inbox size={18} />, accent: 'text-amber-700 bg-amber-50 border-amber-200' },
    { key: 'IN_REVIEW', label: 'In Review', icon: <Clock size={18} />, accent: 'text-blue-700 bg-blue-50 border-blue-200' },
    { key: 'CORRECTION_REQUESTED', label: 'Awaiting Correction', icon: <FileEdit size={18} />, accent: 'text-orange-700 bg-orange-50 border-orange-200' },
    { key: 'FORWARDED_TO_DG', label: 'Forwarded to DG', icon: <Send size={18} />, accent: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

// Resolves a quick date-shortcut into a { from, to } ISO date-string pair
// (date-only, inclusive) matching the custom-range inputs' format so both
// paths feed the same filtering logic.
function shortcutRange(shortcut: 'today' | '7days' | 'month'): { from: string; to: string } {
    const now = new Date();
    const toStr = (d: Date) => d.toISOString().slice(0, 10);
    if (shortcut === 'today') {
        return { from: toStr(startOfDay(now)), to: toStr(now) };
    }
    if (shortcut === '7days') {
        const from = new Date(now);
        from.setDate(from.getDate() - 6);
        return { from: toStr(startOfDay(from)), to: toStr(now) };
    }
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toStr(from), to: toStr(now) };
}

const CommercialQueue: React.FC = () => {
    const [applications, setApplications] = useState<ApplicationListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // All list-view state (search, filters, sort, pagination) lives in the
    // URL so it survives navigating into an application and back, and is
    // shareable/bookmarkable - matching the pattern already used on
    // Dashboard.tsx.
    const [searchParams, setSearchParams] = useSearchParams();

    const searchTerm = searchParams.get('q') || '';
    const summaryFilter = (searchParams.get('summary') as SummaryFilter) || null;
    const dateFrom = searchParams.get('from') || '';
    const dateTo = searchParams.get('to') || '';
    const categoryFilter = searchParams.get('category') || '';
    const countyFilter = searchParams.get('county') || '';
    const commodityFilter = searchParams.get('commodity') || '';
    const officerFilter = searchParams.get('officer') || '';
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

    useEffect(() => {
        loadQueue();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadQueue = async () => {
        setLoading(true);
        setError('');
        try {
            // One simple (non-composite-index) query per status, merged in
            // memory - every other filter/search/sort runs client-side.
            const responses = await Promise.all(
                QUEUE_STATUSES.map((status) => getApplications({ status }))
            );
            const merged = responses.flatMap((r) => r.data.data || []);
            setApplications(merged);
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load the Commercial Verification queue.'));
            setApplications([]);
        } finally {
            setLoading(false);
        }
    };

    // Distinct officer names present in the current dataset, for the
    // Assigned Officer filter dropdown - derived rather than hardcoded so
    // it always reflects who has actually touched an application.
    const officerOptions = useMemo(() => {
        const names = new Set<string>();
        applications.forEach((a) => { if (a.assignedOfficer) names.add(a.assignedOfficer); });
        return Array.from(names).sort();
    }, [applications]);

    const summaryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        applications.forEach((a) => {
            const key = commercialBadgeKey(a.status, a.resubmittedAt);
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }, [applications]);

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const fromTime = dateFrom ? startOfDay(new Date(dateFrom)).getTime() : null;
        const toTime = dateTo ? (() => { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); return d.getTime(); })() : null;

        let result = applications.filter((a) => {
            if (summaryFilter && commercialBadgeKey(a.status, a.resubmittedAt) !== summaryFilter) return false;
            if (categoryFilter && a.category !== categoryFilter) return false;
            if (countyFilter && a.county !== countyFilter) return false;
            if (commodityFilter && a.commodity !== commodityFilter) return false;
            if (officerFilter && a.assignedOfficer !== officerFilter) return false;

            const submitted = a.submittedAt || a.createdAt;
            const submittedTime = submitted ? new Date(submitted).getTime() : null;
            if (fromTime != null && (submittedTime == null || submittedTime < fromTime)) return false;
            if (toTime != null && (submittedTime == null || submittedTime > toTime)) return false;

            if (term) {
                const haystack = [
                    a.applicationNumber, a.applicantName, a.businessName, a.tin,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            return true;
        });

        // Default + selectable sorting. Submission date/time is the
        // primary key in every mode; applicationNumber (sequential,
        // always unique) is the stable secondary tiebreaker so order never
        // flaps when two applications share a timestamp.
        result = [...result].sort((a, b) => {
            const aTime = new Date(a.submittedAt || a.createdAt).getTime();
            const bTime = new Date(b.submittedAt || b.createdAt).getTime();
            if (sortMode === 'LONGEST_WAITING') {
                const diff = waitingTimeMs(b.submittedAt || b.createdAt) - waitingTimeMs(a.submittedAt || a.createdAt);
                if (diff !== 0) return diff;
            } else if (sortMode === 'NEWEST') {
                if (bTime !== aTime) return bTime - aTime;
            } else {
                if (aTime !== bTime) return aTime - bTime;
            }
            return (a.applicationNumber || '').localeCompare(b.applicationNumber || '');
        });

        return result;
    }, [applications, searchTerm, summaryFilter, dateFrom, dateTo, categoryFilter, countyFilter, commodityFilter, officerFilter, sortMode]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Active filter chips - each removable independently. Search term is
    // intentionally excluded (it has its own visible input + clear icon).
    const activeChips: { key: string; label: string }[] = [];
    if (summaryFilter) activeChips.push({ key: 'summary', label: SUMMARY_CARDS.find((c) => c.key === summaryFilter)?.label || summaryFilter });
    if (dateFrom || dateTo) activeChips.push({ key: 'daterange', label: `${dateFrom || '...'} to ${dateTo || '...'}` });
    if (categoryFilter) activeChips.push({ key: 'category', label: categoryLabel(categoryFilter) });
    if (countyFilter) activeChips.push({ key: 'county', label: countyFilter });
    if (commodityFilter) activeChips.push({ key: 'commodity', label: COMMODITY_LABELS[commodityFilter as keyof typeof COMMODITY_LABELS] || commodityFilter });
    if (officerFilter) activeChips.push({ key: 'officer', label: officerFilter });

    const removeChip = (key: string) => {
        const next = new URLSearchParams(searchParams);
        if (key === 'daterange') { next.delete('from'); next.delete('to'); }
        else if (key === 'summary') next.delete('summary');
        else if (key === 'category') next.delete('category');
        else if (key === 'county') next.delete('county');
        else if (key === 'commodity') next.delete('commodity');
        else if (key === 'officer') next.delete('officer');
        next.delete('page');
        setSearchParams(next);
    };

    const clearAllFilters = () => {
        const next = new URLSearchParams();
        if (searchTerm) next.set('q', searchTerm);
        setSearchParams(next);
    };

    const applyShortcut = (shortcut: 'today' | '7days' | 'month') => {
        const { from, to } = shortcutRange(shortcut);
        const next = new URLSearchParams(searchParams);
        next.set('from', from);
        next.set('to', to);
        next.delete('page');
        setSearchParams(next);
    };

    const toggleSort = (mode: SortMode) => setParam('sort', mode === 'OLDEST' ? null : mode, false);

    const sortIcon = (mode: SortMode) => {
        if (sortMode !== mode) return <ChevronsUpDown size={13} className="text-slate-400" />;
        return mode === 'NEWEST' ? <ChevronDown size={13} /> : <ChevronUp size={13} />;
    };

    const hasFilters = activeChips.length > 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-brand-text">Commercial Verification</h1>
                <p className="text-sm text-brand-muted mt-0.5">Review applications and forward verified submissions to the Director-General.</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {SUMMARY_CARDS.map((card) => {
                    const active = summaryFilter === card.key;
                    return (
                        <button
                            key={card.key}
                            type="button"
                            onClick={() => setParam('summary', active ? null : card.key)}
                            className={`text-left rounded-xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1 ${
                                active ? `${card.accent} ring-1 ring-inset ring-current` : 'bg-white border-brand-border hover:border-brand-green/40'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${active ? '' : 'bg-slate-50 text-slate-500'} ${active ? card.accent : ''}`}>
                                    {card.icon}
                                </span>
                                <span className="text-2xl font-bold text-brand-text">{loading ? '-' : (summaryCounts[card.key as string] || 0)}</span>
                            </div>
                            <p className="text-sm font-medium text-brand-text mt-2">{card.label}</p>
                        </button>
                    );
                })}
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
                {/* Search + filter toggle */}
                <div className="p-4 border-b border-brand-border space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-9 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
                        <button
                            type="button"
                            onClick={() => setShowFilters((s) => !s)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-50 flex-shrink-0"
                        >
                            Filters {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {!loading && !error && (
                            <span className="text-xs font-medium text-slate-500 flex-shrink-0 sm:text-right">
                                {filtered.length} {filtered.length === 1 ? 'application' : 'applications'}
                            </span>
                        )}
                    </div>

                    {showFilters && (
                        <div className="rounded-lg border border-brand-border bg-brand-bg p-4 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs font-medium text-brand-muted self-center mr-1">Date:</span>
                                <button onClick={() => applyShortcut('today')} className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-300 bg-white hover:bg-gray-50">Today</button>
                                <button onClick={() => applyShortcut('7days')} className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-300 bg-white hover:bg-gray-50">Last 7 Days</button>
                                <button onClick={() => applyShortcut('month')} className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-300 bg-white hover:bg-gray-50">This Month</button>
                                <input type="date" value={dateFrom} onChange={(e) => setParam('from', e.target.value || null)} className="px-2 py-1 text-xs rounded-md border border-gray-300" />
                                <span className="text-xs text-brand-muted self-center">to</span>
                                <input type="date" value={dateTo} onChange={(e) => setParam('to', e.target.value || null)} className="px-2 py-1 text-xs rounded-md border border-gray-300" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                                <div>
                                    <label className="block text-xs font-medium text-brand-muted mb-1">Assigned Officer</label>
                                    <select value={officerFilter} onChange={(e) => setParam('officer', e.target.value || null)} className="w-full rounded-md border border-gray-300 p-2 text-sm">
                                        <option value="">All officers</option>
                                        <option value="__unassigned__" disabled>Unassigned applications shown by default</option>
                                        {officerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
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

                {/* Table */}
                <div className="p-4">
                    {loading ? (
                        <TableSkeleton />
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-10 px-4 text-center">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                <ClipboardCheck size={20} />
                            </div>
                            <p className="text-sm font-medium text-slate-700">
                                {applications.length === 0 ? 'No applications in the Commercial queue' : 'No applications match your search or filters'}
                            </p>
                            <p className="text-xs text-slate-500 max-w-xs">
                                {applications.length === 0
                                    ? 'Newly submitted applications will appear here as soon as applicants submit them.'
                                    : 'Try adjusting or clearing your filters.'}
                            </p>
                            {applications.length > 0 && hasFilters && (
                                <button onClick={clearAllFilters} className="mt-1 text-xs font-medium text-brand-green hover:underline">Clear Filters</button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Application Number</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Applicant / Business</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Category / Commodity</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">County</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                                <button onClick={() => toggleSort(sortMode === 'NEWEST' ? 'OLDEST' : 'NEWEST')} className="inline-flex items-center gap-1 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded">
                                                    Submitted {sortIcon(sortMode === 'LONGEST_WAITING' ? 'OLDEST' : sortMode)}
                                                </button>
                                            </th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                                <button onClick={() => toggleSort('LONGEST_WAITING')} className="inline-flex items-center gap-1 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded">
                                                    Waiting Time {sortIcon('LONGEST_WAITING')}
                                                </button>
                                            </th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Assigned Officer</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {pageRows.map((a) => (
                                            <QueueRow key={a.id} app={a} searchParams={searchParams} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile/tablet stacked cards */}
                            <div className="lg:hidden space-y-3">
                                {pageRows.map((a) => (
                                    <QueueCard key={a.id} app={a} searchParams={searchParams} />
                                ))}
                            </div>

                            {/* Pagination */}
                            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
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

const StatusBadge: React.FC<{ app: ApplicationListItem }> = ({ app }) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${commercialBadgeColor(app.status, app.resubmittedAt)}`}>
        {commercialBadgeLabel(app.status, app.resubmittedAt)}
    </span>
);

function reviewActionLabel(app: ApplicationListItem): string {
    const key = commercialBadgeKey(app.status, app.resubmittedAt);
    if (key === 'AWAITING_REVIEW') return app.resubmittedAt ? 'Resume Review' : 'Review';
    if (key === 'IN_REVIEW') return 'Continue Review';
    if (key === 'CORRECTION_REQUESTED') return 'View';
    return 'View';
}

const QueueRow: React.FC<{ app: ApplicationListItem; searchParams: URLSearchParams }> = ({ app, searchParams }) => (
    <tr className="hover:bg-slate-50 focus-within:bg-slate-50">
        <td className="px-4 py-2.5 font-medium text-slate-900">{app.applicationNumber}</td>
        <td className="px-4 py-2.5 text-slate-700">
            <div>{app.applicantName || 'Not provided'}</div>
            {app.businessName && app.businessName !== app.applicantName && (
                <div className="text-xs text-slate-400">{app.businessName}</div>
            )}
        </td>
        <td className="px-4 py-2.5 text-slate-700">
            <div>{categoryLabel(app.category)}</div>
            {app.commodity && <div className="text-xs text-slate-400">{COMMODITY_LABELS[app.commodity as keyof typeof COMMODITY_LABELS] || app.commodity}</div>}
        </td>
        <td className="px-4 py-2.5 text-slate-700">{app.county || 'Not provided'}</td>
        <td className="px-4 py-2.5 text-slate-700">
            <div>{app.submittedAt ? new Date(app.submittedAt).toLocaleString() : '-'}</div>
            {app.resubmittedAt && <div className="text-xs text-sky-600">Resubmitted {new Date(app.resubmittedAt).toLocaleDateString()}</div>}
        </td>
        <td className="px-4 py-2.5 text-slate-700">{waitingTimeLabel(app.submittedAt || app.createdAt)}</td>
        <td className="px-4 py-2.5"><StatusBadge app={app} /></td>
        <td className="px-4 py-2.5 text-slate-700">{app.assignedOfficer || <span className="text-slate-400">Unassigned</span>}</td>
        <td className="px-4 py-2.5 text-right">
            <Link
                to={`/applications/commercial/${app.id}?${searchParams.toString()}`}
                className="text-brand-green hover:text-brand-green-hover font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded"
            >
                {reviewActionLabel(app)}
            </Link>
        </td>
    </tr>
);

const QueueCard: React.FC<{ app: ApplicationListItem; searchParams: URLSearchParams }> = ({ app, searchParams }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">{app.applicationNumber}</span>
            <StatusBadge app={app} />
        </div>
        <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Applicant</dt><dd className="text-slate-800 text-right">{app.applicantName || 'Not provided'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Category</dt><dd className="text-slate-800 text-right">{categoryLabel(app.category)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">County</dt><dd className="text-slate-800 text-right">{app.county || 'Not provided'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Submitted</dt><dd className="text-slate-800 text-right">{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '-'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Waiting</dt><dd className="text-slate-800 text-right">{waitingTimeLabel(app.submittedAt || app.createdAt)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Officer</dt><dd className="text-slate-800 text-right">{app.assignedOfficer || 'Unassigned'}</dd></div>
        </dl>
        <div className="pt-2 border-t border-slate-100 flex justify-end">
            <Link to={`/applications/commercial/${app.id}?${searchParams.toString()}`} className="text-brand-green hover:text-brand-green-hover font-medium text-sm">
                {reviewActionLabel(app)}
            </Link>
        </div>
    </div>
);

export default CommercialQueue;

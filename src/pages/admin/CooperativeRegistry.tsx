import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Search, X, ChevronDown, ChevronUp, SlidersHorizontal,
    Building2, MapPinned, Users2, AlertTriangle, ScanSearch, Settings2,
} from 'lucide-react';
import {
    getCooperativeDirectory, scanCooperativeDataQuality,
    type CooperativeDirectoryItem,
} from '../../api/cooperatives';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { apiErrorMessage } from '../applications/statusHelpers';
import {
    formatMembership, isMembershipMissing, sumReportedMembership,
    distinctCommodities, distinctCounties, latestUpdatedAt, formatDateOnly,
    type MembershipFilter, type QualityFilter, type SortMode,
} from './cooperativeHelpers';
import CooperativeDetailPanel from './CooperativeDetailPanel';

/**
 * Cooperative Registry — searchable staff directory for the CDA
 * (Cooperative Development Agency) cooperative listing. Rebuilt to match
 * the Commercial Verification queue's design language (summary cards,
 * search + collapsible filters, chips, sticky-header table + mobile
 * cards, pagination) per the Cooperative Registry enhancement spec.
 *
 * All view state (search/filters/sort/page/pageSize/selected record)
 * round-trips through the URL so returning from the detail side panel -
 * which is an overlay, not a navigation - never loses place, and the
 * page is shareable/bookmarkable just like CommercialQueue.
 */

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'NAME_ASC', label: 'Name A–Z' },
    { value: 'NAME_DESC', label: 'Name Z–A' },
    { value: 'MEMBERSHIP_DESC', label: 'Highest Reported Membership' },
    { value: 'MEMBERSHIP_ASC', label: 'Lowest Reported Membership' },
    { value: 'RECENTLY_UPDATED', label: 'Recently Updated' },
];

const SCROLL_RESTORE_KEY = 'cooperativeRegistry:scrollY';

const CooperativeRegistry: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

    const [items, setItems] = useState<CooperativeDirectoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanMessage, setScanMessage] = useState('');
    const scrollRestoredRef = useRef(false);

    const [searchParams, setSearchParams] = useSearchParams();

    const searchTerm = searchParams.get('q') || '';
    const countyFilter = searchParams.get('county') || '';
    const commodityFilters = useMemo(
        () => (searchParams.get('commodities') || '').split(',').filter(Boolean),
        [searchParams]
    );
    const membershipFilter = (searchParams.get('membership') as MembershipFilter) || 'ALL';
    const qualityFilter = (searchParams.get('quality') as QualityFilter) || 'ALL';
    const sortMode = (searchParams.get('sort') as SortMode) || 'NAME_ASC';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = (parseInt(searchParams.get('size') || '20', 10) as typeof PAGE_SIZE_OPTIONS[number]) || 20;
    const selectedId = searchParams.get('selected') || '';

    const setParam = (key: string, value: string | null, resetPage = true) => {
        const next = new URLSearchParams(searchParams);
        if (!value) next.delete(key);
        else next.set(key, value);
        if (resetPage) next.delete('page');
        setSearchParams(next);
    };

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getCooperativeDirectory();
            setItems(res.data.data || []);
        } catch (e) {
            setError(apiErrorMessage(e, 'Failed to load the cooperative registry.'));
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Restore scroll position after the first successful load — mirrors
    // CommercialQueue's pattern, needed here because opening a detail
    // record is an overlay (no navigation), but a staff member may still
    // reload the page itself while a `selected` id is present in the URL.
    useLayoutEffect(() => {
        if (loading || scrollRestoredRef.current) return;
        scrollRestoredRef.current = true;
        const saved = sessionStorage.getItem(SCROLL_RESTORE_KEY);
        if (saved) {
            const y = parseInt(saved, 10);
            if (!Number.isNaN(y)) requestAnimationFrame(() => window.scrollTo(0, y));
            sessionStorage.removeItem(SCROLL_RESTORE_KEY);
        }
    }, [loading]);

    const openDetail = (id: string) => {
        sessionStorage.setItem(SCROLL_RESTORE_KEY, String(window.scrollY));
        setParam('selected', id, false);
    };
    const closeDetail = () => setParam('selected', null, false);

    const handleScan = async () => {
        setScanning(true);
        setScanMessage('');
        try {
            const res = await scanCooperativeDataQuality();
            const created = res.data.data?.created ?? 0;
            setScanMessage(
                created > 0
                    ? `Data quality scan complete — ${created} new flag${created === 1 ? '' : 's'} raised for review.`
                    : 'Data quality scan complete — no new issues found.'
            );
            await load();
        } catch (e) {
            setScanMessage(apiErrorMessage(e, 'Data quality scan failed.'));
        } finally {
            setScanning(false);
        }
    };

    const counties = useMemo(() => distinctCounties(items), [items]);
    const commodities = useMemo(() => distinctCommodities(items), [items]);

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let result = items.filter((c) => {
            if (countyFilter && c.county !== countyFilter) return false;
            if (commodityFilters.length > 0) {
                const has = (c.commodities || []).some((cm) => commodityFilters.includes(cm));
                if (!has) return false;
            }
            if (membershipFilter === 'AVAILABLE' && isMembershipMissing(c)) return false;
            if (membershipFilter === 'NOT_REPORTED' && !isMembershipMissing(c)) return false;
            if (qualityFilter === 'NEEDS_REVIEW' && isAdmin && (c.openFlagCount || 0) === 0) return false;
            if (term) {
                const haystack = [c.name, c.slug, c.county, c.district].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            return true;
        });

        result = [...result].sort((a, b) => {
            const aMissing = isMembershipMissing(a);
            const bMissing = isMembershipMissing(b);
            if (sortMode === 'MEMBERSHIP_DESC' || sortMode === 'MEMBERSHIP_ASC') {
                // Missing membership values always sort last, regardless
                // of direction, per the spec.
                if (aMissing !== bMissing) return aMissing ? 1 : -1;
                if (!aMissing && !bMissing) {
                    const diff = (a.membershipTotal as number) - (b.membershipTotal as number);
                    if (diff !== 0) return sortMode === 'MEMBERSHIP_DESC' ? -diff : diff;
                }
            } else if (sortMode === 'RECENTLY_UPDATED') {
                const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                if (bTime !== aTime) return bTime - aTime;
            } else if (sortMode === 'NAME_DESC') {
                const cmp = b.name.localeCompare(a.name);
                if (cmp !== 0) return cmp;
            }
            // Default / tiebreaker: Name A-Z, stable.
            return a.name.localeCompare(b.name);
        });

        return result;
    }, [items, searchTerm, countyFilter, commodityFilters, membershipFilter, qualityFilter, isAdmin, sortMode]);

    const isFiltered = !!(searchTerm || countyFilter || commodityFilters.length > 0 || membershipFilter !== 'ALL' || qualityFilter !== 'ALL');

    // Summary figures: computed over the filtered set when any filter is
    // active, otherwise over the entire registry — and clearly labelled
    // either way so staff never mistake a filtered figure for the whole
    // registry's totals (spec section 1).
    const summarySource = isFiltered ? filtered : items;
    const summaryCounties = useMemo(() => distinctCounties(summarySource), [summarySource]);
    const { total: summaryMembership, reportingCount } = useMemo(() => sumReportedMembership(summarySource), [summarySource]);
    const lastUpdated = useMemo(() => latestUpdatedAt(items), [items]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

    const toggleCommodity = (name: string) => {
        const set = new Set(commodityFilters);
        if (set.has(name)) set.delete(name); else set.add(name);
        setParam('commodities', set.size > 0 ? Array.from(set).join(',') : null);
    };

    const activeChips: { key: string; label: string }[] = [];
    if (countyFilter) activeChips.push({ key: 'county', label: `County: ${countyFilter}` });
    commodityFilters.forEach((c) => activeChips.push({ key: `commodity:${c}`, label: `Commodity: ${c}` }));
    if (membershipFilter !== 'ALL') activeChips.push({ key: 'membership', label: membershipFilter === 'AVAILABLE' ? 'Membership: Available' : 'Membership: Not Reported' });
    if (qualityFilter !== 'ALL') activeChips.push({ key: 'quality', label: 'Needs Review' });

    const removeChip = (key: string) => {
        if (key === 'county') setParam('county', null);
        else if (key === 'membership') setParam('membership', null);
        else if (key === 'quality') setParam('quality', null);
        else if (key.startsWith('commodity:')) toggleCommodity(key.slice('commodity:'.length));
    };

    const clearAllFilters = () => {
        const next = new URLSearchParams();
        if (searchTerm) next.set('q', searchTerm);
        setSearchParams(next);
    };

    const hasFilters = activeChips.length > 0;
    const hasMoreFilters = !!(countyFilter || commodityFilters.length > 0 || membershipFilter !== 'ALL' || qualityFilter !== 'ALL');

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Cooperative Registry</h1>
                    <p className="text-sm text-brand-muted mt-0.5">CDA reference directory for farmer registration.</p>
                    <p className="text-xs text-slate-400 mt-1">
                        Source: CDA &middot; Last updated: {loading ? '…' : formatDateOnly(lastUpdated)}
                    </p>
                </div>
                {isAdmin && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={handleScan}
                            disabled={scanning}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                            <ScanSearch size={14} className={scanning ? 'animate-pulse' : ''} />
                            {scanning ? 'Scanning…' : 'Run Data Quality Scan'}
                        </button>
                        <Link
                            to="/admin/cooperatives/import"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-green text-white text-xs font-semibold hover:bg-brand-green-hover"
                        >
                            <Settings2 size={14} /> Manage Registry
                        </Link>
                    </div>
                )}
            </div>

            {scanMessage && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-sm">
                    <span className="flex-1">{scanMessage}</span>
                    <button onClick={() => setScanMessage('')} className="text-blue-400 hover:text-blue-600"><X size={14} /></button>
                </div>
            )}

            {/* Summary cards */}
            <div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <SummaryCard
                        icon={<Building2 className="h-5 w-5 text-brand-green" />}
                        label="Cooperatives"
                        value={loading ? '—' : summarySource.length}
                        accent="bg-green-50"
                    />
                    <SummaryCard
                        icon={<MapPinned className="h-5 w-5 text-blue-600" />}
                        label="Counties Covered"
                        value={loading ? '—' : summaryCounties.length}
                        accent="bg-blue-50"
                    />
                    <SummaryCard
                        icon={<Users2 className="h-5 w-5 text-amber-600" />}
                        label="Reported Membership"
                        value={loading ? '—' : formatMembership(summaryMembership)}
                        sub={loading ? undefined : `Sum of reported figures (${reportingCount} of ${summarySource.length} reporting) — not a count of unique farmers`}
                        accent="bg-amber-50"
                    />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                    {isFiltered ? 'Figures reflect the current filtered results.' : 'Figures reflect the entire registry.'}
                </p>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1"><p className="text-sm text-red-800">{error}</p></div>
                    <button onClick={load} className="flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50">
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
                                placeholder="Search by name, registry ID, county, or district"
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
                                {filtered.length} {filtered.length === 1 ? 'cooperative' : 'cooperatives'}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-brand-muted">Sort:</span>
                        <select
                            value={sortMode}
                            onChange={(e) => setParam('sort', e.target.value === 'NAME_ASC' ? null : e.target.value, false)}
                            className="rounded-md border border-gray-300 py-1 pl-2 pr-6 text-xs"
                        >
                            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>

                        <button
                            type="button"
                            onClick={() => setShowMoreFilters((s) => !s)}
                            className={`ml-auto inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border ${hasMoreFilters ? 'border-brand-green text-brand-green bg-brand-green/5' : 'border-gray-300 bg-white text-slate-700 hover:bg-gray-50'}`}
                        >
                            <SlidersHorizontal size={12} /> Filters {showMoreFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                    </div>

                    {showMoreFilters && (
                        <div className="rounded-lg border border-brand-border bg-brand-bg p-3 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-brand-muted mb-1">County</label>
                                    <select value={countyFilter} onChange={(e) => setParam('county', e.target.value || null)} className="w-full rounded-md border border-gray-300 p-2 text-sm">
                                        <option value="">All counties</option>
                                        {counties.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-brand-muted mb-1">Membership Data</label>
                                    <select value={membershipFilter} onChange={(e) => setParam('membership', e.target.value === 'ALL' ? null : e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm">
                                        <option value="ALL">All</option>
                                        <option value="AVAILABLE">Available</option>
                                        <option value="NOT_REPORTED">Not Reported</option>
                                    </select>
                                </div>
                                {isAdmin && (
                                    <div>
                                        <label className="block text-xs font-medium text-brand-muted mb-1">Data Quality</label>
                                        <select value={qualityFilter} onChange={(e) => setParam('quality', e.target.value === 'ALL' ? null : e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm">
                                            <option value="ALL">All</option>
                                            <option value="NEEDS_REVIEW">Needs Review</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-brand-muted mb-1.5">Commodity</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {commodities.length === 0 && <span className="text-xs text-slate-400">No commodity data yet</span>}
                                    {commodities.map((c) => {
                                        const active = commodityFilters.includes(c);
                                        return (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => toggleCommodity(c)}
                                                className={`px-2.5 py-1 text-xs font-medium rounded-full border ${active ? 'border-brand-green text-brand-green bg-brand-green/10' : 'border-gray-300 bg-white text-slate-600 hover:bg-gray-50'}`}
                                            >
                                                {c}
                                            </button>
                                        );
                                    })}
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
                                <Building2 size={20} />
                            </div>
                            <p className="text-sm font-medium text-slate-700">
                                {items.length === 0 ? 'No cooperatives in the registry yet' : 'No cooperatives match your search or filters'}
                            </p>
                            <p className="text-xs text-slate-500 max-w-xs">
                                {items.length === 0
                                    ? 'Use Manage Registry (admin) to import the CDA listing.'
                                    : 'Try adjusting or clearing your filters.'}
                            </p>
                            {items.length > 0 && hasFilters && (
                                <button onClick={clearAllFilters} className="mt-1 text-xs font-medium text-brand-green hover:underline">Clear Filters</button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200 max-h-[65vh] overflow-y-auto">
                                <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
                                    <colgroup>
                                        <col className="w-[32%]" />
                                        <col className="w-[18%]" />
                                        <col className="w-[22%]" />
                                        <col className="w-[16%]" />
                                        <col className="w-[12%]" />
                                    </colgroup>
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Cooperative / Registry ID</th>
                                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">County / District</th>
                                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Commodities</th>
                                            <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Reported Members</th>
                                            <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {pageRows.map((c) => (
                                            <RegistryRow key={c.id} item={c} isAdmin={isAdmin} onOpen={() => openDetail(c.id)} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="lg:hidden space-y-2.5">
                                {pageRows.map((c) => (
                                    <RegistryCard key={c.id} item={c} isAdmin={isAdmin} onOpen={() => openDetail(c.id)} />
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
                                <span className="text-slate-500">
                                    Showing {rangeStart}–{rangeEnd} of {filtered.length} cooperatives
                                </span>
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

            {selectedId && (
                <CooperativeDetailPanel
                    cooperativeId={selectedId}
                    isAdmin={isAdmin}
                    onClose={closeDetail}
                    onChanged={load}
                />
            )}
        </div>
    );
};

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent: string; sub?: string }> = ({ icon, label, value, accent, sub }) => (
    <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-4 flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>{icon}</div>
        <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
            <p className="text-xl font-bold text-brand-text leading-tight">{value}</p>
            {sub && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{sub}</p>}
        </div>
    </div>
);

const TableSkeleton: React.FC = () => (
    <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
            <tbody className="divide-y divide-slate-100 bg-white">
                {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                            <td key={j} className="px-4 py-3">
                                <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const CommodityBadges: React.FC<{ commodities?: string[] }> = ({ commodities }) => (
    <div className="flex flex-wrap gap-1 max-w-xs">
        {(commodities || []).length > 0 ? (
            (commodities || []).map((name, i) => (
                <span key={`${name}-${i}`} className="px-2 inline-flex text-xs leading-5 font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {name}
                </span>
            ))
        ) : (
            <span className="text-slate-400 text-xs">Not reported</span>
        )}
    </div>
);

const NeedsReviewBadge: React.FC = () => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-200">
        <AlertTriangle size={10} /> Needs Review
    </span>
);

const RegistryRow: React.FC<{ item: CooperativeDirectoryItem; isAdmin: boolean; onOpen: () => void }> = ({ item, isAdmin, onOpen }) => (
    <tr className="hover:bg-slate-50 focus-within:bg-slate-50 align-top">
        <td className="px-3 py-2">
            <button onClick={onOpen} className="text-left font-medium text-brand-green hover:underline break-words whitespace-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded">
                {item.name}
            </button>
            {item.slug && <div className="text-[11px] text-slate-400 mt-0.5">Registry ID: {item.slug}</div>}
            {isAdmin && (item.openFlagCount || 0) > 0 && <div className="mt-1"><NeedsReviewBadge /></div>}
        </td>
        <td className="px-3 py-2 text-slate-700">
            <div className="break-words whitespace-normal">{item.county || <span className="text-slate-400">Not reported</span>}</div>
            {item.district && <div className="text-[11px] text-slate-400">{item.district}</div>}
        </td>
        <td className="px-3 py-2"><CommodityBadges commodities={item.commodities} /></td>
        <td className="px-3 py-2 text-right tabular-nums text-slate-800 font-medium">{formatMembership(item.membershipTotal)}</td>
        <td className="px-3 py-2 text-right">
            <button onClick={onOpen} className="text-brand-green hover:text-brand-green-hover font-medium text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded">
                View Details
            </button>
        </td>
    </tr>
);

const RegistryCard: React.FC<{ item: CooperativeDirectoryItem; isAdmin: boolean; onOpen: () => void }> = ({ item, isAdmin, onOpen }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
            <div>
                <button onClick={onOpen} className="text-left font-semibold text-brand-green hover:underline">{item.name}</button>
                {item.slug && <div className="text-[11px] text-slate-400">Registry ID: {item.slug}</div>}
            </div>
            {isAdmin && (item.openFlagCount || 0) > 0 && <NeedsReviewBadge />}
        </div>
        <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">County / District</dt><dd className="text-slate-800 text-right">{[item.county, item.district].filter(Boolean).join(' / ') || 'Not reported'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Reported Members</dt><dd className="text-slate-800 text-right tabular-nums">{formatMembership(item.membershipTotal)}</dd></div>
        </dl>
        <div><CommodityBadges commodities={item.commodities} /></div>
        <div className="pt-1.5 border-t border-slate-100 flex justify-end">
            <button onClick={onOpen} className="text-brand-green hover:text-brand-green-hover font-medium text-sm">View Details</button>
        </div>
    </div>
);

export default CooperativeRegistry;

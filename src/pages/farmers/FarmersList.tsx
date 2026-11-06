import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getFarmers, downloadFarmersFarmsCsv, type Farmer } from '../../api/farmers';
import { resolveFileUrl } from '../../utils/fileUrl';
import SafeImage from '../../components/SafeImage';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import {
    Search, User, MapPin, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Sprout,
    AlertTriangle, Download, Users, ArrowUpRight, ArrowUp, ArrowDown, X, ChevronLeft,
    ChevronRight, ListFilter,
} from 'lucide-react';
import { COUNTY_NAMES } from '../../data/liberiaCounties';
import PageHeader from '../../components/ui/PageHeader';
import { buttonClasses } from '../../components/ui/buttonStyles';
import {
    formatFarmerId, formatFarmerLocationLine, hasSharedPhoneNumber, sortFarmers,
    SORT_OPTIONS, type IdentityFilter, type SortMode,
} from './farmerListHelpers';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (status === 'Verified') {
        return (
            <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[11px] leading-4 font-semibold rounded-full bg-green-100 text-green-800 whitespace-nowrap">
                <ShieldCheck className="h-3 w-3" /> Verified
            </span>
        );
    }
    if (status === 'Conflict') {
        return (
            <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[11px] leading-4 font-semibold rounded-full bg-red-100 text-red-800 whitespace-nowrap">
                <ShieldAlert className="h-3 w-3" /> Conflict
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[11px] leading-4 font-semibold rounded-full bg-yellow-100 text-yellow-800 whitespace-nowrap">
            <ShieldQuestion className="h-3 w-3" /> Unverified
        </span>
    );
};

const FarmCountBadge: React.FC<{ count: number }> = ({ count }) => (
    <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[11px] leading-4 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap">
        <Sprout className="h-3 w-3" /> {count} Farm{count !== 1 ? 's' : ''}
    </span>
);

/**
 * Read-only triage cue only — NEVER a duplicate verdict. Shown when this
 * farmer's phone number is shared with at least one other record (the same
 * signal the backend's Identity Verification queue already surfaces as a
 * "Potential Issue" — see computeDataReadiness in FarmerController.ts).
 * Clicking it goes straight to the Identity Verification queue for review;
 * this listing itself never merges, hides, or auto-flags anything.
 */
const PotentialDuplicateHint: React.FC<{ farmerId: string }> = ({ farmerId }) => (
    <Link
        to={`/farmers/verification?status=Unverified`}
        title="Phone number shared with another farmer record — review in the Identity Verification queue before assuming this is a duplicate."
        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 hover:underline"
        onClick={(e) => e.stopPropagation()}
        data-farmer-id={farmerId}
    >
        <AlertTriangle className="h-3 w-3" /> Review possible match
    </Link>
);

// Consistent avatar size (h-10/w-10 on the desktop table, h-11/w-11 on
// mobile cards) with a single shared fallback, so a missing/broken photo
// never shrinks, stretches, or shifts layout relative to a real photo.
const FallbackAvatar: React.FC<{ className?: string }> = ({ className = 'h-10 w-10' }) => (
    <div className={`${className} rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
        <User className="h-[45%] w-[45%]" />
    </div>
);

// Same summary-card pattern used on the Cooperative Registry and User
// Management screens, so at-a-glance registry stats look consistent across
// the admin panel. `onClick` makes a card double as a filter shortcut
// (Verified/Unverified cards open the matching filtered listing).
const SummaryCard: React.FC<{
    icon: React.ReactNode; label: string; value: React.ReactNode; accent: string;
    onClick?: () => void; active?: boolean;
}> = ({ icon, label, value, accent, onClick, active }) => {
    const content = (
        <>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>{icon}</div>
            <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">{label}</p>
                <p className="text-xl font-bold text-brand-text leading-tight">{value}</p>
            </div>
        </>
    );
    const baseCls = `bg-white shadow-sm rounded-xl border p-4 flex items-center gap-3 w-full text-left transition-colors ${
        active ? 'border-brand-green ring-1 ring-brand-green/30' : 'border-gray-100'
    }`;
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={`${baseCls} hover:border-brand-green/50 hover:bg-green-50/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green`}>
                {content}
            </button>
        );
    }
    return <div className={baseCls}>{content}</div>;
};

// Skeleton row shown while farmers are loading, so the table never flashes
// "0 farmers" / an empty state before the real data arrives.
const SkeletonRow: React.FC = () => (
    <tr>
        <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" /><div className="space-y-1.5"><div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" /><div className="h-2.5 w-16 bg-gray-100 rounded animate-pulse" /></div></div></td>
        <td className="px-5 py-3"><div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-5 py-3"><div className="h-3.5 w-20 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-5 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" /></td>
        <td className="px-5 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
        <td className="px-5 py-3 text-right"><div className="h-3.5 w-20 bg-gray-200 rounded animate-pulse ml-auto" /></td>
    </tr>
);

// Compact mobile-card rendering of a farmer row, shown below the `lg`
// breakpoint. Preserves every field the desktop table shows (name, Farmer
// ID, contact, location, farm count, identity status, View Profile) —
// nothing is dropped, only re-laid-out for a narrow screen.
const FarmerCard: React.FC<{ farmer: Farmer; flagged: boolean }> = ({ farmer, flagged }) => {
    const locationLine = formatFarmerLocationLine(farmer);
    return (
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 space-y-3 shadow-sm">
            <div className="flex items-center gap-3">
                <SafeImage
                    src={resolveFileUrl(farmer.profilePhoto)}
                    alt={`${farmer.firstName} ${farmer.lastName}`}
                    className="h-11 w-11 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"
                    fallback={<FallbackAvatar className="h-11 w-11" />}
                />
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">{farmer.firstName} {farmer.lastName}</div>
                    <div className="text-[11px] text-gray-500 truncate font-mono">
                        {formatFarmerId(farmer)}{farmer.gender ? ` \u00b7 ${farmer.gender}` : ''}
                    </div>
                </div>
                <StatusBadge status={farmer.identityStatus} />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs border-t border-gray-100 pt-3">
                <div className="min-w-0">
                    <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">Location</div>
                    <div className="text-gray-800 font-medium flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-gray-500 flex-shrink-0" /> {farmer.community || 'N/A'}
                    </div>
                    {locationLine && <div className="text-gray-500 truncate">{locationLine}</div>}
                </div>
                <div className="min-w-0">
                    <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">Contact</div>
                    {farmer.phoneNumber ? (
                        <div className="text-gray-800 truncate">{farmer.phoneNumber}</div>
                    ) : (
                        <div className="text-gray-500 italic">Not provided</div>
                    )}
                    {farmer.email && <div className="text-gray-500 truncate">{farmer.email}</div>}
                </div>
            </div>
            {flagged && (
                <div className="pt-1"><PotentialDuplicateHint farmerId={farmer.id} /></div>
            )}
            <div className="flex items-center justify-between pt-1">
                <FarmCountBadge count={farmer.farms?.length || 0} />
                <Link
                    to={`/farmers/${farmer.id}`}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-brand-green bg-green-50 hover:bg-green-100 transition-colors"
                >
                    View Profile <ArrowUpRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
};

const SortHeader: React.FC<{
    label: string; align?: 'left' | 'right';
    active: boolean; dir: 'asc' | 'desc' | null;
    onClick: () => void;
}> = ({ label, align = 'left', active, dir, onClick }) => (
    <th scope="col" className={`px-5 py-2.5 text-${align} text-[11px] font-semibold text-gray-500 uppercase tracking-wide`}>
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1 hover:text-gray-800 focus:outline-none ${active ? 'text-gray-800' : ''}`}
        >
            {label}
            {active ? (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
        </button>
    </th>
);

const FarmersList: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN;
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    // Every piece of view state (search, filters, sort, page, page size)
    // round-trips through the URL. This is what makes search/filter state
    // survive a visit to a farmer's profile and back — the browser's own
    // back navigation restores the exact same URL/query string, so nothing
    // needs to be stashed in component state or sessionStorage separately.
    // The same URL shape also keeps this page's dashboard drill-down
    // contract intact (/farmers?gender=Female, ?verificationStatus=Verified,
    // ?county=Bong all keep working exactly as before).
    const [searchParams, setSearchParams] = useSearchParams();
    const searchTerm = searchParams.get('q') || '';
    const genderFilter = searchParams.get('gender') || 'All';
    const verificationFilter = (searchParams.get('verificationStatus') as IdentityFilter) || 'All';
    const countyFilter = searchParams.get('county') || 'All';
    const sortMode = (searchParams.get('sort') as SortMode) || 'RECENT';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = (parseInt(searchParams.get('size') || '20', 10) as typeof PAGE_SIZE_OPTIONS[number]) || 20;

    const setParam = (key: string, value: string | null, resetPage = true) => {
        const next = new URLSearchParams(searchParams);
        if (!value || value === 'All') next.delete(key);
        else next.set(key, value);
        if (resetPage) next.delete('page');
        setSearchParams(next);
    };

    const toggleSort = (field: 'NAME' | 'FARMS') => {
        let next: SortMode;
        if (field === 'NAME') {
            next = sortMode === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC';
        } else {
            next = sortMode === 'FARMS_DESC' ? 'FARMS_ASC' : 'FARMS_DESC';
        }
        setParam('sort', next, false);
    };

    const handleExportCsv = async () => {
        try {
            setExporting(true);
            setExportError(null);
            await downloadFarmersFarmsCsv();
        } catch (err: unknown) {
            console.error('Error exporting farmers/farms CSV', err);
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 403) {
                setExportError('You do not have permission to generate this report.');
            } else {
                setExportError('Failed to generate report. Please try again.');
            }
        } finally {
            setExporting(false);
        }
    };

    const fetchFarmers = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getFarmers();
            if (response.data.status) {
                setFarmers(response.data.data);
            } else {
                setError(response.data.message || 'Failed to load farmers.');
            }
        } catch (err: unknown) {
            console.error("Error fetching farmers", err);
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401) {
                setError('Your session has expired. Please log in again.');
            } else {
                setError('Failed to load farmers. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFarmers();
    }, []);

    // Phone-number sharing map, computed once over the FULL unfiltered list
    // (not just the current page/filtered view) so a shared-number hint is
    // never missed just because the matching record is on a different page
    // or filtered out. This mirrors the backend's own "Potential Issue"
    // triage signal (FarmerController.computeDataReadiness) — it is a
    // review cue only, never an automatic duplicate/merge decision.
    const sharedPhoneFarmerIds = useMemo(() => {
        const flagged = new Set<string>();
        for (const f of farmers) {
            if (hasSharedPhoneNumber(f, farmers)) flagged.add(f.id);
        }
        return flagged;
    }, [farmers]);

    const filteredFarmers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const result = farmers.filter((f) => {
            const matchesSearch = !term ||
                f.firstName.toLowerCase().includes(term) ||
                f.lastName.toLowerCase().includes(term) ||
                f.farmerId?.toLowerCase().includes(term);
            const matchesGender = genderFilter === 'All' || f.gender === genderFilter;
            const matchesVerification = verificationFilter === 'All' ||
                (verificationFilter === 'Unverified' ? (!f.identityStatus || f.identityStatus === 'Unverified') : f.identityStatus === verificationFilter);
            const matchesCounty = countyFilter === 'All' || (f.region || '').toLowerCase() === countyFilter.toLowerCase();
            return matchesSearch && matchesGender && matchesVerification && matchesCounty;
        });
        return sortFarmers(result, sortMode);
    }, [farmers, searchTerm, genderFilter, verificationFilter, countyFilter, sortMode]);

    const activeFilterCount = [genderFilter, verificationFilter, countyFilter].filter((v) => v !== 'All').length + (searchTerm ? 1 : 0);
    const isFiltered = activeFilterCount > 0;

    const clearAllFilters = () => setSearchParams({});

    const totalPages = Math.max(1, Math.ceil(filteredFarmers.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageRows = filteredFarmers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const rangeStart = filteredFarmers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const rangeEnd = Math.min(currentPage * pageSize, filteredFarmers.length);

    // Registry-wide totals (NEVER affected by the active filter) — these
    // back the summary cards, which must always reflect the whole registry
    // so staff never mistake a filtered figure for the overall total. The
    // separate "Showing X of Y" strip below the toolbar is what reflects
    // the current filtered view.
    const stats = useMemo(() => ({
        total: farmers.length,
        verified: farmers.filter(f => f.identityStatus === 'Verified').length,
        unverified: farmers.filter(f => !f.identityStatus || f.identityStatus === 'Unverified').length,
        conflict: farmers.filter(f => f.identityStatus === 'Conflict').length,
        totalFarms: farmers.reduce((sum, f) => sum + (f.farms?.length || 0), 0),
    }), [farmers]);

    const nameSortDir: 'asc' | 'desc' | null = sortMode === 'NAME_ASC' ? 'asc' : sortMode === 'NAME_DESC' ? 'desc' : null;
    const farmsSortDir: 'asc' | 'desc' | null = sortMode === 'FARMS_DESC' ? 'desc' : sortMode === 'FARMS_ASC' ? 'asc' : null;

    return (
        <div className="space-y-5">
            <PageHeader
                breadcrumb={[{ label: 'Farmer Registry' }]}
                title="Farmer Registry"
                description="Registered farmers and identity verification."
                actions={
                    <>
                        {(user?.role === UserRole.ADMIN || user?.role === UserRole.INSPECTOR) && (
                            <Link to="/farmers/verification" className={buttonClasses('outline', 'md')}>
                                <ShieldQuestion className="h-4 w-4" /> Identity Verification Queue
                            </Link>
                        )}
                        {isAdmin && (
                            <button
                                type="button"
                                onClick={handleExportCsv}
                                disabled={exporting}
                                className={buttonClasses('secondary', 'md', 'disabled:cursor-not-allowed')}
                            >
                                {exporting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                {exporting ? 'Generating…' : 'Export Report'}
                            </button>
                        )}
                        <Link to="/farmers/mapping/start" className={buttonClasses('primary', 'md')}>
                            + Register Farmer
                        </Link>
                    </>
                }
                meta={exportError ? <p className="text-xs text-red-600">{exportError}</p> : undefined}
            />

            {/* Summary cards — always reflect registry-wide totals, never
                the current filter. Verified/Unverified double as shortcuts
                into the matching filtered view. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard
                    icon={<Users className="h-5 w-5 text-brand-green" />}
                    label="Total Farmers"
                    value={loading ? '—' : stats.total}
                    accent="bg-green-50"
                    onClick={activeFilterCount > 0 ? clearAllFilters : undefined}
                    active={!isFiltered}
                />
                <SummaryCard
                    icon={<ShieldCheck className="h-5 w-5 text-green-600" />}
                    label="Verified"
                    value={loading ? '—' : stats.verified}
                    accent="bg-green-50"
                    onClick={() => setParam('verificationStatus', 'Verified')}
                    active={verificationFilter === 'Verified'}
                />
                <SummaryCard
                    icon={<ShieldQuestion className="h-5 w-5 text-yellow-600" />}
                    label="Unverified"
                    value={loading ? '—' : stats.unverified}
                    accent="bg-yellow-50"
                    onClick={() => setParam('verificationStatus', 'Unverified')}
                    active={verificationFilter === 'Unverified'}
                />
                <SummaryCard icon={<Sprout className="h-5 w-5 text-blue-600" />} label="Farms Registered" value={loading ? '—' : stats.totalFarms} accent="bg-blue-50" />
            </div>

            <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                {/* Toolbar: search + filters + sort, neatly aligned within the table card */}
                <div className="p-3.5 border-b border-gray-100 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-500" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50/60 placeholder-gray-400 text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                placeholder="Search by name or Farmer ID"
                                value={searchTerm}
                                onChange={(e) => setParam('q', e.target.value || null)}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setParam('q', null)}
                                    aria-label="Clear search"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <select
                                value={genderFilter}
                                onChange={(e) => setParam('gender', e.target.value)}
                                className="border border-gray-200 bg-gray-50/60 rounded-lg py-2 px-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="All">All Genders</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                            <select
                                value={verificationFilter}
                                onChange={(e) => setParam('verificationStatus', e.target.value)}
                                className="border border-gray-200 bg-gray-50/60 rounded-lg py-2 px-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="All">All Verification Statuses</option>
                                <option value="Verified">Verified</option>
                                <option value="Unverified">Unverified</option>
                                <option value="Conflict">Conflict</option>
                            </select>
                            <select
                                value={countyFilter}
                                onChange={(e) => setParam('county', e.target.value)}
                                className="border border-gray-200 bg-gray-50/60 rounded-lg py-2 px-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="All">All Counties</option>
                                {COUNTY_NAMES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <select
                                value={sortMode}
                                onChange={(e) => setParam('sort', e.target.value === 'RECENT' ? null : e.target.value, false)}
                                className="border border-gray-200 bg-gray-50/60 rounded-lg py-2 px-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                aria-label="Sort by"
                            >
                                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {isFiltered && (
                                <button
                                    onClick={clearAllFilters}
                                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 underline px-1.5 whitespace-nowrap"
                                >
                                    <X className="h-3.5 w-3.5" /> Clear filters
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Result count strip — only shown once loaded, so it doesn't
                    flash "0 of 0" before data arrives. Separate from the
                    summary cards above (which always reflect totals), this
                    clearly distinguishes the current filtered view from the
                    overall registry. */}
                {!loading && !error && (
                    <div className="px-3.5 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-1.5 text-xs text-gray-500">
                        <ListFilter className="h-3.5 w-3.5 text-gray-500" />
                        Showing <span className="font-semibold text-gray-700">{filteredFarmers.length}</span>
                        {isFiltered && <> of <span className="font-semibold text-gray-700">{farmers.length}</span> total</>} farmers
                        {isFiltered && <span className="text-gray-400">(filtered)</span>}
                    </div>
                )}

                {error ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button
                            onClick={fetchFarmers}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Desktop / tablet table. A single vertical scrollbar
                            (the table body itself, via max-h + overflow-y) —
                            the page around it scrolls normally, so there's
                            never more than one vertical scrollbar nested
                            inside another. */}
                        <div className="hidden lg:block overflow-x-auto overflow-y-auto max-h-[65vh]">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50/90 backdrop-blur-sm sticky top-0 z-10">
                                    <tr>
                                        <SortHeader label="Farmer" active={nameSortDir !== null} dir={nameSortDir} onClick={() => toggleSort('NAME')} />
                                        <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                                        <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                                        <SortHeader label="Farms" active={farmsSortDir !== null} dir={farmsSortDir} onClick={() => toggleSort('FARMS')} />
                                        <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Identity Status</th>
                                        <th scope="col" className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-50">
                                    {loading ? (
                                        <>
                                            <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
                                        </>
                                    ) : pageRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-14 text-center">
                                                <div className="flex flex-col items-center gap-2 text-gray-500">
                                                    <Users className="h-8 w-8" />
                                                    <p className="text-sm text-gray-500">No farmers found matching your criteria.</p>
                                                    {isFiltered && (
                                                        <button
                                                            onClick={clearAllFilters}
                                                            className="text-xs font-medium text-brand-green hover:text-brand-green-hover underline"
                                                        >
                                                            Clear filters
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : pageRows.map((farmer) => {
                                        const locationLine = formatFarmerLocationLine(farmer);
                                        const flagged = sharedPhoneFarmerIds.has(farmer.id);
                                        return (
                                            <tr key={farmer.id} className="hover:bg-green-50/40 transition-colors align-top">
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <SafeImage
                                                            src={resolveFileUrl(farmer.profilePhoto)}
                                                            alt={`${farmer.firstName} ${farmer.lastName}`}
                                                            className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"
                                                            fallback={<FallbackAvatar />}
                                                        />
                                                        <div className="ml-3 min-w-0">
                                                            <div className="text-sm font-semibold text-gray-900 leading-tight truncate">{farmer.firstName} {farmer.lastName}</div>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[11px] text-gray-500 font-mono">{formatFarmerId(farmer)}</span>
                                                                {farmer.gender && (
                                                                    <>
                                                                        <span className="text-gray-300">&middot;</span>
                                                                        <span className="text-[11px] text-gray-500">{farmer.gender}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            {flagged && (
                                                                <div className="mt-1"><PotentialDuplicateHint farmerId={farmer.id} /></div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    {farmer.phoneNumber ? (
                                                        <div className="text-sm text-gray-800">{farmer.phoneNumber}</div>
                                                    ) : (
                                                        <div className="text-sm text-gray-500 italic">Not provided</div>
                                                    )}
                                                    {farmer.email && (
                                                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">{farmer.email}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    <div className="text-sm text-gray-800 flex items-center gap-1">
                                                        <MapPin className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                                        {farmer.community || 'N/A'}
                                                    </div>
                                                    {locationLine && (
                                                        <div className="text-xs text-gray-500 mt-0.5">{locationLine}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    <FarmCountBadge count={farmer.farms?.length || 0} />
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    <StatusBadge status={farmer.identityStatus} />
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap text-right">
                                                    <Link
                                                        to={`/farmers/${farmer.id}`}
                                                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-brand-green bg-green-50 hover:bg-green-100 transition-colors"
                                                    >
                                                        View Profile <ArrowUpRight className="h-3 w-3" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards: same data, stacked layout so nothing
                            overlaps or gets clipped on narrow screens —
                            identification (name, Farmer ID, status) and the
                            View Profile action are never compressed to fit
                            the desktop table's column count. */}
                        <div className="lg:hidden p-3 space-y-2.5">
                            {loading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="h-6 w-6 text-gray-300 animate-spin" />
                                </div>
                            ) : pageRows.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 text-gray-500 py-14">
                                    <Users className="h-8 w-8" />
                                    <p className="text-sm text-gray-500">No farmers found matching your criteria.</p>
                                    {isFiltered && (
                                        <button
                                            onClick={clearAllFilters}
                                            className="text-xs font-medium text-brand-green hover:text-brand-green-hover underline"
                                        >
                                            Clear filters
                                        </button>
                                    )}
                                </div>
                            ) : pageRows.map((farmer) => (
                                <FarmerCard key={farmer.id} farmer={farmer} flagged={sharedPhoneFarmerIds.has(farmer.id)} />
                            ))}
                        </div>

                        {!loading && !error && filteredFarmers.length > 0 && (
                            <div className="px-3.5 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                                <div className="flex items-center gap-2 text-gray-500">
                                    <span>Rows per page:</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => { setParam('size', e.target.value, false); setParam('page', null); }}
                                        className="rounded-md border border-gray-300 py-1 pl-2 pr-6 text-sm"
                                    >
                                        {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <span className="text-gray-500">
                                    Showing {rangeStart}–{rangeEnd} of {filteredFarmers.length} farmers
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={currentPage <= 1}
                                        onClick={() => setParam('page', String(currentPage - 1), false)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" /> Previous
                                    </button>
                                    <span className="text-gray-500">Page {currentPage} of {totalPages}</span>
                                    <button
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setParam('page', String(currentPage + 1), false)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
                                    >
                                        Next <ChevronRight className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default FarmersList;

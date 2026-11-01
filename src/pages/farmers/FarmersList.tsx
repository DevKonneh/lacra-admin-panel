import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getFarmers, downloadFarmersFarmsCsv, type Farmer } from '../../api/farmers';
import { resolveFileUrl } from '../../utils/fileUrl';
import SafeImage from '../../components/SafeImage';
import { useAuth } from '../../context/AuthContext';
import { Search, User, MapPin, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Sprout, AlertTriangle, Download, Users, ArrowRight } from 'lucide-react';
import { COUNTY_NAMES } from '../../data/liberiaCounties';

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (status === 'Verified') {
        return (
            <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[11px] leading-4 font-semibold rounded-full bg-green-100 text-green-800">
                <ShieldCheck className="h-3 w-3" /> Verified
            </span>
        );
    }
    if (status === 'Conflict') {
        return (
            <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[11px] leading-4 font-semibold rounded-full bg-red-100 text-red-800">
                <ShieldAlert className="h-3 w-3" /> Conflict
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[11px] leading-4 font-semibold rounded-full bg-yellow-100 text-yellow-800">
            <ShieldQuestion className="h-3 w-3" /> Unverified
        </span>
    );
};

const FarmCountBadge: React.FC<{ count: number }> = ({ count }) => (
    <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[11px] leading-4 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
        <Sprout className="h-3 w-3" /> {count} Farm{count !== 1 ? 's' : ''}
    </span>
);

const FallbackAvatar: React.FC<{ className?: string }> = ({ className = 'h-10 w-10' }) => (
    <div className={`${className} rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
        <User className="h-[45%] w-[45%]" />
    </div>
);

// Skeleton row shown while farmers are loading, so the table never
// flashes "0 farmers" / an empty state before the real data arrives.
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
// breakpoint so the registry stays readable on narrow screens instead of
// forcing a cramped/clipped horizontal table scroll.
const FarmerCard: React.FC<{ farmer: Farmer }> = ({ farmer }) => {
    const locationLine = [farmer.district, farmer.region].filter(Boolean).join(', ');
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
                    <div className="text-[11px] text-gray-400 truncate">
                        {farmer.farmerId || 'Pending ID'}{farmer.gender ? ` \u00b7 ${farmer.gender}` : ''}
                    </div>
                </div>
                <StatusBadge status={farmer.identityStatus} />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs border-t border-gray-100 pt-3">
                <div className="min-w-0">
                    <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-0.5">Location</div>
                    <div className="text-gray-800 font-medium flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" /> {farmer.community || 'N/A'}
                    </div>
                    {locationLine && <div className="text-gray-400 truncate">{locationLine}</div>}
                </div>
                <div className="min-w-0">
                    <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-0.5">Contact</div>
                    {farmer.phoneNumber ? (
                        <div className="text-gray-800 truncate">{farmer.phoneNumber}</div>
                    ) : (
                        <div className="text-gray-400 italic">Not provided</div>
                    )}
                    {farmer.email && <div className="text-gray-400 truncate">{farmer.email}</div>}
                </div>
            </div>
            <div className="flex items-center justify-between pt-1">
                <FarmCountBadge count={farmer.farms?.length || 0} />
                <Link
                    to={`/farmers/${farmer.id}`}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-brand-green bg-green-50 hover:bg-green-100 transition-colors"
                >
                    View Profile <ArrowRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
};

const FarmersList: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    // URL-param-driven filters so dashboard drill-downs can deep-link
    // straight into a pre-filtered view (e.g. /farmers?gender=Female,
    // /farmers?verificationStatus=Verified, /farmers?county=Bong).
    // These stay in sync with the URL so the filtered view is shareable
    // and survives a page refresh.
    const [searchParams, setSearchParams] = useSearchParams();
    const genderFilter = searchParams.get('gender') || 'All';
    const verificationFilter = searchParams.get('verificationStatus') || 'All';
    const countyFilter = searchParams.get('county') || 'All';

    const updateFilter = (key: string, value: string) => {
        const next = new URLSearchParams(searchParams);
        if (!value || value === 'All') next.delete(key);
        else next.set(key, value);
        setSearchParams(next);
    };

    const handleExportCsv = async () => {
        try {
            setExporting(true);
            setExportError(null);
            await downloadFarmersFarmsCsv();
        } catch (err: any) {
            console.error('Error exporting farmers/farms CSV', err);
            if (err?.response?.status === 403) {
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
        } catch (err: any) {
            console.error("Error fetching farmers", err);
            if (err?.response?.status === 401) {
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

    const filteredFarmers = farmers.filter(f => {
        const matchesSearch =
            f.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.farmerId?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGender = genderFilter === 'All' || f.gender === genderFilter;
        const matchesVerification = verificationFilter === 'All' || f.identityStatus === verificationFilter;
        const matchesCounty = countyFilter === 'All' || (f.region || '').toLowerCase() === countyFilter.toLowerCase();
        return matchesSearch && matchesGender && matchesVerification && matchesCounty;
    });

    const activeFilterCount = [genderFilter, verificationFilter, countyFilter].filter((v) => v !== 'All').length;

    return (
        <div className="space-y-5">
            {/* Page heading + live count badge (left) and primary actions (right). */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div>
                        <h1 className="text-xl font-semibold text-brand-text leading-tight">Farmer Registry</h1>
                        <p className="text-sm text-brand-muted mt-0.5">Registered farmers and identity verification.</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-100 text-green-800 text-xs font-semibold whitespace-nowrap">
                        <Users className="h-3.5 w-3.5" />
                        {loading ? 'Loading…' : (
                            <>
                                {filteredFarmers.length} registered
                                {activeFilterCount > 0 && <span className="font-normal text-green-700/70"> / {farmers.length}</span>}
                            </>
                        )}
                    </span>
                </div>
                <div className="flex flex-col items-start lg:items-end gap-2">
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button
                                type="button"
                                onClick={handleExportCsv}
                                disabled={exporting}
                                className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 text-sm font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                            >
                                {exporting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                {exporting ? 'Generating…' : 'Export Report'}
                            </button>
                        )}
                        <Link
                            to="/farmers/mapping/start"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-brand-green hover:bg-brand-green-hover transition-colors"
                        >
                            + Register Farmer
                        </Link>
                    </div>
                    {exportError && (
                        <p className="text-xs text-red-600">{exportError}</p>
                    )}
                </div>
            </div>

            <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                {/* Toolbar: search + filters, neatly aligned within the table card */}
                <div className="p-3.5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2.5 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50/60 placeholder-gray-400 text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                            placeholder="Search by name or Farmer ID"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={genderFilter}
                            onChange={(e) => updateFilter('gender', e.target.value)}
                            className="border border-gray-200 bg-gray-50/60 rounded-lg py-2 px-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="All">All Genders</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                        <select
                            value={verificationFilter}
                            onChange={(e) => updateFilter('verificationStatus', e.target.value)}
                            className="border border-gray-200 bg-gray-50/60 rounded-lg py-2 px-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="All">All Verification Statuses</option>
                            <option value="Verified">Verified</option>
                            <option value="Unverified">Unverified</option>
                            <option value="Conflict">Conflict</option>
                        </select>
                        <select
                            value={countyFilter}
                            onChange={(e) => updateFilter('county', e.target.value)}
                            className="border border-gray-200 bg-gray-50/60 rounded-lg py-2 px-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="All">All Counties</option>
                            {COUNTY_NAMES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={() => setSearchParams({})}
                                className="text-sm text-gray-500 hover:text-gray-800 underline px-1.5 whitespace-nowrap"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

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
                        {/* Desktop / tablet table, with a sticky header that stays
                            visible while the body scrolls within the card. */}
                        <div className="hidden lg:block overflow-x-auto overflow-y-auto max-h-[65vh]">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50/90 backdrop-blur-sm sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Farmer</th>
                                        <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                                        <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                                        <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Farms</th>
                                        <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Verification</th>
                                        <th scope="col" className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-50">
                                    {loading ? (
                                        <>
                                            <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
                                        </>
                                    ) : filteredFarmers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                                                No farmers found matching your criteria.
                                            </td>
                                        </tr>
                                    ) : filteredFarmers.map((farmer) => {
                                        const locationLine = [farmer.district, farmer.region].filter(Boolean).join(', ');
                                        return (
                                            <tr key={farmer.id} className="hover:bg-green-50/40 transition-colors">
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
                                                                <span className="text-[11px] text-gray-400">{farmer.farmerId || 'Pending ID'}</span>
                                                                {farmer.gender && (
                                                                    <>
                                                                        <span className="text-gray-300">&middot;</span>
                                                                        <span className="text-[11px] text-gray-400">{farmer.gender}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    {farmer.phoneNumber ? (
                                                        <div className="text-sm text-gray-800">{farmer.phoneNumber}</div>
                                                    ) : (
                                                        <div className="text-sm text-gray-400 italic">Not provided</div>
                                                    )}
                                                    {farmer.email && (
                                                        <div className="text-xs text-gray-500 mt-0.5">{farmer.email}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    <div className="text-sm text-gray-800 flex items-center gap-1">
                                                        <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
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
                                                        View Profile <ArrowRight className="h-3 w-3" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards: same data, stacked layout so nothing overlaps
                            or gets clipped on narrow screens. */}
                        <div className="lg:hidden p-3 space-y-2.5">
                            {loading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="h-6 w-6 text-gray-300 animate-spin" />
                                </div>
                            ) : filteredFarmers.length === 0 ? (
                                <p className="text-center text-sm text-gray-500 py-10">No farmers found matching your criteria.</p>
                            ) : filteredFarmers.map((farmer) => (
                                <FarmerCard key={farmer.id} farmer={farmer} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default FarmersList;

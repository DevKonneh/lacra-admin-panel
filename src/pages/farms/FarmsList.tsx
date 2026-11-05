import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getFarms, type FarmWithFarmer } from '../../api/farms';
import { Search, MapPin, ExternalLink, Plus, AlertTriangle, ShieldCheck, ShieldAlert, HelpCircle, FileWarning, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { COUNTY_NAMES } from '../../data/liberiaCounties';
import Badge from '../../components/ui/Badge';

// Flattens a farm's active plot-commodities into a de-duplicated list of
// { name, role } for display as badges. Falls back to the legacy single
// cropType string for farms that haven't been through the new
// commodity-mapping flow yet (or whose Plot/PlotCommodity rows are absent
// from the relation payload for any reason).
const getActiveCommodities = (farm: FarmWithFarmer): { name: string; role: string }[] => {
    const fromPlots = (farm.plots || [])
        .filter((p) => p.isActive)
        .flatMap((p) => p.plotCommodities || [])
        .filter((pc) => pc.isActive);
    if (fromPlots.length > 0) {
        const seen = new Map<string, string>();
        for (const pc of fromPlots) {
            if (!seen.has(pc.commodityName)) seen.set(pc.commodityName, pc.role);
        }
        return Array.from(seen.entries()).map(([name, role]) => ({ name, role }));
    }
    return farm.cropType ? [{ name: farm.cropType, role: 'Primary' }] : [];
};

// Maps the SAME "Assessment Pending" / "Compliant" / "Needs Review" /
// "High Risk" bucket rule used by ReportsController.complianceStatusWhereSql()
// on the backend, so a farm's badge here always agrees with which dashboard
// bucket it was counted/drilled-down into. IMPORTANT: riskLevel defaults to
// 'Low' in the database for any farm that has never been assessed (see
// FarmController.create()/Farm entity), so lastRiskAssessmentDate IS NULL
// must be checked FIRST — otherwise a never-assessed farm with a (merely
// defaulted) 'Low' riskLevel and a valid geometry would be misclassified as
// 'Compliant' instead of 'Assessment Pending'.
const complianceStatusOf = (farm: FarmWithFarmer): 'Assessment Pending' | 'Compliant' | 'Needs Review' | 'High Risk' => {
    if (!farm.lastRiskAssessmentDate) return 'Assessment Pending';
    if (farm.riskLevel === 'High') return 'High Risk';
    if (farm.riskLevel === 'Low' && farm.geometryStatus === 'Valid') return 'Compliant';
    return 'Needs Review';
};

// Visible badge for the SAME 4-bucket rule as complianceStatusOf() above —
// so staff can see, at a glance in the list, exactly which bucket a farm
// falls into without having to apply the filter first.
const ComplianceBadge: React.FC<{ farm: FarmWithFarmer }> = ({ farm }) => {
    const status = complianceStatusOf(farm);
    if (status === 'Assessment Pending') {
        return <Badge tone="slate" icon={<Clock />}>Assessment Pending</Badge>;
    }
    if (status === 'Compliant') {
        return <Badge tone="green" icon={<ShieldCheck />}>Assessed Low Risk, Valid Geometry</Badge>;
    }
    if (status === 'High Risk') {
        return <Badge tone="red" icon={<ShieldAlert />}>High Risk</Badge>;
    }
    return <Badge tone="amber" icon={<HelpCircle />}>Needs Review</Badge>;
};

const GeometryBadge: React.FC<{ farm: FarmWithFarmer }> = ({ farm }) => {
    const status = farm.geometryStatus;
    if (status === 'Valid') {
        return (
            <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Valid Polygon
            </span>
        );
    }
    if (status === 'Invalid') {
        return (
            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                <ShieldAlert className="h-3.5 w-3.5" /> Invalid
            </span>
        );
    }
    if (status === 'Needs Review') {
        return (
            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <HelpCircle className="h-3.5 w-3.5" /> Needs Review
            </span>
        );
    }
    // "Missing" or legacy farms with no geometryStatus at all yet.
    return (
        <span className="inline-flex items-center gap-1 text-gray-400">
            <FileWarning className="h-3.5 w-3.5" /> Missing
        </span>
    );
};

const SkeletonRow: React.FC = () => (
    <tr>
        <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="h-6 w-6 bg-gray-200 rounded animate-pulse" /><div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" /></div></td>
        <td className="px-6 py-4"><div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-5 w-32 bg-gray-200 rounded-full animate-pulse" /></td>
        <td className="px-6 py-4 text-right"><div className="h-3.5 w-20 bg-gray-200 rounded animate-pulse ml-auto" /></td>
    </tr>
);

const FarmsList: React.FC = () => {
    const [farms, setFarms] = useState<FarmWithFarmer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();

    // URL-param-driven filters, so dashboard drill-downs can deep-link
    // straight into a pre-filtered Farm Registry view, e.g.
    // /farms?commodity=Cocoa, /farms?complianceStatus=High%20Risk,
    // /farms?county=Bong, /farms?geometryStatus=Needs%20Review.
    const [searchParams, setSearchParams] = useSearchParams();
    const commodityFilter = searchParams.get('commodity') || 'All';
    const complianceFilter = searchParams.get('complianceStatus') || 'All';
    const geometryFilter = searchParams.get('geometryStatus') || 'All';
    const countyFilter = searchParams.get('county') || 'All';

    const updateFilter = (key: string, value: string) => {
        const next = new URLSearchParams(searchParams);
        if (!value || value === 'All') next.delete(key);
        else next.set(key, value);
        setSearchParams(next);
    };

    const fetchFarms = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getFarms();
            if (response.data.status) {
                setFarms(response.data.data);
            } else {
                setError(response.data.message || 'Failed to load farms.');
            }
        } catch (err: unknown) {
            console.error("Error fetching farms", err);
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401) {
                setError('Your session has expired. Please log in again.');
            } else {
                setError('Failed to load farms. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFarms();
    }, []);

    // All available commodity names across the loaded farms, for the filter dropdown.
    const allCommodities = Array.from(
        new Set(farms.flatMap((f) => getActiveCommodities(f).map((c) => c.name)))
    ).sort();

    const filteredFarms = farms.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.farmer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.farmer.lastName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCommodity = commodityFilter === 'All' ||
            getActiveCommodities(f).some((c) => c.name.toLowerCase() === commodityFilter.toLowerCase());
        const matchesCompliance = complianceFilter === 'All' || complianceStatusOf(f) === complianceFilter;
        const matchesGeometry = geometryFilter === 'All' || (f.geometryStatus || 'Missing') === geometryFilter;
        const matchesCounty = countyFilter === 'All' || (f.farmer.region || '').toLowerCase() === countyFilter.toLowerCase();
        return matchesSearch && matchesCommodity && matchesCompliance && matchesGeometry && matchesCounty;
    });

    const activeFilterCount = [commodityFilter, complianceFilter, geometryFilter, countyFilter].filter((v) => v !== 'All').length;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <p className="text-sm text-brand-muted">
                    {loading ? (
                        'Loading records…'
                    ) : (
                        <>
                            <span className="font-semibold text-brand-text">{filteredFarms.length}</span> registered farm{filteredFarms.length !== 1 ? 's' : ''}
                            {activeFilterCount > 0 && <span className="text-gray-400"> (filtered from {farms.length})</span>}
                        </>
                    )}
                </p>
                {user?.role === UserRole.FARMER && (
                    <Link to="/farms/new" className="inline-flex items-center px-3.5 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-brand-green hover:bg-brand-green-hover transition-colors">
                        <Plus className="h-4 w-4 mr-2" /> Add Farm
                    </Link>
                )}
            </div>

            <div className="bg-white shadow-md rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            placeholder="Search by farm or farmer name"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={commodityFilter}
                        onChange={(e) => updateFilter('commodity', e.target.value)}
                        className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    >
                        <option value="All">All Commodities</option>
                        {allCommodities.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <select
                        value={complianceFilter}
                        onChange={(e) => updateFilter('complianceStatus', e.target.value)}
                        className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    >
                        <option value="All">All Compliance Statuses</option>
                        <option value="Assessment Pending">Assessment Pending</option>
                        <option value="Compliant">Assessed Low Risk, Valid Geometry</option>
                        <option value="Needs Review">Needs Review</option>
                        <option value="High Risk">High Risk</option>
                    </select>
                    <select
                        value={geometryFilter}
                        onChange={(e) => updateFilter('geometryStatus', e.target.value)}
                        className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    >
                        <option value="All">All Geometry Statuses</option>
                        <option value="Valid">Valid</option>
                        <option value="Needs Review">Needs Review</option>
                        <option value="Invalid">Invalid</option>
                        <option value="Missing">Missing</option>
                    </select>
                    <select
                        value={countyFilter}
                        onChange={(e) => updateFilter('county', e.target.value)}
                        className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    >
                        <option value="All">All Counties</option>
                        {COUNTY_NAMES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={() => setSearchParams({})}
                            className="text-sm text-gray-500 hover:text-gray-800 underline px-2"
                        >
                            Clear filters
                        </button>
                    )}
                </div>

                {error ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button
                            onClick={fetchFarms}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farm Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farmer</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commodities</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Geometry Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compliance Status</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Map</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <>
                                        <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
                                    </>
                                ) : filteredFarms.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                                            No farms found matching your criteria.
                                        </td>
                                    </tr>
                                ) : filteredFarms.map((farm) => (
                                    <tr key={farm.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0">
                                                    <MapPin className="h-6 w-6 text-green-500" />
                                                </div>
                                                <div className="ml-4">
                                                    <Link to={`/farms/${farm.id}`} className="text-sm font-medium text-gray-900 hover:text-green-600 hover:underline">
                                                        {farm.name}
                                                    </Link>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link to={`/farmers/${farm.farmer.id}`} className="text-sm text-blue-600 hover:underline">
                                                {farm.farmer.firstName} {farm.farmer.lastName}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {getActiveCommodities(farm).length > 0 ? (
                                                    getActiveCommodities(farm).map((c, i) => (
                                                        <span
                                                            key={`${c.name}-${i}`}
                                                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                                c.role === 'Primary'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-gray-100 text-gray-700'
                                                            }`}
                                                            title={c.role}
                                                        >
                                                            {c.name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-400 text-xs">No commodities</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <GeometryBadge farm={farm} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <ComplianceBadge farm={farm} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Link to={`/map?farmId=${farm.id}`} className="text-green-600 hover:text-green-900 inline-flex items-center">
                                                <ExternalLink className="h-4 w-4 mr-1" /> View on Map
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FarmsList;

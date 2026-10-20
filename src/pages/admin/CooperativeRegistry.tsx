import React, { useEffect, useMemo, useState } from 'react';
import {
    RefreshCw,
    Database,
    CheckCircle2,
    AlertTriangle,
    Search,
    Users2,
    MapPinned,
    Building2,
} from 'lucide-react';
import { getCooperatives, seedCooperatives, type Cooperative, type CooperativeSeedResult } from '../../api/cooperatives';

/**
 * Admin-only page for the real CDA (Cooperative Development Agency)
 * cooperative registry (backend Cooperative entity, 95 records parsed
 * from the official "CDA COOPERATIVE LISTING 2025" letter).
 *
 * Lives under Commodity & Farm (alongside Farm Registry / Commodity
 * Registry) since it is farm/commodity reference data, not a system
 * setting - matches where enumerators and admins actually look for it.
 *
 * Also doubles as a one-click "seed/refresh the production registry"
 * utility, since the backend endpoint is ADMIN-only and idempotent
 * (upserts by slug) - safe to click more than once, e.g. after the
 * registry data is corrected and redeployed.
 */

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent: string }> = ({
    icon,
    label,
    value,
    accent,
}) => (
    <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>{icon}</div>
        <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
            <p className="text-xl font-bold text-brand-text leading-tight">{value}</p>
        </div>
    </div>
);

const SkeletonRow: React.FC = () => (
    <tr>
        <td className="px-6 py-4"><div className="h-3.5 w-40 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-5 w-28 bg-gray-200 rounded-full animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-3.5 w-16 bg-gray-200 rounded animate-pulse" /></td>
    </tr>
);

const CooperativeRegistry: React.FC = () => {
    const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState<CooperativeSeedResult | null>(null);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [countyFilter, setCountyFilter] = useState('All');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getCooperatives();
            setCooperatives(res.data.data || []);
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Failed to load cooperatives. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSeed = async () => {
        setSeeding(true);
        setError('');
        setSeedResult(null);
        try {
            const res = await seedCooperatives();
            setSeedResult(res.data.data);
            await load();
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Seeding failed. Make sure you are logged in as an ADMIN.');
        } finally {
            setSeeding(false);
        }
    };

    const counties = useMemo(
        () => Array.from(new Set(cooperatives.map((c) => c.county).filter((c): c is string => !!c))).sort(),
        [cooperatives]
    );

    const totalMembership = useMemo(
        () => cooperatives.reduce((sum, c) => sum + (c.membershipTotal || 0), 0),
        [cooperatives]
    );

    const filtered = cooperatives.filter((c) => {
        const matchesSearch =
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.county || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCounty = countyFilter === 'All' || c.county === countyFilter;
        return matchesSearch && matchesCounty;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Cooperative Registry (CDA)</h1>
                    <p className="text-sm text-brand-muted mt-1">
                        Official CDA (Cooperative Development Agency) list, used by the Cooperative field on
                        farmer registration (mobile app and Register Farmer form).
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleSeed}
                    disabled={seeding}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-green text-white text-sm font-semibold hover:bg-brand-green-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
                >
                    {seeding ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                    {seeding ? 'Seeding…' : 'Seed / Refresh Registry'}
                </button>
            </div>

            {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3.5 text-sm">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {seedResult && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg p-3.5 text-sm">
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                    <span>
                        Seed complete: <b>{seedResult.created}</b> created, <b>{seedResult.updated}</b> updated,{' '}
                        <b>{seedResult.total}</b> total cooperatives now in the registry.
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    icon={<Building2 className="h-5 w-5 text-brand-green" />}
                    label="Cooperatives"
                    value={loading ? '—' : cooperatives.length}
                    accent="bg-green-50"
                />
                <StatCard
                    icon={<MapPinned className="h-5 w-5 text-blue-600" />}
                    label="Counties Covered"
                    value={loading ? '—' : counties.length}
                    accent="bg-blue-50"
                />
                <StatCard
                    icon={<Users2 className="h-5 w-5 text-amber-600" />}
                    label="Total Membership"
                    value={loading ? '—' : totalMembership.toLocaleString()}
                    accent="bg-amber-50"
                />
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
                            placeholder="Search by cooperative or county name"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={countyFilter}
                        onChange={(e) => setCountyFilter(e.target.value)}
                        className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    >
                        <option value="All">All Counties</option>
                        {counties.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>

                {!loading && error && cooperatives.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button
                            onClick={load}
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
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Cooperative
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        County
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Commodities
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Membership
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <>
                                        <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
                                    </>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                                            {cooperatives.length === 0 ? (
                                                <>
                                                    No cooperatives found. Click <b>Seed / Refresh Registry</b> above to
                                                    load the official 95-cooperative CDA list.
                                                </>
                                            ) : (
                                                'No cooperatives match your search.'
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((c) => (
                                        <tr key={c.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0">
                                                        <Building2 className="h-5 w-5 text-brand-green" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="text-sm font-medium text-gray-900">{c.name}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {c.county || <span className="text-gray-400">—</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {(c.commodities || []).length > 0 ? (
                                                        (c.commodities || []).map((name, i) => (
                                                            <span
                                                                key={`${name}-${i}`}
                                                                className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-700"
                                                            >
                                                                {name}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-700">
                                                {c.membershipTotal ?? <span className="text-gray-400 font-normal">—</span>}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && filtered.length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-500">
                        Showing <b>{filtered.length}</b> of <b>{cooperatives.length}</b> cooperative(s)
                    </div>
                )}
            </div>
        </div>
    );
};

export default CooperativeRegistry;

import React, { useEffect, useState } from 'react';
import { RefreshCw, Database, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getCooperatives, seedCooperatives, type Cooperative, type CooperativeSeedResult } from '../../api/cooperatives';

/**
 * Admin-only utility page for the real CDA (Cooperative Development
 * Agency) cooperative registry (backend Cooperative entity, 95 records
 * parsed from the official "CDA COOPERATIVE LISTING 2025" letter).
 *
 * Exists primarily to make "seed/refresh the production registry" a
 * one-click action from inside the already-authenticated admin panel,
 * instead of needing curl/Postman + a manually fetched Bearer token.
 * Idempotent on the backend (upserts by slug) - safe to click more than
 * once, e.g. after the registry data is corrected and redeployed.
 */
const CooperativeRegistry: React.FC = () => {
    const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState<CooperativeSeedResult | null>(null);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getCooperatives();
            setCooperatives(res.data.data || []);
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Failed to load cooperatives.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

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

    const countyBreakdown = cooperatives.reduce<Record<string, number>>((acc, c) => {
        const key = c.county || 'Unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Cooperative Registry (CDA)</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Official CDA (Cooperative Development Agency) cooperative list, used by the
                        Cooperative field on farmer registration (mobile app and Register Farmer form).
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleSeed}
                    disabled={seeding}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {seeding ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                    {seeding ? 'Seeding...' : 'Seed / Refresh Registry'}
                </button>
            </div>

            {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {seedResult && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-md p-3 text-sm">
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                    <span>
                        Seed complete: <b>{seedResult.created}</b> created, <b>{seedResult.updated}</b> updated,{' '}
                        <b>{seedResult.total}</b> total cooperatives now in the registry.
                    </span>
                </div>
            )}

            <div className="bg-white shadow rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700">
                        {loading ? 'Loading...' : `${cooperatives.length} cooperative(s) currently in the database`}
                    </h2>
                </div>

                {!loading && cooperatives.length === 0 && (
                    <p className="text-sm text-gray-500">
                        No cooperatives found. Click "Seed / Refresh Registry" above to load the official
                        95-cooperative CDA list.
                    </p>
                )}

                {!loading && cooperatives.length > 0 && (
                    <>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {Object.entries(countyBreakdown)
                                .sort((a, b) => b[1] - a[1])
                                .map(([county, count]) => (
                                    <span key={county} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                        {county}: {count}
                                    </span>
                                ))}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500">County</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500">Commodities</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500">Membership</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {cooperatives.map((c) => (
                                        <tr key={c.id}>
                                            <td className="px-3 py-2">{c.name}</td>
                                            <td className="px-3 py-2">{c.county || '—'}</td>
                                            <td className="px-3 py-2">{(c.commodities || []).join(', ') || '—'}</td>
                                            <td className="px-3 py-2">{c.membershipTotal ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CooperativeRegistry;

import React, { useEffect, useState } from 'react';
import { getAllBatches } from '../../api/batches';
import { getAllBusinesses } from '../../api/business';
import { createTransfer, getAuditDashboard, type Transfer, type TransferType } from '../../api/transfers';
import { Truck, Plus } from 'lucide-react';

const ChainOfCustody: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'record' | 'audit'>('record');
    const [batches, setBatches] = useState<any[]>([]);
    const [businesses, setBusinesses] = useState<any[]>([]);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [summary, setSummary] = useState({ totalTransfers: 0, totalQuantityKg: 0 });
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [form, setForm] = useState({
        batchId: '',
        fromBusinessId: '',
        fromFarmerId: '',
        toBusinessId: '',
        quantityKg: '',
        transferDate: new Date().toISOString().split('T')[0],
        type: 'PURCHASE' as TransferType,
        notes: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getAllBatches().then(r => r.data.status && setBatches(r.data.data));
        getAllBusinesses().then(r => r.data.status && setBusinesses(r.data.data));
    }, []);

    useEffect(() => {
        if (activeTab === 'audit') {
            setLoading(true);
            const params: Record<string, string> = {};
            Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
            getAuditDashboard(params)
                .then(r => {
                    if (r.data.status && r.data.data) {
                        setTransfers(r.data.data.transfers || []);
                        setSummary(r.data.data.summary || { totalTransfers: 0, totalQuantityKg: 0 });
                    }
                })
                .catch(() => { setTransfers([]); setSummary({ totalTransfers: 0, totalQuantityKg: 0 }); })
                .finally(() => setLoading(false));
        }
    }, [activeTab, filters.batchId, filters.startDate, filters.endDate, filters.fromBusinessId, filters.toBusinessId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.batchId || !form.quantityKg || !form.transferDate || !form.type) return;
        setLoading(true);
        try {
            await createTransfer({
                batchId: form.batchId,
                fromBusinessId: form.fromBusinessId || undefined,
                fromFarmerId: form.fromFarmerId || undefined,
                toBusinessId: form.toBusinessId || undefined,
                quantityKg: parseFloat(form.quantityKg),
                transferDate: form.transferDate,
                type: form.type,
                notes: form.notes || undefined
            });
            alert('Transfer recorded successfully');
            setForm({ ...form, quantityKg: '', notes: '' });
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to record transfer');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Truck className="w-7 h-7 text-green-600" />
                Chain of Custody
            </h1>

            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('record')}
                    className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'record' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                    Record Transfer
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'audit' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                    Audit Dashboard
                </button>
            </div>

            {activeTab === 'record' && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5" /> Record Purchase or Custody Transfer
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Batch</label>
                            <select
                                required
                                value={form.batchId}
                                onChange={e => setForm({ ...form, batchId: e.target.value })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            >
                                <option value="">Select batch</option>
                                {batches.map(b => (
                                    <option key={b.id} value={b.id}>{b.batchId} ({b.cropType}, {b.weightKg}kg)</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Transfer Type</label>
                            <select
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value as TransferType })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            >
                                <option value="PURCHASE">Purchase (from farmer to buyer)</option>
                                <option value="HANDOVER">Handover (between businesses)</option>
                                <option value="RECEIVE">Receive</option>
                            </select>
                        </div>
                        {form.type !== 'PURCHASE' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">From Business</label>
                                <select
                                    value={form.fromBusinessId}
                                    onChange={e => setForm({ ...form, fromBusinessId: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                >
                                    <option value="">Select business</option>
                                    {businesses.map(b => (
                                        <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">To Business</label>
                            <select
                                value={form.toBusinessId}
                                onChange={e => setForm({ ...form, toBusinessId: e.target.value })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            >
                                <option value="">Select business</option>
                                {businesses.map(b => (
                                    <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Quantity (kg)</label>
                                <input
                                    type="number"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    value={form.quantityKg}
                                    onChange={e => setForm({ ...form, quantityKg: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date</label>
                                <input
                                    type="date"
                                    required
                                    value={form.transferDate}
                                    onChange={e => setForm({ ...form, transferDate: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
                            <input
                                type="text"
                                value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                            {loading ? 'Recording...' : 'Record Transfer'}
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex flex-wrap gap-4 items-center">
                        <h3 className="text-lg font-medium text-gray-900">Audit Dashboard</h3>
                        <div className="flex gap-2 flex-wrap">
                            <input
                                type="text"
                                placeholder="Batch ID"
                                value={filters.batchId || ''}
                                onChange={e => setFilters({ ...filters, batchId: e.target.value })}
                                className="rounded-md border-gray-300 text-sm w-32"
                            />
                            <input
                                type="date"
                                placeholder="Start"
                                value={filters.startDate || ''}
                                onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                                className="rounded-md border-gray-300 text-sm"
                            />
                            <input
                                type="date"
                                value={filters.endDate || ''}
                                onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                                className="rounded-md border-gray-300 text-sm"
                            />
                            <span className="text-sm text-gray-600">
                                Total: {summary.totalTransfers} transfers, {summary.totalQuantityKg.toFixed(1)} kg
                            </span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty (kg)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transfers.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-900">{new Date(t.transferDate).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-sm"><span className="px-2 py-1 rounded text-xs bg-gray-100">{t.type}</span></td>
                                        <td className="px-4 py-3 text-sm">{(t.batch as any)?.batchId || t.batchId}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {t.fromFarmer ? `Farmer: ${t.fromFarmer.firstName} ${t.fromFarmer.lastName}` : (t.fromBusiness as any)?.name || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">{(t.toBusiness as any)?.name || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-right">{t.quantityKg}</td>
                                    </tr>
                                ))}
                                {transfers.length === 0 && !loading && (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No transfers found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChainOfCustody;

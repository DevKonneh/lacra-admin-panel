import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Truck, X } from 'lucide-react';
import type { SupplierRecord } from '../../pages/apply/types';
import { COMMODITY_LABELS } from '../../pages/apply/types';
import ResponsiveTable, { type ColumnDef } from './ResponsiveTable';
import FormField from './FormField';
import { TextInput, SelectInput } from './inputs';
import CountyDistrictFields from './CountyDistrictFields';

function emptySupplier(): SupplierRecord {
    return {
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        supplierType: '', supplierName: '', permitNumber: '', commodity: '',
        county: '', district: '', contact: '',
    };
}

const SUPPLIER_TYPES = ['Registered Agent', 'Agency', 'Cooperative', 'Individual Farmer', 'Other'];

interface SupplierManagerProps {
    records: SupplierRecord[];
    onChange: (records: SupplierRecord[]) => void;
}

// Exporter Export Operations: repeatable commodity-supplier section.
// Allows exporters to list every registered agent/agency/cooperative
// supplying them, with a LACRA permit number for traceability.
const SupplierManager: React.FC<SupplierManagerProps> = ({ records, onChange }) => {
    const [editing, setEditing] = useState<SupplierRecord | null>(null);

    const startAdd = () => setEditing(emptySupplier());
    const startEdit = (record: SupplierRecord) => setEditing({ ...record });
    const cancelEdit = () => setEditing(null);

    const saveEdit = () => {
        if (!editing) return;
        if (!editing.supplierName || !editing.supplierType) return;
        const exists = records.some((r) => r.id === editing.id);
        onChange(exists ? records.map((r) => (r.id === editing.id ? editing : r)) : [...records, editing]);
        setEditing(null);
    };

    const removeRecord = (id: string) => onChange(records.filter((r) => r.id !== id));

    const columns: ColumnDef<SupplierRecord>[] = [
        { header: 'Supplier Type', render: (r) => r.supplierType || '—' },
        { header: 'Supplier Name', render: (r) => r.supplierName },
        { header: 'LACRA Permit No.', render: (r) => r.permitNumber || '—' },
        { header: 'Commodity', render: (r) => r.commodity || '—' },
        { header: 'County', render: (r) => r.county || '—' },
    ];

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">Commodity Suppliers</h3>
                    <p className="text-xs text-slate-500 mt-0.5">List every registered agent, agency or cooperative supplying commodities for export.</p>
                </div>
                {!editing && (
                    <button
                        type="button"
                        onClick={startAdd}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover transition-colors"
                    >
                        <Plus size={16} /> Add Supplier
                    </button>
                )}
            </div>

            <ResponsiveTable
                columns={columns}
                rows={records}
                rowKey={(r) => r.id}
                emptyIcon={<Truck size={20} />}
                emptyTitle="No suppliers added yet"
                emptyDescription='Click "Add Supplier" to register each commodity source.'
                actions={(r) => (
                    <div className="flex items-center gap-1 justify-end">
                        <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-brand-green" title="Edit">
                            <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => removeRecord(r.id)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600" title="Remove">
                            <Trash2 size={15} />
                        </button>
                    </div>
                )}
            />

            {editing && (
                <div className="mt-4 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-800">
                            {records.some((r) => r.id === editing.id) ? 'Edit Supplier' : 'Add Supplier'}
                        </p>
                        <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Supplier Type" required>
                            <SelectInput value={editing.supplierType} onChange={(e) => setEditing({ ...editing, supplierType: e.target.value })}>
                                <option value="">Select...</option>
                                {SUPPLIER_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </SelectInput>
                        </FormField>
                        <FormField label="Supplier Name" required>
                            <TextInput value={editing.supplierName} onChange={(e) => setEditing({ ...editing, supplierName: e.target.value })} />
                        </FormField>
                        <FormField label="LACRA Permit Number" hint="If the supplier is a registered LACRA permit/licence holder">
                            <TextInput value={editing.permitNumber} onChange={(e) => setEditing({ ...editing, permitNumber: e.target.value })} />
                        </FormField>
                        <FormField label="Commodity Supplied">
                            <SelectInput value={editing.commodity} onChange={(e) => setEditing({ ...editing, commodity: e.target.value })}>
                                <option value="">Select...</option>
                                {Object.values(COMMODITY_LABELS).map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </SelectInput>
                        </FormField>
                        <CountyDistrictFields
                            county={editing.county}
                            district={editing.district}
                            onChange={(county, district) => setEditing({ ...editing, county, district })}
                            idPrefix={`supplier-${editing.id}`}
                            countyRequired={false}
                        />
                        <FormField label="Contact Information" full>
                            <TextInput value={editing.contact} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} placeholder="Phone number or email" />
                        </FormField>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={saveEdit}
                            disabled={!editing.supplierName || !editing.supplierType}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-50"
                        >
                            Save Supplier
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplierManager;

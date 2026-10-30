import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Users, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { OwnerRecord, IdType } from '../../pages/apply/types';
import ResponsiveTable, { type ColumnDef } from './ResponsiveTable';
import FormField from './FormField';
import { TextInput, SelectInput } from './inputs';
import DocumentUpload from './DocumentUpload';
import PhoneInput from './PhoneInput';

function emptyOwner(): OwnerRecord {
    return {
        id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fullName: '', nationality: 'Liberian', idType: '', idNumber: '',
        ownershipPercent: '', phone: '', email: '', citizenshipProof: null,
    };
}

interface OwnerManagerProps {
    records: OwnerRecord[];
    onChange: (records: OwnerRecord[]) => void;
}

// Exporter Ownership Information: repeatable shareholder/owner section.
// Total ownership percentage across all owners must equal exactly 100% -
// this is enforced both as a live running total shown to the applicant
// and as a hard validation error once records exist but don't sum
// correctly, satisfying "cannot exceed or fall below 100%".
const OwnerManager: React.FC<OwnerManagerProps> = ({ records, onChange }) => {
    const [editing, setEditing] = useState<OwnerRecord | null>(null);
    const [formError, setFormError] = useState('');

    const startAdd = () => setEditing(emptyOwner());
    const startEdit = (record: OwnerRecord) => setEditing({ ...record });
    const cancelEdit = () => { setEditing(null); setFormError(''); };

    const totalPercent = records.reduce((sum, r) => sum + (typeof r.ownershipPercent === 'number' ? r.ownershipPercent : 0), 0);
    const totalWithEditing = editing
        ? records.filter((r) => r.id !== editing.id).reduce((sum, r) => sum + (typeof r.ownershipPercent === 'number' ? r.ownershipPercent : 0), 0) +
          (typeof editing.ownershipPercent === 'number' ? editing.ownershipPercent : 0)
        : totalPercent;

    const isLocal = (owner: OwnerRecord) => owner.nationality.trim().toLowerCase() === 'liberian';

    const saveEdit = () => {
        if (!editing) return;
        if (!editing.fullName || !editing.idNumber || editing.ownershipPercent === '') {
            setFormError('Full name, ID number and ownership percentage are required.');
            return;
        }
        const pct = Number(editing.ownershipPercent);
        if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
            setFormError('Ownership percentage must be a number between 0 and 100.');
            return;
        }
        const dup = records.some((r) => r.id !== editing.id && r.idNumber.trim() === editing.idNumber.trim() && editing.idNumber.trim() !== '');
        if (dup) {
            setFormError('This ID/passport number is already used by another owner.');
            return;
        }

        const exists = records.some((r) => r.id === editing.id);
        onChange(exists ? records.map((r) => (r.id === editing.id ? editing : r)) : [...records, editing]);
        setEditing(null);
        setFormError('');
    };

    const removeRecord = (id: string) => onChange(records.filter((r) => r.id !== id));

    const columns: ColumnDef<OwnerRecord>[] = [
        { header: 'Full Name', render: (r) => r.fullName },
        { header: 'Nationality', render: (r) => r.nationality || '—' },
        { header: 'ID Number', render: (r) => r.idNumber },
        {
            header: 'Ownership %',
            render: (r) => <span className="font-semibold">{r.ownershipPercent === '' ? '—' : `${r.ownershipPercent}%`}</span>,
        },
    ];

    const percentGood = records.length > 0 && totalPercent === 100;
    const percentBad = records.length > 0 && totalPercent !== 100;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">Ownership Information</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Add every shareholder/owner. Ownership percentages must total exactly 100%.</p>
                </div>
                {!editing && (
                    <button
                        type="button"
                        onClick={startAdd}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover transition-colors"
                    >
                        <Plus size={16} /> Add Owner
                    </button>
                )}
            </div>

            <ResponsiveTable
                columns={columns}
                rows={records}
                rowKey={(r) => r.id}
                emptyIcon={<Users size={20} />}
                emptyTitle="No owners added yet"
                emptyDescription='Click "Add Owner" to register each shareholder. Percentages must add up to 100%.'
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

            {records.length > 0 && (
                <div
                    className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                        percentGood ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                >
                    {percentGood ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    Total ownership: {totalPercent}% {percentBad && '— must total exactly 100% before you can continue.'}
                </div>
            )}

            {editing && (
                <div className="mt-4 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-800">
                            {records.some((r) => r.id === editing.id) ? 'Edit Owner' : 'Add Owner'}
                        </p>
                        <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Full Name" required>
                            <TextInput value={editing.fullName} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} />
                        </FormField>
                        <FormField label="Nationality" required>
                            <TextInput value={editing.nationality} onChange={(e) => setEditing({ ...editing, nationality: e.target.value })} />
                        </FormField>
                        <FormField label="ID Type" required>
                            <SelectInput value={editing.idType} onChange={(e) => setEditing({ ...editing, idType: e.target.value as IdType })}>
                                <option value="">Select...</option>
                                <option value="NATIONAL_ID">National ID</option>
                                <option value="PASSPORT">Passport</option>
                            </SelectInput>
                        </FormField>
                        <FormField label="National ID / Passport Number" required error={formError && formError.includes('ID/passport') ? formError : undefined}>
                            <TextInput value={editing.idNumber} onChange={(e) => { setEditing({ ...editing, idNumber: e.target.value }); setFormError(''); }} />
                        </FormField>
                        <FormField
                            label="Ownership Percentage"
                            required
                            tooltip="The combined ownership percentage of all owners listed must equal exactly 100%."
                            hint={`Running total (including this owner): ${totalWithEditing}%`}
                        >
                            <TextInput
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={editing.ownershipPercent}
                                onChange={(e) => { setEditing({ ...editing, ownershipPercent: e.target.value === '' ? '' : Number(e.target.value) }); setFormError(''); }}
                            />
                        </FormField>
                        <FormField label="Phone Number">
                            <PhoneInput value={editing.phone} onChange={(v) => setEditing({ ...editing, phone: v })} />
                        </FormField>
                        <FormField label="Email Address" full>
                            <TextInput type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                        </FormField>
                        {isLocal(editing) && (
                            <div className="sm:col-span-2">
                                <DocumentUpload
                                    label="Proof of Liberian Citizenship"
                                    required
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    acceptDisplay="PDF, JPG, PNG"
                                    maxSizeMb={5}
                                    helpText="Required for local (Liberian) owners"
                                    value={editing.citizenshipProof}
                                    onChange={(f) => setEditing({ ...editing, citizenshipProof: f })}
                                />
                            </div>
                        )}
                    </div>

                    {formError && !formError.includes('ID/passport') && (
                        <p className="mt-3 text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={13} /> {formError}</p>
                    )}

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={saveEdit}
                            disabled={!editing.fullName || !editing.idNumber || editing.ownershipPercent === ''}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-50"
                        >
                            Save Owner
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OwnerManager;

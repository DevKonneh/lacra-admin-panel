import React, { useState } from 'react';
import { Plus, Pencil, Trash2, UserRound, X } from 'lucide-react';
import type { PersonnelRecord, PersonnelStatus } from '../../pages/apply/types';
import ResponsiveTable, { type ColumnDef } from './ResponsiveTable';
import FormField from './FormField';
import { TextInput, SelectInput } from './inputs';
import CountyDistrictFields from './CountyDistrictFields';
import DocumentUpload from './DocumentUpload';
import PhoneInput from './PhoneInput';

function emptyPersonnel(role: string): PersonnelRecord {
    return {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role, fullName: '', nationalId: '', phone: '', email: '',
        county: '', district: '', community: '', address: '',
        photo: null, startDate: '', status: 'ACTIVE',
    };
}

interface PersonnelManagerProps {
    title: string;
    description: string;
    records: PersonnelRecord[];
    onChange: (records: PersonnelRecord[]) => void;
    // If roleOptions is provided, the role field is a fixed dropdown
    // (used for the Agency/Cooperative "3 Buyers + 1 Clerk" requirement).
    // If omitted, role is a free-text position field (used for leadership).
    roleOptions?: string[];
    freeRoleLabel?: string; // e.g. "Leadership Position"
    // Optional display-only label override per roleOptions value (the
    // STORED value, e.g. "Clerk", is unchanged so it keeps matching the
    // backend's AgentPersonnelRole.CLERK / AgencyStaffingService role
    // checks exactly) — lets the dropdown show "Weighing Clerk" per
    // LACRA's exact regulation wording without touching the underlying
    // role string anywhere else in the codebase.
    roleLabels?: Record<string, string>;
    // When true, renders ONLY the 3 fields LACRA's regulation actually asks
    // for on the "Linked Persons" roster (Full name, Liberian ID/passport
    // number, Phone number) — omitting email, start date, county/district/
    // community/address and the per-person photo upload, which are not
    // part of that spec. Passport-size photos for these 3 buyers + 1 clerk
    // are instead collected as their own separate Required Document
    // checklist items (see documentRequirements.ts), not per-person here.
    // Status still defaults to ACTIVE internally (no UI control) since the
    // backend staffing check (AgencyStaffingService) still needs every
    // wizard-submitted record treated as active. Used for the Agency/
    // Cooperative "3 Buyers + 1 Clerk" roster only — Cooperative Leadership
    // keeps the full field set since it isn't covered by this spec.
    simple?: boolean;
}

// Reusable repeatable-personnel section: renders existing records in a
// responsive table/card list, and an add/edit form (inline, not a modal,
// so it stays simple and fully visible/keyboard-navigable) for creating
// or updating a single record at a time. Used for Agency/Cooperative
// personnel (3 Agents + 1 Clerk) and Cooperative leadership.
const PersonnelManager: React.FC<PersonnelManagerProps> = ({
    title, description, records, onChange, roleOptions, freeRoleLabel = 'Position', roleLabels, simple = false,
}) => {
    const [editing, setEditing] = useState<PersonnelRecord | null>(null);
    const [duplicateIdError, setDuplicateIdError] = useState('');

    const startAdd = () => setEditing(emptyPersonnel(roleOptions ? roleOptions[0] : ''));
    const startEdit = (record: PersonnelRecord) => setEditing({ ...record });
    const cancelEdit = () => { setEditing(null); setDuplicateIdError(''); };

    const saveEdit = () => {
        if (!editing) return;
        if (!editing.fullName || !editing.nationalId || !editing.phone) return;

        // Duplicate National ID detection across all OTHER records in this list.
        const dup = records.some((r) => r.id !== editing.id && r.nationalId.trim() === editing.nationalId.trim() && editing.nationalId.trim() !== '');
        if (dup) {
            setDuplicateIdError('This National ID number is already used by another person in this list.');
            return;
        }

        const exists = records.some((r) => r.id === editing.id);
        onChange(exists ? records.map((r) => (r.id === editing.id ? editing : r)) : [...records, editing]);
        setEditing(null);
        setDuplicateIdError('');
    };

    const removeRecord = (id: string) => {
        onChange(records.filter((r) => r.id !== id));
    };

    const columns: ColumnDef<PersonnelRecord>[] = [
        { header: roleOptions ? 'Role' : freeRoleLabel, render: (r) => roleLabels?.[r.role] || r.role || '—' },
        { header: 'Full Name', render: (r) => r.fullName },
        { header: 'Liberian ID / Passport Number', render: (r) => r.nationalId },
        { header: 'Phone', render: (r) => r.phone },
        ...(simple
            ? []
            : [
                  {
                      header: 'Status',
                      render: (r: PersonnelRecord) => (
                          <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  r.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : r.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                              }`}
                          >
                              {r.status}
                          </span>
                      ),
                  },
              ]),
    ];

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                </div>
                {!editing && (
                    <button
                        type="button"
                        onClick={startAdd}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover transition-colors"
                    >
                        <Plus size={16} /> Add Person
                    </button>
                )}
            </div>

            <ResponsiveTable
                columns={columns}
                rows={records}
                rowKey={(r) => r.id}
                emptyIcon={<UserRound size={20} />}
                emptyTitle="No personnel added yet"
                emptyDescription='Click "Add Person" to register the required personnel for this section.'
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
                            {records.some((r) => r.id === editing.id) ? 'Edit Person' : 'Add Person'}
                        </p>
                        <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {roleOptions ? (
                            <FormField label="Personnel Role" required>
                                <SelectInput value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                                    {roleOptions.map((r) => (
                                        <option key={r} value={r}>{roleLabels?.[r] || r}</option>
                                    ))}
                                </SelectInput>
                            </FormField>
                        ) : (
                            <FormField label={freeRoleLabel} required>
                                <TextInput value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} placeholder="e.g. Chairperson, Secretary" />
                            </FormField>
                        )}
                        <FormField label="Full Name" required>
                            <TextInput value={editing.fullName} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} />
                        </FormField>
                        <FormField label="Liberian ID / Passport Number" required error={duplicateIdError}>
                            <TextInput value={editing.nationalId} onChange={(e) => { setEditing({ ...editing, nationalId: e.target.value }); setDuplicateIdError(''); }} />
                        </FormField>
                        <FormField label="Phone Number" required>
                            <PhoneInput value={editing.phone} onChange={(v) => setEditing({ ...editing, phone: v })} />
                        </FormField>
                        {!simple && (
                            <>
                                <FormField label="Email Address">
                                    <TextInput type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                                </FormField>
                                <FormField label="Effective / Start Date">
                                    <TextInput type="date" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
                                </FormField>
                                <CountyDistrictFields
                                    county={editing.county}
                                    district={editing.district}
                                    onChange={(county, district) => setEditing({ ...editing, county, district })}
                                    idPrefix={`personnel-${editing.id}`}
                                />
                                <FormField label="Community">
                                    <TextInput value={editing.community} onChange={(e) => setEditing({ ...editing, community: e.target.value })} />
                                </FormField>
                                <FormField label="Complete Address" full>
                                    <TextInput value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
                                </FormField>
                                <FormField label="Status">
                                    <SelectInput value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as PersonnelStatus })}>
                                        <option value="ACTIVE">Active</option>
                                        <option value="INACTIVE">Inactive</option>
                                        <option value="PENDING">Pending</option>
                                    </SelectInput>
                                </FormField>
                                <div className="sm:col-span-2">
                                    <DocumentUpload
                                        label="Passport-size Photograph"
                                        required
                                        accept=".jpg,.jpeg,.png"
                                        acceptDisplay="JPG, PNG"
                                        maxSizeMb={2}
                                        value={editing.photo}
                                        onChange={(f) => setEditing({ ...editing, photo: f })}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={saveEdit}
                            disabled={!editing.fullName || !editing.nationalId || !editing.phone}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-50"
                        >
                            Save Person
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonnelManager;

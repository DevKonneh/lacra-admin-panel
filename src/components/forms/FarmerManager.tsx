import React, { useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Users, X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { FarmerRecord } from '../../pages/apply/types';
import { COMMODITY_LABELS } from '../../pages/apply/types';
import ResponsiveTable, { type ColumnDef } from './ResponsiveTable';
import FormField from './FormField';
import { TextInput, SelectInput } from './inputs';
import CountyDistrictFields from './CountyDistrictFields';
import PhoneInput from './PhoneInput';
import Alert from './Alert';

function emptyFarmer(): FarmerRecord {
    return {
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        memberId: '', fullName: '', gender: '', phone: '',
        county: '', district: '', community: '', commodity: '', gps: '',
    };
}

const CSV_HEADER_LABELS = ['Member ID', 'Full Name', 'Gender', 'Phone', 'County', 'District', 'Community', 'Commodity', 'GPS Coordinates'];

// Minimal CSV parser (handles quoted fields containing commas). No extra
// dependency is added for this phase - the applicant is provided a fixed
// template so a simple, predictable parser is sufficient. True .xls/.xlsx
// binary parsing would require a dedicated library; those files are
// accepted for the *document upload* (Step 5) but for this in-form quick
// import we ask applicants to use the CSV template.
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += char;
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            if (row.some((c) => c.trim() !== '')) rows.push(row);
            row = [];
        } else {
            field += char;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        if (row.some((c) => c.trim() !== '')) rows.push(row);
    }
    return rows;
}

function downloadCsvTemplate() {
    const header = CSV_HEADER_LABELS.join(',');
    const example = 'MEM-001,Jane Doe,Female,+231 770 000 001,Nimba,Sanniquellie-Mahn,Gbeyanlay,Cocoa,7.3667 -8.6500';
    const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'farmer_member_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

interface PreviewRow {
    data: FarmerRecord;
    errors: string[];
}

interface FarmerManagerProps {
    records: FarmerRecord[];
    onChange: (records: FarmerRecord[]) => void;
}

// Cooperative Farmer/Member repeatable section. Supports adding farmers
// one-by-one (inline form, same interaction pattern as PersonnelManager)
// OR bulk-importing via a CSV file, with a downloadable template and a
// mandatory preview-before-accept step that flags row-level problems
// (missing required fields, duplicate Member ID either within the file or
// against records already in the list) before anything is added.
const FarmerManager: React.FC<FarmerManagerProps> = ({ records, onChange }) => {
    const [editing, setEditing] = useState<FarmerRecord | null>(null);
    const [duplicateError, setDuplicateError] = useState('');
    const [showBulk, setShowBulk] = useState(false);
    const [preview, setPreview] = useState<PreviewRow[] | null>(null);
    const [fileError, setFileError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const startAdd = () => { setEditing(emptyFarmer()); setShowBulk(false); };
    const startEdit = (record: FarmerRecord) => { setEditing({ ...record }); setShowBulk(false); };
    const cancelEdit = () => { setEditing(null); setDuplicateError(''); };

    const isDuplicate = (candidate: FarmerRecord, others: FarmerRecord[]) => {
        return others.some((r) => {
            if (r.id === candidate.id) return false;
            const sameMemberId = candidate.memberId.trim() !== '' && r.memberId.trim().toLowerCase() === candidate.memberId.trim().toLowerCase();
            const sameNamePhone = candidate.fullName.trim() !== '' && r.fullName.trim().toLowerCase() === candidate.fullName.trim().toLowerCase() && r.phone.trim() === candidate.phone.trim() && candidate.phone.trim() !== '';
            return sameMemberId || sameNamePhone;
        });
    };

    const saveEdit = () => {
        if (!editing) return;
        if (!editing.fullName || !editing.phone) return;
        if (isDuplicate(editing, records)) {
            setDuplicateError('A farmer/member with this Member ID (or the same name and phone) is already on the list.');
            return;
        }
        const exists = records.some((r) => r.id === editing.id);
        onChange(exists ? records.map((r) => (r.id === editing.id ? editing : r)) : [...records, editing]);
        setEditing(null);
        setDuplicateError('');
    };

    const removeRecord = (id: string) => onChange(records.filter((r) => r.id !== id));

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setFileError('');
        setPreview(null);

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'csv') {
            setFileError('Please upload a CSV file. If your farmer list is in Excel, save it as "CSV (Comma delimited)" first and upload that file, or use the downloadable template below.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result || '');
            const rows = parseCsv(text);
            if (rows.length === 0) {
                setFileError('The file appears to be empty.');
                return;
            }
            // Detect and skip a header row if the first cell looks like our known header label.
            const first = rows[0].map((c) => c.trim().toLowerCase());
            const looksLikeHeader = first[0] === 'member id' || first[0] === 'memberid';
            const dataRows = looksLikeHeader ? rows.slice(1) : rows;

            const built: PreviewRow[] = [];
            const seenInFile = new Set<string>();

            dataRows.forEach((cols) => {
                const get = (i: number) => (cols[i] || '').trim();
                const rec: FarmerRecord = {
                    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    memberId: get(0),
                    fullName: get(1),
                    gender: (get(2) === 'Male' || get(2) === 'Female') ? get(2) as 'Male' | 'Female' : '',
                    phone: get(3),
                    county: get(4),
                    district: get(5),
                    community: get(6),
                    commodity: get(7),
                    gps: get(8),
                };
                const errors: string[] = [];
                if (!rec.fullName) errors.push('Missing full name');
                if (!rec.phone) errors.push('Missing phone number');
                const key = (rec.memberId || `${rec.fullName}|${rec.phone}`).toLowerCase();
                if (rec.memberId && seenInFile.has(rec.memberId.toLowerCase())) errors.push('Duplicate Member ID within this file');
                if (isDuplicate(rec, records)) errors.push('Already exists in the current list');
                seenInFile.add(key);
                built.push({ data: rec, errors });
            });

            if (built.length === 0) {
                setFileError('No data rows were found in this file.');
                return;
            }
            setPreview(built);
        };
        reader.readAsText(file);
    };

    const acceptPreview = () => {
        if (!preview) return;
        const validRows = preview.filter((p) => p.errors.length === 0).map((p) => p.data);
        onChange([...records, ...validRows]);
        setPreview(null);
        setShowBulk(false);
    };

    const validCount = preview?.filter((p) => p.errors.length === 0).length ?? 0;
    const invalidCount = (preview?.length ?? 0) - validCount;

    const columns: ColumnDef<FarmerRecord>[] = [
        { header: 'Member ID', render: (r) => r.memberId || '—' },
        { header: 'Full Name', render: (r) => r.fullName },
        { header: 'Phone', render: (r) => r.phone },
        { header: 'Commodity', render: (r) => r.commodity || '—' },
        { header: 'County', render: (r) => r.county || '—' },
    ];

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">Farmer / Member Records</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Add cooperative members individually, or import a list using the CSV template.</p>
                </div>
                {!editing && !showBulk && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowBulk(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                            <Upload size={16} /> Bulk Upload
                        </button>
                        <button
                            type="button"
                            onClick={startAdd}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover transition-colors"
                        >
                            <Plus size={16} /> Add Farmer
                        </button>
                    </div>
                )}
            </div>

            <ResponsiveTable
                columns={columns}
                rows={records}
                rowKey={(r) => r.id}
                emptyIcon={<Users size={20} />}
                emptyTitle="No farmers or members added yet"
                emptyDescription='Click "Add Farmer" to add one record, or "Bulk Upload" to import a CSV list.'
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
                <p className="mt-3 text-xs text-slate-500">{records.length} farmer/member record(s) on file.</p>
            )}

            {/* Bulk upload panel */}
            {showBulk && (
                <div className="mt-4 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-800">Bulk Upload Farmer/Member List</p>
                        <button type="button" onClick={() => { setShowBulk(false); setPreview(null); setFileError(''); }} className="text-slate-400 hover:text-slate-600">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                        <button
                            type="button"
                            onClick={downloadCsvTemplate}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        >
                            <Download size={15} /> Download CSV Template
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover"
                        >
                            <FileSpreadsheet size={15} /> Choose CSV File
                        </button>
                        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                    </div>

                    <p className="text-xs text-slate-500 mb-2">
                        Columns expected: {CSV_HEADER_LABELS.join(', ')}. Fill in the template and upload it below — you will be shown a preview before any records are added.
                    </p>

                    {fileError && (
                        <Alert variant="error" title="Could not read this file">
                            {fileError}
                        </Alert>
                    )}

                    {preview && (
                        <div className="mt-3 space-y-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                    <CheckCircle2 size={13} /> {validCount} ready to import
                                </span>
                                {invalidCount > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full">
                                        <AlertTriangle size={13} /> {invalidCount} with issues (will be skipped)
                                    </span>
                                )}
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-72">
                                <table className="min-w-full divide-y divide-slate-200 text-xs">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Member ID</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Full Name</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Phone</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600">County</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Commodity</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {preview.map((p, i) => (
                                            <tr key={i} className={p.errors.length ? 'bg-red-50' : ''}>
                                                <td className="px-3 py-2">{p.data.memberId || '—'}</td>
                                                <td className="px-3 py-2">{p.data.fullName || '—'}</td>
                                                <td className="px-3 py-2">{p.data.phone || '—'}</td>
                                                <td className="px-3 py-2">{p.data.county || '—'}</td>
                                                <td className="px-3 py-2">{p.data.commodity || '—'}</td>
                                                <td className="px-3 py-2">
                                                    {p.errors.length === 0 ? (
                                                        <span className="text-green-700">OK</span>
                                                    ) : (
                                                        <span className="text-red-600">{p.errors.join('; ')}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={acceptPreview}
                                    disabled={validCount === 0}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-50"
                                >
                                    Import {validCount} Record{validCount === 1 ? '' : 's'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Single-record add/edit form */}
            {editing && (
                <div className="mt-4 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-800">
                            {records.some((r) => r.id === editing.id) ? 'Edit Farmer / Member' : 'Add Farmer / Member'}
                        </p>
                        <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Member ID" hint="Leave blank to auto-generate later">
                            <TextInput value={editing.memberId} onChange={(e) => { setEditing({ ...editing, memberId: e.target.value }); setDuplicateError(''); }} />
                        </FormField>
                        <FormField label="Full Name" required error={duplicateError}>
                            <TextInput value={editing.fullName} onChange={(e) => { setEditing({ ...editing, fullName: e.target.value }); setDuplicateError(''); }} />
                        </FormField>
                        <FormField label="Gender">
                            <SelectInput value={editing.gender} onChange={(e) => setEditing({ ...editing, gender: e.target.value as 'Male' | 'Female' | '' })}>
                                <option value="">Select...</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </SelectInput>
                        </FormField>
                        <FormField label="Phone Number" required>
                            <PhoneInput value={editing.phone} onChange={(v) => { setEditing({ ...editing, phone: v }); setDuplicateError(''); }} />
                        </FormField>
                        <CountyDistrictFields
                            county={editing.county}
                            district={editing.district}
                            onChange={(county, district) => setEditing({ ...editing, county, district })}
                            idPrefix={`farmer-${editing.id}`}
                            countyRequired={false}
                        />
                        <FormField label="Community / Address">
                            <TextInput value={editing.community} onChange={(e) => setEditing({ ...editing, community: e.target.value })} />
                        </FormField>
                        <FormField label="Commodity Produced">
                            <SelectInput value={editing.commodity} onChange={(e) => setEditing({ ...editing, commodity: e.target.value })}>
                                <option value="">Select...</option>
                                {Object.values(COMMODITY_LABELS).map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </SelectInput>
                        </FormField>
                        <FormField label="Farm Location / GPS Coordinates" hint="Where available">
                            <TextInput value={editing.gps} onChange={(e) => setEditing({ ...editing, gps: e.target.value })} placeholder="e.g. 7.3667, -8.6500" />
                        </FormField>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={saveEdit}
                            disabled={!editing.fullName || !editing.phone}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-50"
                        >
                            Save Record
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FarmerManager;

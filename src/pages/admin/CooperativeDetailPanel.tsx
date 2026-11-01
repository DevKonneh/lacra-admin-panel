import React, { useEffect, useState } from 'react';
import {
    X, Loader2, Building2, MapPin, Users2, Phone, Clock, Flag as FlagIcon,
    History, Pencil, Save, CheckCircle2,
} from 'lucide-react';
import {
    getCooperativeDetail, correctCooperative, reviewCooperativeFlag,
    type CooperativeDetail, type Cooperative,
} from '../../api/cooperatives';
import { apiErrorMessage } from '../applications/statusHelpers';
import {
    formatMembership, formatDateTime, formatDateOnly, FLAG_TYPE_LABELS, FLAG_TYPE_COLORS,
} from './cooperativeHelpers';
import Alert from '../../components/forms/Alert';
import { TextInput, TextArea } from '../../components/forms/inputs';

interface CooperativeDetailPanelProps {
    cooperativeId: string;
    isAdmin: boolean;
    onClose: () => void;
    /** Notifies the parent list that something changed (correction
     * applied, flag reviewed) so it can re-fetch the directory without
     * this panel owning the list's own data. */
    onChanged: () => void;
}

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
        <dt className="text-xs font-medium text-slate-500 flex-shrink-0">{label}</dt>
        <dd className="text-sm text-slate-800 text-right">{value}</dd>
    </div>
);

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }> = ({ title, icon, children, action }) => (
    <div className="rounded-xl border border-brand-border bg-brand-card p-4">
        <div className="flex items-center justify-between mb-2.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-text">
                <span className="text-brand-green">{icon}</span> {title}
            </h3>
            {action}
        </div>
        {children}
    </div>
);

/**
 * Editable structured fields for the manual-correction form. Separate
 * component state from `detail.cooperative` so edits can be cancelled
 * without having to re-fetch.
 */
interface EditableFields {
    name: string;
    county: string;
    district: string;
    community: string;
    address: string;
    commodities: string;
    membershipTotal: string;
    membershipMale: string;
    membershipFemale: string;
    contactName: string;
    contactRole: string;
    contactPhones: string;
}

function toEditable(c: Cooperative): EditableFields {
    return {
        name: c.name || '',
        county: c.county || '',
        district: c.district || '',
        community: c.community || '',
        address: c.address || '',
        commodities: (c.commodities || []).join(', '),
        membershipTotal: c.membershipTotal !== null && c.membershipTotal !== undefined ? String(c.membershipTotal) : '',
        membershipMale: c.membershipMale !== null && c.membershipMale !== undefined ? String(c.membershipMale) : '',
        membershipFemale: c.membershipFemale !== null && c.membershipFemale !== undefined ? String(c.membershipFemale) : '',
        contactName: c.contactName || '',
        contactRole: c.contactRole || '',
        contactPhones: (c.contactPhones || []).join(', '),
    };
}

const parseIntOrNull = (v: string): number | null => {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = parseInt(trimmed, 10);
    return Number.isNaN(n) ? null : n;
};

const CooperativeDetailPanel: React.FC<CooperativeDetailPanelProps> = ({ cooperativeId, isAdmin, onClose, onChanged }) => {
    const [detail, setDetail] = useState<CooperativeDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [editing, setEditing] = useState(false);
    const [fields, setFields] = useState<EditableFields | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');

    const [reviewingFlagId, setReviewingFlagId] = useState<string | null>(null);
    const [reviewOutcome, setReviewOutcome] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getCooperativeDetail(cooperativeId);
            setDetail(res.data.data);
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load this cooperative.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        setEditing(false);
        setSaveError('');
        setSaveSuccess('');
        setReviewingFlagId(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cooperativeId]);

    // Close on Escape for keyboard accessibility.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const startEditing = () => {
        if (!detail) return;
        setFields(toEditable(detail.cooperative));
        setSaveError('');
        setSaveSuccess('');
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
        setFields(null);
        setSaveError('');
    };

    const handleSave = async () => {
        if (!fields || !detail) return;
        setSaving(true);
        setSaveError('');
        try {
            const original = detail.cooperative;
            const payload: Record<string, unknown> = {};
            if (fields.name !== (original.name || '')) payload.name = fields.name;
            if (fields.county !== (original.county || '')) payload.county = fields.county || null;
            if (fields.district !== (original.district || '')) payload.district = fields.district || null;
            if (fields.community !== (original.community || '')) payload.community = fields.community || null;
            if (fields.address !== (original.address || '')) payload.address = fields.address || null;
            const newCommodities = fields.commodities.split(',').map((s) => s.trim()).filter(Boolean);
            if (newCommodities.join(', ') !== (original.commodities || []).join(', ')) payload.commodities = newCommodities;
            const newTotal = parseIntOrNull(fields.membershipTotal);
            if (newTotal !== (original.membershipTotal ?? null)) payload.membershipTotal = newTotal;
            const newMale = parseIntOrNull(fields.membershipMale);
            if (newMale !== (original.membershipMale ?? null)) payload.membershipMale = newMale;
            const newFemale = parseIntOrNull(fields.membershipFemale);
            if (newFemale !== (original.membershipFemale ?? null)) payload.membershipFemale = newFemale;
            if (fields.contactName !== (original.contactName || '')) payload.contactName = fields.contactName || null;
            if (fields.contactRole !== (original.contactRole || '')) payload.contactRole = fields.contactRole || null;
            const newPhones = fields.contactPhones.split(',').map((s) => s.trim()).filter(Boolean);
            if (newPhones.join(', ') !== (original.contactPhones || []).join(', ')) payload.contactPhones = newPhones;

            if (Object.keys(payload).length === 0) {
                setEditing(false);
                setFields(null);
                return;
            }

            const res = await correctCooperative(cooperativeId, payload);
            setSaveSuccess(`${res.data.data.changed} field(s) updated.`);
            setEditing(false);
            setFields(null);
            await load();
            onChanged();
        } catch (err) {
            setSaveError(apiErrorMessage(err, 'Failed to save changes. Please try again.'));
        } finally {
            setSaving(false);
        }
    };

    const submitFlagReview = async (flagId: string) => {
        if (!reviewOutcome.trim()) {
            setReviewError('A review outcome is required.');
            return;
        }
        setReviewSubmitting(true);
        setReviewError('');
        try {
            await reviewCooperativeFlag(flagId, reviewOutcome.trim());
            setReviewingFlagId(null);
            setReviewOutcome('');
            await load();
            onChanged();
        } catch (err) {
            setReviewError(apiErrorMessage(err, 'Failed to record the review outcome. Please try again.'));
        } finally {
            setReviewSubmitting(false);
        }
    };

    const coop = detail?.cooperative;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} aria-hidden="true" />

            {/* Panel */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Cooperative details"
                className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[560px] bg-brand-bg shadow-2xl overflow-y-auto focus:outline-none"
            >
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-brand-border px-4 py-3 flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-brand-text truncate">
                        {loading ? 'Loading…' : (coop?.name || 'Cooperative Details')}
                    </h2>
                    <button
                        onClick={onClose}
                        autoFocus
                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                        aria-label="Close details panel"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {loading ? (
                        <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
                            <Loader2 className="animate-spin" size={16} /> Loading cooperative details...
                        </div>
                    ) : error || !detail || !coop ? (
                        <Alert variant="error" title="Could not load cooperative">{error || 'Cooperative not found.'}</Alert>
                    ) : (
                        <>
                            {saveSuccess && <Alert variant="success" onClose={() => setSaveSuccess('')}>{saveSuccess}</Alert>}
                            {!coop.isActive && (
                                <Alert variant="warning" title="Inactive record">
                                    This cooperative is marked inactive and is hidden from registration pickers, but its history and farmer links remain visible here.
                                </Alert>
                            )}

                            {/* Identity */}
                            <SectionCard
                                title="Cooperative"
                                icon={<Building2 size={16} />}
                                action={isAdmin && !editing && (
                                    <button onClick={startEditing} className="inline-flex items-center gap-1 text-xs font-medium text-brand-green hover:underline">
                                        <Pencil size={12} /> Edit
                                    </button>
                                )}
                            >
                                {editing && fields ? (
                                    <div className="space-y-2">
                                        <label className="block text-xs font-medium text-slate-500">Official Name</label>
                                        <TextInput value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} />
                                    </div>
                                ) : (
                                    <dl>
                                        <DetailRow label="Official Name" value={<span className="font-medium">{coop.name}</span>} />
                                        <DetailRow label="Registry ID" value={<span className="font-mono text-xs">{coop.slug}</span>} />
                                        <DetailRow label="CDA Reference" value="Not recorded" />
                                    </dl>
                                )}
                            </SectionCard>

                            {/* Location */}
                            <SectionCard title="Location" icon={<MapPin size={16} />}>
                                {editing && fields ? (
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">County</label>
                                            <TextInput value={fields.county} onChange={(e) => setFields({ ...fields, county: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">District</label>
                                            <TextInput value={fields.district} onChange={(e) => setFields({ ...fields, district: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Community</label>
                                            <TextInput value={fields.community} onChange={(e) => setFields({ ...fields, community: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                                            <TextInput value={fields.address} onChange={(e) => setFields({ ...fields, address: e.target.value })} />
                                        </div>
                                    </div>
                                ) : (
                                    <dl>
                                        <DetailRow label="County" value={coop.county || 'Not recorded'} />
                                        <DetailRow label="District" value={coop.district || 'Not recorded'} />
                                        <DetailRow label="Community" value={coop.community || 'Not recorded'} />
                                        <DetailRow label="Address" value={coop.address || 'Not recorded'} />
                                        {coop.location && (
                                            <DetailRow label="As published by CDA" value={<span className="text-xs text-slate-500">{coop.location}</span>} />
                                        )}
                                    </dl>
                                )}
                            </SectionCard>

                            {/* Commodities + Membership */}
                            <SectionCard title="Commodities &amp; Membership" icon={<Users2 size={16} />}>
                                {editing && fields ? (
                                    <div className="space-y-2.5">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Commodities (comma-separated)</label>
                                            <TextInput value={fields.commodities} onChange={(e) => setFields({ ...fields, commodities: e.target.value })} placeholder="Cocoa, Coffee" />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2.5">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Total</label>
                                                <TextInput value={fields.membershipTotal} onChange={(e) => setFields({ ...fields, membershipTotal: e.target.value })} inputMode="numeric" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Male</label>
                                                <TextInput value={fields.membershipMale} onChange={(e) => setFields({ ...fields, membershipMale: e.target.value })} inputMode="numeric" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Female</label>
                                                <TextInput value={fields.membershipFemale} onChange={(e) => setFields({ ...fields, membershipFemale: e.target.value })} inputMode="numeric" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                                            {(coop.commodities || []).length > 0 ? (
                                                coop.commodities!.map((c, i) => (
                                                    <span key={`${c}-${i}`} className="px-2 py-0.5 text-xs font-medium rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20">{c}</span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-400">No commodity recorded</span>
                                            )}
                                        </div>
                                        <dl>
                                            <DetailRow label="Reported Membership" value={<span className="font-semibold">{formatMembership(coop.membershipTotal)}</span>} />
                                            <DetailRow label="Male" value={formatMembership(coop.membershipMale)} />
                                            <DetailRow label="Female" value={formatMembership(coop.membershipFemale)} />
                                            <DetailRow label="Source" value="CDA" />
                                            <DetailRow label="On file since" value={formatDateOnly(coop.createdAt)} />
                                        </dl>
                                    </>
                                )}
                            </SectionCard>

                            {/* Contact */}
                            <SectionCard title="Contact" icon={<Phone size={16} />}>
                                {editing && fields ? (
                                    <div className="space-y-2.5">
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Contact Name</label>
                                                <TextInput value={fields.contactName} onChange={(e) => setFields({ ...fields, contactName: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                                                <TextInput value={fields.contactRole} onChange={(e) => setFields({ ...fields, contactRole: e.target.value })} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Phone Number(s), comma-separated</label>
                                            <TextInput value={fields.contactPhones} onChange={(e) => setFields({ ...fields, contactPhones: e.target.value })} />
                                        </div>
                                    </div>
                                ) : (
                                    <dl>
                                        <DetailRow label="Name" value={coop.contactName || 'Not recorded'} />
                                        <DetailRow label="Role" value={coop.contactRole || 'Not recorded'} />
                                        <DetailRow label="Phone" value={(coop.contactPhones || []).length > 0 ? coop.contactPhones!.join(', ') : 'Not recorded'} />
                                    </dl>
                                )}
                            </SectionCard>

                            {editing && (
                                <div className="flex items-center gap-2">
                                    {saveError && <span className="text-xs text-red-600 flex-1">{saveError}</span>}
                                    <button onClick={cancelEditing} disabled={saving} className="ml-auto px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                                    <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-60">
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Changes
                                    </button>
                                </div>
                            )}

                            {/* CMIS-linked farmers */}
                            <SectionCard title={`Farmers Registered in CMIS (${detail.linkedFarmers.length})`} icon={<Users2 size={16} />}>
                                <p className="text-xs text-slate-500 mb-2">
                                    Linked by matching cooperative name at registration time — a separate measure from CDA-reported membership above. No coverage percentage is calculated since the two figures are not a confirmed comparable scope.
                                </p>
                                {detail.linkedFarmers.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic">No CMIS farmer registrations reference this cooperative yet.</p>
                                ) : (
                                    <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                                        {detail.linkedFarmers.map((f) => (
                                            <li key={f.id} className="py-1.5 flex items-center justify-between gap-2 text-sm">
                                                <span className="text-slate-800 truncate">{f.name || 'Unnamed farmer'}</span>
                                                <span className="text-xs text-slate-400 flex-shrink-0">{f.farmerId || f.region || ''}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </SectionCard>

                            {/* Data quality flags - staff only */}
                            {isAdmin && (
                                <SectionCard title={`Data Quality Flags (${detail.flags.length})`} icon={<FlagIcon size={16} />}>
                                    {detail.flags.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-500" /> No flags on this record.</p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {detail.flags.map((flag) => (
                                                <div key={flag.id} className="rounded-lg border border-slate-200 p-2.5">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${FLAG_TYPE_COLORS[flag.type]}`}>{FLAG_TYPE_LABELS[flag.type]}</span>
                                                        <span className={`text-[11px] font-medium ${flag.status === 'OPEN' ? 'text-amber-600' : 'text-green-600'}`}>{flag.status === 'OPEN' ? 'Open' : 'Reviewed'}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-700">{flag.reason}</p>
                                                    <p className="text-[11px] text-slate-400 mt-1">Raised {formatDateTime(flag.createdAt)}{flag.createdByName ? ` by ${flag.createdByName}` : ''}</p>

                                                    {flag.status === 'REVIEWED' ? (
                                                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-xs text-slate-600">
                                                            <span className="font-medium">Outcome:</span> {flag.reviewOutcome}
                                                            <div className="text-[11px] text-slate-400 mt-0.5">Reviewed {formatDateTime(flag.reviewedAt)}{flag.reviewedByName ? ` by ${flag.reviewedByName}` : ''}</div>
                                                        </div>
                                                    ) : reviewingFlagId === flag.id ? (
                                                        <div className="mt-2 space-y-1.5">
                                                            <TextArea
                                                                rows={2}
                                                                value={reviewOutcome}
                                                                onChange={(e) => setReviewOutcome(e.target.value)}
                                                                placeholder="e.g. Confirmed not a duplicate - different county. No action needed."
                                                                className="text-xs"
                                                            />
                                                            {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}
                                                            <div className="flex justify-end gap-1.5">
                                                                <button onClick={() => { setReviewingFlagId(null); setReviewOutcome(''); setReviewError(''); }} className="px-2.5 py-1 text-xs rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50">Cancel</button>
                                                                <button
                                                                    disabled={reviewSubmitting}
                                                                    onClick={() => submitFlagReview(flag.id)}
                                                                    className="px-2.5 py-1 text-xs rounded-md bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-60"
                                                                >
                                                                    {reviewSubmitting ? 'Saving…' : 'Record Outcome'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setReviewingFlagId(flag.id)} className="mt-1.5 text-xs font-medium text-brand-green hover:underline">
                                                            Record review outcome
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </SectionCard>
                            )}

                            {/* Change history - staff only */}
                            {isAdmin && (
                                <SectionCard title="Change History" icon={<History size={16} />}>
                                    {detail.changeHistory.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic">No corrections or import changes recorded for this cooperative.</p>
                                    ) : (
                                        <ul className="space-y-2 max-h-64 overflow-y-auto">
                                            {detail.changeHistory.map((log) => (
                                                <li key={log.id} className="text-xs border-l-2 border-slate-200 pl-2.5">
                                                    <span className="font-medium text-slate-700">{log.fieldName}</span>{' '}
                                                    <span className="text-slate-500">
                                                        {log.previousValue ? `"${log.previousValue}"` : 'empty'} → {log.newValue ? `"${log.newValue}"` : 'empty'}
                                                    </span>
                                                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                                                        <Clock size={10} /> {formatDateTime(log.createdAt)} · {log.source === 'CDA_IMPORT' ? 'CDA Import' : 'Manual Correction'}
                                                        {log.performedByName ? ` · ${log.performedByName}` : ''}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </SectionCard>
                            )}

                            <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
                                <Clock size={12} /> Last registry update: {formatDateTime(coop.updatedAt)}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default CooperativeDetailPanel;

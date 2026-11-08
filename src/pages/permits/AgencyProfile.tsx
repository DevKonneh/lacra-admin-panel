import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, QrCode, Lock, Loader2, ShieldAlert, CheckCircle2, XCircle,
    AlertTriangle, Plus, UserMinus, Repeat, Link2, Users, FileWarning,
    Camera, Building2, UserCircle2,
} from 'lucide-react';
import {
    getAgency,
    downloadAgencyQrCode,
    downloadAgentQrCode,
    appointAgencyPersonnel,
    replaceAgencyPersonnel,
    deactivateAgencyPersonnel,
    uploadAgencyLogo,
    uploadAgencyPersonnelPhoto,
    type AgencyProfile as AgencyProfileData,
    type AgentPersonnelRecord,
    type AgentPersonnelRole,
} from '../../api/agencies';
import { apiErrorMessage } from '../applications/statusHelpers';
import PageHeader from '../../components/ui/PageHeader';

// Agency profile page — the detail view behind each row in AgencyRegister.tsx
// (GET /api/agencies/:id). Shows the Agency's own permit/status, the live
// staffing summary (>= 3 distinct active Agents + exactly 1 active Clerk),
// and separate Agents/Clerk roster sections with appoint/replace/deactivate
// actions and per-Agent QR downloads — demonstrating directly in the UI
// that two Agents under the same Agency share the Agency's printed permit
// number while each resolves through their own distinct QR/token.

type DisplayStatus = AgencyProfileData['status'] | 'HELD';

const STATUS_BADGE: Record<DisplayStatus, { label: string; className: string; Icon: React.ElementType }> = {
    VALID: { label: 'Valid', className: 'bg-green-50 text-green-800 border border-green-200', Icon: CheckCircle2 },
    EXPIRED: { label: 'Expired', className: 'bg-slate-100 text-slate-600 border border-slate-200', Icon: XCircle },
    HELD: { label: 'Held for review', className: 'bg-amber-100 text-amber-900 border border-amber-300', Icon: ShieldAlert },
    SUSPENDED: { label: 'Suspended', className: 'bg-orange-50 text-orange-800 border border-orange-200', Icon: AlertTriangle },
    REVOKED: { label: 'Revoked', className: 'bg-red-50 text-red-800 border border-red-200', Icon: XCircle },
    PENDING: { label: 'Pending', className: 'bg-blue-50 text-blue-700 border border-blue-200', Icon: FileWarning },
    NOT_YET_ISSUED: { label: 'Not Yet Issued', className: 'bg-slate-100 text-slate-600 border border-slate-200', Icon: FileWarning },
};

function formatDate(value: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const StatusBadge: React.FC<{ status: DisplayStatus }> = ({ status }) => {
    const { label, className, Icon } = STATUS_BADGE[status];
    return (
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${className}`}>
            <Icon size={14} className="flex-shrink-0" />
            {label}
        </span>
    );
};

const PersonnelStatusBadge: React.FC<{ status: AgentPersonnelRecord['status'] }> = ({ status }) => {
    const map: Record<AgentPersonnelRecord['status'], string> = {
        ACTIVE: 'bg-green-100 text-green-700',
        INACTIVE: 'bg-slate-100 text-slate-600',
        REPLACED: 'bg-blue-100 text-blue-700',
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${map[status]}`}>{status}</span>;
};

// Small square logo uploader for the Agency profile header. Clicking the
// thumbnail (or placeholder) opens a hidden file input; the selected
// image is uploaded immediately via uploadAgencyLogo() and the parent
// page re-fetches the Agency to pick up the new logoUrl.
const AgencyLogoUploader: React.FC<{
    logoUrl: string | null;
    uploading: boolean;
    onUpload: (file: File) => void;
}> = ({ logoUrl, uploading, onUpload }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div className="flex-shrink-0">
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(file);
                    e.target.value = '';
                }}
            />
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                title={logoUrl ? 'Replace Agency logo' : 'Upload Agency logo'}
                className="relative group h-16 w-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center hover:border-brand-green transition-colors disabled:opacity-60"
            >
                {logoUrl ? (
                    <img src={logoUrl} alt="Agency logo" className="h-full w-full object-cover" />
                ) : (
                    <Building2 className="h-7 w-7 text-slate-300" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? (
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                    ) : (
                        <Camera className="h-4 w-4 text-white" />
                    )}
                </span>
            </button>
        </div>
    );
};

// Small circular photo thumbnail + uploader used inline in each
// Agent/Clerk roster row. Same click-to-upload pattern as
// AgencyLogoUploader above, scoped to one personnel record.
const PersonnelPhotoCell: React.FC<{
    photoUrl: string | null;
    fullName: string;
    uploading: boolean;
    onUpload: (file: File) => void;
}> = ({ photoUrl, fullName, uploading, onUpload }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div className="flex-shrink-0">
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(file);
                    e.target.value = '';
                }}
            />
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                title={photoUrl ? `Replace ${fullName}'s photo` : `Upload ${fullName}'s photo`}
                className="relative group h-9 w-9 rounded-full border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center hover:border-brand-green transition-colors disabled:opacity-60"
            >
                {photoUrl ? (
                    <img src={photoUrl} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                    <UserCircle2 className="h-5 w-5 text-slate-300" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? (
                        <Loader2 className="h-3 w-3 text-white animate-spin" />
                    ) : (
                        <Camera className="h-3 w-3 text-white" />
                    )}
                </span>
            </button>
        </div>
    );
};

// Inline appoint-new-person form — role is fixed per section (Agents
// section always appoints AGENT, Clerk section always appoints CLERK),
// mirroring PersonnelManager.tsx's inline-form-not-modal pattern.
const AppointForm: React.FC<{
    role: AgentPersonnelRole;
    onCancel: () => void;
    onSubmit: (payload: { fullName: string; county?: string; nationalId?: string; phone?: string }) => Promise<void>;
    submitting: boolean;
}> = ({ role, onCancel, onSubmit, submitting }) => {
    const [fullName, setFullName] = useState('');
    const [county, setCounty] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [phone, setPhone] = useState('');

    return (
        <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800">Appoint New {role === 'AGENT' ? 'Agent' : 'Clerk'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                    <input
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">County</label>
                    <input
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        value={county}
                        onChange={(e) => setCounty(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">National ID</label>
                    <input
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!fullName.trim() || submitting}
                    onClick={() => onSubmit({ fullName: fullName.trim(), county: county || undefined, nationalId: nationalId || undefined, phone: phone || undefined })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-50"
                >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Appoint
                </button>
            </div>
        </div>
    );
};

const PersonnelRow: React.FC<{
    person: AgentPersonnelRecord;
    onDeactivate: (id: string) => void;
    onReplace: (id: string) => void;
    onDownloadQr: (id: string, name: string) => void;
    onUploadPhoto: (id: string, file: File) => void;
    downloadingId: string | null;
    uploadingPhotoId: string | null;
}> = ({ person: p, onDeactivate, onReplace, onDownloadQr, onUploadPhoto, downloadingId, uploadingPhotoId }) => {
    const isAgent = p.role === 'AGENT';
    return (
        <tr className={p.status !== 'ACTIVE' ? 'bg-slate-50/70 text-slate-400' : ''}>
            <td className="px-3 py-3 align-top">
                <div className="flex items-center gap-2.5">
                    <PersonnelPhotoCell
                        photoUrl={p.photoUrl}
                        fullName={p.fullName}
                        uploading={uploadingPhotoId === p.id}
                        onUpload={(file) => onUploadPhoto(p.id, file)}
                    />
                    <div>
                        <div className="text-sm font-medium text-slate-800">{p.fullName}</div>
                        {isAgent && p.permitNumber && <div className="text-xs font-mono text-slate-500 mt-0.5">{p.permitNumber}</div>}
                        {p.requiresAgencyConfirmation && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                                <AlertTriangle size={11} /> Pending Agency confirmation
                            </div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-3 py-3 align-top text-sm text-slate-600 whitespace-nowrap">{p.county || '—'}</td>
            <td className="px-3 py-3 align-top whitespace-nowrap"><PersonnelStatusBadge status={p.status} /></td>
            <td className="px-3 py-3 align-top text-xs text-slate-500 whitespace-nowrap">{formatDateTime(p.appointedAt)}</td>
            <td className="px-3 py-3 align-top text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-2">
                    {isAgent && p.status === 'ACTIVE' && (
                        p.isPubliclyBlocked || !p.permitNumber ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700" title={p.publicBlockReason || 'No QR issued yet'}>
                                <Lock size={12} /> No QR
                            </span>
                        ) : (
                            <button
                                onClick={() => onDownloadQr(p.id, p.fullName)}
                                disabled={downloadingId === p.id}
                                className="inline-flex items-center gap-1 text-brand-green hover:text-brand-green-hover text-xs font-medium disabled:opacity-50"
                                title="Download this Agent's own verification QR"
                            >
                                {downloadingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <QrCode size={12} />}
                                QR
                            </button>
                        )
                    )}
                    {p.status === 'ACTIVE' && (
                        <>
                            <button onClick={() => onReplace(p.id)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-brand-green" title="Replace">
                                <Repeat size={14} />
                            </button>
                            <button onClick={() => onDeactivate(p.id)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600" title="Deactivate">
                                <UserMinus size={14} />
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
};

const AgencyProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [agency, setAgency] = useState<AgencyProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [appointingRole, setAppointingRole] = useState<AgentPersonnelRole | null>(null);
    const [actionError, setActionError] = useState('');
    const [actionSubmitting, setActionSubmitting] = useState(false);
    const [downloadingQrId, setDownloadingQrId] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState('');
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState('');

    const load = async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const res = await getAgency(id);
            setAgency(res.data.data);
        } catch (err: any) {
            setError(apiErrorMessage(err, 'Failed to load this Agency profile.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleAppoint = async (payload: { fullName: string; county?: string; nationalId?: string; phone?: string }) => {
        if (!id || !appointingRole) return;
        setActionSubmitting(true);
        setActionError('');
        try {
            await appointAgencyPersonnel(id, { role: appointingRole, ...payload });
            setAppointingRole(null);
            await load();
        } catch (err: any) {
            setActionError(apiErrorMessage(err, 'Failed to appoint this person.'));
        } finally {
            setActionSubmitting(false);
        }
    };

    const handleDeactivate = async (personnelId: string) => {
        if (!id) return;
        const reason = window.prompt('Reason for deactivation (optional):') || undefined;
        setActionError('');
        try {
            await deactivateAgencyPersonnel(id, personnelId, reason);
            await load();
        } catch (err: any) {
            setActionError(apiErrorMessage(err, 'Failed to deactivate this person.'));
        }
    };

    const handleReplace = async (personnelId: string) => {
        if (!id) return;
        const fullName = window.prompt("Replacement appointee's full name:");
        if (!fullName || !fullName.trim()) return;
        const reason = window.prompt('Reason for replacement (optional):') || undefined;
        setActionError('');
        try {
            await replaceAgencyPersonnel(id, personnelId, { fullName: fullName.trim(), reason });
            await load();
        } catch (err: any) {
            setActionError(apiErrorMessage(err, 'Failed to replace this person.'));
        }
    };

    const handleDownloadAgencyQr = async () => {
        if (!agency || agency.isPubliclyBlocked || !agency.hasVerificationToken) return;
        try {
            setDownloadError('');
            setDownloadingQrId('agency');
            const res = await downloadAgencyQrCode(agency.id);
            const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'image/png' }));
            const link = document.createElement('a');
            const safeName = (agency.agencyName || 'agency').replace(/[^a-zA-Z0-9]+/g, '_');
            link.href = blobUrl;
            link.download = `${safeName}_Agency_Permit_${agency.permitNumber}_QR.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err: any) {
            setDownloadError(apiErrorMessage(err, 'Failed to download the Agency QR code.'));
        } finally {
            setDownloadingQrId(null);
        }
    };

    const handleUploadLogo = async (file: File) => {
        if (!agency) return;
        setUploadError('');
        setUploadingLogo(true);
        try {
            await uploadAgencyLogo(agency.id, file);
            await load();
        } catch (err: any) {
            setUploadError(apiErrorMessage(err, 'Failed to upload the Agency logo.'));
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleUploadPersonnelPhoto = async (personnelId: string, file: File) => {
        if (!id) return;
        setUploadError('');
        setUploadingPhotoId(personnelId);
        try {
            await uploadAgencyPersonnelPhoto(id, personnelId, file);
            await load();
        } catch (err: any) {
            setUploadError(apiErrorMessage(err, 'Failed to upload this photo.'));
        } finally {
            setUploadingPhotoId(null);
        }
    };

    const handleDownloadAgentQr = async (personnelId: string, name: string) => {
        if (!id) return;
        try {
            setDownloadError('');
            setDownloadingQrId(personnelId);
            const res = await downloadAgentQrCode(id, personnelId);
            const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'image/png' }));
            const link = document.createElement('a');
            const safeName = name.replace(/[^a-zA-Z0-9]+/g, '_');
            link.href = blobUrl;
            link.download = `${safeName}_Agent_QR.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err: any) {
            setDownloadError(apiErrorMessage(err, 'Failed to download this Agent QR code.'));
        } finally {
            setDownloadingQrId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
            </div>
        );
    }

    if (error || !agency) {
        return (
            <div className="space-y-4">
                <Link to="/permits/agencies" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                    <ArrowLeft size={15} /> Back to Agency Register
                </Link>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error || 'Agency not found.'}</p>
                </div>
            </div>
        );
    }

    const displayStatus: DisplayStatus = agency.isPubliclyBlocked ? 'HELD' : agency.status;

    return (
        <div className="space-y-5">
            <Link to="/permits/agencies" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                <ArrowLeft size={15} /> Back to Agency Register
            </Link>

            <div className="flex items-start gap-3">
                <AgencyLogoUploader logoUrl={agency.logoUrl} uploading={uploadingLogo} onUpload={handleUploadLogo} />
                <div className="flex-1 min-w-0">
                    <PageHeader
                        breadcrumb={[{ label: 'Licensing & Permits' }, { label: 'Agencies', }, { label: agency.agencyName || 'Agency' }]}
                        title={agency.agencyName || 'Agency'}
                        description={`${agency.county || 'County unknown'}${agency.locality ? ` / ${agency.locality}` : ''}`}
                        actions={
                            agency.isPubliclyBlocked || !agency.hasVerificationToken ? (
                                <span className="inline-flex items-center gap-1 text-sm text-amber-700">
                                    <Lock size={14} /> {agency.isPubliclyBlocked ? 'QR unavailable while held' : 'No QR issued'}
                                </span>
                            ) : (
                                <button
                                    onClick={handleDownloadAgencyQr}
                                    disabled={downloadingQrId === 'agency'}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-50"
                                >
                                    {downloadingQrId === 'agency' ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                                    Download Agency QR
                                </button>
                            )
                        }
                    />
                </div>
            </div>

            {downloadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{downloadError}</div>
            )}

            {uploadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{uploadError}</div>
            )}

            {/* Summary strip */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Permit Number</p>
                    <p className="text-sm font-mono font-semibold text-slate-800">
                        {agency.permitNumber || <span className="italic font-sans text-slate-400">Staged: {agency.stagedPermitNumber}</span>}
                    </p>
                </div>
                <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Status</p>
                    <StatusBadge status={displayStatus} />
                </div>
                <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Issuance</p>
                    <p className="text-sm text-slate-700">{formatDate(agency.issuanceDate)}</p>
                </div>
                <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Expiration</p>
                    <p className="text-sm text-slate-700">{formatDate(agency.expirationDate)}</p>
                </div>
            </div>

            {agency.isPubliclyBlocked && agency.publicBlockReason && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-amber-900">Held pending staff review</p>
                        <p className="text-sm text-amber-800 mt-0.5">{agency.publicBlockReason}</p>
                    </div>
                </div>
            )}

            {/* Staffing summary */}
            <div className={`rounded-xl border p-4 ${agency.staffing.meetsRequirement ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                <div className="flex items-start gap-3">
                    {agency.staffing.meetsRequirement ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                        <p className={`text-sm font-semibold ${agency.staffing.meetsRequirement ? 'text-green-900' : 'text-amber-900'}`}>
                            Staffing: {agency.staffing.activeAgents} of {agency.staffing.requiredAgents} required Agents · {agency.staffing.activeClerks} of {agency.staffing.requiredClerks} required Clerk
                        </p>
                        {!agency.staffing.meetsRequirement && agency.staffing.flagReason && (
                            <p className="text-sm text-amber-800 mt-0.5">{agency.staffing.flagReason}</p>
                        )}
                        {agency.staffing.meetsRequirement && (
                            <p className="text-sm text-green-800 mt-0.5">Staffing requirement met — this Agency is fully staffed.</p>
                        )}
                    </div>
                </div>
            </div>

            {actionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>
            )}

            {/* Agents roster */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <Users size={15} /> Agents ({agency.agents.filter((a) => a.status === 'ACTIVE').length} active)
                    </h3>
                    {appointingRole !== 'AGENT' && (
                        <button
                            onClick={() => setAppointingRole('AGENT')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-green text-white hover:bg-brand-green-hover"
                        >
                            <Plus size={13} /> Appoint Agent
                        </button>
                    )}
                </div>

                {appointingRole === 'AGENT' && (
                    <AppointForm role="AGENT" onCancel={() => setAppointingRole(null)} onSubmit={handleAppoint} submitting={actionSubmitting} />
                )}

                {agency.agents.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No Agents appointed yet.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase">Agent / Permit No.</th>
                                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase">County</th>
                                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase">Status</th>
                                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase">Appointed</th>
                                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-600 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {agency.agents.map((p) => (
                                    <PersonnelRow
                                        key={p.id}
                                        person={p}
                                        onDeactivate={handleDeactivate}
                                        onReplace={handleReplace}
                                        onDownloadQr={handleDownloadAgentQr}
                                        onUploadPhoto={handleUploadPersonnelPhoto}
                                        downloadingId={downloadingQrId}
                                        uploadingPhotoId={uploadingPhotoId}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="text-[11px] text-slate-400">
                    Every Agent carries the same permit number as this Agency, but each has their own distinct verification QR/token — scanning any one Agent's code verifies that specific person, not the Agency as a whole.
                </p>
            </div>

            {/* Clerk roster */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <Link2 size={15} /> Clerk ({agency.clerks.filter((c) => c.status === 'ACTIVE').length} active)
                    </h3>
                    {appointingRole !== 'CLERK' && (
                        <button
                            onClick={() => setAppointingRole('CLERK')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-green text-white hover:bg-brand-green-hover"
                        >
                            <Plus size={13} /> Appoint Clerk
                        </button>
                    )}
                </div>

                {appointingRole === 'CLERK' && (
                    <AppointForm role="CLERK" onCancel={() => setAppointingRole(null)} onSubmit={handleAppoint} submitting={actionSubmitting} />
                )}

                {agency.clerks.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No Clerk appointed yet.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase">Clerk</th>
                                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase">County</th>
                                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase">Status</th>
                                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase">Appointed</th>
                                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-600 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {agency.clerks.map((p) => (
                                    <PersonnelRow
                                        key={p.id}
                                        person={p}
                                        onDeactivate={handleDeactivate}
                                        onReplace={handleReplace}
                                        onDownloadQr={handleDownloadAgentQr}
                                        onUploadPhoto={handleUploadPersonnelPhoto}
                                        downloadingId={downloadingQrId}
                                        uploadingPhotoId={uploadingPhotoId}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="text-[11px] text-slate-400">
                    Clerks are internal staffing records only — they have no permit number and no public verification QR.
                </p>
            </div>
        </div>
    );
};

export default AgencyProfilePage;

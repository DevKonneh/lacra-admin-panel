import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, QrCode, Lock, Loader2, ShieldAlert, CheckCircle2, XCircle,
    AlertTriangle, FileWarning, History, Ship,
} from 'lucide-react';
import {
    getExporter,
    downloadExporterQrCode,
    type ExporterRecord,
} from '../../api/exporters';
import {
    createExporterComplianceAction,
    listExporterComplianceActions,
    type ComplianceAction,
    type ComplianceActionType,
} from '../../api/complianceActions';
import ComplianceActionsMenu from '../../components/compliance/ComplianceActionsMenu';
import ComplianceHistoryEntry from '../../components/compliance/ComplianceHistoryEntry';
import { apiErrorMessage } from '../applications/statusHelpers';
import PageHeader from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

// Exporter profile page — the detail view behind each row in
// ExporterRegister.tsx (GET /api/exporters/:id). Simplified relative to
// AgencyProfile.tsx: Exporters have no staffing/personnel roster and no
// logo upload, so this page is just the license summary, the county
// conflict notice (if held for review — e.g. Meridian Commodity Inc.),
// the QR download action, compliance actions, and compliance history.

type DisplayStatus = ExporterRecord['status'] | 'HELD';

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

const StatusBadge: React.FC<{ status: DisplayStatus }> = ({ status }) => {
    const { label, className, Icon } = STATUS_BADGE[status];
    return (
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${className}`}>
            <Icon size={14} className="flex-shrink-0" />
            {label}
        </span>
    );
};

const ExporterProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN;

    const [exporter, setExporter] = useState<ExporterRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState('');
    const [complianceHistory, setComplianceHistory] = useState<ComplianceAction[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState('');

    const load = async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const res = await getExporter(id);
            setExporter(res.data.data);
        } catch (err: any) {
            setError(apiErrorMessage(err, 'Failed to load this Exporter profile.'));
        } finally {
            setLoading(false);
        }
    };

    const loadComplianceHistory = async () => {
        if (!id) return;
        try {
            setHistoryLoading(true);
            setHistoryError('');
            const res = await listExporterComplianceActions(id);
            setComplianceHistory(res.data.data || []);
        } catch (err: any) {
            setHistoryError(apiErrorMessage(err, 'Failed to load compliance history.'));
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        load();
        loadComplianceHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Fires a compliance action against the Exporter's own Certificate —
    // e.g. suspending the export license — then reloads both the profile
    // (to pick up the status flip) and the compliance history panel.
    const handleComplianceAction = async (
        actionType: ComplianceActionType,
        payload: { reason: string; fineAmount?: number; fineCurrency?: string }
    ) => {
        if (!id) return;
        await createExporterComplianceAction(id, { actionType, ...payload });
        await Promise.all([load(), loadComplianceHistory()]);
    };

    const handleDownloadQr = async () => {
        if (!exporter || exporter.isPubliclyBlocked || !exporter.hasVerificationToken) return;
        try {
            setDownloadError('');
            setDownloading(true);
            const res = await downloadExporterQrCode(exporter.id);
            const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'image/png' }));
            const link = document.createElement('a');
            const safeName = (exporter.exporterName || 'exporter').replace(/[^a-zA-Z0-9]+/g, '_');
            link.href = blobUrl;
            link.download = `${safeName}_Export_License_${exporter.licenseNumber}_QR.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err: any) {
            setDownloadError(apiErrorMessage(err, 'Failed to download the export license QR code.'));
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
            </div>
        );
    }

    if (error || !exporter) {
        return (
            <div className="space-y-4">
                <Link to="/permits/exporters" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                    <ArrowLeft size={15} /> Back to Exporter Register
                </Link>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error || 'Exporter not found.'}</p>
                </div>
            </div>
        );
    }

    const displayStatus: DisplayStatus = exporter.isPubliclyBlocked ? 'HELD' : exporter.status;

    return (
        <div className="space-y-5">
            <Link to="/permits/exporters" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                <ArrowLeft size={15} /> Back to Exporter Register
            </Link>

            <div className="flex items-start gap-3">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                    <Ship className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                    <PageHeader
                        breadcrumb={[{ label: 'Licensing & Permits' }, { label: 'Exporters' }, { label: exporter.exporterName || 'Exporter' }]}
                        title={exporter.exporterName || 'Exporter'}
                        description={`${exporter.county || 'County unknown'}${exporter.locality ? ` / ${exporter.locality}` : ''}`}
                        actions={
                            <div className="flex items-center gap-2">
                                {exporter.isPubliclyBlocked || !exporter.hasVerificationToken ? (
                                    <span className="inline-flex items-center gap-1 text-sm text-amber-700">
                                        <Lock size={14} /> {exporter.isPubliclyBlocked ? 'QR unavailable while held' : 'No QR issued'}
                                    </span>
                                ) : (
                                    <button
                                        onClick={handleDownloadQr}
                                        disabled={downloading}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-50"
                                    >
                                        {downloading ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                                        Download QR
                                    </button>
                                )}
                                {isAdmin && (
                                    <ComplianceActionsMenu
                                        visible={isAdmin}
                                        subjectLabel={`${exporter.exporterName || 'Exporter'} — ${exporter.licenseNumber || exporter.stagedPermitNumber || ''}`}
                                        currentStatus={exporter.status}
                                        onAction={handleComplianceAction}
                                    />
                                )}
                            </div>
                        }
                    />
                </div>
            </div>

            {downloadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{downloadError}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Export License Number</p>
                    <p className="text-sm font-mono text-slate-800 mt-1">
                        {exporter.licenseNumber || <span className="italic font-sans text-slate-400">Staged: {exporter.stagedPermitNumber}</span>}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Status</p>
                    <div className="mt-1"><StatusBadge status={displayStatus} /></div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Issued</p>
                    <p className="text-sm text-slate-700 mt-1">{formatDate(exporter.issuanceDate)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Expires</p>
                    <p className="text-sm text-slate-700 mt-1">{formatDate(exporter.expirationDate)}</p>
                </div>
            </div>

            {exporter.isPubliclyBlocked && exporter.publicBlockReason && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-amber-900">Held for review</p>
                        <p className="text-sm text-amber-800 mt-0.5">{exporter.publicBlockReason}</p>
                        {exporter.disputedCounty && (
                            <p className="text-sm text-amber-800 mt-1">
                                Overview county: <strong>{exporter.county}</strong> · Historical QR county: <strong>{exporter.disputedCounty}</strong>
                            </p>
                        )}
                    </div>
                </div>
            )}

            {!exporter.isPubliclyBlocked && exporter.disputedCounty && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Note: an alternate county (<strong>{exporter.disputedCounty}</strong>) was recorded on this exporter's historical QR before the discrepancy was resolved in favor of <strong>{exporter.county}</strong>. Preserved here as a permanent audit record.
                </div>
            )}

            {/* Compliance History */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-3">
                    <History size={15} /> Compliance History
                </h3>
                {historyLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 py-4 justify-center">
                        <Loader2 size={15} className="animate-spin" /> Loading…
                    </div>
                ) : historyError ? (
                    <p className="text-sm text-red-700">{historyError}</p>
                ) : complianceHistory.length === 0 ? (
                    <p className="text-sm text-slate-400">No compliance actions recorded yet.</p>
                ) : (
                    <div className="space-y-2">
                        {complianceHistory.map((a) => (
                            <ComplianceHistoryEntry key={a.id} action={a} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExporterProfilePage;

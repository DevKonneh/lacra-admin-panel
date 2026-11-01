import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, RefreshCw, Download, CheckCircle2, AlertTriangle, PlusCircle,
    Pencil, MinusCircle, History, Loader2, ShieldAlert,
} from 'lucide-react';
import {
    previewCooperativeImport, applyCooperativeImport, getCooperativeImportRuns,
    type ImportPreviewResult, type ImportPreviewRecord, type CooperativeImportRun,
} from '../../api/cooperatives';
import { apiErrorMessage } from '../applications/statusHelpers';
import { formatDateTime } from './cooperativeHelpers';

/**
 * ADMIN-only registry maintenance screen — replaces the old one-click
 * "Seed / Refresh Registry" button with a reviewed import workflow:
 * preview the embedded CDA listing against the live registry (new /
 * changed / unchanged, nothing touched silently), then apply only after
 * an explicit confirmation. Every run is recorded (source, date, user,
 * result) and shown in the history list below.
 *
 * Deliberately named "Import CDA Records" rather than "Sync Registry" to
 * avoid implying any live connection to CDA — the source is a fixed,
 * manually embedded listing bundled with the backend, not a live feed.
 */

const STATUS_STYLES: Record<ImportPreviewRecord['status'], { label: string; icon: React.ReactNode; className: string }> = {
    NEW: { label: 'New', icon: <PlusCircle size={13} />, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CHANGED: { label: 'Changed', icon: <Pencil size={13} />, className: 'bg-amber-50 text-amber-700 border-amber-200' },
    UNCHANGED: { label: 'Unchanged', icon: <CheckCircle2 size={13} />, className: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const CooperativeRegistryManage: React.FC = () => {
    const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [previewError, setPreviewError] = useState('');
    const [applying, setApplying] = useState(false);
    const [applyError, setApplyError] = useState('');
    const [applyResult, setApplyResult] = useState<{ created: number; updated: number; unchanged: number; total: number } | null>(null);
    const [filter, setFilter] = useState<'ALL' | ImportPreviewRecord['status']>('ALL');

    const [runs, setRuns] = useState<CooperativeImportRun[]>([]);
    const [loadingRuns, setLoadingRuns] = useState(true);
    const [runsError, setRunsError] = useState('');

    const loadPreview = async () => {
        setLoadingPreview(true);
        setPreviewError('');
        try {
            const res = await previewCooperativeImport();
            setPreview(res.data.data);
        } catch (e) {
            setPreviewError(apiErrorMessage(e, 'Failed to build the import preview. Make sure you are logged in as an administrator.'));
            setPreview(null);
        } finally {
            setLoadingPreview(false);
        }
    };

    const loadRuns = async () => {
        setLoadingRuns(true);
        setRunsError('');
        try {
            const res = await getCooperativeImportRuns();
            setRuns(res.data.data || []);
        } catch (e) {
            setRunsError(apiErrorMessage(e, 'Failed to load import history.'));
            setRuns([]);
        } finally {
            setLoadingRuns(false);
        }
    };

    useEffect(() => {
        loadPreview();
        loadRuns();
    }, []);

    const handleApply = async () => {
        if (!preview) return;
        const confirmed = window.confirm(
            `Apply this import? ${preview.summary.newCount} new, ${preview.summary.changedCount} changed, ` +
            `${preview.summary.unchangedCount} unchanged. Existing cooperative IDs and farmer links are preserved — nothing is deleted.`
        );
        if (!confirmed) return;
        setApplying(true);
        setApplyError('');
        setApplyResult(null);
        try {
            const res = await applyCooperativeImport();
            const { created, updated, unchanged, total } = res.data.data;
            setApplyResult({ created, updated, unchanged, total });
            await Promise.all([loadPreview(), loadRuns()]);
        } catch (e) {
            setApplyError(apiErrorMessage(e, 'Import failed. No changes were applied.'));
        } finally {
            setApplying(false);
        }
    };

    const records = preview?.records || [];
    const filteredRecords = filter === 'ALL' ? records : records.filter((r) => r.status === filter);
    const hasChanges = !!preview && (preview.summary.newCount > 0 || preview.summary.changedCount > 0);

    return (
        <div className="space-y-5">
            <div>
                <Link to="/admin/cooperatives" className="inline-flex items-center gap-1.5 text-sm text-brand-green hover:underline mb-2">
                    <ArrowLeft size={14} /> Back to Cooperative Registry
                </Link>
                <h1 className="text-2xl font-bold text-brand-text">Import CDA Records</h1>
                <p className="text-sm text-brand-muted mt-0.5">
                    Review changes from the embedded CDA listing before applying them to the live registry. This is a manual,
                    one-time import of a fixed source document — not a live connection to CDA.
                </p>
            </div>

            {applyResult && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg p-3.5 text-sm">
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                    <span>
                        Import applied: <b>{applyResult.created}</b> created, <b>{applyResult.updated}</b> updated,{' '}
                        <b>{applyResult.unchanged}</b> unchanged — <b>{applyResult.total}</b> total cooperatives in the registry.
                    </span>
                </div>
            )}
            {applyError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3.5 text-sm">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{applyError}</span>
                </div>
            )}

            {/* Preview */}
            <div className="bg-brand-card shadow-card rounded-xl border border-brand-border overflow-hidden">
                <div className="p-4 border-b border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-brand-text">Preview</h2>
                        {preview && <p className="text-xs text-slate-500 mt-0.5">Source: {preview.source}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={loadPreview}
                            disabled={loadingPreview}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-xs font-medium text-slate-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                            <RefreshCw size={13} className={loadingPreview ? 'animate-spin' : ''} /> Refresh Preview
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={applying || loadingPreview || !hasChanges}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-brand-green text-white text-xs font-semibold hover:bg-brand-green-hover disabled:opacity-50"
                        >
                            {applying ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                            {applying ? 'Applying…' : 'Apply Import'}
                        </button>
                    </div>
                </div>

                {previewError ? (
                    <div className="p-4 flex items-start gap-2 text-sm text-red-700">
                        <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {previewError}
                    </div>
                ) : loadingPreview ? (
                    <div className="p-8 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={20} /></div>
                ) : preview ? (
                    <>
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-brand-border">
                            <MiniStat label="New" value={preview.summary.newCount} className="text-emerald-700 bg-emerald-50 border-emerald-200" />
                            <MiniStat label="Changed" value={preview.summary.changedCount} className="text-amber-700 bg-amber-50 border-amber-200" />
                            <MiniStat label="Unchanged" value={preview.summary.unchangedCount} className="text-slate-600 bg-slate-50 border-slate-200" />
                            <MiniStat label="Not in Source" value={preview.notInSource.length} className="text-slate-600 bg-slate-50 border-slate-200" />
                        </div>

                        {!hasChanges && (
                            <div className="px-4 pt-3 text-xs text-slate-500">No new or changed records — applying now would have no effect.</div>
                        )}

                        <div className="px-4 pt-3 flex flex-wrap gap-1.5">
                            {(['ALL', 'NEW', 'CHANGED', 'UNCHANGED'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-full border ${filter === f ? 'border-brand-green text-brand-green bg-brand-green/10' : 'border-gray-300 bg-white text-slate-600 hover:bg-gray-50'}`}
                                >
                                    {f === 'ALL' ? 'All' : STATUS_STYLES[f].label}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 max-h-[420px] overflow-y-auto space-y-2">
                            {filteredRecords.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-6">No records in this category.</p>
                            ) : (
                                filteredRecords.map((r) => <PreviewRecordRow key={r.slug} record={r} />)
                            )}
                        </div>

                        {preview.notInSource.length > 0 && (
                            <div className="p-4 border-t border-brand-border">
                                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                    <MinusCircle size={13} /> In registry, not in this source ({preview.notInSource.length})
                                </h3>
                                <p className="text-xs text-slate-400 mb-2">
                                    These existing cooperatives are not part of the embedded listing. They are never removed or
                                    modified by this import.
                                </p>
                                <ul className="text-sm text-slate-700 space-y-1">
                                    {preview.notInSource.map((n) => (
                                        <li key={n.id} className="flex justify-between gap-3 border-b border-slate-50 py-1">
                                            <span>{n.name}</span>
                                            <span className="text-slate-400">{n.county || 'Not reported'}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            {/* Import run history */}
            <div className="bg-brand-card shadow-card rounded-xl border border-brand-border overflow-hidden">
                <div className="p-4 border-b border-brand-border">
                    <h2 className="text-sm font-semibold text-brand-text flex items-center gap-2"><History size={15} /> Import Run History</h2>
                </div>
                {runsError ? (
                    <div className="p-4 text-sm text-red-700 flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {runsError}</div>
                ) : loadingRuns ? (
                    <div className="p-8 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={20} /></div>
                ) : runs.length === 0 ? (
                    <p className="p-4 text-sm text-slate-400">No import runs recorded yet.</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {runs.map((run) => (
                            <div key={run.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                                <div>
                                    <p className="font-medium text-slate-800">{formatDateTime(run.createdAt)}</p>
                                    <p className="text-xs text-slate-500">
                                        By {run.performedByName || 'Unknown user'} &middot; {run.source}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-600">
                                    <span className="text-emerald-700">{run.newCount} new</span>
                                    <span className="text-amber-700">{run.changedCount} changed</span>
                                    <span className="text-slate-500">{run.unchangedCount} unchanged</span>
                                    {run.flaggedCount > 0 && <span className="text-red-600 flex items-center gap-1"><ShieldAlert size={12} /> {run.flaggedCount} flagged</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const MiniStat: React.FC<{ label: string; value: number; className: string }> = ({ label, value, className }) => (
    <div className={`rounded-lg border p-2.5 text-center ${className}`}>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
    </div>
);

const PreviewRecordRow: React.FC<{ record: ImportPreviewRecord }> = ({ record }) => {
    const style = STATUS_STYLES[record.status];
    return (
        <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{record.name}</p>
                    <p className="text-[11px] text-slate-400">{record.slug} &middot; {record.county || 'Not reported'}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0 ${style.className}`}>
                    {style.icon} {style.label}
                </span>
            </div>
            {record.changes.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                    {record.changes.map((c, i) => (
                        <li key={i}>
                            <span className="font-medium text-slate-700">{c.field}:</span>{' '}
                            <span className="text-slate-400 line-through">{c.previousValue ?? 'Not reported'}</span>{' '}
                            <span>→</span> <span className="text-slate-800">{c.newValue ?? 'Not reported'}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default CooperativeRegistryManage;

import React, { useEffect, useState } from 'react';
import { PlusCircle, AlertTriangle, CheckCircle2, Loader2, History, RefreshCw, ShieldAlert } from 'lucide-react';
import {
    previewAgencyImport,
    applyAgencyImport,
    getAgencyImportRuns,
    type AgencyImportSummary,
} from '../../api/agencies';
import { apiErrorMessage } from '../../pages/applications/statusHelpers';

// ADMIN-only inline panel (embedded in AgencyRegister.tsx, not its own
// route) for the historical Agency Register import workflow: a dry-run
// preview (classifying every source record as MATCHED / ADDED / CONFLICT)
// shown BEFORE anything is written, and an explicit "Apply Import" action
// gated on reviewing that preview — mirrors
// CooperativeRegistryManage.tsx's reviewed-import pattern (preview first,
// confirm, then apply; every run recorded and viewable in history).
//
// The real 11-Agency / 7-Agent register data lives only in the backend's
// src/data/agencyRegisterSeedData.ts (a verbatim transcription of the
// project owner's source package) — this panel never receives or
// displays anything beyond what AgencyImportService.preview()/apply()
// return, and triggers no file upload of its own.
const STATUS_STYLES: Record<'MATCHED' | 'ADDED' | 'CONFLICT', { label: string; className: string }> = {
    ADDED: { label: 'Will be added', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    MATCHED: { label: 'Already imported', className: 'bg-slate-50 text-slate-500 border-slate-200' },
    CONFLICT: { label: 'Conflict — held', className: 'bg-amber-50 text-amber-800 border-amber-200' },
};

interface Props {
    onApplied: () => void;
}

const AgencyImportPanel: React.FC<Props> = ({ onApplied }) => {
    const [preview, setPreview] = useState<AgencyImportSummary | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [previewError, setPreviewError] = useState('');
    const [applying, setApplying] = useState(false);
    const [applyError, setApplyError] = useState('');
    const [applyResult, setApplyResult] = useState<AgencyImportSummary | null>(null);
    const [runs, setRuns] = useState<any[]>([]);
    const [showRuns, setShowRuns] = useState(false);

    const loadPreview = async () => {
        setLoadingPreview(true);
        setPreviewError('');
        try {
            const res = await previewAgencyImport();
            setPreview(res.data.data);
        } catch (e) {
            setPreviewError(apiErrorMessage(e, 'Failed to build the import preview. Make sure you are logged in as an administrator.'));
            setPreview(null);
        } finally {
            setLoadingPreview(false);
        }
    };

    const loadRuns = async () => {
        try {
            const res = await getAgencyImportRuns();
            setRuns(res.data.data || []);
        } catch {
            setRuns([]);
        }
    };

    useEffect(() => {
        loadPreview();
        loadRuns();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = async () => {
        if (!preview) return;
        const confirmed = window.confirm(
            `Apply this historical import? ${preview.addedAgencyCount} new Agencies and ${preview.addedPersonnelCount} new Agent/Clerk records will be created. ` +
            `${preview.conflictAgencyCount} record(s) will be held pending staff reconciliation of a name conflict. This is idempotent — re-running it later will not create duplicates.`
        );
        if (!confirmed) return;
        setApplying(true);
        setApplyError('');
        setApplyResult(null);
        try {
            const res = await applyAgencyImport();
            setApplyResult(res.data.data);
            await Promise.all([loadPreview(), loadRuns()]);
            onApplied();
        } catch (e) {
            setApplyError(apiErrorMessage(e, 'Import failed. No changes were applied.'));
        } finally {
            setApplying(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">Historical Agency Register Import</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Review the dry-run preview below before applying. This workflow never touches a live, already-issued Agency application.
                    </p>
                </div>
                <button
                    onClick={loadPreview}
                    disabled={loadingPreview}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                    <RefreshCw size={13} className={loadingPreview ? 'animate-spin' : ''} /> Refresh Preview
                </button>
            </div>

            {previewError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-800">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{previewError}</span>
                </div>
            )}

            {applyError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-800">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{applyError}</span>
                </div>
            )}

            {applyResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-start gap-2 text-sm text-green-800">
                    <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                    <span>
                        Import applied: {applyResult.addedAgencyCount} Agenc{applyResult.addedAgencyCount === 1 ? 'y' : 'ies'} added,{' '}
                        {applyResult.addedPersonnelCount} Agent/Clerk record(s) added, {applyResult.matchedAgencyCount} already-imported Agenc{applyResult.matchedAgencyCount === 1 ? 'y' : 'ies'} left untouched.
                    </span>
                </div>
            )}

            {loadingPreview ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
                    <Loader2 size={16} className="animate-spin" /> Building preview…
                </div>
            ) : preview ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-slate-200 p-3">
                            <p className="text-[11px] text-slate-500 uppercase tracking-wide">Total Agencies</p>
                            <p className="text-lg font-bold text-brand-text">{preview.totalAgencySourceRecords}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-[11px] text-emerald-700 uppercase tracking-wide">To Be Added</p>
                            <p className="text-lg font-bold text-emerald-800">{preview.addedAgencyCount}</p>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-[11px] text-amber-700 uppercase tracking-wide">Conflicts (Held)</p>
                            <p className="text-lg font-bold text-amber-800">{preview.conflictAgencyCount}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-3">
                            <p className="text-[11px] text-slate-500 uppercase tracking-wide">Already Imported</p>
                            <p className="text-lg font-bold text-brand-text">{preview.matchedAgencyCount}</p>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500">
                        Personnel: {preview.totalPersonnelSourceRecords} historical Agent entries — {preview.addedPersonnelCount} to be added, {preview.matchedPersonnelCount} already imported.
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Agency</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Permit No.</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Result</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {preview.agencyRecords.map((r) => (
                                    <tr key={r.sourceRecordId} className={r.status === 'CONFLICT' ? 'bg-amber-50/60' : ''}>
                                        <td className="px-3 py-2 text-slate-700">{r.agencyName}</td>
                                        <td className="px-3 py-2 font-mono text-slate-600">{r.permitNumber}</td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${STATUS_STYLES[r.status].className}`}>
                                                {r.status === 'CONFLICT' && <ShieldAlert size={11} className="mr-1" />}
                                                {STATUS_STYLES[r.status].label}
                                            </span>
                                            {r.conflictReason && (
                                                <p className="text-[10px] text-amber-700 mt-1 max-w-xs">{r.conflictReason}</p>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                            onClick={() => setShowRuns((v) => !v)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                        >
                            <History size={13} /> {showRuns ? 'Hide' : 'Show'} import run history ({runs.length})
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={applying || (preview.addedAgencyCount === 0 && preview.addedPersonnelCount === 0)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-green text-white hover:bg-brand-green-hover disabled:opacity-50"
                        >
                            {applying ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                            {applying ? 'Applying…' : 'Apply Import'}
                        </button>
                    </div>

                    {showRuns && (
                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200 text-xs">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Date</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Type</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-600">By</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Result</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {runs.length === 0 ? (
                                        <tr><td colSpan={4} className="px-3 py-3 text-center text-slate-400">No import runs recorded yet.</td></tr>
                                    ) : runs.map((r) => (
                                        <tr key={r.id}>
                                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-slate-600">{r.isDryRun ? 'Preview' : 'Apply'}</td>
                                            <td className="px-3 py-2 text-slate-600">{r.performedByName || '—'}</td>
                                            <td className="px-3 py-2 text-slate-600">
                                                {r.addedAgencyCount} added, {r.matchedAgencyCount} matched, {r.conflictAgencyCount} conflicts
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
};

export default AgencyImportPanel;

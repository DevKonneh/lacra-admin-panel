import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle2, Circle, Clock, FileText, Send, History as HistoryIcon,
    Eye, Download, AlertTriangle, ChevronRight, X, Loader2, Upload, ZoomIn, ZoomOut, RotateCw,
    ChevronLeft, ChevronsLeft, ChevronsRight, Save, AlertCircle, Image as ImageIcon,
} from 'lucide-react';
import {
    getApplication, startCommercialReview, requestCorrection, verifyCommercial,
    resubmitAfterCorrection, saveCommercialReviewProgress, replaceDocument, uploadApplicationDocument,
    type ApplicationRecord, type ApplicationHistoryEntry, type DocumentVerificationStatus,
    type DocumentHistoryEntry,
} from '../../api/applications';
import { useAuth } from '../../context/AuthContext';
import Alert from '../../components/forms/Alert';
import {
    categoryLabel, apiErrorMessage,
    commercialBadgeLabel, commercialBadgeColor, timeSinceSubmissionLabel, timeInCommercialReviewLabel,
    formatDateParts,
} from './statusHelpers';
import { COMMODITY_LABELS } from '../apply/types';
import { DOCUMENT_REQUIREMENTS as DOC_REQUIREMENTS_BY_CATEGORY } from '../apply/documentRequirements';
import {
    APPLICANT_FIELD_LABELS, LEADERSHIP_FIELD_LABELS, BANK_FIELD_LABELS, LICENCE_FIELD_LABELS,
    WAREHOUSE_FIELD_LABELS, fieldLabel, documentLabel, applicantFieldSection,
    fieldDisplayValue, isFieldMissing, type FieldDisplayContext,
} from './commercialReviewFields';
import { QUEUE_ORDER_KEY } from './CommercialQueue';

type UploadedDoc = { url?: string; name?: string; size?: number; type?: string } | null | undefined;

function getApplicantRecord(category: string, data: Record<string, unknown> | undefined): Record<string, unknown> | null {
    if (!data) return null;
    switch (category) {
        case 'LOCAL_BUYER': return (data.buyer as Record<string, unknown>) || null;
        case 'AGENCY': return (data.agency as Record<string, unknown>) || null;
        case 'COOPERATIVE': return (data.cooperative as Record<string, unknown>) || null;
        case 'LOCAL_EXPORTER':
        case 'FOREIGN_EXPORTER': return (data.exporter as Record<string, unknown>) || null;
        default: return null;
    }
}

function isImageUrl(url: string): boolean {
    return /\.(jpe?g|png|gif|webp)($|\?)/i.test(url);
}
function isPdfUrl(url: string): boolean {
    return /\.pdf($|\?)/i.test(url);
}

const PROGRESS_STEPS = ['Submitted', 'Commercial Review', 'DG Review'] as const;

function currentProgressIndex(status: string): number {
    if (status === 'AWAITING_COMMERCIAL_VERIFICATION' || status === 'COMMERCIAL_REVIEW_IN_PROGRESS'
        || status === 'APPLICANT_CORRECTION_REQUIRED' || status === 'RETURNED_TO_COMMERCIAL') {
        return 1;
    }
    if (status === 'COMMERCIALLY_VERIFIED' || status === 'AWAITING_FIRST_DG_APPROVAL' || status === 'COMMERCIAL_STAGE_APPROVED') {
        return 2;
    }
    // Anything further along (Technical/Billing/etc.) - the Commercial
    // + DG stages are both long complete.
    return 2;
}

// Friendlier labels for Activity History action codes - purely cosmetic,
// does not affect what's recorded or any workflow logic.
const ACTION_LABELS: Record<string, string> = {
    SUBMITTED: 'Application Submitted',
    COMMERCIAL_REVIEW_STARTED: 'Review Started',
    CORRECTION_REQUESTED: 'Correction Requested',
    RESUBMITTED: 'Resubmitted',
    DOCUMENT_REPLACED: 'Document Replaced',
    COMMERCIALLY_VERIFIED: 'Verified by Commercial',
    ROUTED_TO_DG: 'Routed to Director-General',
};
function actionLabel(action: string): string {
    return ACTION_LABELS[action] || action.replace(/_/g, ' ');
}

const FieldGrid: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="rounded-xl border border-brand-border bg-brand-card p-4">
        <h3 className="text-sm font-semibold text-brand-text mb-3 flex items-center gap-1.5">{icon}{title}</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">{children}</dl>
    </div>
);

const Field: React.FC<{ label: string; value: string; missing?: boolean; required?: boolean }> = ({ label, value, missing, required }) => (
    <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide font-medium text-brand-muted mb-0.5">
            {label}{required && <span className="text-red-500"> *</span>}
        </dt>
        <dd className={`text-sm font-medium truncate ${missing ? 'text-red-600' : 'text-brand-text'}`} title={value}>
            {missing ? <span className="inline-flex items-center gap-1"><AlertTriangle size={12} /> {value}</span> : value}
        </dd>
    </div>
);

// Non-document verification checks the officer must tick manually. Deliberately
// does NOT include one item per required document any more - a document's own
// verification status (set via the Verified/Needs Correction buttons on its
// card) is the single source of truth for whether that document has been
// checked, so there is no separate, duplicate checkbox for it here.
const NON_DOCUMENT_CHECKLIST_ITEMS = [
    { key: 'info-match', label: 'Applicant and business information matches submitted documents' },
];

type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'failed';

const CommercialApplicationReview: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    const [application, setApplication] = useState<ApplicationRecord | null>(null);
    const [history, setHistory] = useState<ApplicationHistoryEntry[]>([]);
    const [assignedOfficer, setAssignedOfficer] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Review-panel local state (mirrors application.commercialReview once
    // loaded; persisted via "Save Progress").
    const [docStatuses, setDocStatuses] = useState<Record<string, { status: DocumentVerificationStatus; comment?: string }>>({});
    const [checklist, setChecklist] = useState<Record<string, boolean>>({});
    const [internalNotes, setInternalNotes] = useState('');
    const [applicantMessage, setApplicantMessage] = useState('');
    const [documentHistory, setDocumentHistory] = useState<Record<string, DocumentHistoryEntry[]>>({});
    const [previewKey, setPreviewKey] = useState<string | null>(null);
    const [replacingKey, setReplacingKey] = useState<string | null>(null);
    const [replaceError, setReplaceError] = useState('');

    // Accurate save-state tracking for "Save Progress" - compares current
    // review-panel state against the last-saved snapshot so the UI always
    // reflects reality rather than assuming a save just because a field
    // changed.
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const lastSavedSnapshotRef = useRef<string>('');
    const hasLoadedRef = useRef(false);

    // Outstanding-requirement "jump to this item" support: briefly
    // highlights the targeted document card or checklist row after
    // scrolling it into view.
    const [highlightTarget, setHighlightTarget] = useState<string | null>(null);

    // Correction-request form state (two steps: fill in details, then
    // confirm a summary before actually sending).
    const [showCorrectionForm, setShowCorrectionForm] = useState(false);
    const [correctionStep, setCorrectionStep] = useState<'form' | 'summary'>('form');
    const [correctionFields, setCorrectionFields] = useState<Record<string, boolean>>({});
    const [correctionInstructions, setCorrectionInstructions] = useState('');

    const backToQueueUrl = `/applications/commercial-queue?${searchParams.toString()}`;

    useEffect(() => {
        if (id) load(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const load = async (appId: string) => {
        setLoading(true);
        setError('');
        try {
            const response = await getApplication(appId);
            const { history: h, assignedOfficer: officer, ...app } = response.data.data;
            setApplication(app);
            setHistory(h || []);
            setAssignedOfficer(officer);
            const review = app.commercialReview;
            const docs = review?.documents || {};
            const chk = review?.checklist || {};
            const notes = review?.internalNotes || '';
            const draft = review?.applicantMessageDraft || '';
            setDocStatuses(docs);
            setChecklist(chk);
            setInternalNotes(notes);
            setApplicantMessage(draft);
            setDocumentHistory(review?.documentHistory || {});
            lastSavedSnapshotRef.current = JSON.stringify({ docs, chk, notes, draft });
            hasLoadedRef.current = true;
            setSaveState('idle');
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load this application.'));
        } finally {
            setLoading(false);
        }
    };

    // Flips save-state to "Unsaved Changes" the moment local review state
    // diverges from the last successfully-saved snapshot - but only once
    // the initial load has populated that snapshot, so loading the page
    // never itself reads as an unsaved edit.
    useEffect(() => {
        if (!hasLoadedRef.current) return;
        const current = JSON.stringify({ docs: docStatuses, chk: checklist, notes: internalNotes, draft: applicantMessage });
        if (current !== lastSavedSnapshotRef.current) {
            setSaveState((s) => (s === 'saving' ? s : 'unsaved'));
        }
    }, [docStatuses, checklist, internalNotes, applicantMessage]);

    // Warn before leaving the page (tab close/refresh/external navigation)
    // while there are unsaved review changes.
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (saveState === 'unsaved' || saveState === 'failed') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [saveState]);

    const confirmDiscardIfUnsaved = (): boolean => {
        if (saveState === 'unsaved' || saveState === 'failed') {
            return window.confirm('You have unsaved review changes. Leave this page without saving?');
        }
        return true;
    };

    const documentRequirements = useMemo(() => {
        if (!application) return [];
        return DOC_REQUIREMENTS_BY_CATEGORY[application.category] || [];
    }, [application]);

    const requiredDocKeys = useMemo(() => documentRequirements.filter((r) => r.required).map((r) => r.key), [documentRequirements]);
    const verifiedRequiredCount = requiredDocKeys.filter((k) => docStatuses[k]?.status === 'VERIFIED').length;
    const allRequiredVerified = requiredDocKeys.length > 0 && verifiedRequiredCount === requiredDocKeys.length;
    const allChecklistDone = NON_DOCUMENT_CHECKLIST_ITEMS.every((item) => checklist[item.key]);
    const canForward = allRequiredVerified && allChecklistDone;

    // Documents marked "Needs Correction" without a reason - blocks saving/
    // forwarding client-side too, mirroring the backend's own validation
    // (never relying on the backend enforcement alone for UX feedback).
    const missingCorrectionReasons = useMemo(
        () => Object.entries(docStatuses)
            .filter(([, v]) => v?.status === 'NEEDS_CORRECTION' && !String(v?.comment || '').trim())
            .map(([key]) => key),
        [docStatuses]
    );

    // Outstanding requirements for forwarding, each with a target element
    // id so the review panel can link directly to the affected item.
    const incompleteItems = useMemo(() => {
        const items: { label: string; targetId: string }[] = [];
        requiredDocKeys
            .filter((k) => docStatuses[k]?.status !== 'VERIFIED')
            .forEach((k) => items.push({ label: `${documentLabel(k)} not yet verified`, targetId: `doc-${k}` }));
        NON_DOCUMENT_CHECKLIST_ITEMS
            .filter((item) => !checklist[item.key])
            .forEach((item) => items.push({ label: item.label, targetId: `checklist-${item.key}` }));
        return items;
    }, [requiredDocKeys, docStatuses, checklist]);

    const focusTarget = (targetId: string) => {
        setHighlightTarget(targetId);
        const el = document.getElementById(targetId);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => setHighlightTarget((cur) => (cur === targetId ? null : cur)), 2200);
    };

    // Both of the following must be declared before any early return below
    // (React's Rules of Hooks) even though they only produce meaningful
    // values once `application`/`history` are loaded - they safely no-op
    // on the pre-load render.
    const correctionHistoryEntryEarly = [...history].reverse().find((h) => h.action === 'CORRECTION_REQUESTED');
    const replacedAfterCorrectionKeys = useMemo(() => {
        if (!correctionHistoryEntryEarly) return new Set<string>();
        const cutoff = new Date(correctionHistoryEntryEarly.createdAt).getTime();
        const keys = new Set<string>();
        Object.entries(documentHistory).forEach(([key, entries]) => {
            if (entries.some((e) => new Date(e.replacedAt).getTime() >= cutoff)) keys.add(key);
        });
        return keys;
    }, [documentHistory, correctionHistoryEntryEarly]);

    const correctionAffectedLabels = useMemo(
        () => Object.entries(correctionFields).filter(([, v]) => v).map(([k]) => documentLabel(k.replace('doc:', '')) || fieldLabel(k)),
        [correctionFields]
    );

    if (loading) {
        return <div className="text-sm text-gray-500 py-10 text-center flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> Loading application...</div>;
    }
    if (error || !application) {
        return (
            <div className="space-y-4">
                <button onClick={() => navigate(backToQueueUrl)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
                    <ArrowLeft size={16} /> Back to queue
                </button>
                <Alert variant="error" title="Could not load application">{error || 'Application not found.'}</Alert>
            </div>
        );
    }

    const role = user?.role;
    const isCommercial = role === 'COMMERCIAL' || role === 'ADMIN';
    const status = application.status;
    const applicantRecord = getApplicantRecord(application.category, application.data as unknown as Record<string, unknown>);
    const businessName = (applicantRecord?.legalName || applicantRecord?.businessName) as string | undefined;
    const applicantName = (applicantRecord?.fullName || applicantRecord?.repFullName) as string | undefined;
    const county = (applicantRecord?.county || application.data?.warehouse?.county) as string | undefined;
    const step1 = (application.data as unknown as Record<string, unknown>)?.step1 as Record<string, unknown> | undefined;
    const fieldContext: FieldDisplayContext = { isRenewal: step1?.isRenewal as boolean | undefined };

    const canStartReview = isCommercial && (status === 'AWAITING_COMMERCIAL_VERIFICATION' || status === 'RETURNED_TO_COMMERCIAL');
    const isResubmitted = !!application.resubmittedAt && status === 'AWAITING_COMMERCIAL_VERIFICATION';
    const canWorkOn = isCommercial && status === 'COMMERCIAL_REVIEW_IN_PROGRESS';
    const isAwaitingCorrection = status === 'APPLICANT_CORRECTION_REQUIRED';
    const isForwarded = ['COMMERCIALLY_VERIFIED', 'AWAITING_FIRST_DG_APPROVAL', 'COMMERCIAL_STAGE_APPROVED'].includes(status);
    const correctionHistoryEntry = correctionHistoryEntryEarly;

    const runAction = async (fn: () => Promise<unknown>, successMessage: string) => {
        if (!id) return;
        setSubmitting(true);
        setActionError('');
        setActionSuccess('');
        try {
            await fn();
            setActionSuccess(successMessage);
            await load(id);
        } catch (err) {
            setActionError(apiErrorMessage(err, 'The action could not be completed. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveProgress = async () => {
        if (!id) return;
        if (missingCorrectionReasons.length > 0) {
            setActionError(`A correction reason is required for: ${missingCorrectionReasons.map((k) => documentLabel(k)).join(', ')}.`);
            return;
        }
        setSaveState('saving');
        setActionError('');
        setActionSuccess('');
        try {
            await saveCommercialReviewProgress(id, { documents: docStatuses, checklist, internalNotes, applicantMessageDraft: applicantMessage });
            lastSavedSnapshotRef.current = JSON.stringify({ docs: docStatuses, chk: checklist, notes: internalNotes, draft: applicantMessage });
            setSaveState('saved');
            setActionSuccess('Review progress saved.');
        } catch (err) {
            setSaveState('failed');
            setActionError(apiErrorMessage(err, 'Could not save review progress. Please try again.'));
        }
    };

    const handleStartReview = () => runAction(() => startCommercialReview(id!), 'Review started.');
    const handleResumeReview = () => runAction(() => startCommercialReview(id!), 'Review resumed.');
    const handleVerifyAndForward = () => runAction(() => verifyCommercial(id!, internalNotes || undefined), 'Application verified and forwarded to the Director-General.');

    const openCorrectionForm = () => {
        setCorrectionStep('form');
        setShowCorrectionForm(true);
    };

    const handleSubmitCorrection = () => {
        const reasonParts = [
            correctionAffectedLabels.length > 0 ? `Affected items: ${correctionAffectedLabels.join(', ')}.` : '',
            correctionInstructions.trim(),
        ].filter(Boolean);
        const reason = reasonParts.join(' ') || 'Correction required.';
        runAction(() => requestCorrection(id!, reason), 'Correction requested from the applicant.').then(() => {
            setShowCorrectionForm(false);
            setCorrectionStep('form');
            setCorrectionFields({});
            setCorrectionInstructions('');
        });
    };

    const handleResubmit = () => runAction(() => resubmitAfterCorrection(id!), 'Marked as resubmitted and returned to the Commercial queue.');

    const setDocStatus = (key: string, patch: Partial<{ status: DocumentVerificationStatus; comment: string }>) => {
        setDocStatuses((prev) => {
            const existing = prev[key] || { status: 'PENDING' as DocumentVerificationStatus };
            return { ...prev, [key]: { ...existing, ...patch } };
        });
    };

    const handleReplaceFile = async (key: string, file: File) => {
        if (!id) return;
        setReplacingKey(key);
        setReplaceError('');
        try {
            const uploadRes = await uploadApplicationDocument(file);
            const uploaded = uploadRes.data?.data;
            if (!uploaded?.url) throw new Error('Upload did not return a file URL.');
            await replaceDocument(id, key, { url: uploaded.url, name: uploaded.name || file.name, size: uploaded.size, type: uploaded.type });
            await load(id);
            setActionSuccess(`${documentLabel(key)} replaced. It has been reset to Pending for re-verification - the previous version is preserved in Document History.`);
        } catch (err) {
            setReplaceError(apiErrorMessage(err, 'Failed to replace the document. Please try again.'));
        } finally {
            setReplacingKey(null);
        }
    };

    const progressIdx = currentProgressIndex(status);

    // Previous/Next Application, following the exact filtered+sorted order
    // the officer was viewing the queue in (persisted by CommercialQueue.tsx
    // into sessionStorage every time its result set changes).
    let orderedIds: string[] = [];
    try {
        orderedIds = JSON.parse(sessionStorage.getItem(QUEUE_ORDER_KEY) || '[]');
    } catch {
        orderedIds = [];
    }
    const orderedIndex = id ? orderedIds.indexOf(id) : -1;
    const prevApplicationId = orderedIndex > 0 ? orderedIds[orderedIndex - 1] : null;
    const nextApplicationId = orderedIndex >= 0 && orderedIndex < orderedIds.length - 1 ? orderedIds[orderedIndex + 1] : null;

    const goToApplication = (targetId: string) => {
        if (!confirmDiscardIfUnsaved()) return;
        navigate(`/applications/commercial/${targetId}?${searchParams.toString()}`);
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <button
                    onClick={() => { if (confirmDiscardIfUnsaved()) navigate(backToQueueUrl); }}
                    className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded"
                >
                    <ArrowLeft size={16} /> Back to queue
                </button>
                {(prevApplicationId || nextApplicationId) && (
                    <div className="flex items-center gap-2">
                        <button
                            disabled={!prevApplicationId}
                            onClick={() => prevApplicationId && goToApplication(prevApplicationId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={14} /> Previous Application
                        </button>
                        <button
                            disabled={!nextApplicationId}
                            onClick={() => nextApplicationId && goToApplication(nextApplicationId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Next Application <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Compact header */}
            <div className="rounded-xl border border-brand-border bg-brand-card p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold text-brand-text">{application.applicationNumber}</h1>
                            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${commercialBadgeColor(status, application.resubmittedAt)}`}>
                                {commercialBadgeLabel(status, application.resubmittedAt)}
                            </span>
                        </div>
                        <p className="text-sm text-brand-muted mt-0.5">
                            {applicantName || businessName || 'Not provided'}
                            {businessName && applicantName && businessName !== applicantName ? ` - ${businessName}` : ''}
                        </p>
                    </div>
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 text-xs sm:text-right">
                        <div><dt className="text-brand-muted">Category</dt><dd className="font-medium text-brand-text">{categoryLabel(application.category)}</dd></div>
                        <div><dt className="text-brand-muted">Commodity</dt><dd className="font-medium text-brand-text">{application.commodity ? (COMMODITY_LABELS[application.commodity as keyof typeof COMMODITY_LABELS] || application.commodity) : 'Not provided'}</dd></div>
                        <div><dt className="text-brand-muted">County</dt><dd className="font-medium text-brand-text">{county || 'Not provided'}</dd></div>
                        <div>
                            <dt className="text-brand-muted">Submitted</dt>
                            <dd className="font-medium text-brand-text">
                                {application.submittedAt ? (
                                    <>
                                        {formatDateParts(application.submittedAt).date}{' '}
                                        <span className="text-brand-muted font-normal">{formatDateParts(application.submittedAt).time}</span>
                                    </>
                                ) : 'Not available'}
                            </dd>
                        </div>
                        <div><dt className="text-brand-muted">Assigned Officer</dt><dd className="font-medium text-brand-text">{assignedOfficer || 'Unassigned'}</dd></div>
                        <div><dt className="text-brand-muted">Time Since Submission</dt><dd className="font-medium text-brand-text">{timeSinceSubmissionLabel(application.submittedAt)}</dd></div>
                        <div><dt className="text-brand-muted">Time in Commercial Review</dt><dd className="font-medium text-brand-text">{timeInCommercialReviewLabel(history)}</dd></div>
                    </dl>
                </div>

                {/* Progress indicator */}
                <div className="flex items-center">
                    {PROGRESS_STEPS.map((step, idx) => (
                        <React.Fragment key={step}>
                            <div className="flex items-center gap-1.5">
                                {idx < progressIdx ? (
                                    <CheckCircle2 size={16} className="text-brand-green" />
                                ) : idx === progressIdx ? (
                                    <Clock size={16} className="text-blue-600" />
                                ) : (
                                    <Circle size={16} className="text-slate-300" />
                                )}
                                <span className={`text-xs font-medium ${idx <= progressIdx ? 'text-brand-text' : 'text-slate-400'}`}>{step}</span>
                            </div>
                            {idx < PROGRESS_STEPS.length - 1 && <ChevronRight size={14} className="text-slate-300 mx-2 flex-shrink-0" />}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {actionError && <Alert variant="error" onClose={() => setActionError('')}>{actionError}</Alert>}
            {actionSuccess && <Alert variant="success" onClose={() => setActionSuccess('')}>{actionSuccess}</Alert>}
            {isResubmitted && (
                <Alert variant="info" title="Application resubmitted">
                    The applicant's correction has been received. Documents replaced in response are marked "Replaced after correction" below - review them and the rest of the information before continuing.
                </Alert>
            )}

            {/* 70/30 two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-start">
                {/* Left: application information (≈70%) */}
                <div className="lg:col-span-7 space-y-4">
                    <ApplicantSection record={applicantRecord} context={fieldContext} />
                    <LicenceSection data={application.data as unknown as Record<string, unknown>} context={fieldContext} />
                    <OperationsSection data={application.data as unknown as Record<string, unknown>} />
                    <DocumentsSection
                        requirements={documentRequirements}
                        documents={(application.data?.documents || {}) as Record<string, UploadedDoc>}
                        statuses={docStatuses}
                        documentHistory={documentHistory}
                        replacedAfterCorrectionKeys={replacedAfterCorrectionKeys}
                        editable={canWorkOn}
                        replacingKey={replacingKey}
                        replaceError={replaceError}
                        highlightTarget={highlightTarget}
                        onStatusChange={setDocStatus}
                        onPreview={(key) => setPreviewKey(key)}
                        onReplaceFile={handleReplaceFile}
                    />
                    <ActivityHistorySection history={history} />
                </div>

                {/* Right: review panel (≈30%), sticky beneath the app's own
                    sticky topbar on desktop so Save Progress/Request
                    Correction/Verify & Forward stay reachable while
                    scrolling, without ever covering content. */}
                <div className="lg:col-span-3">
                    <div className="lg:sticky lg:top-20 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
                        <ReviewPanel
                            isResubmitted={isResubmitted}
                            isAwaitingCorrection={isAwaitingCorrection}
                            isForwarded={isForwarded}
                            canStartReview={canStartReview}
                            canWorkOn={canWorkOn}
                            submitting={submitting}
                            saveState={saveState}
                            assignedOfficer={assignedOfficer}
                            checklistItems={NON_DOCUMENT_CHECKLIST_ITEMS}
                            checklist={checklist}
                            onToggleChecklist={(key) => setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))}
                            internalNotes={internalNotes}
                            onInternalNotesChange={setInternalNotes}
                            applicantMessage={applicantMessage}
                            onApplicantMessageChange={setApplicantMessage}
                            verifiedRequiredCount={verifiedRequiredCount}
                            totalRequiredCount={requiredDocKeys.length}
                            canForward={canForward}
                            incompleteItems={incompleteItems}
                            onFocusItem={focusTarget}
                            correctionHistoryEntry={correctionHistoryEntry}
                            onStartReview={handleStartReview}
                            onResumeReview={handleResumeReview}
                            onSaveProgress={handleSaveProgress}
                            onVerifyAndForward={handleVerifyAndForward}
                            onOpenCorrectionForm={openCorrectionForm}
                            onResubmit={handleResubmit}
                        />
                    </div>
                </div>
            </div>

            {/* Correction request modal - two steps: fill in details, then
                confirm a summary before the request is actually sent. */}
            {showCorrectionForm && (
                <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowCorrectionForm(false)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-brand-text">
                                {correctionStep === 'form' ? 'Request Correction' : 'Confirm Correction Request'}
                            </h3>
                            <button onClick={() => setShowCorrectionForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>

                        {correctionStep === 'form' ? (
                            <>
                                <div>
                                    <p className="text-xs font-medium text-brand-muted mb-2">Select affected fields or documents</p>
                                    <div className="max-h-40 overflow-y-auto space-y-1.5 border border-brand-border rounded-lg p-2">
                                        {documentRequirements.map((req) => (
                                            <label key={req.key} className="flex items-center gap-2 text-sm">
                                                <input type="checkbox" checked={!!correctionFields[`doc:${req.key}`]} onChange={() => setCorrectionFields((p) => ({ ...p, [`doc:${req.key}`]: !p[`doc:${req.key}`] }))} className="rounded border-gray-300 text-brand-green focus:ring-brand-green" />
                                                {documentLabel(req.key)}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-brand-muted mb-1">Instructions for the applicant <span className="text-red-500">*</span></label>
                                    <textarea rows={4} value={correctionInstructions} onChange={(e) => setCorrectionInstructions(e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500" placeholder="Explain clearly what needs to be corrected or resubmitted..." />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setShowCorrectionForm(false)} className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 bg-white border border-gray-300 hover:bg-gray-50">Cancel</button>
                                    <button disabled={!correctionInstructions.trim()} onClick={() => setCorrectionStep('summary')} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50">
                                        Review Summary
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2 text-sm">
                                    <div>
                                        <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-1">Affected Items</p>
                                        {correctionAffectedLabels.length > 0 ? (
                                            <ul className="list-disc list-inside text-orange-900 space-y-0.5">
                                                {correctionAffectedLabels.map((l) => <li key={l}>{l}</li>)}
                                            </ul>
                                        ) : <p className="text-orange-700 text-xs">No specific documents selected.</p>}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-1">Instructions to Applicant</p>
                                        <p className="text-orange-900 whitespace-pre-wrap">{correctionInstructions}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setCorrectionStep('form')} className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 bg-white border border-gray-300 hover:bg-gray-50">Back</button>
                                    <button disabled={submitting} onClick={handleSubmitCorrection} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50">
                                        Confirm &amp; Send Correction Request
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Large document preview panel - zoom, rotation, PDF page
                navigation, and next/previous document controls. */}
            {previewKey && (
                <DocumentPreviewModal
                    key={previewKey}
                    requirements={documentRequirements}
                    documents={(application.data?.documents || {}) as Record<string, UploadedDoc>}
                    currentKey={previewKey}
                    onNavigate={setPreviewKey}
                    onClose={() => setPreviewKey(null)}
                />
            )}
        </div>
    );
};

// -----------------------------------------------------------------
// Application information sections
// -----------------------------------------------------------------

const SECTION_DEFS: { key: 'personal' | 'business' | 'contact'; title: string }[] = [
    { key: 'personal', title: 'Personal Information' },
    { key: 'business', title: 'Business Information' },
    { key: 'contact', title: 'Contact and Location' },
];

const ApplicantSection: React.FC<{ record: Record<string, unknown> | null; context: FieldDisplayContext }> = ({ record, context }) => {
    if (!record) {
        return (
            <FieldGrid title="Personal Information">
                <Field label="Status" value="No applicant information available" missing />
            </FieldGrid>
        );
    }
    const allLabels = { ...APPLICANT_FIELD_LABELS, ...LEADERSHIP_FIELD_LABELS, ...BANK_FIELD_LABELS };
    return (
        <>
            {SECTION_DEFS.map((sec) => {
                const entries = Object.entries(record).filter(
                    ([key, value]) => allLabels[key] && typeof value !== 'object' && applicantFieldSection(key) === sec.key
                );
                if (entries.length === 0) return null;
                return (
                    <FieldGrid key={sec.key} title={sec.title} icon={<FileText size={14} className="text-brand-green" />}>
                        {entries.map(([key, value]) => (
                            <Field
                                key={key}
                                label={allLabels[key]}
                                value={fieldDisplayValue(key, value, context)}
                                missing={isFieldMissing(key, value, context)}
                            />
                        ))}
                    </FieldGrid>
                );
            })}
        </>
    );
};

const LicenceSection: React.FC<{ data: Record<string, unknown>; context: FieldDisplayContext }> = ({ data, context }) => {
    const step1 = (data?.step1 as Record<string, unknown>) || {};
    const category = (step1.category as string) || '';
    const categoryRecord = getApplicantRecord(category, data) || {};
    const entries = Object.entries({ ...step1, ...categoryRecord }).filter(([key]) => LICENCE_FIELD_LABELS[key]);
    if (entries.length === 0) return null;
    return (
        <FieldGrid title="Licence and Commodity Details">
            {entries.map(([key, value]) => (
                <Field
                    key={key}
                    label={LICENCE_FIELD_LABELS[key]}
                    value={fieldDisplayValue(key, value, context)}
                    missing={isFieldMissing(key, value, context)}
                />
            ))}
        </FieldGrid>
    );
};

const OperationsSection: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
    const warehouse = data?.warehouse as Record<string, unknown> | undefined;
    const hasWarehouse = warehouse && Object.values(warehouse).some((v) => v !== '' && v !== null && v !== undefined);
    return (
        <FieldGrid title="Operations and Warehouse">
            {!hasWarehouse ? (
                <Field label="Warehouse" value="Not applicable" />
            ) : (
                Object.entries(warehouse!)
                    .filter(([key]) => WAREHOUSE_FIELD_LABELS[key])
                    .map(([key, value]) => (
                        <Field key={key} label={WAREHOUSE_FIELD_LABELS[key]} value={fieldDisplayValue(key, value)} missing={isFieldMissing(key, value)} />
                    ))
            )}
        </FieldGrid>
    );
};

// -----------------------------------------------------------------
// Supporting Documents - compact cards (title, filename, thumbnail, one
// status badge), with Preview/Download, inline replace-upload, a
// correction-comment field shown only when needed, and an expandable
// history of prior versions for documents that have been replaced.
// -----------------------------------------------------------------

const DOC_STATUS_LABELS: Record<DocumentVerificationStatus, string> = {
    PENDING: 'Pending',
    VERIFIED: 'Verified',
    NEEDS_CORRECTION: 'Needs Correction',
};
const DOC_STATUS_COLORS: Record<DocumentVerificationStatus, string> = {
    PENDING: 'bg-slate-100 text-slate-600 border border-slate-200',
    VERIFIED: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    NEEDS_CORRECTION: 'bg-orange-100 text-orange-700 border border-orange-200',
};

const DocumentsSection: React.FC<{
    requirements: { key: string; label: string; required: boolean }[];
    documents: Record<string, UploadedDoc>;
    statuses: Record<string, { status: DocumentVerificationStatus; comment?: string }>;
    documentHistory: Record<string, DocumentHistoryEntry[]>;
    replacedAfterCorrectionKeys: Set<string>;
    editable: boolean;
    replacingKey: string | null;
    replaceError: string;
    highlightTarget: string | null;
    onStatusChange: (key: string, patch: Partial<{ status: DocumentVerificationStatus; comment: string }>) => void;
    onPreview: (key: string) => void;
    onReplaceFile: (key: string, file: File) => void;
}> = ({
    requirements, documents, statuses, documentHistory, replacedAfterCorrectionKeys, editable,
    replacingKey, replaceError, highlightTarget, onStatusChange, onPreview, onReplaceFile,
}) => (
    <div className="rounded-xl border border-brand-border bg-brand-card p-4">
        <h3 className="text-sm font-semibold text-brand-text mb-3 flex items-center gap-1.5"><FileText size={14} className="text-brand-green" /> Supporting Documents</h3>
        {replaceError && <p className="text-xs text-red-600 mb-2 flex items-center gap-1"><AlertCircle size={12} /> {replaceError}</p>}
        {requirements.length === 0 ? (
            <p className="text-sm text-brand-muted">No documents are required for this application category.</p>
        ) : (
            <div className="space-y-2">
                {requirements.map((req) => {
                    const doc = documents[req.key];
                    const docStatus = statuses[req.key]?.status || 'PENDING';
                    const comment = statuses[req.key]?.comment || '';
                    const needsCommentWarning = docStatus === 'NEEDS_CORRECTION' && !comment.trim();
                    const history = documentHistory[req.key] || [];
                    const wasReplacedAfterCorrection = replacedAfterCorrectionKeys.has(req.key);
                    const targetId = `doc-${req.key}`;
                    const highlighted = highlightTarget === targetId;
                    const inputId = `replace-input-${req.key}`;
                    return (
                        <div
                            key={req.key}
                            id={targetId}
                            className={`rounded-lg border p-2.5 transition-shadow ${highlighted ? 'border-amber-400 ring-2 ring-amber-300' : 'border-slate-100'}`}
                        >
                            <div className="flex items-start gap-2.5">
                                <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                                    {doc?.url && isImageUrl(doc.url) ? (
                                        <img src={doc.url} alt="" className="h-full w-full object-cover" />
                                    ) : doc?.url ? (
                                        <FileText size={16} className="text-slate-400" />
                                    ) : (
                                        <ImageIcon size={16} className="text-slate-300" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-sm font-medium text-brand-text truncate">{documentLabel(req.key)}</p>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${req.required ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {req.required ? 'Required' : 'Optional'}
                                        </span>
                                        {wasReplacedAfterCorrection && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-700">Replaced after correction</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-brand-muted truncate">{doc?.name || 'Not provided'}</p>
                                </div>
                                <span className={`flex-shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded-full ${DOC_STATUS_COLORS[docStatus]}`}>
                                    {DOC_STATUS_LABELS[docStatus]}
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                {doc?.url && (
                                    <>
                                        <button onClick={() => onPreview(req.key)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-green hover:underline">
                                            <Eye size={13} /> Preview
                                        </button>
                                        <a href={doc.url} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-green hover:underline">
                                            <Download size={13} /> Download
                                        </a>
                                    </>
                                )}
                                {editable && (
                                    <>
                                        <label htmlFor={inputId} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-green cursor-pointer">
                                            {replacingKey === req.key ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                                            {doc?.url ? 'Replace' : 'Upload'}
                                        </label>
                                        <input
                                            id={inputId}
                                            type="file"
                                            className="hidden"
                                            disabled={replacingKey === req.key}
                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplaceFile(req.key, f); e.target.value = ''; }}
                                        />
                                    </>
                                )}
                                {editable && doc?.url && (
                                    <div className="flex items-center gap-1 ml-auto">
                                        {(['PENDING', 'VERIFIED', 'NEEDS_CORRECTION'] as DocumentVerificationStatus[]).map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => onStatusChange(req.key, { status: s })}
                                                className={`px-2 py-0.5 text-[11px] font-medium rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${docStatus === s ? DOC_STATUS_COLORS[s] : 'bg-white text-slate-500 border-gray-200 hover:bg-slate-50'}`}
                                            >
                                                {DOC_STATUS_LABELS[s]}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Correction-comment field - shown only when
                                the document is actually marked Needs
                                Correction, and required before it can be
                                saved/forwarded. */}
                            {editable && doc?.url && docStatus === 'NEEDS_CORRECTION' && (
                                <div className="mt-2">
                                    <textarea
                                        rows={2}
                                        value={comment}
                                        onChange={(e) => onStatusChange(req.key, { comment: e.target.value })}
                                        placeholder="Explain what needs to be corrected for this document (required)..."
                                        className={`w-full rounded-md border p-1.5 text-xs focus:ring-1 focus:ring-green-500 focus:border-green-500 ${needsCommentWarning ? 'border-red-300' : 'border-gray-200'}`}
                                    />
                                    {needsCommentWarning && (
                                        <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1"><AlertCircle size={11} /> A correction reason is required.</p>
                                    )}
                                </div>
                            )}
                            {!editable && comment && (
                                <p className="mt-2 text-xs text-orange-700">Note: {comment}</p>
                            )}

                            {history.length > 0 && (
                                <details className="mt-2 text-xs">
                                    <summary className="cursor-pointer text-slate-500 hover:text-slate-700 select-none">Document history ({history.length})</summary>
                                    <ul className="mt-1.5 space-y-1.5 border-l-2 border-slate-100 pl-2.5">
                                        {[...history].reverse().map((h, i) => (
                                            <li key={i} className="text-slate-500">
                                                <span className="text-slate-700">{h.name || 'Previous file'}</span>
                                                {h.decision?.status && (
                                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${DOC_STATUS_COLORS[h.decision.status]}`}>{DOC_STATUS_LABELS[h.decision.status]}</span>
                                                )}
                                                <span className="block text-[11px] text-slate-400">Replaced {formatDateParts(h.replacedAt).date} {formatDateParts(h.replacedAt).time}</span>
                                                {h.url && <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline text-[11px]">View previous file</a>}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                    );
                })}
            </div>
        )}
    </div>
);

const ActivityHistorySection: React.FC<{ history: ApplicationHistoryEntry[] }> = ({ history }) => (
    <div className="rounded-xl border border-brand-border bg-brand-card p-4">
        <h3 className="text-sm font-semibold text-brand-text mb-3 flex items-center gap-1.5"><HistoryIcon size={14} className="text-brand-green" /> Activity History</h3>
        {history.length === 0 ? (
            <p className="text-sm text-brand-muted">No activity recorded yet.</p>
        ) : (
            <ol className="space-y-3">
                {history.map((h) => (
                    <li key={h.id} className="text-sm border-l-2 border-slate-200 pl-3">
                        <div className="flex flex-wrap justify-between items-baseline gap-x-3">
                            <span className="font-medium text-slate-800">{actionLabel(h.action)}</span>
                            <span className="text-xs text-slate-400">{formatDateParts(h.createdAt).date} {formatDateParts(h.createdAt).time}</span>
                        </div>
                        {(h.role || h.userName) && <p className="text-xs text-slate-500">{h.role}{h.userName ? ` - ${h.userName}` : ''}</p>}
                        {h.comments && <p className="text-slate-600 mt-0.5">{h.comments}</p>}
                        {h.reason && <p className="text-orange-700 mt-0.5">Reason: {h.reason}</p>}
                    </li>
                ))}
            </ol>
        )}
    </div>
);

// -----------------------------------------------------------------
// Document preview modal - zoom, rotation, PDF page navigation, and
// next/previous document controls (cycling through this application's
// document requirements in order).
// -----------------------------------------------------------------

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const DocumentPreviewModal: React.FC<{
    requirements: { key: string; label: string; required: boolean }[];
    documents: Record<string, UploadedDoc>;
    currentKey: string;
    onNavigate: (key: string) => void;
    onClose: () => void;
}> = ({ requirements, documents, currentKey, onNavigate, onClose }) => {
    // Keyed by currentKey at the call site (see the parent's
    // `<DocumentPreviewModal key={previewKey} .../>`), so this entire
    // component remounts - and these controls naturally reset to their
    // defaults - whenever the officer switches documents, without needing
    // an effect that calls setState on every key change.
    const [zoomIdx, setZoomIdx] = useState(2); // index into ZOOM_LEVELS, default 1x
    const [rotation, setRotation] = useState(0);
    const [pdfPage, setPdfPage] = useState(1);

    const currentIndex = requirements.findIndex((r) => r.key === currentKey);
    const currentReq = requirements[currentIndex];
    const doc = documents[currentKey];
    const zoom = ZOOM_LEVELS[zoomIdx];

    const goTo = (index: number) => {
        if (index < 0 || index >= requirements.length) return;
        onNavigate(requirements[index].key);
    };

    const isPdf = doc?.url ? isPdfUrl(doc.url) : false;
    const isImage = doc?.url ? isImageUrl(doc.url) : false;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-3 border-b border-brand-border gap-2 flex-wrap">
                    <div className="min-w-0">
                        <span className="text-sm font-medium text-brand-text truncate block">{documentLabel(currentKey)}</span>
                        {doc?.name && <span className="text-xs text-brand-muted truncate block">{doc.name}</span>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button disabled={zoomIdx <= 0} onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Zoom out"><ZoomOut size={16} /></button>
                        <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
                        <button disabled={zoomIdx >= ZOOM_LEVELS.length - 1} onClick={() => setZoomIdx((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Zoom in"><ZoomIn size={16} /></button>
                        <button onClick={() => setRotation((r) => (r + 90) % 360)} className="p-1.5 rounded text-slate-500 hover:bg-slate-100" title="Rotate"><RotateCw size={16} /></button>
                        {isPdf && (
                            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-200">
                                <button disabled={pdfPage <= 1} onClick={() => setPdfPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Previous page"><ChevronLeft size={16} /></button>
                                <span className="text-xs text-slate-500">Page {pdfPage}</span>
                                <button onClick={() => setPdfPage((p) => p + 1)} className="p-1.5 rounded text-slate-500 hover:bg-slate-100" title="Next page"><ChevronRight size={16} /></button>
                            </div>
                        )}
                        {doc?.url && (
                            <a href={doc.url} download target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-brand-green hover:bg-slate-100 ml-1" title="Download"><Download size={16} /></a>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:bg-slate-100 ml-1"><X size={18} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-50 flex items-center justify-center p-4 min-h-[50vh]">
                    {!doc?.url ? (
                        <div className="text-center text-slate-400">
                            <ImageIcon size={32} className="mx-auto mb-2" />
                            <p className="text-sm">No document has been uploaded for {documentLabel(currentKey)}.</p>
                        </div>
                    ) : isPdf ? (
                        <iframe
                            title={doc.name || currentKey}
                            src={`${doc.url}#page=${pdfPage}&zoom=${Math.round(zoom * 100)}`}
                            className="w-full h-[70vh] bg-white border border-slate-200 rounded"
                        />
                    ) : isImage ? (
                        <img
                            src={doc.url}
                            alt={doc.name || currentKey}
                            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 0.15s ease' }}
                            className="max-w-full max-h-[70vh] object-contain"
                        />
                    ) : (
                        <div className="text-center text-slate-400">
                            <FileText size={32} className="mx-auto mb-2" />
                            <p className="text-sm">Preview isn't available for this file type.</p>
                            <a href={doc.url} download target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline text-sm mt-1 inline-block">Download instead</a>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-3 border-t border-brand-border">
                    <button disabled={currentIndex <= 0} onClick={() => goTo(currentIndex - 1)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-50 disabled:opacity-40">
                        <ChevronsLeft size={14} /> Previous Document
                    </button>
                    <span className="text-xs text-slate-400">
                        {currentReq?.required ? 'Required' : 'Optional'} document {currentIndex + 1} of {requirements.length}
                    </span>
                    <button disabled={currentIndex >= requirements.length - 1} onClick={() => goTo(currentIndex + 1)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-50 disabled:opacity-40">
                        Next Document <ChevronsRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// -----------------------------------------------------------------
// Review panel (right column)
// -----------------------------------------------------------------

const SAVE_STATE_LABELS: Record<SaveState, { label: string; className: string; icon: React.ReactNode }> = {
    idle: { label: '', className: '', icon: null },
    unsaved: { label: 'Unsaved Changes', className: 'text-amber-700 bg-amber-50 border-amber-200', icon: <AlertCircle size={12} /> },
    saving: { label: 'Saving...', className: 'text-blue-700 bg-blue-50 border-blue-200', icon: <Loader2 size={12} className="animate-spin" /> },
    saved: { label: 'Saved', className: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 size={12} /> },
    failed: { label: 'Save Failed', className: 'text-red-700 bg-red-50 border-red-200', icon: <AlertCircle size={12} /> },
};

interface ReviewPanelProps {
    isResubmitted: boolean;
    isAwaitingCorrection: boolean;
    isForwarded: boolean;
    canStartReview: boolean;
    canWorkOn: boolean;
    submitting: boolean;
    saveState: SaveState;
    assignedOfficer?: string;
    checklistItems: { key: string; label: string }[];
    checklist: Record<string, boolean>;
    onToggleChecklist: (key: string) => void;
    internalNotes: string;
    onInternalNotesChange: (v: string) => void;
    applicantMessage: string;
    onApplicantMessageChange: (v: string) => void;
    verifiedRequiredCount: number;
    totalRequiredCount: number;
    canForward: boolean;
    incompleteItems: { label: string; targetId: string }[];
    onFocusItem: (targetId: string) => void;
    correctionHistoryEntry?: ApplicationHistoryEntry;
    onStartReview: () => void;
    onResumeReview: () => void;
    onSaveProgress: () => void;
    onVerifyAndForward: () => void;
    onOpenCorrectionForm: () => void;
    onResubmit: () => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({
    isResubmitted, isAwaitingCorrection, isForwarded, canStartReview, canWorkOn, submitting, saveState,
    assignedOfficer, checklistItems, checklist, onToggleChecklist,
    internalNotes, onInternalNotesChange, applicantMessage, onApplicantMessageChange,
    verifiedRequiredCount, totalRequiredCount, canForward, incompleteItems, onFocusItem,
    correctionHistoryEntry, onStartReview, onSaveProgress, onVerifyAndForward,
    onOpenCorrectionForm, onResubmit,
}) => {
    const saveBadge = SAVE_STATE_LABELS[saveState];
    return (
        <div className="rounded-xl border border-brand-border bg-brand-card p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-brand-text">Review Panel</h3>
                {canWorkOn && saveState !== 'idle' && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${saveBadge.className}`}>
                        {saveBadge.icon} {saveBadge.label}
                    </span>
                )}
            </div>

            <div className="text-xs">
                <span className="text-brand-muted">Assigned officer: </span>
                <span className="font-medium text-brand-text">{assignedOfficer || 'Unassigned'}</span>
            </div>

            {isForwarded && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                    <p className="font-medium flex items-center gap-1.5"><Send size={14} /> Forwarded to the Director-General</p>
                    <p className="text-xs mt-1 text-emerald-700">This application has been verified by Commercial and is now with the DG. The review below is read-only.</p>
                </div>
            )}

            {isAwaitingCorrection && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800 space-y-1">
                    <p className="font-medium">Awaiting applicant correction</p>
                    {correctionHistoryEntry?.reason && <p className="text-xs">{correctionHistoryEntry.reason}</p>}
                    <p className="text-xs text-orange-600">Requested {correctionHistoryEntry ? `${formatDateParts(correctionHistoryEntry.createdAt).date} ${formatDateParts(correctionHistoryEntry.createdAt).time}` : ''}</p>
                    <button
                        disabled={submitting}
                        onClick={onResubmit}
                        className="mt-2 w-full px-3 py-2 text-sm font-medium rounded-md text-white bg-brand-green hover:bg-brand-green-hover disabled:opacity-50"
                    >
                        Mark as Resubmitted
                    </button>
                </div>
            )}

            {isResubmitted && !isForwarded && !isAwaitingCorrection && (
                <div className="rounded-lg bg-sky-50 border border-sky-200 p-2.5 text-xs text-sky-800">
                    The applicant's correction has been received. Review the updated fields and replaced documents above before continuing.
                </div>
            )}

            {!isForwarded && (
                <>
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-brand-muted">Document Verification</span>
                            <span className="text-xs text-brand-muted">{verifiedRequiredCount}/{totalRequiredCount}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-brand-green" style={{ width: totalRequiredCount > 0 ? `${(verifiedRequiredCount / totalRequiredCount) * 100}%` : '0%' }} />
                        </div>
                        <p className="text-[11px] text-brand-muted mt-1">Each document's own status above is the source of truth for this count.</p>
                    </div>

                    <div>
                        <span className="text-xs font-semibold text-brand-muted block mb-1.5">Verification Checklist</span>
                        <div className="space-y-1.5">
                            {checklistItems.map((item) => (
                                <label key={item.key} id={`checklist-${item.key}`} className="flex items-start gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={!!checklist[item.key]}
                                        onChange={() => onToggleChecklist(item.key)}
                                        disabled={!canWorkOn && !canStartReview}
                                        className="mt-0.5 rounded border-gray-300 text-brand-green focus:ring-brand-green"
                                    />
                                    <span className="text-brand-text">{item.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-brand-muted mb-1">Internal Notes <span className="font-normal">(staff only)</span></label>
                        <textarea
                            rows={3}
                            value={internalNotes}
                            onChange={(e) => onInternalNotesChange(e.target.value)}
                            disabled={!canWorkOn}
                            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-slate-50"
                            placeholder="Notes visible only to LACRA staff..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-brand-muted mb-1">Message to Applicant <span className="font-normal">(draft, applicant-visible)</span></label>
                        <textarea
                            rows={2}
                            value={applicantMessage}
                            onChange={(e) => onApplicantMessageChange(e.target.value)}
                            disabled={!canWorkOn}
                            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-slate-50"
                            placeholder="Draft a message the applicant will see if a correction is requested..."
                        />
                    </div>
                </>
            )}

            <div className="pt-2 border-t border-brand-border space-y-2">
                {canStartReview && (
                    <button disabled={submitting} onClick={onStartReview} className="w-full px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                        {isResubmitted ? 'Resume Review' : 'Start Review'}
                    </button>
                )}
                {canWorkOn && (
                    <>
                        <button disabled={submitting} onClick={onSaveProgress} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md text-slate-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
                            <Save size={14} /> Save Progress
                        </button>
                        <button disabled={submitting} onClick={onOpenCorrectionForm} className="w-full px-4 py-2 text-sm font-medium rounded-md text-orange-700 bg-white border border-orange-300 hover:bg-orange-50 disabled:opacity-50">
                            Request Correction
                        </button>
                        <button
                            disabled={submitting || !canForward}
                            onClick={onVerifyAndForward}
                            className="w-full px-4 py-2 text-sm font-medium rounded-md text-white bg-brand-green hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Verify &amp; Forward to DG
                        </button>
                        {!canForward && incompleteItems.length > 0 && (
                            <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-md p-2 space-y-1">
                                <p className="font-medium flex items-center gap-1"><AlertTriangle size={12} className="flex-shrink-0" /> Cannot forward yet:</p>
                                <ul className="space-y-0.5">
                                    {incompleteItems.map((item) => (
                                        <li key={item.targetId}>
                                            <button type="button" onClick={() => onFocusItem(item.targetId)} className="text-left underline decoration-dotted hover:text-orange-900">
                                                {item.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default CommercialApplicationReview;

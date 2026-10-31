import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle2, Circle, Clock, FileText, Send, History as HistoryIcon,
    Eye, Download, AlertTriangle, ChevronRight, X, Loader2,
} from 'lucide-react';
import {
    getApplication, startCommercialReview, requestCorrection, verifyCommercial,
    resubmitAfterCorrection, saveCommercialReviewProgress,
    type ApplicationRecord, type ApplicationHistoryEntry, type DocumentVerificationStatus,
} from '../../api/applications';
import { useAuth } from '../../context/AuthContext';
import Alert from '../../components/forms/Alert';
import {
    categoryLabel, apiErrorMessage,
    commercialBadgeLabel, commercialBadgeColor, waitingTimeLabel,
} from './statusHelpers';
import { COMMODITY_LABELS } from '../apply/types';
import { DOCUMENT_REQUIREMENTS as DOC_REQUIREMENTS_BY_CATEGORY } from '../apply/documentRequirements';
import {
    APPLICANT_FIELD_LABELS, LEADERSHIP_FIELD_LABELS, BANK_FIELD_LABELS, LICENCE_FIELD_LABELS,
    WAREHOUSE_FIELD_LABELS, fieldLabel, displayValue, documentLabel,
} from './commercialReviewFields';

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
    const [previewDoc, setPreviewDoc] = useState<{ key: string; url: string; name: string } | null>(null);

    // Correction-form state.
    const [showCorrectionForm, setShowCorrectionForm] = useState(false);
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
            setDocStatuses(review?.documents || {});
            setChecklist(review?.checklist || {});
            setInternalNotes(review?.internalNotes || '');
            setApplicantMessage(review?.applicantMessageDraft || '');
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load this application.'));
        } finally {
            setLoading(false);
        }
    };

    const documentRequirements = useMemo(() => {
        if (!application) return [];
        return DOC_REQUIREMENTS_BY_CATEGORY[application.category] || [];
    }, [application]);

    // Category-based verification checklist - one item per required
    // document plus a final "information matches submission" check. Kept
    // derived from the real document requirements rather than hardcoded,
    // so it's always accurate for whichever category this application is.
    const checklistItems = useMemo(() => {
        const items = documentRequirements.filter((r) => r.required).map((r) => ({ key: `doc:${r.key}`, label: `${documentLabel(r.key)} verified` }));
        items.push({ key: 'info-match', label: 'Applicant and business information matches submitted documents' });
        return items;
    }, [documentRequirements]);

    const requiredDocKeys = useMemo(() => documentRequirements.filter((r) => r.required).map((r) => r.key), [documentRequirements]);
    const verifiedRequiredCount = requiredDocKeys.filter((k) => docStatuses[k]?.status === 'VERIFIED').length;
    const allRequiredVerified = requiredDocKeys.length > 0 && verifiedRequiredCount === requiredDocKeys.length;
    const allChecklistDone = checklistItems.every((item) => checklist[item.key]);
    const canForward = allRequiredVerified && allChecklistDone;

    const incompleteReasons: string[] = [];
    if (!allRequiredVerified) incompleteReasons.push(`${requiredDocKeys.length - verifiedRequiredCount} required document(s) not yet verified`);
    if (!allChecklistDone) incompleteReasons.push('verification checklist not fully completed');

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

    const canStartReview = isCommercial && (status === 'AWAITING_COMMERCIAL_VERIFICATION' || status === 'RETURNED_TO_COMMERCIAL');
    const isResubmitted = !!application.resubmittedAt && status === 'AWAITING_COMMERCIAL_VERIFICATION';
    const canWorkOn = isCommercial && status === 'COMMERCIAL_REVIEW_IN_PROGRESS';
    const isAwaitingCorrection = status === 'APPLICANT_CORRECTION_REQUIRED';
    const isForwarded = ['COMMERCIALLY_VERIFIED', 'AWAITING_FIRST_DG_APPROVAL', 'COMMERCIAL_STAGE_APPROVED'].includes(status);
    const correctionHistoryEntry = [...history].reverse().find((h) => h.action === 'CORRECTION_REQUESTED');

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

    const handleSaveProgress = () => runAction(
        () => saveCommercialReviewProgress(id!, { documents: docStatuses, checklist, internalNotes, applicantMessageDraft: applicantMessage }),
        'Review progress saved.'
    );

    const handleStartReview = () => runAction(() => startCommercialReview(id!), 'Review started.');
    const handleResumeReview = () => runAction(() => startCommercialReview(id!), 'Review resumed.');
    const handleVerifyAndForward = () => runAction(() => verifyCommercial(id!, internalNotes || undefined), 'Application verified and forwarded to the Director-General.');

    const handleSubmitCorrection = () => {
        const selected = Object.entries(correctionFields).filter(([, v]) => v).map(([k]) => k);
        const reasonParts = [
            selected.length > 0 ? `Affected items: ${selected.map((k) => documentLabel(k.replace('doc:', '')) || fieldLabel(k)).join(', ')}.` : '',
            correctionInstructions.trim(),
        ].filter(Boolean);
        const reason = reasonParts.join(' ') || 'Correction required.';
        runAction(() => requestCorrection(id!, reason), 'Correction requested from the applicant.').then(() => {
            setShowCorrectionForm(false);
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

    const progressIdx = currentProgressIndex(status);

    return (
        <div className="space-y-5">
            <button onClick={() => navigate(backToQueueUrl)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded">
                <ArrowLeft size={16} /> Back to queue
            </button>

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
                        <div><dt className="text-brand-muted">Submitted</dt><dd className="font-medium text-brand-text">{application.submittedAt ? new Date(application.submittedAt).toLocaleString() : 'Not available'}</dd></div>
                        <div><dt className="text-brand-muted">Assigned Officer</dt><dd className="font-medium text-brand-text">{assignedOfficer || 'Unassigned'}</dd></div>
                        <div><dt className="text-brand-muted">Waiting</dt><dd className="font-medium text-brand-text">{waitingTimeLabel(application.submittedAt)}</dd></div>
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

            {/* 70/30 two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-start">
                {/* Left: application information (≈70%) */}
                <div className="lg:col-span-7 space-y-4">
                    <ApplicantSection category={application.category} record={applicantRecord} />
                    <LicenceSection data={application.data as unknown as Record<string, unknown>} />
                    <OperationsSection data={application.data as unknown as Record<string, unknown>} />
                    <DocumentsSection
                        requirements={documentRequirements}
                        documents={(application.data?.documents || {}) as Record<string, UploadedDoc>}
                        statuses={docStatuses}
                        editable={canWorkOn}
                        onStatusChange={setDocStatus}
                        onPreview={(key, url, name) => setPreviewDoc({ key, url, name })}
                    />
                    <ActivityHistorySection history={history} />
                </div>

                {/* Right: review panel (≈30%), sticky on desktop */}
                <div className="lg:col-span-3">
                    <div className="lg:sticky lg:top-4 space-y-4">
                        <ReviewPanel
                            status={status}
                            isResubmitted={isResubmitted}
                            isAwaitingCorrection={isAwaitingCorrection}
                            isForwarded={isForwarded}
                            canStartReview={canStartReview}
                            canWorkOn={canWorkOn}
                            submitting={submitting}
                            assignedOfficer={assignedOfficer}
                            checklistItems={checklistItems}
                            checklist={checklist}
                            onToggleChecklist={(key) => setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))}
                            internalNotes={internalNotes}
                            onInternalNotesChange={setInternalNotes}
                            applicantMessage={applicantMessage}
                            onApplicantMessageChange={setApplicantMessage}
                            verifiedRequiredCount={verifiedRequiredCount}
                            totalRequiredCount={requiredDocKeys.length}
                            canForward={canForward}
                            incompleteReasons={incompleteReasons}
                            correctionHistoryEntry={correctionHistoryEntry}
                            onStartReview={handleStartReview}
                            onResumeReview={handleResumeReview}
                            onSaveProgress={handleSaveProgress}
                            onVerifyAndForward={handleVerifyAndForward}
                            onOpenCorrectionForm={() => setShowCorrectionForm(true)}
                            onResubmit={handleResubmit}
                        />
                    </div>
                </div>
            </div>

            {/* Correction form modal-style panel */}
            {showCorrectionForm && (
                <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowCorrectionForm(false)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-brand-text">Request Correction</h3>
                            <button onClick={() => setShowCorrectionForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
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
                            <button disabled={submitting || !correctionInstructions.trim()} onClick={handleSubmitCorrection} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50">
                                Send Correction Request
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document preview overlay */}
            {previewDoc && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setPreviewDoc(null)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-3 border-b border-brand-border">
                            <span className="text-sm font-medium text-brand-text truncate">{previewDoc.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <a href={previewDoc.url} download target="_blank" rel="noopener noreferrer" className="text-brand-green hover:text-brand-green-hover"><Download size={16} /></a>
                                <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-50">
                            {/\.pdf($|\?)/i.test(previewDoc.url) ? (
                                <iframe title={previewDoc.name} src={previewDoc.url} className="w-full h-[70vh]" />
                            ) : (
                                <img src={previewDoc.url} alt={previewDoc.name} className="max-w-full mx-auto" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// -----------------------------------------------------------------
// Application information sections
// -----------------------------------------------------------------

const ApplicantSection: React.FC<{ category: string; record: Record<string, unknown> | null }> = ({ record }) => {
    if (!record) {
        return (
            <FieldGrid title="Applicant and Business Information">
                <Field label="Status" value="No applicant information available" missing />
            </FieldGrid>
        );
    }
    // Merge the identity/business labels and leadership/bank labels into
    // one grid, de-duplicating by key so the same field is never shown
    // twice (e.g. a category that happens to define both fullName and
    // legalName only shows whichever is actually present).
    const allLabels = { ...APPLICANT_FIELD_LABELS, ...LEADERSHIP_FIELD_LABELS, ...BANK_FIELD_LABELS };
    const entries = Object.entries(record).filter(([key, value]) => allLabels[key] && typeof value !== 'object');
    return (
        <FieldGrid title="Applicant and Business Information" icon={<FileText size={14} className="text-brand-green" />}>
            {entries.length === 0 ? (
                <Field label="Status" value="Not provided" missing />
            ) : (
                entries.map(([key, value]) => (
                    <Field key={key} label={allLabels[key]} value={displayValue(value)} missing={displayValue(value) === 'Not provided'} />
                ))
            )}
        </FieldGrid>
    );
};

const LicenceSection: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
    const step1 = (data?.step1 as Record<string, unknown>) || {};
    const category = (step1.category as string) || '';
    const categoryRecord = getApplicantRecord(category, data) || {};
    const entries = Object.entries({ ...step1, ...categoryRecord }).filter(([key]) => LICENCE_FIELD_LABELS[key]);
    if (entries.length === 0) return null;
    return (
        <FieldGrid title="Licence and Commodity Details">
            {entries.map(([key, value]) => (
                <Field key={key} label={LICENCE_FIELD_LABELS[key]} value={displayValue(value)} />
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
                        <Field key={key} label={WAREHOUSE_FIELD_LABELS[key]} value={displayValue(value)} />
                    ))
            )}
        </FieldGrid>
    );
};

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
    editable: boolean;
    onStatusChange: (key: string, patch: Partial<{ status: DocumentVerificationStatus; comment: string }>) => void;
    onPreview: (key: string, url: string, name: string) => void;
}> = ({ requirements, documents, statuses, editable, onStatusChange, onPreview }) => (
    <div className="rounded-xl border border-brand-border bg-brand-card p-4">
        <h3 className="text-sm font-semibold text-brand-text mb-3 flex items-center gap-1.5"><FileText size={14} className="text-brand-green" /> Supporting Documents</h3>
        {requirements.length === 0 ? (
            <p className="text-sm text-brand-muted">No documents are required for this application category.</p>
        ) : (
            <div className="space-y-2.5">
                {requirements.map((req) => {
                    const doc = documents[req.key];
                    const docStatus = statuses[req.key]?.status || 'PENDING';
                    return (
                        <div key={req.key} className="rounded-lg border border-slate-100 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-brand-text">
                                        {documentLabel(req.key)}{req.required && <span className="text-red-500"> *</span>}
                                    </p>
                                    <p className="text-xs text-brand-muted mt-0.5 truncate">
                                        {doc?.name ? doc.name : 'Not provided'}
                                    </p>
                                </div>
                                <span className={`flex-shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded-full ${DOC_STATUS_COLORS[docStatus]}`}>
                                    {DOC_STATUS_LABELS[docStatus]}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                {doc?.url && (
                                    <>
                                        <button onClick={() => onPreview(req.key, doc.url!, doc.name || req.label)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-green hover:underline">
                                            <Eye size={13} /> Preview
                                        </button>
                                        <a href={doc.url} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-green hover:underline">
                                            <Download size={13} /> Download
                                        </a>
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
                            {editable && doc?.url && (
                                <input
                                    type="text"
                                    value={statuses[req.key]?.comment || ''}
                                    onChange={(e) => onStatusChange(req.key, { comment: e.target.value })}
                                    placeholder="Add a correction comment for this document (optional)..."
                                    className="mt-2 w-full rounded-md border border-gray-200 p-1.5 text-xs focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                />
                            )}
                            {!editable && statuses[req.key]?.comment && (
                                <p className="mt-2 text-xs text-orange-700">Note: {statuses[req.key]?.comment}</p>
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
                            <span className="font-medium text-slate-800">{h.action.replace(/_/g, ' ')}</span>
                            <span className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString()}</span>
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
// Review panel (right column)
// -----------------------------------------------------------------

interface ReviewPanelProps {
    status: string;
    isResubmitted: boolean;
    isAwaitingCorrection: boolean;
    isForwarded: boolean;
    canStartReview: boolean;
    canWorkOn: boolean;
    submitting: boolean;
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
    incompleteReasons: string[];
    correctionHistoryEntry?: ApplicationHistoryEntry;
    onStartReview: () => void;
    onResumeReview: () => void;
    onSaveProgress: () => void;
    onVerifyAndForward: () => void;
    onOpenCorrectionForm: () => void;
    onResubmit: () => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({
    isResubmitted, isAwaitingCorrection, isForwarded, canStartReview, canWorkOn, submitting,
    assignedOfficer, checklistItems, checklist, onToggleChecklist,
    internalNotes, onInternalNotesChange, applicantMessage, onApplicantMessageChange,
    verifiedRequiredCount, totalRequiredCount, canForward, incompleteReasons,
    correctionHistoryEntry, onStartReview, onSaveProgress, onVerifyAndForward,
    onOpenCorrectionForm, onResubmit,
}) => (
    <div className="rounded-xl border border-brand-border bg-brand-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-brand-text">Review Panel</h3>

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
                <p className="text-xs text-orange-600">Requested {correctionHistoryEntry ? new Date(correctionHistoryEntry.createdAt).toLocaleString() : ''}</p>
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
                </div>

                <div>
                    <span className="text-xs font-semibold text-brand-muted block mb-1.5">Verification Checklist</span>
                    <div className="space-y-1.5">
                        {checklistItems.map((item) => (
                            <label key={item.key} className="flex items-start gap-2 text-sm">
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
                    <label className="block text-xs font-semibold text-brand-muted mb-1">Message to Applicant <span className="font-normal">(draft)</span></label>
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
                    <button disabled={submitting} onClick={onSaveProgress} className="w-full px-4 py-2 text-sm font-medium rounded-md text-slate-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
                        Save Progress
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
                    {!canForward && (
                        <p className="text-xs text-orange-600 flex items-start gap-1">
                            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                            <span>Cannot forward yet: {incompleteReasons.join('; ')}.</span>
                        </p>
                    )}
                </>
            )}
        </div>
    </div>
);

export default CommercialApplicationReview;

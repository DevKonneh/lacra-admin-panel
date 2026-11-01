import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle2, Circle, Clock, FileText, History as HistoryIcon,
    Eye, Download, AlertTriangle, ChevronRight, X, Loader2, ZoomIn, ZoomOut, RotateCw,
    ChevronLeft, ChevronsLeft, ChevronsRight, Image as ImageIcon,
    ClipboardList, ShieldCheck, Info,
} from 'lucide-react';
import {
    getApplication, dgApprove, dgReturn, dgApproveSecond, dgReturnToTechnical,
    dgApproveFinal, dgReturnToFinance,
    type ApplicationRecord, type ApplicationHistoryEntry, type WarehouseAssessmentRecord,
    type InvoiceRecord, type PaymentSubmissionRecord, type CertificateRecord,
} from '../../api/applications';
import { useAuth } from '../../context/AuthContext';
import Alert from '../../components/forms/Alert';
import {
    categoryLabel, apiErrorMessage, formatDateParts, durationLabel,
    OUTCOME_LABELS, PAYMENT_METHOD_LABELS,
} from './statusHelpers';
import { COMMODITY_LABELS } from '../apply/types';
import { DOCUMENT_REQUIREMENTS as DOC_REQUIREMENTS_BY_CATEGORY } from '../apply/documentRequirements';
import {
    APPLICANT_FIELD_LABELS, LEADERSHIP_FIELD_LABELS, BANK_FIELD_LABELS, LICENCE_FIELD_LABELS,
    WAREHOUSE_FIELD_LABELS, documentLabel, applicantFieldSection,
    fieldDisplayValue, isFieldMissing, type FieldDisplayContext,
} from './commercialReviewFields';
import { DG_QUEUE_ORDER_KEY } from './DGApprovalQueue';

type UploadedDoc = { url?: string; name?: string; size?: number; type?: string } | null | undefined;

type Stage = 'FIRST' | 'SECOND' | 'FINAL';

const STAGE_STATUS: Record<Stage, string> = {
    FIRST: 'AWAITING_FIRST_DG_APPROVAL',
    SECOND: 'AWAITING_SECOND_DG_APPROVAL',
    FINAL: 'AWAITING_FINAL_DG_APPROVAL',
};

const STAGE_LABELS: Record<Stage, string> = {
    FIRST: 'Commercial Approval',
    SECOND: 'Technical Approval',
    FINAL: 'Final Approval',
};

// Next destination after approving each stage - driven by the actual
// configured workflow (verifyCommercial -> dgApprove -> AWAITING_TECHNICAL_REVIEW,
// etc, see ApplicationController.ts), not a fictional simplification.
const NEXT_DESTINATION_LABEL: Record<Stage, string> = {
    FIRST: 'Technical Review',
    SECOND: 'Billing Review',
    FINAL: 'IT Certificate Printing',
};

const RETURN_DESTINATION_LABEL: Record<Stage, string> = {
    FIRST: 'Commercial and Marketing',
    SECOND: 'Technical Services',
    FINAL: 'Finance',
};

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

// The ACTUAL configured workflow stages, in order, spanning every
// department this application passes through - not a fictional/simplified
// 3-step version. Each DG decision step is visually distinct from a
// department's own review step, and from "final overall application
// approval" (only the very last DG step, Final Approval, represents that).
const WORKFLOW_STEPS: { label: string; statuses: string[] }[] = [
    { label: 'Submitted', statuses: ['SUBMITTED'] },
    {
        label: 'Commercial Review', statuses: [
            'AWAITING_COMMERCIAL_VERIFICATION', 'COMMERCIAL_REVIEW_IN_PROGRESS',
            'APPLICANT_CORRECTION_REQUIRED', 'RETURNED_TO_COMMERCIAL', 'COMMERCIALLY_VERIFIED',
        ],
    },
    { label: 'DG: Commercial Approval', statuses: ['AWAITING_FIRST_DG_APPROVAL', 'COMMERCIAL_STAGE_APPROVED'] },
    {
        label: 'Technical Review', statuses: [
            'AWAITING_TECHNICAL_REVIEW', 'INSPECTOR_ASSIGNMENT_PENDING', 'INSPECTOR_ASSIGNED',
            'WAREHOUSE_INSPECTION_SCHEDULED', 'WAREHOUSE_ASSESSMENT_IN_PROGRESS', 'WAREHOUSE_ASSESSMENT_SUBMITTED',
            'WAREHOUSE_REINSPECTION_REQUIRED', 'AWAITING_TECHNICAL_VERIFICATION', 'TECHNICALLY_VERIFIED',
        ],
    },
    { label: 'DG: Technical Approval', statuses: ['AWAITING_SECOND_DG_APPROVAL', 'RETURNED_TO_TECHNICAL_SERVICES', 'TECHNICAL_STAGE_APPROVED'] },
    {
        label: 'Billing & Payment', statuses: [
            'AWAITING_BILLING_REVIEW', 'BILLING_REVIEW_IN_PROGRESS', 'INVOICE_APPROVED', 'AWAITING_APPLICANT_PAYMENT',
            'PAYMENT_SUBMITTED', 'PAYMENT_VERIFICATION_PENDING', 'PAYMENT_CORRECTION_REQUIRED', 'PENDING_CHEQUE_CLEARANCE',
            'PAYMENT_VERIFIED', 'RETURNED_TO_FINANCE',
        ],
    },
    { label: 'DG: Final Approval', statuses: ['AWAITING_FINAL_DG_APPROVAL', 'APPROVED_FOR_ISSUANCE'] },
    { label: 'Certificate Issuance', statuses: ['AWAITING_IT_CERTIFICATE_PRINTING', 'CERTIFICATE_PRINTED', 'ISSUED'] },
];

function workflowStepIndex(status: string): number {
    const idx = WORKFLOW_STEPS.findIndex((s) => s.statuses.includes(status));
    return idx >= 0 ? idx : 0;
}

// Friendlier labels for every Activity History action code produced by
// ApplicationController.ts across the whole workflow (not just Commercial)
// - purely cosmetic, does not affect what's recorded or any workflow logic.
const ACTION_LABELS: Record<string, string> = {
    SUBMITTED: 'Application Submitted',
    ROUTED_TO_COMMERCIAL: 'Routed to Commercial and Marketing',
    COMMERCIAL_REVIEW_STARTED: 'Commercial Review Started',
    CORRECTION_REQUESTED: 'Correction Requested from Applicant',
    RESUBMITTED: 'Resubmitted by Applicant',
    DOCUMENT_REPLACED: 'Document Replaced',
    COMMERCIALLY_VERIFIED: 'Verified by Commercial and Marketing',
    ROUTED_TO_DG: 'Routed to Director-General (Commercial Approval)',
    DG_FIRST_APPROVAL: 'Approved by Director-General (Commercial Stage)',
    DG_RETURNED_TO_COMMERCIAL: 'Returned to Commercial by Director-General',
    ROUTED_TO_TECHNICAL: 'Routed to Technical Services',
    TECHNICALLY_VERIFIED: 'Verified by Technical Services',
    ROUTED_TO_DG_SECOND: 'Routed to Director-General (Technical Approval)',
    DG_SECOND_APPROVAL: 'Approved by Director-General (Technical Stage)',
    DG_RETURNED_TO_TECHNICAL: 'Returned to Technical Services by Director-General',
    REINSPECTION_REQUIRED: 'Reinspection Required',
    ROUTED_TO_BILLING: 'Routed to Billing',
    INVOICE_APPROVED: 'Invoice Approved',
    ROUTED_TO_PAYMENT: 'Routed to Applicant for Payment',
    PAYMENT_SUBMITTED: 'Payment Submitted',
    ROUTED_TO_PAYMENT_VERIFICATION: 'Routed for Payment Verification',
    PAYMENT_CORRECTION_REQUIRED: 'Payment Correction Required',
    PENDING_CHEQUE_CLEARANCE: 'Pending Cheque Clearance',
    PAYMENT_VERIFIED: 'Payment Verified by Finance',
    CHEQUE_CLEARED: 'Cheque Cleared by Finance',
    ROUTED_TO_FINAL_DG_APPROVAL: 'Routed to Director-General (Final Approval)',
    DG_FINAL_APPROVAL: 'Final Approval Given by Director-General',
    DG_RETURNED_TO_FINANCE: 'Returned to Finance by Director-General',
    ROUTED_TO_IT: 'Routed to IT for Certificate Printing',
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

// -----------------------------------------------------------------
// Stage-specific Department Review Summary - built entirely from actual
// saved review data (commercialReview, warehouseAssessments, invoices,
// payments, and ApplicationHistoryEntry rows). Never fabricates a
// positive-sounding recommendation: every field falls back to the literal
// string "Not recorded" when nothing was actually saved.
// -----------------------------------------------------------------

interface StageSummary {
    stageTitle: string;
    departmentLabel: string;
    reviewingOfficer: string;
    recommendation: string;
    completedAt?: string;
    forwardedAt?: string;
    findings: string;
    documentChecks?: { label: string; verified: boolean }[];
    checklistItems?: { label: string; done: boolean }[];
    unresolvedIssues: string[];
    previousReturn?: { reason: string; returnedAt: string; departmentResponse: string; respondedAt?: string };
}

function buildStageSummary(
    stage: Stage,
    application: ApplicationRecord,
    history: ApplicationHistoryEntry[],
    warehouseAssessments: WarehouseAssessmentRecord[],
    invoices: InvoiceRecord[],
    payments: PaymentSubmissionRecord[],
): StageSummary {
    const findLast = (actions: string[]) => [...history].reverse().find((h) => actions.includes(h.action));

    if (stage === 'FIRST') {
        const completed = findLast(['COMMERCIALLY_VERIFIED']);
        const forwarded = findLast(['ROUTED_TO_DG']);
        const returned = findLast(['DG_RETURNED_TO_COMMERCIAL']);
        const docs = application.commercialReview?.documents || {};
        const requirements = DOC_REQUIREMENTS_BY_CATEGORY[application.category] || [];
        const documentChecks = requirements.map((r) => ({ label: documentLabel(r.key), verified: docs[r.key]?.status === 'VERIFIED' }));
        const checklistItems = [{ label: 'Applicant and business information matches submitted documents', done: !!application.commercialReview?.checklist?.['info-match'] }];
        const unresolvedIssues = Object.entries(docs)
            .filter(([, v]) => v?.status === 'NEEDS_CORRECTION')
            .map(([key, v]) => `${documentLabel(key)}${v?.comment ? `: ${v.comment}` : ''}`);
        let departmentResponse = 'Not recorded';
        let respondedAt: string | undefined;
        if (returned) {
            const afterReturn = [...history].filter((h) => new Date(h.createdAt).getTime() > new Date(returned.createdAt).getTime());
            const resp = afterReturn.find((h) => h.action === 'COMMERCIALLY_VERIFIED' || h.action === 'RESUBMITTED');
            if (resp) { departmentResponse = resp.comments || 'Not recorded'; respondedAt = resp.createdAt; }
        }
        return {
            stageTitle: 'Commercial Review Summary',
            departmentLabel: 'Commercial and Marketing Department',
            reviewingOfficer: completed?.userName || 'Not recorded',
            recommendation: completed ? 'Verified - recommended for Director-General approval' : 'Not recorded',
            completedAt: completed?.createdAt,
            forwardedAt: forwarded?.createdAt,
            findings: application.commercialReview?.internalNotes || 'Not recorded',
            documentChecks,
            checklistItems,
            unresolvedIssues,
            previousReturn: returned ? { reason: returned.reason || 'Not recorded', returnedAt: returned.createdAt, departmentResponse, respondedAt } : undefined,
        };
    }

    if (stage === 'SECOND') {
        const completed = findLast(['TECHNICALLY_VERIFIED']);
        const forwarded = findLast(['ROUTED_TO_DG_SECOND']);
        const returned = findLast(['DG_RETURNED_TO_TECHNICAL']);
        const currentAssessment = [...warehouseAssessments].sort((a, b) => b.versionNumber - a.versionNumber)[0];
        const unresolvedIssues: string[] = [];
        if (currentAssessment?.outcome === 'FAIL') unresolvedIssues.push('Warehouse assessment outcome: Fail');
        if (currentAssessment?.outcome === 'PASS_WITH_CONDITIONS') unresolvedIssues.push('Warehouse assessment outcome: Pass with Conditions');
        let departmentResponse = 'Not recorded';
        let respondedAt: string | undefined;
        if (returned) {
            const afterReturn = [...history].filter((h) => new Date(h.createdAt).getTime() > new Date(returned.createdAt).getTime());
            const resp = afterReturn.find((h) => h.action === 'TECHNICALLY_VERIFIED' || h.action === 'REINSPECTION_REQUIRED');
            if (resp) { departmentResponse = resp.comments || 'Not recorded'; respondedAt = resp.createdAt; }
        }
        return {
            stageTitle: 'Technical Review Summary',
            departmentLabel: 'Technical Services Department',
            reviewingOfficer: completed?.userName || currentAssessment?.inspectorName || 'Not recorded',
            recommendation: currentAssessment?.outcome ? OUTCOME_LABELS[currentAssessment.outcome] : 'Not recorded',
            completedAt: completed?.createdAt,
            forwardedAt: forwarded?.createdAt,
            findings: currentAssessment?.notes || 'Not recorded',
            unresolvedIssues,
            previousReturn: returned ? { reason: returned.reason || 'Not recorded', returnedAt: returned.createdAt, departmentResponse, respondedAt } : undefined,
        };
    }

    // FINAL stage - Finance / Payment Summary.
    const completed = findLast(['PAYMENT_VERIFIED', 'CHEQUE_CLEARED']);
    const forwarded = findLast(['ROUTED_TO_FINAL_DG_APPROVAL']);
    const returned = findLast(['DG_RETURNED_TO_FINANCE']);
    const currentInvoice = [...invoices].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    const currentPayment = [...payments].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    const unresolvedIssues: string[] = [];
    if (currentPayment && currentInvoice && currentPayment.amountPaid != null && currentPayment.amountPaid < currentInvoice.amount) {
        unresolvedIssues.push(`Amount paid (${currentInvoice.currency} ${currentPayment.amountPaid.toLocaleString()}) is less than the invoiced amount (${currentInvoice.currency} ${currentInvoice.amount.toLocaleString()})`);
    }
    let departmentResponse = 'Not recorded';
    let respondedAt: string | undefined;
    if (returned) {
        const afterReturn = [...history].filter((h) => new Date(h.createdAt).getTime() > new Date(returned.createdAt).getTime());
        const resp = afterReturn.find((h) => h.action === 'PAYMENT_VERIFIED' || h.action === 'CHEQUE_CLEARED' || h.action === 'INVOICE_APPROVED');
        if (resp) { departmentResponse = resp.comments || 'Not recorded'; respondedAt = resp.createdAt; }
    }
    return {
        stageTitle: 'Finance and Payment Summary',
        departmentLabel: 'Finance Department',
        reviewingOfficer: completed?.userName || 'Not recorded',
        recommendation: completed ? 'Payment verified - recommended for final approval' : 'Not recorded',
        completedAt: completed?.createdAt,
        forwardedAt: forwarded?.createdAt,
        findings: currentPayment?.notes || currentInvoice?.notes || 'Not recorded',
        unresolvedIssues,
        previousReturn: returned ? { reason: returned.reason || 'Not recorded', returnedAt: returned.createdAt, departmentResponse, respondedAt } : undefined,
    };
}

const StageSummarySection: React.FC<{
    summary: StageSummary;
    invoice?: InvoiceRecord;
    payment?: PaymentSubmissionRecord;
}> = ({ summary, invoice, payment }) => (
    <div className="rounded-xl border-2 border-brand-green/30 bg-brand-green/5 p-4 space-y-3">
        <h3 className="text-sm font-bold text-brand-text flex items-center gap-1.5">
            <ShieldCheck size={16} className="text-brand-green" /> {summary.stageTitle}
        </h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-[11px] uppercase tracking-wide text-brand-muted">Reviewing Department</dt><dd className="font-medium text-brand-text">{summary.departmentLabel}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-brand-muted">Reviewing Officer</dt><dd className="font-medium text-brand-text">{summary.reviewingOfficer}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-brand-muted">Recorded Recommendation</dt><dd className="font-medium text-brand-text">{summary.recommendation}</dd></div>
            <div>
                <dt className="text-[11px] uppercase tracking-wide text-brand-muted">Review Completed</dt>
                <dd className="font-medium text-brand-text">{summary.completedAt ? `${formatDateParts(summary.completedAt).date} ${formatDateParts(summary.completedAt).time}` : 'Not recorded'}</dd>
            </div>
            <div>
                <dt className="text-[11px] uppercase tracking-wide text-brand-muted">Forwarded to DG</dt>
                <dd className="font-medium text-brand-text">{summary.forwardedAt ? `${formatDateParts(summary.forwardedAt).date} ${formatDateParts(summary.forwardedAt).time}` : 'Not recorded'}</dd>
            </div>
            {invoice && (
                <div><dt className="text-[11px] uppercase tracking-wide text-brand-muted">Invoice</dt><dd className="font-medium text-brand-text">{invoice.invoiceNumber} - {invoice.currency} {invoice.amount.toLocaleString()}</dd></div>
            )}
            {payment && (
                <div><dt className="text-[11px] uppercase tracking-wide text-brand-muted">Payment</dt><dd className="font-medium text-brand-text">{payment.method ? PAYMENT_METHOD_LABELS[payment.method] : 'Not recorded'}{payment.amountPaid != null ? ` - ${payment.amountPaid.toLocaleString()}` : ''}</dd></div>
            )}
        </dl>

        {summary.documentChecks && summary.documentChecks.length > 0 && (
            <div>
                <p className="text-[11px] uppercase tracking-wide text-brand-muted mb-1.5">Required Document Verification Results</p>
                <div className="flex flex-wrap gap-1.5">
                    {summary.documentChecks.map((d) => (
                        <span key={d.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${d.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {d.verified ? <CheckCircle2 size={11} /> : <Circle size={11} />} {d.label}
                        </span>
                    ))}
                </div>
            </div>
        )}

        {summary.checklistItems && summary.checklistItems.length > 0 && (
            <div>
                <p className="text-[11px] uppercase tracking-wide text-brand-muted mb-1.5">Completed Information Checks</p>
                <ul className="space-y-1">
                    {summary.checklistItems.map((c) => (
                        <li key={c.label} className="flex items-center gap-1.5 text-sm text-brand-text">
                            {c.done ? <CheckCircle2 size={13} className="text-brand-green flex-shrink-0" /> : <Circle size={13} className="text-slate-300 flex-shrink-0" />}
                            {c.label}
                        </li>
                    ))}
                </ul>
            </div>
        )}

        <div>
            <p className="text-[11px] uppercase tracking-wide text-brand-muted mb-1">Officer's Findings and Remarks</p>
            <p className={`text-sm ${summary.findings === 'Not recorded' ? 'text-slate-400 italic' : 'text-brand-text'}`}>{summary.findings}</p>
        </div>

        {summary.unresolvedIssues.length > 0 && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-orange-700 font-semibold mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Unresolved Issues</p>
                <ul className="list-disc list-inside text-sm text-orange-800 space-y-0.5">
                    {summary.unresolvedIssues.map((i) => <li key={i}>{i}</li>)}
                </ul>
            </div>
        )}

        {summary.previousReturn && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">Previous Director-General Return</p>
                <p className="text-sm text-amber-900"><span className="font-medium">Reason:</span> {summary.previousReturn.reason}</p>
                <p className="text-[11px] text-amber-600">Returned {formatDateParts(summary.previousReturn.returnedAt).date} {formatDateParts(summary.previousReturn.returnedAt).time}</p>
                <p className="text-sm text-amber-900"><span className="font-medium">Department's Response:</span> {summary.previousReturn.departmentResponse}</p>
                {summary.previousReturn.respondedAt && (
                    <p className="text-[11px] text-amber-600">Responded {formatDateParts(summary.previousReturn.respondedAt).date} {formatDateParts(summary.previousReturn.respondedAt).time}</p>
                )}
            </div>
        )}
    </div>
);

// -----------------------------------------------------------------
// Application information sections (read-only on the DG decision screen -
// the DG reviews what departments have already verified, never re-edits
// submitted information or document verification itself).
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
// Supporting Documents - read-only on the DG decision screen. For the
// Commercial-approval stage, a per-document verification badge is shown
// using the saved commercialReview.documents status (the only stage that
// tracks per-document verification); verifying officer/timestamp are
// shown at the best-effort granularity actually available (the officer
// and completion time of the Commercial review as a whole, since
// individual document-level officer/timestamp are not separately
// recorded by the backend). Technical/Final stages show the same
// documents without a verification badge, since no per-document
// verification step exists for those departments in this workflow.
// -----------------------------------------------------------------

const DOC_STATUS_LABELS: Record<string, string> = { PENDING: 'Pending', VERIFIED: 'Verified', NEEDS_CORRECTION: 'Needs Correction' };
const DOC_STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-slate-100 text-slate-600 border border-slate-200',
    VERIFIED: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    NEEDS_CORRECTION: 'bg-orange-100 text-orange-700 border border-orange-200',
};

const ReadOnlyDocumentsSection: React.FC<{
    requirements: { key: string; label: string; required: boolean }[];
    documents: Record<string, UploadedDoc>;
    statuses: Record<string, { status: string; comment?: string }>;
    showVerificationBadge: boolean;
    verifiedBy?: string;
    verifiedAt?: string;
    onPreview: (key: string) => void;
}> = ({ requirements, documents, statuses, showVerificationBadge, verifiedBy, verifiedAt, onPreview }) => (
    <div className="rounded-xl border border-brand-border bg-brand-card p-4">
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-brand-text flex items-center gap-1.5"><FileText size={14} className="text-brand-green" /> Supporting Documents</h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Read-only</span>
        </div>
        {requirements.length === 0 ? (
            <p className="text-sm text-brand-muted">No documents are required for this application category.</p>
        ) : (
            <div className="space-y-2">
                {requirements.map((req) => {
                    const doc = documents[req.key];
                    const docStatus = statuses[req.key]?.status || 'PENDING';
                    return (
                        <div key={req.key} className="rounded-lg border border-slate-100 p-2.5">
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
                                    </div>
                                    <p className="text-xs text-brand-muted truncate">{doc?.name || 'Not provided'}</p>
                                    {showVerificationBadge && doc?.url && (verifiedBy || verifiedAt) && docStatus === 'VERIFIED' && (
                                        <p className="text-[11px] text-slate-400 truncate">
                                            Verified by {verifiedBy || 'Not recorded'}{verifiedAt ? ` on ${formatDateParts(verifiedAt).date}` : ''}
                                        </p>
                                    )}
                                </div>
                                {showVerificationBadge && (
                                    <span className={`flex-shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded-full ${DOC_STATUS_COLORS[docStatus]}`}>
                                        {DOC_STATUS_LABELS[docStatus]}
                                    </span>
                                )}
                            </div>
                            {doc?.url && (
                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                    <button onClick={() => onPreview(req.key)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-green hover:underline">
                                        <Eye size={13} /> Preview
                                    </button>
                                    <a href={doc.url} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-green hover:underline">
                                        <Download size={13} /> Download
                                    </a>
                                </div>
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
// Document preview modal - identical in behaviour to Commercial's, kept
// as a local copy since the component isn't exported for reuse.
// -----------------------------------------------------------------

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const DocumentPreviewModal: React.FC<{
    requirements: { key: string; label: string; required: boolean }[];
    documents: Record<string, UploadedDoc>;
    currentKey: string;
    onNavigate: (key: string) => void;
    onClose: () => void;
}> = ({ requirements, documents, currentKey, onNavigate, onClose }) => {
    const [zoomIdx, setZoomIdx] = useState(2);
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
// Main page
// -----------------------------------------------------------------

const DGApplicationReview: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    const [application, setApplication] = useState<ApplicationRecord | null>(null);
    const [history, setHistory] = useState<ApplicationHistoryEntry[]>([]);
    const [warehouseAssessments, setWarehouseAssessments] = useState<WarehouseAssessmentRecord[]>([]);
    const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
    const [payments, setPayments] = useState<PaymentSubmissionRecord[]>([]);
    const [, setCertificate] = useState<CertificateRecord | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [dgRemarks, setDgRemarks] = useState('');
    const [previewKey, setPreviewKey] = useState<string | null>(null);

    const [showReturnForm, setShowReturnForm] = useState(false);
    const [returnStep, setReturnStep] = useState<'form' | 'summary'>('form');
    const [returnItems, setReturnItems] = useState<Record<string, boolean>>({});
    const [returnInstructions, setReturnInstructions] = useState('');

    // Which stage tab the DG arrived from (round-tripped in the URL by the
    // queue, same as Commercial's searchParams pattern) - used to pick the
    // right stage context/summary/labels even if, by the time this page
    // loads, the application has already moved past or not yet reached
    // that exact status (in which case the page renders read-only).
    const stageParam = (searchParams.get('stage') as Stage) || 'FIRST';
    const stage: Stage = STAGE_STATUS[stageParam] ? stageParam : 'FIRST';

    const backToQueueUrl = `/applications/dg-queue?${searchParams.toString()}`;

    React.useEffect(() => {
        if (id) load(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const load = async (appId: string) => {
        setLoading(true);
        setError('');
        try {
            const response = await getApplication(appId);
            const { history: h, warehouseAssessments: wa, invoices: inv, payments: pay, certificate: cert, ...app } = response.data.data;
            setApplication(app);
            setHistory(h || []);
            setWarehouseAssessments(wa || []);
            setInvoices(inv || []);
            setPayments(pay || []);
            setCertificate(cert);
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
    const isDG = role === 'DG' || role === 'ADMIN';
    const status = application.status;
    const applicantRecord = getApplicantRecord(application.category, application.data as unknown as Record<string, unknown>);
    const businessName = (applicantRecord?.legalName || applicantRecord?.businessName) as string | undefined;
    const applicantName = (applicantRecord?.fullName || applicantRecord?.repFullName) as string | undefined;
    const county = (applicantRecord?.county || application.data?.warehouse?.county) as string | undefined;
    const step1 = (application.data as unknown as Record<string, unknown>)?.step1 as Record<string, unknown> | undefined;
    const fieldContext: FieldDisplayContext = { isRenewal: step1?.isRenewal as boolean | undefined };

    // Only actionable (decision buttons enabled) when the application's
    // ACTUAL current status matches the stage this page is showing - this
    // is what makes an already-decided application render read-only
    // (section 7's "completed decisions are read-only records"), and is
    // what the backend's own requireStatus() 409-guard enforces server-side
    // regardless of what the UI allows.
    const isActionable = isDG && status === STAGE_STATUS[stage];
    const alreadyDecided = status !== STAGE_STATUS[stage];

    const stageSummary = buildStageSummary(stage, application, history, warehouseAssessments, invoices, payments);
    const currentInvoice = stage === 'FINAL' ? [...invoices].sort((a, b) => b.versionNumber - a.versionNumber)[0] : undefined;
    const currentPayment = stage === 'FINAL' ? [...payments].sort((a, b) => b.versionNumber - a.versionNumber)[0] : undefined;

    // "Received by DG" - when the application entered THIS stage, derived
    // from history (ROUTED_TO_DG / ROUTED_TO_DG_SECOND / ROUTED_TO_FINAL_DG_APPROVAL),
    // kept distinct from the original submittedAt per the spec.
    const ROUTED_ACTION: Record<Stage, string> = { FIRST: 'ROUTED_TO_DG', SECOND: 'ROUTED_TO_DG_SECOND', FINAL: 'ROUTED_TO_FINAL_DG_APPROVAL' };
    const receivedByDGEntry = [...history].reverse().find((h) => h.action === ROUTED_ACTION[stage]);
    const receivedByDG = receivedByDGEntry?.createdAt;

    const progressIdx = workflowStepIndex(status);

    let orderedIds: string[] = [];
    try {
        orderedIds = JSON.parse(sessionStorage.getItem(DG_QUEUE_ORDER_KEY) || '[]');
    } catch {
        orderedIds = [];
    }
    const orderedIndex = id ? orderedIds.indexOf(id) : -1;
    const prevApplicationId = orderedIndex > 0 ? orderedIds[orderedIndex - 1] : null;
    const nextApplicationId = orderedIndex >= 0 && orderedIndex < orderedIds.length - 1 ? orderedIds[orderedIndex + 1] : null;

    const goToApplication = (targetId: string) => {
        navigate(`/applications/dg/${targetId}?${searchParams.toString()}`);
    };

    const runAction = async (fn: () => Promise<unknown>, successMessage: string) => {
        if (!id) return;
        setSubmitting(true);
        setActionError('');
        setActionSuccess('');
        try {
            await fn();
            setActionSuccess(successMessage);
            setDgRemarks('');
            await load(id);
        } catch (err) {
            // Entered remarks/instructions are deliberately left untouched
            // on failure so the DG doesn't lose their work and can retry.
            setActionError(apiErrorMessage(err, 'The decision could not be saved. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = () => {
        if (stage === 'FIRST') runAction(() => dgApprove(id!, dgRemarks || undefined), `Application approved and routed to ${NEXT_DESTINATION_LABEL.FIRST}.`);
        else if (stage === 'SECOND') runAction(() => dgApproveSecond(id!, dgRemarks || undefined), `Application approved and routed to ${NEXT_DESTINATION_LABEL.SECOND}.`);
        else runAction(() => dgApproveFinal(id!, dgRemarks || undefined), `Final approval given and routed to ${NEXT_DESTINATION_LABEL.FINAL}.`);
    };

    // Plain derived value (not useMemo): this file already has two early
    // returns (loading / error-or-missing-application) ABOVE this point in
    // the component body, so any hook placed here would be called
    // conditionally and violate the Rules of Hooks. The computation is
    // cheap (a handful of checkbox entries), so memoization isn't needed.
    const returnAffectedLabels = Object.entries(returnItems).filter(([, v]) => v).map(([k]) => k);

    const handleSubmitReturn = () => {
        const reasonParts = [
            returnAffectedLabels.length > 0 ? `Affected items: ${returnAffectedLabels.join(', ')}.` : '',
            returnInstructions.trim(),
        ].filter(Boolean);
        const reason = reasonParts.join(' ') || 'Returned by the Director-General.';
        const action = stage === 'FIRST'
            ? () => dgReturn(id!, reason)
            : stage === 'SECOND'
                ? () => dgReturnToTechnical(id!, reason)
                : () => dgReturnToFinance(id!, reason);
        runAction(action, `Application returned to ${RETURN_DESTINATION_LABEL[stage]}.`).then(() => {
            setShowReturnForm(false);
            setReturnStep('form');
            setReturnItems({});
            setReturnInstructions('');
        });
    };

    const returnSelectableItems: string[] =
        stage === 'FIRST'
            ? documentRequirements.map((r) => documentLabel(r.key))
            : stage === 'SECOND'
                ? ['Warehouse assessment findings', 'Assessment checklist', 'Inspection scheduling']
                : ['Invoice accuracy', 'Payment proof', 'Payment amount', 'Payment method'];

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <button
                    onClick={() => navigate(backToQueueUrl)}
                    className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded"
                >
                    <ArrowLeft size={16} /> Back to Queue
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

            {/* Header */}
            <div className="rounded-xl border border-brand-border bg-brand-card p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold text-brand-text break-words">{application.applicationNumber}</h1>
                            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                {STAGE_LABELS[stage]}
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
                            <dt className="text-brand-muted">Original Submission</dt>
                            <dd className="font-medium text-brand-text">
                                {application.submittedAt ? `${formatDateParts(application.submittedAt).date} ${formatDateParts(application.submittedAt).time}` : 'Not available'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-brand-muted">Received by DG</dt>
                            <dd className="font-medium text-brand-text">
                                {receivedByDG ? `${formatDateParts(receivedByDG).date} ${formatDateParts(receivedByDG).time}` : 'Not recorded'}
                            </dd>
                        </div>
                        <div><dt className="text-brand-muted">Time Awaiting Decision</dt><dd className="font-medium text-brand-text">{isActionable ? durationLabel(receivedByDG) : 'Decision recorded'}</dd></div>
                    </dl>
                </div>

                {/* Full workflow progress - every actual configured stage,
                    with the current DG step visually distinguished from a
                    plain department-review step, and from final overall
                    approval (only the last DG step represents that). */}
                <div className="flex items-center overflow-x-auto pb-1">
                    {WORKFLOW_STEPS.map((step, idx) => {
                        const isDGStep = idx === 2 || idx === 4 || idx === 6;
                        return (
                            <React.Fragment key={step.label}>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {idx < progressIdx ? (
                                        <CheckCircle2 size={16} className="text-brand-green" />
                                    ) : idx === progressIdx ? (
                                        <Clock size={16} className={isDGStep ? 'text-purple-600' : 'text-blue-600'} />
                                    ) : (
                                        <Circle size={16} className="text-slate-300" />
                                    )}
                                    <span className={`text-xs font-medium whitespace-nowrap ${idx <= progressIdx ? (isDGStep ? 'text-purple-700' : 'text-brand-text') : 'text-slate-400'}`}>
                                        {step.label}
                                    </span>
                                </div>
                                {idx < WORKFLOW_STEPS.length - 1 && <ChevronRight size={14} className="text-slate-300 mx-1.5 flex-shrink-0" />}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Explicit distinction: this stage's approval vs final
                    overall application approval. */}
                {stage === 'FINAL' ? (
                    <div className="rounded-lg bg-purple-50 border border-purple-200 p-2.5 text-xs text-purple-800 flex items-start gap-1.5">
                        <Info size={13} className="flex-shrink-0 mt-0.5" />
                        This is the <span className="font-semibold">final overall approval</span> for this application. Approving here grants the licence/permit for issuance and routes it to IT for certificate printing.
                    </div>
                ) : (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600 flex items-start gap-1.5">
                        <Info size={13} className="flex-shrink-0 mt-0.5" />
                        Approving here advances the application to <span className="font-medium">{NEXT_DESTINATION_LABEL[stage]}</span> - it does not represent the final overall approval of the licence/permit.
                    </div>
                )}
            </div>

            {actionError && <Alert variant="error" onClose={() => setActionError('')}>{actionError}</Alert>}
            {actionSuccess && <Alert variant="success" onClose={() => setActionSuccess('')}>{actionSuccess}</Alert>}
            {alreadyDecided && (
                <Alert variant="info" title="Decision already recorded">
                    This application is no longer awaiting a decision at the {STAGE_LABELS[stage]} stage (current status: {status.replace(/_/g, ' ')}). The information below is shown for reference and is read-only.
                </Alert>
            )}

            {/* 70/30 two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-start">
                <div className="lg:col-span-7 space-y-4">
                    <StageSummarySection summary={stageSummary} invoice={currentInvoice} payment={currentPayment} />
                    <ApplicantSection record={applicantRecord} context={fieldContext} />
                    <LicenceSection data={application.data as unknown as Record<string, unknown>} context={fieldContext} />
                    <OperationsSection data={application.data as unknown as Record<string, unknown>} />
                    <ReadOnlyDocumentsSection
                        requirements={documentRequirements}
                        documents={(application.data?.documents || {}) as Record<string, UploadedDoc>}
                        statuses={application.commercialReview?.documents || {}}
                        showVerificationBadge={stage === 'FIRST'}
                        verifiedBy={stageSummary.reviewingOfficer !== 'Not recorded' ? stageSummary.reviewingOfficer : undefined}
                        verifiedAt={stageSummary.completedAt}
                        onPreview={(key) => setPreviewKey(key)}
                    />
                    <ActivityHistorySection history={history} />
                </div>

                <div className="lg:col-span-3">
                    <div className="lg:sticky lg:top-20 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
                        <div className="rounded-xl border border-brand-border bg-brand-card p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-brand-text flex items-center gap-1.5"><ClipboardList size={14} className="text-brand-green" /> Director-General Decision</h3>

                            <dl className="text-xs space-y-1">
                                <div className="flex justify-between"><dt className="text-brand-muted">Current Stage</dt><dd className="font-medium text-brand-text">{STAGE_LABELS[stage]}</dd></div>
                                <div className="flex justify-between"><dt className="text-brand-muted">Recommendation</dt><dd className="font-medium text-brand-text text-right">{stageSummary.recommendation}</dd></div>
                            </dl>

                            {!isActionable && !alreadyDecided && (
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600">
                                    You do not have permission to decide on this application, or it is not currently at this approval stage.
                                </div>
                            )}

                            {isActionable && (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-brand-muted mb-1">
                                            DG Remarks
                                            <span className="font-normal"> (internal - visible to staff and audit history, not sent to the applicant)</span>
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={dgRemarks}
                                            onChange={(e) => setDgRemarks(e.target.value)}
                                            disabled={submitting}
                                            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-slate-50"
                                            placeholder="Internal remarks about this decision..."
                                        />
                                    </div>

                                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-[11px] text-emerald-800">
                                        Will route to: <span className="font-semibold">{NEXT_DESTINATION_LABEL[stage]}</span>
                                    </div>

                                    <div className="pt-2 border-t border-brand-border space-y-2">
                                        <button
                                            disabled={submitting}
                                            onClick={handleApprove}
                                            className="w-full px-4 py-2 text-sm font-medium rounded-md text-white bg-brand-green hover:bg-brand-green-hover disabled:opacity-50"
                                        >
                                            {submitting ? <Loader2 size={14} className="animate-spin inline mr-1.5" /> : null}
                                            {stage === 'FINAL' ? 'Give Final Approval' : `Approve ${STAGE_LABELS[stage]}`}
                                        </button>
                                        <button
                                            disabled={submitting}
                                            onClick={() => { setShowReturnForm(true); setReturnStep('form'); }}
                                            className="w-full px-4 py-2 text-sm font-medium rounded-md text-orange-700 bg-white border border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                                        >
                                            Return to {RETURN_DESTINATION_LABEL[stage]}
                                        </button>
                                    </div>
                                </>
                            )}

                            {alreadyDecided && (
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600">
                                    This decision has already been recorded for this stage. See Activity History for the full record.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Return modal - two steps, mirroring the Commercial
                correction-request pattern exactly, adapted to the DG's
                stage-specific return destinations. */}
            {showReturnForm && (
                <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowReturnForm(false)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-brand-text">
                                {returnStep === 'form' ? `Return to ${RETURN_DESTINATION_LABEL[stage]}` : 'Confirm Return'}
                            </h3>
                            <button onClick={() => setShowReturnForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>

                        {returnStep === 'form' ? (
                            <>
                                <div>
                                    <p className="text-xs font-medium text-brand-muted mb-2">Select affected fields, documents, or findings</p>
                                    <div className="max-h-40 overflow-y-auto space-y-1.5 border border-brand-border rounded-lg p-2">
                                        {returnSelectableItems.map((label) => (
                                            <label key={label} className="flex items-center gap-2 text-sm">
                                                <input type="checkbox" checked={!!returnItems[label]} onChange={() => setReturnItems((p) => ({ ...p, [label]: !p[label] }))} className="rounded border-gray-300 text-brand-green focus:ring-brand-green" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-brand-muted mb-1">Instructions for {RETURN_DESTINATION_LABEL[stage]} <span className="text-red-500">*</span></label>
                                    <textarea rows={4} value={returnInstructions} onChange={(e) => setReturnInstructions(e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500" placeholder="Explain clearly what needs to be addressed before resubmitting..." />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setShowReturnForm(false)} className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 bg-white border border-gray-300 hover:bg-gray-50">Cancel</button>
                                    <button disabled={!returnInstructions.trim()} onClick={() => setReturnStep('summary')} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50">
                                        Review Summary
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2 text-sm">
                                    <div>
                                        <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-1">Affected Items</p>
                                        {returnAffectedLabels.length > 0 ? (
                                            <ul className="list-disc list-inside text-orange-900 space-y-0.5">
                                                {returnAffectedLabels.map((l) => <li key={l}>{l}</li>)}
                                            </ul>
                                        ) : <p className="text-orange-700 text-xs">No specific items selected.</p>}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-1">Instructions to {RETURN_DESTINATION_LABEL[stage]}</p>
                                        <p className="text-orange-900 whitespace-pre-wrap">{returnInstructions}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setReturnStep('form')} className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 bg-white border border-gray-300 hover:bg-gray-50">Back</button>
                                    <button disabled={submitting} onClick={handleSubmitReturn} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50">
                                        {submitting ? <Loader2 size={14} className="animate-spin inline mr-1.5" /> : null}
                                        Confirm &amp; Return to {RETURN_DESTINATION_LABEL[stage]}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

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

export default DGApplicationReview;

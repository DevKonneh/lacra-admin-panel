// Shared helpers for rendering Application status/category values across
// the Commercial Verification queue, DG Approval queue, and Application
// Detail pages. Kept in one place so status color-coding stays consistent
// no matter which internal queue page is showing a given application.

export const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    SUBMITTED: 'bg-yellow-100 text-yellow-800',
    AWAITING_COMMERCIAL_VERIFICATION: 'bg-yellow-100 text-yellow-800',
    COMMERCIAL_REVIEW_IN_PROGRESS: 'bg-blue-100 text-blue-800',
    APPLICANT_CORRECTION_REQUIRED: 'bg-orange-100 text-orange-800',
    COMMERCIALLY_VERIFIED: 'bg-indigo-100 text-indigo-800',
    AWAITING_FIRST_DG_APPROVAL: 'bg-purple-100 text-purple-800',
    RETURNED_TO_COMMERCIAL: 'bg-orange-100 text-orange-800',
    COMMERCIAL_STAGE_APPROVED: 'bg-green-100 text-green-800',
    AWAITING_TECHNICAL_REVIEW: 'bg-teal-100 text-teal-800',
    // Phase 3: Technical Review + Inspector Assignment + Warehouse
    // Assessment + Second DG Approval.
    INSPECTOR_ASSIGNMENT_PENDING: 'bg-teal-100 text-teal-800',
    INSPECTOR_ASSIGNED: 'bg-blue-100 text-blue-800',
    WAREHOUSE_INSPECTION_SCHEDULED: 'bg-blue-100 text-blue-800',
    WAREHOUSE_ASSESSMENT_IN_PROGRESS: 'bg-blue-100 text-blue-800',
    WAREHOUSE_ASSESSMENT_SUBMITTED: 'bg-indigo-100 text-indigo-800',
    WAREHOUSE_REINSPECTION_REQUIRED: 'bg-orange-100 text-orange-800',
    AWAITING_TECHNICAL_VERIFICATION: 'bg-indigo-100 text-indigo-800',
    TECHNICALLY_VERIFIED: 'bg-indigo-100 text-indigo-800',
    AWAITING_SECOND_DG_APPROVAL: 'bg-purple-100 text-purple-800',
    RETURNED_TO_TECHNICAL_SERVICES: 'bg-orange-100 text-orange-800',
    TECHNICAL_STAGE_APPROVED: 'bg-green-100 text-green-800',
    AWAITING_BILLING_REVIEW: 'bg-teal-100 text-teal-800',
    // Phase 4: Billing Review + Payment Verification + Final DG Approval
    // + IT Certificate Printing/Issuance.
    BILLING_REVIEW_IN_PROGRESS: 'bg-blue-100 text-blue-800',
    INVOICE_APPROVED: 'bg-indigo-100 text-indigo-800',
    AWAITING_APPLICANT_PAYMENT: 'bg-yellow-100 text-yellow-800',
    PAYMENT_SUBMITTED: 'bg-blue-100 text-blue-800',
    PAYMENT_VERIFICATION_PENDING: 'bg-blue-100 text-blue-800',
    PAYMENT_CORRECTION_REQUIRED: 'bg-orange-100 text-orange-800',
    PENDING_CHEQUE_CLEARANCE: 'bg-amber-100 text-amber-800',
    PAYMENT_VERIFIED: 'bg-indigo-100 text-indigo-800',
    AWAITING_FINAL_DG_APPROVAL: 'bg-purple-100 text-purple-800',
    RETURNED_TO_FINANCE: 'bg-orange-100 text-orange-800',
    APPROVED_FOR_ISSUANCE: 'bg-green-100 text-green-800',
    AWAITING_IT_CERTIFICATE_PRINTING: 'bg-teal-100 text-teal-800',
    CERTIFICATE_PRINTED: 'bg-indigo-100 text-indigo-800',
    ISSUED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    REVOKED: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-gray-200 text-gray-700',
    CANCELLED: 'bg-gray-200 text-gray-700',
};

// Human-readable labels for the PaymentMethod enum, used on the payment-
// recording form and detail-page history rendering.
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    BANK_TRANSFER: 'Bank Transfer',
    MOBILE_MONEY: 'Mobile Money',
    CHEQUE: 'Cheque',
    CASH_AT_LACRA: 'Cash at LACRA',
};

// Human-readable labels for the WarehouseAssessment outcome enum, used on
// the assessment form and detail-page history rendering.
export const OUTCOME_LABELS: Record<string, string> = {
    PASS: 'Pass',
    PASS_WITH_CONDITIONS: 'Pass with Conditions',
    FAIL: 'Fail',
};

export const OUTCOME_COLORS: Record<string, string> = {
    PASS: 'bg-green-100 text-green-800',
    PASS_WITH_CONDITIONS: 'bg-orange-100 text-orange-800',
    FAIL: 'bg-red-100 text-red-800',
};

export function statusColor(status: string): string {
    return STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
}

export function statusLabel(status: string): string {
    return (status || '').replace(/_/g, ' ');
}

// -----------------------------------------------------------------
// Commercial Verification queue + review page: short, readable status
// badges. These map the real backend ApplicationStatus values (see
// gh-backend-clone's entities/Application.ts) onto the five short labels
// requested for this stage - they do NOT introduce new statuses, they are
// purely a display-layer simplification of the existing 41-value enum for
// the slice of the workflow Commercial actually sees.
// -----------------------------------------------------------------
export type CommercialBadgeStatus = 'AWAITING_REVIEW' | 'IN_REVIEW' | 'CORRECTION_REQUESTED' | 'FORWARDED_TO_DG';

export const COMMERCIAL_BADGE_LABELS: Record<CommercialBadgeStatus | 'RESUBMITTED', string> = {
    AWAITING_REVIEW: 'Awaiting Review',
    IN_REVIEW: 'In Review',
    CORRECTION_REQUESTED: 'Correction Requested',
    RESUBMITTED: 'Resubmitted',
    FORWARDED_TO_DG: 'Forwarded to DG',
};

export const COMMERCIAL_BADGE_COLORS: Record<CommercialBadgeStatus | 'RESUBMITTED', string> = {
    AWAITING_REVIEW: 'bg-amber-100 text-amber-800 border border-amber-200',
    IN_REVIEW: 'bg-blue-100 text-blue-800 border border-blue-200',
    CORRECTION_REQUESTED: 'bg-orange-100 text-orange-800 border border-orange-200',
    RESUBMITTED: 'bg-sky-100 text-sky-800 border border-sky-200',
    FORWARDED_TO_DG: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
};

/**
 * Maps a raw backend status (plus whether the application has ever been
 * resubmitted, via a non-null resubmittedAt) to the short Commercial badge
 * label. "Resubmitted" is distinguished from "Awaiting Review" purely by
 * the presence of resubmittedAt - once Commercial acts on it again
 * (starts review), it reads as "In Review" like any other application.
 */
export function commercialBadgeKey(status: string, resubmittedAt?: string | null): CommercialBadgeStatus | 'RESUBMITTED' {
    switch (status) {
        case 'AWAITING_COMMERCIAL_VERIFICATION':
            return resubmittedAt ? 'RESUBMITTED' : 'AWAITING_REVIEW';
        case 'COMMERCIAL_REVIEW_IN_PROGRESS':
            return 'IN_REVIEW';
        case 'APPLICANT_CORRECTION_REQUIRED':
            return 'CORRECTION_REQUESTED';
        // The DG sent this back to Commercial for further work - it needs
        // action again, so it reads as "Awaiting Review", not "Forwarded".
        case 'RETURNED_TO_COMMERCIAL':
            return 'AWAITING_REVIEW';
        case 'COMMERCIALLY_VERIFIED':
        case 'AWAITING_FIRST_DG_APPROVAL':
        case 'COMMERCIAL_STAGE_APPROVED':
            return 'FORWARDED_TO_DG';
        default:
            // Any later-stage status (Technical/Billing/etc.) means the
            // application has long since left Commercial's hands.
            return 'FORWARDED_TO_DG';
    }
}

export function commercialBadgeLabel(status: string, resubmittedAt?: string | null): string {
    return COMMERCIAL_BADGE_LABELS[commercialBadgeKey(status, resubmittedAt)];
}

export function commercialBadgeColor(status: string, resubmittedAt?: string | null): string {
    return COMMERCIAL_BADGE_COLORS[commercialBadgeKey(status, resubmittedAt)];
}

// Formats the elapsed duration between two timestamps (or a timestamp and
// "now", when `untilIso` is omitted) as a short string (e.g. "2h 15m",
// "3d 4h", "just now"). Generic building block behind both
// timeSinceSubmissionLabel() and timeInCommercialReviewLabel() below - pure
// function of its inputs, recomputed on every render rather than stored.
export function durationLabel(sinceIso?: string | null, untilIso?: string | null): string {
    if (!sinceIso) return '-';
    const since = new Date(sinceIso).getTime();
    if (Number.isNaN(since)) return '-';
    const until = untilIso ? new Date(untilIso).getTime() : Date.now();
    if (Number.isNaN(until)) return '-';
    const diffMs = until - since;
    if (diffMs < 0) return 'just now';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    if (hours < 24) return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

// Raw millisecond duration between two timestamps (or a timestamp and
// "now"), used for the Longest Waiting sort.
export function durationMs(sinceIso?: string | null, untilIso?: string | null): number {
    if (!sinceIso) return 0;
    const since = new Date(sinceIso).getTime();
    if (Number.isNaN(since)) return 0;
    const until = untilIso ? new Date(untilIso).getTime() : Date.now();
    if (Number.isNaN(until)) return 0;
    return Math.max(0, until - since);
}

// "Time Since Submission" - how long ago the application was originally
// submitted (never affected by resubmission/review activity). This is the
// label the redesign spec asks for in place of the former generic
// "Waiting" column/field name.
export function timeSinceSubmissionLabel(submittedAtIso?: string | null): string {
    return durationLabel(submittedAtIso);
}
export function timeSinceSubmissionMs(submittedAtIso?: string | null): number {
    return durationMs(submittedAtIso);
}

// "Time in Commercial Review" - how long the application has actually been
// in Commercial's hands, measured from the most recent time Commercial
// started working on it (COMMERCIAL_REVIEW_IN_PROGRESS via
// startCommercialReview()/resumeReview, action "REVIEW_STARTED" - see
// ApplicationController.startCommercialReview()) through to now, or
// through to the moment it left Commercial's queue (verified/forwarded or
// correction requested) if that has already happened. Falls back to '-'
// if Commercial has never actually started reviewing it yet (still sitting
// untouched in Awaiting Review).
export function timeInCommercialReviewLabel(history: { action: string; createdAt: string }[]): string {
    const started = [...history].reverse().find((h) => h.action === 'COMMERCIAL_REVIEW_STARTED');
    if (!started) return '-';
    const ended = [...history]
        .filter((h) => new Date(h.createdAt).getTime() >= new Date(started.createdAt).getTime())
        .find((h) => ['COMMERCIALLY_VERIFIED', 'CORRECTION_REQUESTED'].includes(h.action));
    return durationLabel(started.createdAt, ended?.createdAt);
}

// Deprecated aliases kept temporarily so any remaining call sites keep
// compiling while the rest of the codebase migrates to the explicit names
// above - both simply forward to timeSinceSubmission*().
export const waitingTimeLabel = timeSinceSubmissionLabel;
export const waitingTimeMs = timeSinceSubmissionMs;

// Formats an ISO timestamp as a short "31 Oct 2026" date string plus a
// separate "2:45 PM" time string, matching the redesign spec's requested
// queue/review-page date presentation (date on one line, time beneath).
export function formatDateParts(iso?: string | null): { date: string; time: string } {
    if (!iso) return { date: '-', time: '' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: '-', time: '' };
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return { date, time };
}

export const CATEGORY_LABELS: Record<string, string> = {
    LOCAL_BUYER: 'Local Produce Buyer',
    AGENCY: 'Agency',
    COOPERATIVE: 'Cooperative',
    LOCAL_EXPORTER: 'Local Exporter',
    FOREIGN_EXPORTER: 'Foreign Exporter',
};

export function categoryLabel(category: string): string {
    return CATEGORY_LABELS[category] || category;
}

// Extracts a user-facing message from an Axios error response
// ({status, errors, data, message} envelope - see backend's
// utils/response.ts) without resorting to `any`.
export function apiErrorMessage(err: unknown, fallback: string): string {
    if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data &&
        typeof (err.response.data as { message?: unknown }).message === 'string'
    ) {
        return (err.response.data as { message: string }).message;
    }
    return fallback;
}

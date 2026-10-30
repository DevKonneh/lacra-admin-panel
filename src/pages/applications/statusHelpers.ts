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

import axios from 'axios';
import type { ApiResponse } from './types';
import type { ApplicationCategory, ApplicationState } from '../pages/apply/types';

// The /apply wizard is a public, self-contained module that must remain
// reachable by fully unauthenticated applicants (see optionalAuthMiddleware
// on the backend routes), and it currently has zero dependency on the rest
// of the admin panel's authenticated app shell. Rather than reuse
// api/index.ts or api/client.ts (both of which unconditionally attach any
// stored admin Bearer token, and api/client.ts additionally redirects to
// /login on a 401 - never applicable here since these routes never return
// 401 for anonymous callers), this module gets its own minimal axios
// instance. It still goes through the same Vite dev-server proxy
// (see vite.config.ts's '/api' -> http://localhost:8100 rule) so no CORS
// configuration or absolute URL is needed.
// IMPORTANT: must resolve to the real backend in production, exactly like
// api/client.ts and api/index.ts do. A plain relative '/api/applications'
// base URL works fine in local dev (Vite's proxy forwards it to
// localhost:8100) but on the deployed static site there is no backend at
// that path - Render's SPA catch-all rewrite (`/* -> /index.html`) quietly
// returns the index page / an empty 200 instead of a real API response,
// which is why documents silently "failed" to upload and other calls on
// this module looked broken in production. VITE_API_BASE_URL is set to the
// relative '/api' in local .env (routed through the Vite proxy) and to the
// full backend URL in render.yaml for production, so appending
// '/applications' to it keeps both environments working correctly.
const applicationsApi = axios.create({
    baseURL: `${import.meta.env.VITE_API_BASE_URL || 'https://lacra-eudr-backend.onrender.com/api'}/applications`,
    headers: { 'Content-Type': 'application/json' },
});

export type ApplicationChannel = 'ONLINE' | 'OFFICE_ASSISTED';

export interface UploadedDocumentResponse {
    url: string;
    name: string;
    size: number;
    type: string;
}

// Per-document verification state saved via saveCommercialReviewProgress()
// / returned on the Application record. Additive, Commercial-stage-only -
// absent (undefined) for applications no officer has reviewed yet.
export type DocumentVerificationStatus = 'PENDING' | 'VERIFIED' | 'NEEDS_CORRECTION';

// One archived prior version of a replaced document - see replaceDocument()
// below. `decision` is whatever verification status/comment the document
// had at the moment it was replaced (null if it had never been reviewed).
export interface DocumentHistoryEntry {
    url?: string;
    name?: string;
    decision?: { status: DocumentVerificationStatus; comment?: string } | null;
    replacedAt: string;
}

export interface CommercialReviewState {
    documents?: Record<string, { status: DocumentVerificationStatus; comment?: string }>;
    checklist?: Record<string, boolean>;
    internalNotes?: string;
    applicantMessageDraft?: string;
    documentHistory?: Record<string, DocumentHistoryEntry[]>;
}

export interface ApplicationRecord {
    id: string;
    applicationNumber: string;
    category: ApplicationCategory;
    commodity?: string;
    channel: ApplicationChannel;
    submissionMethod?: string;
    status: string;
    data: ApplicationState;
    submittedAt?: string;
    resubmittedAt?: string;
    createdAt: string;
    updatedAt: string;
    commercialReview?: CommercialReviewState | null;
}

export interface ApplicationHistoryEntry {
    id: string;
    action: string;
    previousStatus?: string;
    newStatus?: string;
    userId?: string;
    userName?: string;
    role?: string;
    department?: string;
    comments?: string;
    reason?: string;
    createdAt: string;
}

export type WarehouseAssessmentOutcome = 'PASS' | 'PASS_WITH_CONDITIONS' | 'FAIL';

export interface WarehouseAssessmentRecord {
    id: string;
    applicationId: string;
    versionNumber: number;
    inspectorId?: string;
    inspectorName?: string;
    assignedByUserId?: string;
    assignedByName?: string;
    scheduledDate?: string;
    startedAt?: string;
    submittedAt?: string;
    outcome?: WarehouseAssessmentOutcome;
    checklistData?: Record<string, string>;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface InspectorOption {
    id: string;
    name?: string;
    email: string;
}

// -----------------------------------------------------------------
// Phase 4: Billing Review + Payment Verification + Final DG Approval +
// IT Certificate Printing/Issuance. Mirrors the backend's Invoice /
// PaymentSubmission / Certificate entities exactly.
// -----------------------------------------------------------------

export interface InvoiceRecord {
    id: string;
    applicationId: string;
    versionNumber: number;
    invoiceNumber: string;
    currency: string;
    amount: number;
    feeBreakdown?: { label: string; amount: number }[];
    notes?: string;
    createdByUserId?: string;
    createdByName?: string;
    approvedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export type PaymentMethod = 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CHEQUE' | 'CASH_AT_LACRA';

export interface PaymentSubmissionRecord {
    id: string;
    applicationId: string;
    versionNumber: number;
    invoiceId: string;
    method?: PaymentMethod;
    referenceNumber?: string;
    amountPaid?: number;
    proofDocumentUrl?: string;
    proofDocumentName?: string;
    submittedAt?: string;
    verifiedByUserId?: string;
    verifiedByName?: string;
    verifiedAt?: string;
    chequeClearedAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CertificateRecord {
    id: string;
    applicationId: string;
    certificateNumber?: string;
    permitOrLicenceType?: string;
    issueDate?: string;
    expiryDate?: string;
    printedByUserId?: string;
    printedByName?: string;
    printedAt?: string;
    issuedAt?: string;
    documentUrl?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CertificateVerificationResult {
    certificateNumber: string;
    permitOrLicenceType?: string;
    issueDate?: string;
    expiryDate?: string;
    status: string;
    valid: boolean;
    applicantName?: string;
    applicationNumber: string;
    commodity?: string;
    category: string;
}

export interface ApplicationListItem {
    id: string;
    applicationNumber: string;
    category: ApplicationCategory;
    commodity?: string;
    channel: ApplicationChannel;
    submissionMethod?: string;
    status: string;
    applicantName?: string;
    businessName?: string;
    tin?: string;
    county?: string;
    submittedAt?: string;
    resubmittedAt?: string;
    createdAt: string;
    // Best-effort, derived server-side from history (see getAll() on the
    // backend) - not a tracked assignment record. Undefined means no
    // Commercial officer has started/resubmitted this application yet.
    assignedOfficer?: string;
}

export interface CreateApplicationPayload {
    category: ApplicationCategory;
    commodity?: string;
    channel?: ApplicationChannel;
    data: ApplicationState;
    // Office-Assisted intake fields - only meaningful when
    // channel === 'OFFICE_ASSISTED'.
    officeApplicantName?: string;
    officeApplicantPhone?: string;
    officeApplicantEmail?: string;
    officeLocation?: string;
    enteringOfficerName?: string;
    assistedEntryReason?: string;
    applicantConsentConfirmed?: boolean;
}

/**
 * Uploads a single document/photo for the /apply wizard (Step2-Step5's
 * DocumentUpload instances) to the backend, which stores it on Cloudinary
 * and returns a persistent URL. No Application record needs to exist yet -
 * documents are uploaded progressively as the applicant fills in the form,
 * well before final submission.
 */
export const uploadApplicationDocument = (
    file: File,
    onUploadProgress?: (percent: number) => void
) => {
    const formData = new FormData();
    formData.append('file', file);
    return applicationsApi.post<ApiResponse<UploadedDocumentResponse>>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
            if (!onUploadProgress || !evt.total) return;
            onUploadProgress(Math.round((evt.loaded * 100) / evt.total));
        },
    });
};

/**
 * Final submission of the /apply wizard. Creates the Application row on
 * the backend (status becomes AWAITING_COMMERCIAL_VERIFICATION) and
 * returns the server-assigned, sequential applicationNumber
 * (LACRA-APP-{year}-{seq}) plus submittedAt timestamp.
 */
export const createApplication = (payload: CreateApplicationPayload) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>('/', payload);
};

// The two lookup/list endpoints below require an authenticated LACRA staff
// session (authMiddleware on the backend) and are intended for the
// forthcoming internal Commercial/Technical/Finance/DG review queues, not
// the public /apply wizard itself.
export const getApplication = (id: string) => {
    return applicationsApi.get<ApiResponse<ApplicationRecord & {
        history: ApplicationHistoryEntry[];
        warehouseAssessments: WarehouseAssessmentRecord[];
        invoices: InvoiceRecord[];
        payments: PaymentSubmissionRecord[];
        certificate?: CertificateRecord;
        assignedOfficer?: string;
    }>>(`/${id}`, {
        headers: authHeader(),
    });
};

export const getApplications = (filters?: { category?: string; channel?: string; status?: string }) => {
    return applicationsApi.get<ApiResponse<ApplicationListItem[]>>('/', { params: filters, headers: authHeader() });
};

// -----------------------------------------------------------------
// Stage 2: Commercial and Marketing verification + First DG Approval.
// All five actions below require an authenticated staff session with
// the appropriate role (COMMERCIAL/DG, or ADMIN) - the backend
// authMiddleware enforces this and returns 403 otherwise. Each call
// returns the updated ApplicationRecord on success.
// -----------------------------------------------------------------

/** Commercial officer opens an application and starts working on it. */
export const startCommercialReview = (id: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/commercial/start-review`,
        {},
        { headers: authHeader() }
    );
};

/** Commercial officer sends the application back to the applicant for correction. `reason` is required. */
export const requestCorrection = (id: string, reason: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/commercial/request-correction`,
        { reason },
        { headers: authHeader() }
    );
};

/** Commercial officer marks the application verified; auto-routes to the DG for first approval. */
export const verifyCommercial = (id: string, comments?: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/commercial/verify`,
        { comments },
        { headers: authHeader() }
    );
};

/**
 * Commercial officer resubmits an application after the applicant's
 * correction has been received, moving it from APPLICANT_CORRECTION_REQUIRED
 * back into AWAITING_COMMERCIAL_VERIFICATION. Additive endpoint - does not
 * introduce a new approval stage.
 */
export const resubmitAfterCorrection = (id: string, comments?: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/commercial/resubmit`,
        { comments },
        { headers: authHeader() }
    );
};

/**
 * Saves in-progress Commercial-stage review work (document verification
 * statuses/comments, checklist, internal notes, draft applicant-visible
 * message) without changing the application's status. Powers "Save
 * Progress" on the Application Review page.
 */
export const saveCommercialReviewProgress = (id: string, payload: Partial<CommercialReviewState>) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/commercial/save-review-progress`,
        payload,
        { headers: authHeader() }
    );
};

/**
 * Replaces one uploaded document (e.g. a corrected file re-uploaded by/for
 * the applicant) with a newly-uploaded file. The backend resets that
 * document's verification status to PENDING and archives the previous
 * file + decision into commercialReview.documentHistory - it is never
 * silently discarded. `file` must already have been uploaded via
 * uploadApplicationDocument() to obtain the url/name/size/type.
 */
export const replaceDocument = (
    id: string,
    documentKey: string,
    file: { url: string; name: string; size?: number; type?: string }
) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/commercial/replace-document`,
        { documentKey, ...file },
        { headers: authHeader() }
    );
};

/** DG approves the commercial stage; auto-routes to Technical Review. */
export const dgApprove = (id: string, comments?: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/dg/approve`,
        { comments },
        { headers: authHeader() }
    );
};

/** DG returns the application to Commercial for further work. `reason` is required. */
export const dgReturn = (id: string, reason: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/dg/return`,
        { reason },
        { headers: authHeader() }
    );
};

// -----------------------------------------------------------------
// Stage 3: Technical Review + Inspector Assignment + Warehouse
// Assessment + Second DG Approval. TECHNICAL/INSPECTOR-role (or ADMIN)
// sessions required, matching the backend's authMiddleware gates.
// -----------------------------------------------------------------

/** Lists staff accounts with the INSPECTOR role, for the assignment dropdown. */
export const getInspectors = () => {
    return applicationsApi.get<ApiResponse<InspectorOption[]>>('/meta/inspectors', {
        headers: authHeader(),
    });
};

/** Technical Services opens an application and starts the inspector-assignment step. */
export const startTechnicalAssignment = (id: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/technical/start-assignment`,
        {},
        { headers: authHeader() }
    );
};

/** Technical Services assigns a specific inspector to carry out the warehouse assessment. */
export const assignInspector = (id: string, inspectorId: string) => {
    return applicationsApi.post<ApiResponse<{ application: ApplicationRecord; assessment: WarehouseAssessmentRecord }>>(
        `/${id}/technical/assign-inspector`,
        { inspectorId },
        { headers: authHeader() }
    );
};

/** Inspector schedules the warehouse inspection date. Also used to reschedule after a reinspection request. */
export const scheduleInspection = (id: string, scheduledDate: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/inspector/schedule`,
        { scheduledDate },
        { headers: authHeader() }
    );
};

/** Inspector marks the on-site warehouse assessment as started. */
export const startAssessment = (id: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/inspector/start-assessment`,
        {},
        { headers: authHeader() }
    );
};

/** Inspector submits assessment findings; auto-routes to Technical Services for verification. */
export const submitAssessment = (
    id: string,
    outcome: WarehouseAssessmentOutcome,
    checklistData?: Record<string, string>,
    notes?: string
) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/inspector/submit-assessment`,
        { outcome, checklistData, notes },
        { headers: authHeader() }
    );
};

/** Technical Services verifies the inspector's findings; auto-routes to the DG for second approval. */
export const verifyTechnical = (id: string, comments?: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/technical/verify`,
        { comments },
        { headers: authHeader() }
    );
};

/** Technical Services sends the application back for a re-inspection cycle. `reason` is required. */
export const requireReinspection = (id: string, reason: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/technical/require-reinspection`,
        { reason },
        { headers: authHeader() }
    );
};

/** DG approves the technical stage; auto-routes to Billing. */
export const dgApproveSecond = (id: string, comments?: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/dg/approve-second`,
        { comments },
        { headers: authHeader() }
    );
};

/** DG returns the application to Technical Services for further work. `reason` is required. */
export const dgReturnToTechnical = (id: string, reason: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/dg/return-to-technical`,
        { reason },
        { headers: authHeader() }
    );
};

// -----------------------------------------------------------------
// Stage 4: Billing Review + Payment Verification + Final DG Approval +
// IT Certificate Printing/Issuance. FINANCE/DG/IT-role (or ADMIN)
// sessions required, matching the backend's authMiddleware gates.
// -----------------------------------------------------------------

/** Finance opens an application and starts the billing review. */
export const startBillingReview = (id: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/billing/start-review`,
        {},
        { headers: authHeader() }
    );
};

/** Finance creates and approves the invoice; auto-routes to the applicant for payment. */
export const createInvoice = (
    id: string,
    amount: number,
    currency?: string,
    feeBreakdown?: { label: string; amount: number }[],
    notes?: string
) => {
    return applicationsApi.post<ApiResponse<{ application: ApplicationRecord; invoice: InvoiceRecord }>>(
        `/${id}/billing/create-invoice`,
        { amount, currency, feeBreakdown, notes },
        { headers: authHeader() }
    );
};

/** Finance records a payment received from the applicant (proof submitted out-of-band); auto-routes to payment verification. */
export const submitPayment = (
    id: string,
    method: PaymentMethod,
    referenceNumber?: string,
    amountPaid?: number,
    proofDocumentUrl?: string,
    proofDocumentName?: string,
    notes?: string
) => {
    return applicationsApi.post<ApiResponse<{ application: ApplicationRecord; payment: PaymentSubmissionRecord }>>(
        `/${id}/payment/submit`,
        { method, referenceNumber, amountPaid, proofDocumentUrl, proofDocumentName, notes },
        { headers: authHeader() }
    );
};

/** Finance verifies the recorded payment. Cheque payments route to PENDING_CHEQUE_CLEARANCE; other methods route straight to Final DG Approval. */
export const verifyPayment = (id: string, comments?: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/payment/verify`,
        { comments },
        { headers: authHeader() }
    );
};

/** Finance clears a previously-verified cheque payment; routes to Final DG Approval. */
export const clearCheque = (id: string, comments?: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/payment/clear-cheque`,
        { comments },
        { headers: authHeader() }
    );
};

/** Finance sends a payment submission back to the applicant for correction. `reason` is required. */
export const requirePaymentCorrection = (id: string, reason: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/payment/require-correction`,
        { reason },
        { headers: authHeader() }
    );
};

/** DG gives final approval; auto-routes to IT for certificate printing. */
export const dgApproveFinal = (id: string, comments?: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/dg/approve-final`,
        { comments },
        { headers: authHeader() }
    );
};

/** DG returns the application to Finance for further work at the final-approval stage. `reason` is required. */
export const dgReturnToFinance = (id: string, reason: string) => {
    return applicationsApi.post<ApiResponse<ApplicationRecord>>(
        `/${id}/dg/return-to-finance`,
        { reason },
        { headers: authHeader() }
    );
};

/** IT marks the certificate as printed. */
export const printCertificate = (id: string, validityMonths?: number) => {
    return applicationsApi.post<ApiResponse<{ application: ApplicationRecord; certificate: CertificateRecord }>>(
        `/${id}/it/print-certificate`,
        { validityMonths },
        { headers: authHeader() }
    );
};

/** IT issues the printed certificate to the applicant — the final step of the workflow. */
export const issueCertificate = (id: string) => {
    return applicationsApi.post<ApiResponse<{ application: ApplicationRecord; certificate: CertificateRecord }>>(
        `/${id}/it/issue-certificate`,
        {},
        { headers: authHeader() }
    );
};

/** Public QR-verification lookup — no auth required. Given a certificateNumber, confirms authenticity. */
export const verifyCertificate = (certificateNumber: string) => {
    return applicationsApi.get<ApiResponse<CertificateVerificationResult>>(
        `/verify/${certificateNumber}`
    );
};

function authHeader(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export default applicationsApi;

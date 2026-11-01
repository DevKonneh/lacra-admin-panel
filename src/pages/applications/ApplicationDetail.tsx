import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, History, Warehouse, Receipt, Wallet, Printer, QrCode } from 'lucide-react';
import {
    getApplication,
    startCommercialReview,
    requestCorrection,
    verifyCommercial,
    dgApprove,
    dgReturn,
    getInspectors,
    startTechnicalAssignment,
    assignInspector,
    scheduleInspection,
    startAssessment,
    submitAssessment,
    verifyTechnical,
    requireReinspection,
    dgApproveSecond,
    dgReturnToTechnical,
    startBillingReview,
    createInvoice,
    submitPayment,
    verifyPayment,
    clearCheque,
    requirePaymentCorrection,
    dgApproveFinal,
    dgReturnToFinance,
    printCertificate,
    issueCertificate,
    type ApplicationRecord,
    type ApplicationHistoryEntry,
    type WarehouseAssessmentRecord,
    type WarehouseAssessmentOutcome,
    type InspectorOption,
    type InvoiceRecord,
    type PaymentSubmissionRecord,
    type PaymentMethod,
    type CertificateRecord,
} from '../../api/applications';
import { useAuth } from '../../context/AuthContext';
import Alert from '../../components/forms/Alert';
import { statusColor, statusLabel, categoryLabel, apiErrorMessage, OUTCOME_LABELS, OUTCOME_COLORS, PAYMENT_METHOD_LABELS } from './statusHelpers';

const ReviewSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">{title}</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">{children}</dl>
    </div>
);

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 sm:border-none sm:pb-0">
        <dt className="text-slate-500">{label}</dt>
        <dd className="text-slate-800 font-medium text-right">{value ?? '-'}</dd>
    </div>
);

// Pulls the category-specific applicant/business record out of the
// application's raw `data` blob (same shape the /apply wizard produced),
// so this one page can render the right fields for any of the five
// categories without needing five separate detail components.
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

const FIELD_LABELS: Record<string, string> = {
    fullName: 'Full Name',
    legalName: 'Legal Name',
    businessName: 'Business Name',
    phone: 'Phone',
    email: 'Email',
    county: 'County',
    businessRegNumber: 'Business Reg. Number',
    tin: 'TIN',
    ownerFullName: 'Owner Full Name',
    signatoryName: 'Signatory Name',
    signatoryPosition: 'Signatory Position',
    bankName: 'Bank Name',
    repFullName: 'Authorized Representative',
    repPosition: 'Representative Position',
    exportVolume: 'Export Volume',
    destinationCountries: 'Destination Countries',
};

// Actions that require a mandatory reason/comment before they can be
// submitted (Request Correction, DG Return, Require Reinspection, DG
// Return to Technical, Payment Correction, DG Return to Finance).
// Rendered as a small inline text area + confirm/cancel, per the spec's
// "return/reject/hold require a reason" rule.
type PendingAction =
    | 'requestCorrection'
    | 'dgReturn'
    | 'requireReinspection'
    | 'dgReturnToTechnical'
    | 'requirePaymentCorrection'
    | 'dgReturnToFinance'
    | null;

const REASON_ACTION_LABELS: Record<Exclude<PendingAction, null>, string> = {
    requestCorrection: 'Reason for requesting correction',
    dgReturn: 'Reason for returning to Commercial',
    requireReinspection: 'Reason for requiring reinspection',
    dgReturnToTechnical: 'Reason for returning to Technical Services',
    requirePaymentCorrection: 'Reason for requiring a payment correction',
    dgReturnToFinance: 'Reason for returning to Finance',
};

const ApplicationDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [application, setApplication] = useState<ApplicationRecord | null>(null);
    const [history, setHistory] = useState<ApplicationHistoryEntry[]>([]);
    const [warehouseAssessments, setWarehouseAssessments] = useState<WarehouseAssessmentRecord[]>([]);
    const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
    const [payments, setPayments] = useState<PaymentSubmissionRecord[]>([]);
    const [certificate, setCertificate] = useState<CertificateRecord | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [reasonText, setReasonText] = useState('');

    // Inspector-assignment dropdown state (Technical Services).
    const [inspectors, setInspectors] = useState<InspectorOption[]>([]);
    const [selectedInspectorId, setSelectedInspectorId] = useState('');

    // Inspector scheduling + assessment-submission form state.
    const [scheduledDateInput, setScheduledDateInput] = useState('');
    const [assessmentOutcome, setAssessmentOutcome] = useState<WarehouseAssessmentOutcome>('PASS');
    const [assessmentNotes, setAssessmentNotes] = useState('');

    // Billing (Finance) invoice-creation form state.
    const [invoiceAmount, setInvoiceAmount] = useState('');
    const [invoiceCurrency, setInvoiceCurrency] = useState('USD');
    const [invoiceNotes, setInvoiceNotes] = useState('');

    // Payment (Finance) recording form state.
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentAmountPaid, setPaymentAmountPaid] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    // IT certificate-printing form state.
    const [validityMonths, setValidityMonths] = useState('12');

    useEffect(() => {
        if (id) loadApplication(id);
    }, [id]);

    useEffect(() => {
        const role = user?.role;
        const isTechnical = role === 'TECHNICAL' || role === 'ADMIN';
        const canAssign = isTechnical && application && (
            application.status === 'AWAITING_TECHNICAL_REVIEW'
            || application.status === 'INSPECTOR_ASSIGNMENT_PENDING'
            || application.status === 'RETURNED_TO_TECHNICAL_SERVICES'
        );
        if (canAssign && inspectors.length === 0) {
            loadInspectors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [application?.status, user?.role]);

    const loadApplication = async (appId: string) => {
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

    // Loaded lazily the first time Technical Services reaches the
    // inspector-assignment step, rather than on every page load.
    const loadInspectors = async () => {
        try {
            const response = await getInspectors();
            setInspectors(response.data.data || []);
        } catch (err) {
            setActionError(apiErrorMessage(err, 'Failed to load the inspector list.'));
        }
    };

    const runAction = async (fn: () => Promise<unknown>, successMessage: string) => {
        if (!id) return;
        setSubmitting(true);
        setActionError('');
        setActionSuccess('');
        try {
            await fn();
            setActionSuccess(successMessage);
            setPendingAction(null);
            setReasonText('');
            await loadApplication(id);
        } catch (err) {
            setActionError(apiErrorMessage(err, 'The action could not be completed. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-sm text-gray-500 py-10 text-center">Loading application...</div>;
    if (error || !application) {
        return (
            <div className="space-y-4">
                <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
                    <ArrowLeft size={16} /> Back
                </button>
                <Alert variant="error" title="Could not load application">{error || 'Application not found.'}</Alert>
            </div>
        );
    }

    const applicantRecord = getApplicantRecord(
        application.category,
        application.data as unknown as Record<string, unknown>,
    );
    const role = user?.role;
    const isCommercial = role === 'COMMERCIAL' || role === 'ADMIN';
    const isDG = role === 'DG' || role === 'ADMIN';
    const isTechnical = role === 'TECHNICAL' || role === 'ADMIN';
    const isInspector = role === 'INSPECTOR' || role === 'ADMIN';
    const isFinance = role === 'FINANCE' || role === 'ADMIN';
    const isIT = role === 'IT' || role === 'ADMIN';

    const canStartReview = isCommercial && application.status === 'AWAITING_COMMERCIAL_VERIFICATION';
    const canCommercialAct = isCommercial && (application.status === 'AWAITING_COMMERCIAL_VERIFICATION' || application.status === 'COMMERCIAL_REVIEW_IN_PROGRESS');
    const canDGAct = isDG && application.status === 'AWAITING_FIRST_DG_APPROVAL';

    // Phase 3: Technical Review + Inspector Assignment + Warehouse
    // Assessment + Second DG Approval.
    // Also actionable on RETURNED_TO_TECHNICAL_SERVICES (the DG sent it
    // back for more work at the second-approval stage) - mirrors how
    // canStartReview/canCommercialAct above already include
    // RETURNED_TO_COMMERCIAL for the equivalent first-stage return.
    const canStartTechnicalAssignment = isTechnical && (application.status === 'AWAITING_TECHNICAL_REVIEW' || application.status === 'RETURNED_TO_TECHNICAL_SERVICES');
    const canAssignInspector = isTechnical && (application.status === 'AWAITING_TECHNICAL_REVIEW' || application.status === 'INSPECTOR_ASSIGNMENT_PENDING' || application.status === 'RETURNED_TO_TECHNICAL_SERVICES');
    const canScheduleInspection = isInspector && (application.status === 'INSPECTOR_ASSIGNED' || application.status === 'WAREHOUSE_REINSPECTION_REQUIRED');
    const canStartAssessment = isInspector && application.status === 'WAREHOUSE_INSPECTION_SCHEDULED';
    const canSubmitAssessment = isInspector && application.status === 'WAREHOUSE_ASSESSMENT_IN_PROGRESS';
    const canTechnicalVerify = isTechnical && application.status === 'AWAITING_TECHNICAL_VERIFICATION';
    const canDGActSecond = isDG && application.status === 'AWAITING_SECOND_DG_APPROVAL';

    // Phase 4: Billing Review + Payment Verification + Final DG Approval
    // + IT Certificate Printing/Issuance.
    const canStartBillingReview = isFinance && application.status === 'AWAITING_BILLING_REVIEW';
    const canCreateInvoice = isFinance && (
        application.status === 'AWAITING_BILLING_REVIEW'
        || application.status === 'BILLING_REVIEW_IN_PROGRESS'
        || application.status === 'RETURNED_TO_FINANCE'
    );
    const canSubmitPayment = isFinance && (
        application.status === 'AWAITING_APPLICANT_PAYMENT'
        || application.status === 'PAYMENT_CORRECTION_REQUIRED'
    );
    const canVerifyPayment = isFinance && application.status === 'PAYMENT_VERIFICATION_PENDING';
    const canClearCheque = isFinance && application.status === 'PENDING_CHEQUE_CLEARANCE';
    const canDGActFinal = isDG && application.status === 'AWAITING_FINAL_DG_APPROVAL';

    // When the application is currently sitting in one of the three
    // "returned by DG" statuses, surface the DG's reason prominently here
    // (this generic page has no dedicated correction-banner the way
    // CommercialApplicationReview.tsx does for RETURNED_TO_COMMERCIAL) -
    // otherwise the receiving department sees only the raw, easy-to-miss
    // Audit History entry at the bottom of the page.
    const DG_RETURN_ACTION_BY_STATUS: Record<string, string> = {
        RETURNED_TO_COMMERCIAL: 'DG_RETURNED_TO_COMMERCIAL',
        RETURNED_TO_TECHNICAL_SERVICES: 'DG_RETURNED_TO_TECHNICAL',
        RETURNED_TO_FINANCE: 'DG_RETURNED_TO_FINANCE',
    };
    const dgReturnAction = DG_RETURN_ACTION_BY_STATUS[application.status];
    const dgReturnEntry = dgReturnAction
        ? [...history].reverse().find((h) => h.action === dgReturnAction)
        : undefined;
    const canPrintCertificate = isIT && application.status === 'AWAITING_IT_CERTIFICATE_PRINTING';
    const canIssueCertificate = isIT && application.status === 'CERTIFICATE_PRINTED';

    const hasActionPanel = canStartReview || canCommercialAct || canDGAct
        || canStartTechnicalAssignment || canAssignInspector || canScheduleInspection
        || canStartAssessment || canSubmitAssessment || canTechnicalVerify || canDGActSecond
        || canStartBillingReview || canCreateInvoice || canSubmitPayment || canVerifyPayment
        || canClearCheque || canDGActFinal || canPrintCertificate || canIssueCertificate;

    return (
        <div className="space-y-6">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
                <ArrowLeft size={16} /> Back to queue
            </button>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{application.applicationNumber}</h1>
                    <p className="text-sm text-gray-500">{categoryLabel(application.category)} - {application.commodity || 'N/A'}</p>
                </div>
                <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${statusColor(application.status)}`}>
                    {statusLabel(application.status)}
                </span>
            </div>

            {dgReturnAction && (
                <div className="rounded-xl border border-orange-300 bg-orange-50 p-4">
                    <h3 className="text-sm font-semibold text-orange-800 mb-1">Returned by the Director-General</h3>
                    {dgReturnEntry?.reason
                        ? <p className="text-sm text-orange-800">{dgReturnEntry.reason}</p>
                        : <p className="text-sm text-orange-700 italic">Not recorded</p>}
                    {dgReturnEntry?.createdAt && (
                        <p className="text-xs text-orange-600 mt-1">
                            Returned {new Date(dgReturnEntry.createdAt).toLocaleString()}
                        </p>
                    )}
                </div>
            )}

            {actionError && <Alert variant="error" onClose={() => setActionError('')}>{actionError}</Alert>}
            {actionSuccess && <Alert variant="success" onClose={() => setActionSuccess('')}>{actionSuccess}</Alert>}

            {/* Action panel - only rendered when the current user's role can act on the current status */}
            {hasActionPanel && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Actions</h3>

                    {pendingAction ? (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-slate-700">
                                {REASON_ACTION_LABELS[pendingAction]}
                                <span className="text-red-500"> *</span>
                            </label>
                            <textarea
                                className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                rows={3}
                                value={reasonText}
                                onChange={(e) => setReasonText(e.target.value)}
                                placeholder="Explain what needs to change..."
                            />
                            <div className="flex gap-2">
                                <button
                                    disabled={submitting || !reasonText.trim()}
                                    onClick={() => {
                                        if (pendingAction === 'requestCorrection') {
                                            runAction(() => requestCorrection(id!, reasonText), 'Correction requested from the applicant.');
                                        } else if (pendingAction === 'dgReturn') {
                                            runAction(() => dgReturn(id!, reasonText), 'Application returned to Commercial.');
                                        } else if (pendingAction === 'requireReinspection') {
                                            runAction(() => requireReinspection(id!, reasonText), 'Reinspection required; returned to the inspector for scheduling.');
                                        } else if (pendingAction === 'dgReturnToTechnical') {
                                            runAction(() => dgReturnToTechnical(id!, reasonText), 'Application returned to Technical Services.');
                                        } else if (pendingAction === 'requirePaymentCorrection') {
                                            runAction(() => requirePaymentCorrection(id!, reasonText), 'Payment correction requested from the applicant.');
                                        } else if (pendingAction === 'dgReturnToFinance') {
                                            runAction(() => dgReturnToFinance(id!, reasonText), 'Application returned to Finance.');
                                        }
                                    }}
                                    className="px-4 py-2 text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                                >
                                    Confirm
                                </button>
                                <button
                                    disabled={submitting}
                                    onClick={() => { setPendingAction(null); setReasonText(''); }}
                                    className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 bg-white border border-gray-300 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {canStartReview && (
                                    <button
                                        disabled={submitting}
                                        onClick={() => runAction(() => startCommercialReview(id!), 'Review started.')}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Start Review
                                    </button>
                                )}
                                {canCommercialAct && (
                                    <>
                                        <button
                                            disabled={submitting}
                                            onClick={() => runAction(() => verifyCommercial(id!), 'Application verified and routed to the Director-General.')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Verify &amp; Route to DG
                                        </button>
                                        <button
                                            disabled={submitting}
                                            onClick={() => setPendingAction('requestCorrection')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-orange-700 bg-white border border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                                        >
                                            Request Correction
                                        </button>
                                    </>
                                )}
                                {canDGAct && (
                                    <>
                                        <button
                                            disabled={submitting}
                                            onClick={() => runAction(() => dgApprove(id!), 'Application approved and routed to Technical Review.')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            disabled={submitting}
                                            onClick={() => setPendingAction('dgReturn')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-orange-700 bg-white border border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                                        >
                                            Return to Commercial
                                        </button>
                                    </>
                                )}
                                {canStartTechnicalAssignment && (
                                    <button
                                        disabled={submitting}
                                        onClick={() => runAction(() => startTechnicalAssignment(id!), 'Technical review started.')}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Start Technical Review
                                    </button>
                                )}
                                {canTechnicalVerify && (
                                    <>
                                        <button
                                            disabled={submitting}
                                            onClick={() => runAction(() => verifyTechnical(id!), 'Findings verified and routed to the Director-General.')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Verify &amp; Route to DG
                                        </button>
                                        <button
                                            disabled={submitting}
                                            onClick={() => setPendingAction('requireReinspection')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-orange-700 bg-white border border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                                        >
                                            Require Reinspection
                                        </button>
                                    </>
                                )}
                                {canDGActSecond && (
                                    <>
                                        <button
                                            disabled={submitting}
                                            onClick={() => runAction(() => dgApproveSecond(id!), 'Application approved and routed to Billing.')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            disabled={submitting}
                                            onClick={() => setPendingAction('dgReturnToTechnical')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-orange-700 bg-white border border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                                        >
                                            Return to Technical Services
                                        </button>
                                    </>
                                )}
                                {canStartAssessment && (
                                    <button
                                        disabled={submitting}
                                        onClick={() => runAction(() => startAssessment(id!), 'Assessment started.')}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Start On-site Assessment
                                    </button>
                                )}
                                {canStartBillingReview && (
                                    <button
                                        disabled={submitting}
                                        onClick={() => runAction(() => startBillingReview(id!), 'Billing review started.')}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Start Billing Review
                                    </button>
                                )}
                                {canVerifyPayment && (
                                    <button
                                        disabled={submitting}
                                        onClick={() => runAction(() => verifyPayment(id!), 'Payment verified.')}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                    >
                                        Verify Payment
                                    </button>
                                )}
                                {canVerifyPayment && (
                                    <button
                                        disabled={submitting}
                                        onClick={() => setPendingAction('requirePaymentCorrection')}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-orange-700 bg-white border border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                                    >
                                        Require Payment Correction
                                    </button>
                                )}
                                {canClearCheque && (
                                    <button
                                        disabled={submitting}
                                        onClick={() => runAction(() => clearCheque(id!), 'Cheque cleared; routed to the Director-General for final approval.')}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                    >
                                        Clear Cheque
                                    </button>
                                )}
                                {canDGActFinal && (
                                    <>
                                        <button
                                            disabled={submitting}
                                            onClick={() => runAction(() => dgApproveFinal(id!), 'Application given final approval and routed to IT for certificate printing.')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Approve (Final)
                                        </button>
                                        <button
                                            disabled={submitting}
                                            onClick={() => setPendingAction('dgReturnToFinance')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-orange-700 bg-white border border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                                        >
                                            Return to Finance
                                        </button>
                                    </>
                                )}
                                {canIssueCertificate && (
                                    <button
                                        disabled={submitting}
                                        onClick={() => runAction(() => issueCertificate(id!), 'Certificate issued to the applicant. Workflow complete.')}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                    >
                                        Issue Certificate
                                    </button>
                                )}
                            </div>

                            {canAssignInspector && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">Assign Inspector</label>
                                    <div className="flex flex-wrap gap-2">
                                        <select
                                            className="flex-1 min-w-[200px] rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            value={selectedInspectorId}
                                            onChange={(e) => setSelectedInspectorId(e.target.value)}
                                        >
                                            <option value="">Select an inspector...</option>
                                            {inspectors.map((i) => (
                                                <option key={i.id} value={i.id}>{i.name || i.email}</option>
                                            ))}
                                        </select>
                                        <button
                                            disabled={submitting || !selectedInspectorId}
                                            onClick={() => runAction(() => assignInspector(id!, selectedInspectorId), 'Inspector assigned.')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            Assign
                                        </button>
                                    </div>
                                </div>
                            )}

                            {canScheduleInspection && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">Schedule Inspection Date</label>
                                    <div className="flex flex-wrap gap-2">
                                        <input
                                            type="date"
                                            className="rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            value={scheduledDateInput}
                                            onChange={(e) => setScheduledDateInput(e.target.value)}
                                        />
                                        <button
                                            disabled={submitting || !scheduledDateInput}
                                            onClick={() => runAction(() => scheduleInspection(id!, scheduledDateInput), 'Inspection scheduled.')}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            Schedule
                                        </button>
                                    </div>
                                </div>
                            )}

                            {canSubmitAssessment && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                                    <label className="block text-sm font-medium text-slate-700">Submit Warehouse Assessment</label>
                                    <div>
                                        <span className="block text-xs text-slate-500 mb-1">Outcome</span>
                                        <div className="flex gap-2">
                                            {(['PASS', 'PASS_WITH_CONDITIONS', 'FAIL'] as WarehouseAssessmentOutcome[]).map((o) => (
                                                <button
                                                    key={o}
                                                    type="button"
                                                    onClick={() => setAssessmentOutcome(o)}
                                                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${assessmentOutcome === o ? OUTCOME_COLORS[o] + ' border-transparent' : 'bg-white text-slate-600 border-gray-300'}`}
                                                >
                                                    {OUTCOME_LABELS[o]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-slate-500 mb-1">Notes</span>
                                        <textarea
                                            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            rows={2}
                                            value={assessmentNotes}
                                            onChange={(e) => setAssessmentNotes(e.target.value)}
                                            placeholder="Findings, conditions, or reasons for failure..."
                                        />
                                    </div>
                                    <button
                                        disabled={submitting}
                                        onClick={() => runAction(() => submitAssessment(id!, assessmentOutcome, undefined, assessmentNotes), 'Assessment submitted and routed to Technical Services.')}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                    >
                                        Submit Assessment
                                    </button>
                                </div>
                            )}

                            {canCreateInvoice && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                                    <label className="block text-sm font-medium text-slate-700">Create &amp; Approve Invoice</label>
                                    <div className="flex flex-wrap gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-40 rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            value={invoiceAmount}
                                            onChange={(e) => setInvoiceAmount(e.target.value)}
                                            placeholder="Amount"
                                        />
                                        <select
                                            className="rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            value={invoiceCurrency}
                                            onChange={(e) => setInvoiceCurrency(e.target.value)}
                                        >
                                            <option value="USD">USD</option>
                                            <option value="LRD">LRD</option>
                                        </select>
                                    </div>
                                    <textarea
                                        className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                        rows={2}
                                        value={invoiceNotes}
                                        onChange={(e) => setInvoiceNotes(e.target.value)}
                                        placeholder="Notes (fee breakdown, remarks)..."
                                    />
                                    <button
                                        disabled={submitting || !invoiceAmount || Number(invoiceAmount) <= 0}
                                        onClick={() => runAction(
                                            () => createInvoice(id!, Number(invoiceAmount), invoiceCurrency, undefined, invoiceNotes || undefined),
                                            'Invoice created and approved; the applicant has been notified to pay.'
                                        )}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                    >
                                        Create Invoice
                                    </button>
                                </div>
                            )}

                            {canSubmitPayment && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                                    <label className="block text-sm font-medium text-slate-700">Record Applicant Payment</label>
                                    <div className="flex flex-wrap gap-2">
                                        <select
                                            className="rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                        >
                                            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                                                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            className="flex-1 min-w-[160px] rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            value={paymentReference}
                                            onChange={(e) => setPaymentReference(e.target.value)}
                                            placeholder="Reference number"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-40 rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            value={paymentAmountPaid}
                                            onChange={(e) => setPaymentAmountPaid(e.target.value)}
                                            placeholder="Amount paid"
                                        />
                                    </div>
                                    <textarea
                                        className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                        rows={2}
                                        value={paymentNotes}
                                        onChange={(e) => setPaymentNotes(e.target.value)}
                                        placeholder="Notes..."
                                    />
                                    <button
                                        disabled={submitting}
                                        onClick={() => runAction(
                                            () => submitPayment(
                                                id!,
                                                paymentMethod,
                                                paymentReference || undefined,
                                                paymentAmountPaid ? Number(paymentAmountPaid) : undefined,
                                                undefined,
                                                undefined,
                                                paymentNotes || undefined
                                            ),
                                            'Payment recorded and routed for verification.'
                                        )}
                                        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                    >
                                        Record Payment
                                    </button>
                                </div>
                            )}

                            {canPrintCertificate && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">Print Certificate</label>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-32 rounded-md border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            value={validityMonths}
                                            onChange={(e) => setValidityMonths(e.target.value)}
                                            placeholder="Validity (months)"
                                        />
                                        <span className="text-xs text-slate-500">months validity</span>
                                        <button
                                            disabled={submitting}
                                            onClick={() => runAction(
                                                () => printCertificate(id!, validityMonths ? Number(validityMonths) : undefined),
                                                'Certificate printed.'
                                            )}
                                            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            Print Certificate
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <ReviewSection title="Application Summary">
                <Row label="Channel" value={application.channel === 'OFFICE_ASSISTED' ? 'Office-Assisted' : 'Online Self-Service'} />
                <Row label="Submission Method" value={application.submissionMethod} />
                <Row label="Submitted" value={application.submittedAt ? new Date(application.submittedAt).toLocaleString() : undefined} />
            </ReviewSection>

            {applicantRecord && (
                <ReviewSection title="Applicant / Business Information">
                    {Object.entries(applicantRecord)
                        .filter(([key, value]) => FIELD_LABELS[key] && typeof value !== 'object')
                        .map(([key, value]) => (
                            <Row key={key} label={FIELD_LABELS[key]} value={String(value)} />
                        ))}
                </ReviewSection>
            )}

            {application.data?.warehouse && (
                <ReviewSection title="Operations and Warehouse">
                    <Row label="Warehouse Name" value={application.data.warehouse.name} />
                    <Row label="County" value={application.data.warehouse.county} />
                    <Row label="Capacity" value={application.data.warehouse.capacity ? `${application.data.warehouse.capacity} ${application.data.warehouse.capacityUnit || ''}` : undefined} />
                    <Row label="Ownership Status" value={application.data.warehouse.ownership} />
                </ReviewSection>
            )}

            {application.data?.documents && Object.keys(application.data.documents).length > 0 && (
                <ReviewSection title="Supporting Documents">
                    {Object.entries(application.data.documents as Record<string, { url?: string; name?: string } | undefined>).map(([key, doc]) => (
                        <div key={key} className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 sm:border-none sm:pb-0">
                            <dt className="text-slate-500 flex items-center gap-1"><FileText size={14} /> {key.replace(/_/g, ' ')}</dt>
                            <dd className="text-slate-800 font-medium text-right">
                                {doc?.url ? (
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                                        {doc.name || 'View file'}
                                    </a>
                                ) : (doc?.name || 'Not provided')}
                            </dd>
                        </div>
                    ))}
                </ReviewSection>
            )}

            {warehouseAssessments.length > 0 && (
                <ReviewSection title="Warehouse Assessment">
                    <div className="col-span-full space-y-3">
                        {warehouseAssessments.map((wa) => (
                            <div key={wa.id} className="rounded-lg border border-slate-100 p-3">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-xs font-semibold text-slate-500">Cycle {wa.versionNumber}</span>
                                    {wa.outcome && (
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${OUTCOME_COLORS[wa.outcome]}`}>
                                            {OUTCOME_LABELS[wa.outcome]}
                                        </span>
                                    )}
                                </div>
                                <Row label="Inspector" value={wa.inspectorName} />
                                <Row label="Scheduled" value={wa.scheduledDate ? new Date(wa.scheduledDate).toLocaleDateString() : undefined} />
                                <Row label="Submitted" value={wa.submittedAt ? new Date(wa.submittedAt).toLocaleString() : undefined} />
                                {wa.notes && (
                                    <div className="flex justify-between gap-3 pt-1">
                                        <dt className="text-slate-500 flex items-center gap-1"><Warehouse size={14} /> Notes</dt>
                                        <dd className="text-slate-800 text-right">{wa.notes}</dd>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ReviewSection>
            )}

            {invoices.length > 0 && (
                <ReviewSection title="Invoices">
                    <div className="col-span-full space-y-3">
                        {invoices.map((inv) => (
                            <div key={inv.id} className="rounded-lg border border-slate-100 p-3">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-xs font-semibold text-slate-500">Cycle {inv.versionNumber}</span>
                                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                                        <Receipt size={13} /> {inv.invoiceNumber}
                                    </span>
                                </div>
                                <Row label="Amount" value={`${inv.currency} ${inv.amount.toLocaleString()}`} />
                                <Row label="Created By" value={inv.createdByName} />
                                <Row label="Approved" value={inv.approvedAt ? new Date(inv.approvedAt).toLocaleString() : undefined} />
                                {inv.feeBreakdown && inv.feeBreakdown.length > 0 && (
                                    <div className="col-span-full pt-1 space-y-0.5">
                                        {inv.feeBreakdown.map((f, idx) => (
                                            <div key={idx} className="flex justify-between text-xs text-slate-500">
                                                <span>{f.label}</span>
                                                <span>{inv.currency} {f.amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {inv.notes && (
                                    <div className="flex justify-between gap-3 pt-1">
                                        <dt className="text-slate-500">Notes</dt>
                                        <dd className="text-slate-800 text-right">{inv.notes}</dd>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ReviewSection>
            )}

            {payments.length > 0 && (
                <ReviewSection title="Payments">
                    <div className="col-span-full space-y-3">
                        {payments.map((p) => (
                            <div key={p.id} className="rounded-lg border border-slate-100 p-3">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-xs font-semibold text-slate-500">Cycle {p.versionNumber}</span>
                                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                                        <Wallet size={13} /> {p.method ? PAYMENT_METHOD_LABELS[p.method] : '-'}
                                    </span>
                                </div>
                                <Row label="Reference" value={p.referenceNumber} />
                                <Row label="Amount Paid" value={p.amountPaid != null ? p.amountPaid.toLocaleString() : undefined} />
                                <Row label="Submitted" value={p.submittedAt ? new Date(p.submittedAt).toLocaleString() : undefined} />
                                <Row label="Verified" value={p.verifiedAt ? `${new Date(p.verifiedAt).toLocaleString()}${p.verifiedByName ? ` (${p.verifiedByName})` : ''}` : undefined} />
                                {p.chequeClearedAt && (
                                    <Row label="Cheque Cleared" value={new Date(p.chequeClearedAt).toLocaleString()} />
                                )}
                                {p.notes && (
                                    <div className="flex justify-between gap-3 pt-1">
                                        <dt className="text-slate-500">Notes</dt>
                                        <dd className="text-slate-800 text-right">{p.notes}</dd>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ReviewSection>
            )}

            {certificate && (
                <ReviewSection title="Certificate">
                    <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 sm:border-none sm:pb-0">
                        <dt className="text-slate-500 flex items-center gap-1"><Printer size={14} /> Certificate No.</dt>
                        <dd className="text-slate-800 font-medium text-right">{certificate.certificateNumber || '-'}</dd>
                    </div>
                    <Row label="Type" value={certificate.permitOrLicenceType} />
                    <Row label="Issue Date" value={certificate.issueDate ? new Date(certificate.issueDate).toLocaleDateString() : undefined} />
                    <Row label="Expiry Date" value={certificate.expiryDate ? new Date(certificate.expiryDate).toLocaleDateString() : undefined} />
                    <Row label="Printed By" value={certificate.printedByName} />
                    <Row label="Printed At" value={certificate.printedAt ? new Date(certificate.printedAt).toLocaleString() : undefined} />
                    <Row label="Issued At" value={certificate.issuedAt ? new Date(certificate.issuedAt).toLocaleString() : 'Not yet issued'} />
                    {certificate.certificateNumber && certificate.issuedAt && (
                        <div className="col-span-full pt-1">
                            <a
                                href={`/verify/${certificate.certificateNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-green-600 hover:underline text-sm"
                            >
                                <QrCode size={14} /> Public verification link
                            </a>
                        </div>
                    )}
                </ReviewSection>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <History size={16} /> Audit History
                </h3>
                <ol className="space-y-3">
                    {history.map((h) => (
                        <li key={h.id} className="text-sm border-l-2 border-slate-200 pl-3">
                            <div className="flex justify-between items-baseline">
                                <span className="font-medium text-slate-800">{h.action.replace(/_/g, ' ')}</span>
                                <span className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString()}</span>
                            </div>
                            {h.role && <p className="text-xs text-slate-500">{h.role}{h.userName ? ` - ${h.userName}` : ''}</p>}
                            {h.comments && <p className="text-slate-600 mt-0.5">{h.comments}</p>}
                            {h.reason && <p className="text-orange-700 mt-0.5">Reason: {h.reason}</p>}
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
};

export default ApplicationDetail;

import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, ShieldCheck } from 'lucide-react';
import { useRegistration } from '../RegistrationContext';
import { CATEGORY_LABELS, COMMODITY_LABELS } from '../types';
import { DOCUMENT_REQUIREMENTS } from '../documentRequirements';
import FormField from '../../../components/forms/FormField';
import { TextInput, Checkbox } from '../../../components/forms/inputs';
import Alert from '../../../components/forms/Alert';
import type { FieldErrors } from '../validators';
import { isNonEmpty } from '../validators';

export function validateStep6(state: ReturnType<typeof useRegistration>['state'], captchaExpected: number): FieldErrors {
    const errors: FieldErrors = {};
    const d = state.declaration;
    if (!d.confirmTrue) errors.confirmTrue = 'You must confirm this declaration to continue.';
    if (!d.understandFalseInfo) errors.understandFalseInfo = 'You must confirm this declaration to continue.';
    if (!d.agreeRegulations) errors.agreeRegulations = 'You must confirm this declaration to continue.';
    if (!d.authorizeVerification) errors.authorizeVerification = 'You must confirm this declaration to continue.';
    if (!d.consentProcessing) errors.consentProcessing = 'You must confirm this declaration to continue.';
    if (!isNonEmpty(d.fullName)) errors.fullName = 'Full name is missing — go back and complete the applicant/authorized signatory information.';
    if (!isNonEmpty(d.signature)) errors.signature = 'Electronic signature could not be captured — go back and complete the applicant/authorized signatory information.';
    if (!isNonEmpty(d.submissionDate)) errors.submissionDate = 'Submission date is required.';
    if (Number(d.captchaAnswer) !== captchaExpected) errors.captchaAnswer = 'Incorrect answer. Please try again.';
    return errors;
}

const ReviewSection: React.FC<{ title: string; onEdit: () => void; children: React.ReactNode }> = ({ title, onEdit, children }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-medium text-brand-green hover:underline">
                <Pencil size={12} /> Edit
            </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">{children}</dl>
    </div>
);

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 sm:border-none sm:pb-0">
        <dt className="text-slate-500">{label}</dt>
        <dd className="text-slate-800 font-medium text-right">{value || '—'}</dd>
    </div>
);

interface Step6Props {
    errors: FieldErrors;
    onEditStep: (step: number) => void;
    captchaA: number;
    captchaB: number;
}

// Step 6: Declaration and Review. Shows a full, organized read-only
// review of everything entered so far (with per-section Edit links that
// jump back to the relevant step), the 5 mandated declaration statements,
// applicant identity/signature/date fields, and a simple arithmetic
// CAPTCHA (no external service dependency, works fully offline in this
// phase) as anti-spam verification before submission.
const Step6Review: React.FC<Step6Props> = ({ errors, onEditStep, captchaA, captchaB }) => {
    const { state, setDeclaration } = useRegistration();
    const { step1 } = state;
    const category = step1.category;
    const d = state.declaration;
    const [showAllDocs] = useState(true);

    const requirements = category ? DOCUMENT_REQUIREMENTS[category] : [];

    // The person who "signs" the declaration is always the same person
    // already registered as the applicant/authorized representative for
    // this category - the individual buyer, the agency's authorized
    // signatory, the cooperative's authorized representative, or the
    // exporter's authorized signatory. Their name/position are pulled
    // through automatically rather than re-typed here.
    const registeredPersonName =
        category === 'LOCAL_BUYER' ? state.buyer.fullName :
        category === 'AGENCY' ? state.agency.signatoryName :
        category === 'COOPERATIVE' ? state.cooperative.repFullName :
        category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER' ? state.exporter.signatoryName :
        '';
    const registeredPersonPosition =
        category === 'AGENCY' ? state.agency.signatoryPosition :
        category === 'COOPERATIVE' ? state.cooperative.repPosition :
        category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER' ? state.exporter.signatoryPosition :
        '';

    // Submission Date is auto-captured (with a full timestamp) rather
    // than manually entered by the applicant - it reflects the moment
    // they reached the review/declaration step, and is refreshed every
    // time they land here so it always represents their most recent
    // review pass, not a stale date.
    //
    // Full Name, Position and Electronic Signature are likewise
    // auto-captured from the already-registered applicant/signatory
    // record above - the applicant does not re-type their name to "sign".
    useEffect(() => {
        if (d.submissionDate && d.fullName === registeredPersonName && d.position === registeredPersonPosition && d.signature === registeredPersonName) return;
        setDeclaration({
            ...d,
            submissionDate: new Date().toISOString(),
            fullName: registeredPersonName,
            position: registeredPersonPosition,
            signature: registeredPersonName,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registeredPersonName, registeredPersonPosition]);

    const formattedSubmissionDate = d.submissionDate
        ? new Date(d.submissionDate).toLocaleString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
          })
        : '—';

    const categoryInfo = useMemo(() => {
        switch (category) {
            case 'LOCAL_BUYER': return state.buyer;
            case 'AGENCY': return state.agency;
            case 'COOPERATIVE': return state.cooperative;
            case 'LOCAL_EXPORTER':
            case 'FOREIGN_EXPORTER': return state.exporter;
            default: return null;
        }
    }, [category, state]);

    return (
        <div className="space-y-6">
            <Alert variant="info" title="Please review your application carefully">
                Check every section below before submitting. Use "Edit" to make changes to a specific section.
            </Alert>

            <ReviewSection title="Application Type" onEdit={() => onEditStep(0)}>
                <Row label="Category" value={category ? CATEGORY_LABELS[category] : undefined} />
                <Row label="Commodity" value={step1.commodity ? COMMODITY_LABELS[step1.commodity] : undefined} />
                <Row label="Applicant Type" value={step1.applicantKind === 'INDIVIDUAL' ? 'Individual' : step1.applicantKind === 'ORGANIZATION' ? 'Organization' : undefined} />
                <Row label="Application" value={step1.isRenewal ? `Renewal (Previous #: ${step1.previousNumber})` : 'New Application'} />
            </ReviewSection>

            {categoryInfo && (
                <ReviewSection title="Applicant / Business Information" onEdit={() => onEditStep(1)}>
                    {'fullName' in categoryInfo && <Row label="Full Name" value={categoryInfo.fullName} />}
                    {'legalName' in categoryInfo && <Row label="Legal Name" value={categoryInfo.legalName} />}
                    {'businessName' in categoryInfo && <Row label="Business Name" value={categoryInfo.businessName} />}
                    {'phone' in categoryInfo && <Row label="Phone" value={categoryInfo.phone} />}
                    {'email' in categoryInfo && <Row label="Email" value={categoryInfo.email} />}
                    {'county' in categoryInfo && <Row label="County" value={categoryInfo.county} />}
                    {'businessRegNumber' in categoryInfo && <Row label="Business Reg. Number" value={categoryInfo.businessRegNumber} />}
                    {'tin' in categoryInfo && <Row label="TIN" value={categoryInfo.tin} />}
                </ReviewSection>
            )}

            {category !== 'LOCAL_BUYER' && category && (
                <ReviewSection title="Owner and Responsible Persons" onEdit={() => onEditStep(2)}>
                    {category === 'AGENCY' && (
                        <>
                            <Row label="Owner" value={state.agency.ownerFullName} />
                            <Row label="Signatory" value={state.agency.signatoryName} />
                            <Row label="Bank" value={state.agency.bankName} />
                            <Row label="Personnel Registered" value={`${state.personnel.length} record(s)`} />
                        </>
                    )}
                    {category === 'COOPERATIVE' && (
                        <>
                            <Row label="Authorized Representative" value={state.cooperative.repFullName} />
                            <Row label="Bank" value={state.cooperative.bankName} />
                            <Row label="Leadership Registered" value={`${state.leadership.length} record(s)`} />
                            <Row label="Farmers/Members Registered" value={`${state.farmers.length} record(s)`} />
                            <Row label="Personnel Registered" value={`${state.personnel.length} record(s)`} />
                        </>
                    )}
                    {(category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER') && (
                        <>
                            <Row label="Owners Registered" value={`${state.owners.length} record(s)`} />
                            <Row label="Total Ownership" value={`${state.owners.reduce((s, o) => s + (typeof o.ownershipPercent === 'number' ? o.ownershipPercent : 0), 0)}%`} />
                            <Row label="Authorized Signatory" value={state.exporter.signatoryName} />
                            <Row label="Bank" value={state.exporter.bankName} />
                        </>
                    )}
                </ReviewSection>
            )}

            {category !== 'LOCAL_BUYER' && (
                <ReviewSection title="Operations and Warehouse" onEdit={() => onEditStep(3)}>
                    <Row label="Warehouse Name" value={state.warehouse.name} />
                    <Row label="County" value={state.warehouse.county} />
                    <Row label="Capacity" value={state.warehouse.capacity ? `${state.warehouse.capacity} ${state.warehouse.capacityUnit}` : undefined} />
                    <Row label="Ownership Status" value={state.warehouse.ownership} />
                    {(category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER') && (
                        <>
                            <Row label="GPS Coordinates" value={state.warehouse.gps} />
                            <Row label="Export Volume" value={state.exporter.exportVolume ? `${state.exporter.exportVolume} ${state.exporter.exportUnit}` : undefined} />
                            <Row label="Destinations" value={state.exporter.destinationCountries} />
                            <Row label="Suppliers Registered" value={`${state.suppliers.length} record(s)`} />
                        </>
                    )}
                </ReviewSection>
            )}

            {showAllDocs && category && (
                <ReviewSection title="Supporting Documents" onEdit={() => onEditStep(4)}>
                    {requirements.map((req) => (
                        <Row
                            key={req.key}
                            label={req.label}
                            value={state.documents[req.key]?.status === 'done' ? state.documents[req.key]?.name : req.required ? 'Missing' : 'Not provided'}
                        />
                    ))}
                </ReviewSection>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Declaration</h3>
                <div className="space-y-3 mb-5">
                    <DeclarationItem
                        checked={d.confirmTrue}
                        onChange={(v) => setDeclaration({ ...d, confirmTrue: v })}
                        error={errors.confirmTrue}
                        text="I confirm that the information provided in this application is true and complete."
                    />
                    <DeclarationItem
                        checked={d.understandFalseInfo}
                        onChange={(v) => setDeclaration({ ...d, understandFalseInfo: v })}
                        error={errors.understandFalseInfo}
                        text="I understand that providing false information may result in rejection or cancellation of the permit or licence."
                    />
                    <DeclarationItem
                        checked={d.agreeRegulations}
                        onChange={(v) => setDeclaration({ ...d, agreeRegulations: v })}
                        error={errors.agreeRegulations}
                        text="I agree to comply with all applicable LACRA regulations."
                    />
                    <DeclarationItem
                        checked={d.authorizeVerification}
                        onChange={(v) => setDeclaration({ ...d, authorizeVerification: v })}
                        error={errors.authorizeVerification}
                        text="I authorize LACRA to verify the submitted information and inspect the stated business and warehouse locations."
                    />
                    <DeclarationItem
                        checked={d.consentProcessing}
                        onChange={(v) => setDeclaration({ ...d, consentProcessing: v })}
                        error={errors.consentProcessing}
                        text="I consent to the processing of my information for regulatory purposes."
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Full Name" required error={errors.fullName} hint="Captured from the applicant/authorized signatory registered in earlier steps">
                        <TextInput value={d.fullName || 'Not yet registered — complete the earlier steps'} disabled className="bg-slate-50 text-slate-500" />
                    </FormField>
                    <FormField label="Position / Title" hint="Captured from the earlier steps, where applicable">
                        <TextInput value={d.position || '—'} disabled className="bg-slate-50 text-slate-500" />
                    </FormField>
                    <FormField label="Electronic Signature" required error={errors.signature} hint="Automatically signed using the registered applicant/signatory's name">
                        <TextInput value={d.signature || 'Not yet registered — complete the earlier steps'} disabled className="bg-slate-50 text-slate-500 font-medium italic" />
                    </FormField>
                    <FormField label="Submission Date" hint="Automatically captured when you reach this step">
                        <TextInput value={formattedSubmissionDate} disabled className="bg-slate-50 text-slate-500" />
                    </FormField>
                    <FormField
                        label={`Verification: what is ${captchaA} + ${captchaB}?`}
                        required
                        error={errors.captchaAnswer}
                        tooltip="This simple check helps prevent automated/spam submissions."
                        full
                    >
                        <div className="flex items-center gap-2 max-w-xs">
                            <ShieldCheck size={18} className="text-brand-green flex-shrink-0" />
                            <TextInput type="number" value={d.captchaAnswer} onChange={(e) => setDeclaration({ ...d, captchaAnswer: e.target.value })} />
                        </div>
                    </FormField>
                </div>
            </div>
        </div>
    );
};

const DeclarationItem: React.FC<{ checked: boolean; onChange: (v: boolean) => void; text: string; error?: string }> = ({ checked, onChange, text, error }) => (
    <div>
        <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} label={text} />
        {error && <p className="mt-1 ml-6 text-xs text-red-600" role="alert">{error}</p>}
    </div>
);

export default Step6Review;

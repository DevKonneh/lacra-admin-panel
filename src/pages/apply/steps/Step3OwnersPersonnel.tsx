import React from 'react';
import { useRegistration } from '../RegistrationContext';
import type { AgencyInfo, CooperativeInfo, ExporterInfo, IdType } from '../types';
import FormField from '../../../components/forms/FormField';
import { TextInput, SelectInput } from '../../../components/forms/inputs';
import CountyDistrictFields from '../../../components/forms/CountyDistrictFields';
import DocumentUpload from '../../../components/forms/DocumentUpload';
import BankNameField from '../../../components/forms/BankNameField';
import PhoneInput from '../../../components/forms/PhoneInput';
import PersonnelManager from '../../../components/forms/PersonnelManager';
import FarmerManager from '../../../components/forms/FarmerManager';
import OwnerManager from '../../../components/forms/OwnerManager';
import Alert from '../../../components/forms/Alert';
import { MIN_BANK_BALANCE } from '../documentRequirements';
import { isValidEmail, isValidPhone, isPositiveNumber, type FieldErrors } from '../validators';

const REQUIRED_BUYERS = 3;
const REQUIRED_CLERKS = 1;

// Display label shown in the Personnel Role dropdown and roster table for
// the "Clerk" role, per LACRA's exact regulation wording ("Weighing
// Clerk") \u2014 the underlying STORED role value stays "Clerk" everywhere
// (AgencyStaffingService.countWizardPersonnel / AgentPersonnelRole.CLERK
// on the backend, countPersonnel/countAgencyPersonnel above) so this is
// purely a display-layer change.
const PERSONNEL_ROLE_LABELS: Record<string, string> = { Agent: 'Agent', Clerk: 'Weighing Clerk' };

// Original, UNCHANGED personnel count — still used as-is for COOPERATIVE.
// IMPORTANT: this Agency-release change must not alter Cooperative's
// pre-existing "exactly 3 Agents + 1 Clerk" requirement, which has no
// corresponding enforcement in AgencyStaffingService on the backend (that
// service only ever runs for ApplicationCategory.AGENCY — see
// ApplicationController's DG-approval and certificate-issuance gates).
// Left exactly as it was before this release so Cooperative applicants see
// no behavior change.
export function countPersonnel(personnel: ReturnType<typeof useRegistration>['state']['personnel']) {
    const buyers = personnel.filter((p) => p.role === 'Agent').length;
    const clerks = personnel.filter((p) => p.role === 'Clerk').length;
    return { buyers, clerks };
}

// AGENCY-ONLY count, added for this release to mirror the backend's
// AgencyStaffingService.countWizardPersonnel() EXACTLY (parity contract
// documented there): only ACTIVE records count toward the requirement, and
// Agents are de-duplicated by nationalId (falling back to fullName) so two
// rows accidentally describing the same person cannot be miscounted as two
// distinct Agents. Deliberately NOT used for COOPERATIVE (see countPersonnel
// above) since the backend has no staffing gate for that category and this
// release must not change its existing behavior.
export function countAgencyPersonnel(personnel: ReturnType<typeof useRegistration>['state']['personnel']) {
    const isActive = (p: (typeof personnel)[number]) => !p.status || p.status === 'ACTIVE';
    const agentRecords = personnel.filter((p) => p.role === 'Agent' && isActive(p));
    const clerkRecords = personnel.filter((p) => p.role === 'Clerk' && isActive(p));
    const distinctAgentKeys = new Set(
        agentRecords.map((p) => (p.nationalId && p.nationalId.trim()) || (p.fullName && p.fullName.trim()) || p.id)
    );
    return { buyers: distinctAgentKeys.size, clerks: clerkRecords.length };
}

export function validateStep3(category: string, state: ReturnType<typeof useRegistration>['state']): FieldErrors {
    const errors: FieldErrors = {};
    const req = (val: string, key: string, label: string) => { if (!val || !val.trim()) errors[key] = `${label} is required.`; };

    // Shared bank-balance check: validates presence, numeric validity and
    // the category's MIN_BANK_BALANCE minimum (per LACRA's regulation —
    // previously MIN_BANK_BALANCE was only ever shown as an informational
    // hint and never actually enforced here).
    const checkBankBalance = (balance: string, min: number) => {
        req(balance, 'bankBalance', 'Balance / equivalent in USD');
        if (balance) {
            if (!isPositiveNumber(balance)) {
                errors.bankBalance = 'Balance / equivalent in USD must be a valid number.';
            } else if (Number(balance) < min) {
                errors.bankBalance = `Balance / equivalent in USD must be at least US$${min.toLocaleString()}.`;
            }
        }
    };

    if (category === 'AGENCY') {
        const a = state.agency;
        req(a.ownerFullName, 'ownerFullName', "Owner's full name");
        req(a.ownerIdNumber, 'ownerIdNumber', "Owner's National ID/passport number");
        req(a.signatoryName, 'signatoryName', "Authorized signatory's name");
        req(a.bankName, 'bankName', 'Bank name');
        req(a.bankAccountName, 'bankAccountName', 'Bank account name');
        req(a.bankAccountNumber, 'bankAccountNumber', 'Bank account number');
        checkBankBalance(a.bankBalance, MIN_BANK_BALANCE.AGENCY);
        if (a.signatoryEmail && !isValidEmail(a.signatoryEmail)) errors.signatoryEmail = 'Enter a valid email address.';
        if (a.signatoryPhone && !isValidPhone(a.signatoryPhone)) errors.signatoryPhone = 'Enter a valid Liberian phone number (8-9 digits after +231).';

        const { buyers, clerks } = countAgencyPersonnel(state.personnel);
        if (buyers < REQUIRED_BUYERS || clerks !== REQUIRED_CLERKS) {
            errors.personnel = `At least ${REQUIRED_BUYERS} distinct active Agents and exactly ${REQUIRED_CLERKS} active Weighing Clerk are required. Currently: ${buyers} agent(s), ${clerks} clerk(s).`;
        }
    } else if (category === 'COOPERATIVE') {
        const c = state.cooperative;
        req(c.repFullName, 'repFullName', "Authorized representative's full name");
        req(c.repNationalId, 'repNationalId', "Authorized representative's National ID number");
        req(c.bankName, 'bankName', 'Bank name');
        req(c.bankAccountName, 'bankAccountName', 'Bank account name');
        req(c.bankAccountNumber, 'bankAccountNumber', 'Bank account number');
        checkBankBalance(c.bankBalance, MIN_BANK_BALANCE.COOPERATIVE);
        if (c.repEmail && !isValidEmail(c.repEmail)) errors.repEmail = 'Enter a valid email address.';
        if (c.repPhone && !isValidPhone(c.repPhone)) errors.repPhone = 'Enter a valid Liberian phone number (8-9 digits after +231).';

        // UNCHANGED for this release: Cooperative keeps its original
        // exact-equality requirement (see countPersonnel's doc comment).
        const { buyers, clerks } = countPersonnel(state.personnel);
        if (buyers !== REQUIRED_BUYERS || clerks !== REQUIRED_CLERKS) {
            errors.personnel = `Exactly ${REQUIRED_BUYERS} Agents and ${REQUIRED_CLERKS} Weighing Clerk are required. Currently: ${buyers} buyer(s), ${clerks} clerk(s).`;
        }
        if (state.farmers.length === 0) {
            errors.farmers = 'Add at least one farmer/member record.';
        }
    } else if (category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER') {
        const x = state.exporter;
        req(x.signatoryName, 'signatoryName', "Authorized signatory's full name");
        req(x.signatoryIdNumber, 'signatoryIdNumber', "Authorized signatory's ID number");
        req(x.bankName, 'bankName', 'Bank name');
        req(x.bankAccountName, 'bankAccountName', 'Bank account name');
        req(x.bankAccountNumber, 'bankAccountNumber', 'Bank account number');
        checkBankBalance(x.bankBalance, MIN_BANK_BALANCE[category]);
        if (x.signatoryEmail && !isValidEmail(x.signatoryEmail)) errors.signatoryEmail = 'Enter a valid email address.';
        if (x.signatoryPhone && !isValidPhone(x.signatoryPhone)) errors.signatoryPhone = 'Enter a valid Liberian phone number (8-9 digits after +231).';

        if (state.owners.length === 0) {
            errors.owners = 'Add at least one owner/shareholder.';
        } else {
            const total = state.owners.reduce((sum, o) => sum + (typeof o.ownershipPercent === 'number' ? o.ownershipPercent : 0), 0);
            if (total !== 100) {
                errors.owners = `Total ownership percentage must equal exactly 100%. Current total: ${total}%.`;
            }
        }
    }
    return errors;
}

interface Step3Props {
    errors: FieldErrors;
}

// Step 3: Owner and Responsible Persons. Content varies heavily by
// category: Agency needs owner+signatory+banking+the 3-buyer/1-clerk
// personnel roster; Cooperative needs the authorized representative,
// banking, cooperative leadership and the farmer/member list PLUS its own
// 3-buyer/1-clerk roster; Exporter needs the repeatable ownership section
// (must total 100%), the authorized signatory and banking. Local Buyer
// has no separate "owner/responsible persons" step since the applicant
// IS the individual - Step 3 is skipped for that category by the wizard.
const Step3OwnersPersonnel: React.FC<Step3Props> = ({ errors }) => {
    const { state, setAgency, setCooperative, setExporter, setPersonnel, setLeadership, setFarmers, setOwners } = useRegistration();
    const category = state.step1.category;

    if (category === 'AGENCY') {
        const a = state.agency;
        const update = (patch: Partial<AgencyInfo>) => setAgency({ ...a, ...patch });
        const { buyers, clerks } = countAgencyPersonnel(state.personnel);
        return (
            <div className="space-y-8">
                <section>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight mb-4">Owner and Authorized Representative</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Owner's Full Name" required error={errors.ownerFullName}>
                            <TextInput value={a.ownerFullName} onChange={(e) => update({ ownerFullName: e.target.value })} />
                        </FormField>
                        <FormField label="Nationality" required>
                            <TextInput value={a.ownerNationality} onChange={(e) => update({ ownerNationality: e.target.value })} />
                        </FormField>
                        <FormField label="ID Type">
                            <SelectInput value={a.ownerIdType} onChange={(e) => update({ ownerIdType: e.target.value as IdType })}>
                                <option value="">Select...</option>
                                <option value="NATIONAL_ID">National ID</option>
                                <option value="PASSPORT">Passport</option>
                            </SelectInput>
                        </FormField>
                        <FormField label="National ID / Passport Number" required error={errors.ownerIdNumber}>
                            <TextInput value={a.ownerIdNumber} onChange={(e) => update({ ownerIdNumber: e.target.value })} />
                        </FormField>
                        <div className="sm:col-span-2">
                            <DocumentUpload
                                label="Proof of Liberian Citizenship"
                                required
                                accept=".pdf,.jpg,.jpeg,.png"
                                acceptDisplay="PDF, JPG, PNG"
                                maxSizeMb={5}
                                value={a.ownerCitizenshipProof}
                                onChange={(f) => update({ ownerCitizenshipProof: f })}
                            />
                        </div>
                        <FormField label="Authorized Signatory's Name" required error={errors.signatoryName}>
                            <TextInput value={a.signatoryName} onChange={(e) => update({ signatoryName: e.target.value })} />
                        </FormField>
                        <FormField label="Authorized Signatory's Position">
                            <TextInput value={a.signatoryPosition} onChange={(e) => update({ signatoryPosition: e.target.value })} />
                        </FormField>
                        <FormField label="Phone Number" error={errors.signatoryPhone}>
                            <PhoneInput value={a.signatoryPhone} onChange={(v) => update({ signatoryPhone: v })} hasError={!!errors.signatoryPhone} />
                        </FormField>
                        <FormField label="Email Address" error={errors.signatoryEmail}>
                            <TextInput type="email" value={a.signatoryEmail} onChange={(e) => update({ signatoryEmail: e.target.value })} />
                        </FormField>
                        <div className="sm:col-span-2">
                            <DocumentUpload
                                label="Passport-size Photograph"
                                required
                                accept=".jpg,.jpeg,.png"
                                acceptDisplay="JPG, PNG"
                                maxSizeMb={2}
                                value={a.signatoryPhoto}
                                onChange={(f) => update({ signatoryPhoto: f })}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <DocumentUpload
                                label="Business Logo"
                                accept=".jpg,.jpeg,.png"
                                acceptDisplay="JPG, PNG"
                                maxSizeMb={2}
                                helpText="Optional — used to brand the agency's permit and correspondence"
                                value={a.businessLogo}
                                onChange={(f) => update({ businessLogo: f })}
                            />
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight mb-4">Organization Banking Details</h2>
                    <Alert variant="info" title="Why we ask for this">
                        These details support Commercial &amp; Marketing eligibility checks. Enter the statement balance in US dollars or its US-dollar equivalent; LACRA verifies the statement during review.
                    </Alert>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <BankNameField value={a.bankName} onChange={(v) => update({ bankName: v })} error={errors.bankName} idPrefix="agency" />
                        <FormField label="Bank Account Name" required error={errors.bankAccountName}>
                            <TextInput value={a.bankAccountName} onChange={(e) => update({ bankAccountName: e.target.value })} />
                        </FormField>
                        <FormField label="Bank Account Number" required error={errors.bankAccountNumber}>
                            <TextInput value={a.bankAccountNumber} onChange={(e) => update({ bankAccountNumber: e.target.value })} />
                        </FormField>
                        <FormField label="Balance / Equivalent in USD" required error={errors.bankBalance} hint={`Minimum required: US$${MIN_BANK_BALANCE.AGENCY.toLocaleString()}`}>
                            <TextInput type="number" min={0} value={a.bankBalance} onChange={(e) => update({ bankBalance: e.target.value })} />
                        </FormField>
                        <FormField label="Bank Statement Date">
                            <TextInput type="date" value={a.bankStatementDate} onChange={(e) => update({ bankStatementDate: e.target.value })} />
                        </FormField>
                    </div>
                </section>

                <section>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight mb-1">Linked Persons · Three Buyers and One Weighing Clerk</h2>
                    <p className="text-xs text-slate-500 mb-3">
                        Record the four people to be registered. Attach their registration records and passport-size photos in the Supporting Documents checklist.
                    </p>
                    {errors.personnel && <Alert variant="warning" title="Personnel requirement not met">{errors.personnel}</Alert>}
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 mb-2">
                        Required: at least {REQUIRED_BUYERS} distinct active Agents and exactly {REQUIRED_CLERKS} active Weighing Clerk — currently {buyers} agent(s), {clerks} clerk(s).
                    </div>
                    <PersonnelManager
                        title="Agency Personnel"
                        description="Register the required personnel: at least 3 Agents and exactly 1 Weighing Clerk."
                        records={state.personnel}
                        onChange={setPersonnel}
                        roleOptions={['Agent', 'Clerk']}
                        roleLabels={PERSONNEL_ROLE_LABELS}
                        simple
                    />
                </section>
            </div>
        );
    }

    if (category === 'COOPERATIVE') {
        const c = state.cooperative;
        const update = (patch: Partial<CooperativeInfo>) => setCooperative({ ...c, ...patch });
        const { buyers, clerks } = countPersonnel(state.personnel);
        return (
            <div className="space-y-8">
                <section>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight mb-4">Authorized Representative</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Full Name" required error={errors.repFullName}>
                            <TextInput value={c.repFullName} onChange={(e) => update({ repFullName: e.target.value })} />
                        </FormField>
                        <FormField label="Leadership Position">
                            <TextInput value={c.repPosition} onChange={(e) => update({ repPosition: e.target.value })} />
                        </FormField>
                        <FormField label="National ID Number" required error={errors.repNationalId}>
                            <TextInput value={c.repNationalId} onChange={(e) => update({ repNationalId: e.target.value })} />
                        </FormField>
                        <FormField label="Phone Number" error={errors.repPhone}>
                            <PhoneInput value={c.repPhone} onChange={(v) => update({ repPhone: v })} hasError={!!errors.repPhone} />
                        </FormField>
                        <FormField label="Email Address" error={errors.repEmail}>
                            <TextInput type="email" value={c.repEmail} onChange={(e) => update({ repEmail: e.target.value })} />
                        </FormField>
                        <CountyDistrictFields
                            county={c.repCounty} district={c.repDistrict}
                            onChange={(repCounty, repDistrict) => update({ repCounty, repDistrict })}
                            idPrefix="coop-rep"
                            countyRequired={false}
                        />
                        <FormField label="Address" full>
                            <TextInput value={c.repAddress} onChange={(e) => update({ repAddress: e.target.value })} />
                        </FormField>
                        <div className="sm:col-span-2">
                            <DocumentUpload
                                label="Passport-size Photograph"
                                required
                                accept=".jpg,.jpeg,.png"
                                acceptDisplay="JPG, PNG"
                                maxSizeMb={2}
                                value={c.repPhoto}
                                onChange={(f) => update({ repPhoto: f })}
                            />
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight mb-4">Organization Banking Details</h2>
                    <Alert variant="info" title="Why we ask for this">
                        These details support Commercial &amp; Marketing eligibility checks. Enter the statement balance in US dollars or its US-dollar equivalent; LACRA verifies the statement during review.
                    </Alert>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <BankNameField value={c.bankName} onChange={(v) => update({ bankName: v })} error={errors.bankName} idPrefix="coop" />
                        <FormField label="Bank Account Name" required error={errors.bankAccountName}>
                            <TextInput value={c.bankAccountName} onChange={(e) => update({ bankAccountName: e.target.value })} />
                        </FormField>
                        <FormField label="Bank Account Number" required error={errors.bankAccountNumber}>
                            <TextInput value={c.bankAccountNumber} onChange={(e) => update({ bankAccountNumber: e.target.value })} />
                        </FormField>
                        <FormField label="Balance / Equivalent in USD" required error={errors.bankBalance} hint={`Minimum required: US$${MIN_BANK_BALANCE.COOPERATIVE.toLocaleString()}`}>
                            <TextInput type="number" min={0} value={c.bankBalance} onChange={(e) => update({ bankBalance: e.target.value })} />
                        </FormField>
                        <FormField label="Bank Statement Date">
                            <TextInput type="date" value={c.bankStatementDate} onChange={(e) => update({ bankStatementDate: e.target.value })} />
                        </FormField>
                    </div>
                </section>

                <section>
                    <PersonnelManager
                        title="Cooperative Leadership"
                        description="Add each member of the cooperative's leadership."
                        records={state.leadership}
                        onChange={setLeadership}
                        freeRoleLabel="Position"
                    />
                </section>

                <section>
                    {errors.farmers && <Alert variant="warning" title="Farmer/member records required">{errors.farmers}</Alert>}
                    <FarmerManager records={state.farmers} onChange={setFarmers} />
                </section>

                <section>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight mb-1">Linked Persons · Three Buyers and One Weighing Clerk</h2>
                    <p className="text-xs text-slate-500 mb-3">
                        Record the four people to be registered. Attach their registration records and passport-size photos in the Supporting Documents checklist.
                    </p>
                    {errors.personnel && <Alert variant="warning" title="Personnel requirement not met">{errors.personnel}</Alert>}
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 mb-2">
                        Required: exactly {REQUIRED_BUYERS} Agents and {REQUIRED_CLERKS} Weighing Clerk — currently {buyers} buyer(s), {clerks} clerk(s).
                    </div>
                    <PersonnelManager
                        title="Cooperative Personnel"
                        description="Register the required personnel: 3 Agents and 1 Weighing Clerk."
                        records={state.personnel}
                        onChange={setPersonnel}
                        roleOptions={['Agent', 'Clerk']}
                        roleLabels={PERSONNEL_ROLE_LABELS}
                        simple
                    />
                </section>
            </div>
        );
    }

    if (category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER') {
        const x = state.exporter;
        const update = (patch: Partial<ExporterInfo>) => setExporter({ ...x, ...patch });
        return (
            <div className="space-y-8">
                <section>
                    {errors.owners && <Alert variant="warning" title="Ownership information incomplete">{errors.owners}</Alert>}
                    <OwnerManager records={state.owners} onChange={setOwners} />
                </section>

                <section>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight mb-4">Authorized Signatory</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Full Name" required error={errors.signatoryName}>
                            <TextInput value={x.signatoryName} onChange={(e) => update({ signatoryName: e.target.value })} />
                        </FormField>
                        <FormField label="Position/Title">
                            <TextInput value={x.signatoryPosition} onChange={(e) => update({ signatoryPosition: e.target.value })} />
                        </FormField>
                        <FormField label="National ID / Passport Number" required error={errors.signatoryIdNumber}>
                            <TextInput value={x.signatoryIdNumber} onChange={(e) => update({ signatoryIdNumber: e.target.value })} />
                        </FormField>
                        <FormField label="Phone Number" error={errors.signatoryPhone}>
                            <PhoneInput value={x.signatoryPhone} onChange={(v) => update({ signatoryPhone: v })} hasError={!!errors.signatoryPhone} />
                        </FormField>
                        <FormField label="Email Address" error={errors.signatoryEmail}>
                            <TextInput type="email" value={x.signatoryEmail} onChange={(e) => update({ signatoryEmail: e.target.value })} />
                        </FormField>
                        <div className="sm:col-span-2">
                            <DocumentUpload
                                label="Passport-size Photograph"
                                required
                                accept=".jpg,.jpeg,.png"
                                acceptDisplay="JPG, PNG"
                                maxSizeMb={2}
                                value={x.signatoryPhoto}
                                onChange={(f) => update({ signatoryPhoto: f })}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <DocumentUpload
                                label="Business Logo"
                                accept=".jpg,.jpeg,.png"
                                acceptDisplay="JPG, PNG"
                                maxSizeMb={2}
                                helpText="Optional — used to brand the company's permit and correspondence"
                                value={x.businessLogo}
                                onChange={(f) => update({ businessLogo: f })}
                            />
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight mb-4">Organization Banking Details</h2>
                    <Alert variant="info" title="Why we ask for this">
                        These details support Commercial &amp; Marketing eligibility checks. Enter the statement balance in US dollars or its US-dollar equivalent; LACRA verifies the statement during review.
                        {' '}Minimum required: {category === 'LOCAL_EXPORTER' ? `US$${MIN_BANK_BALANCE.LOCAL_EXPORTER.toLocaleString()} for a Local Exporter.` : `US$${MIN_BANK_BALANCE.FOREIGN_EXPORTER.toLocaleString()} for a Foreign Exporter.`}
                    </Alert>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <BankNameField value={x.bankName} onChange={(v) => update({ bankName: v })} error={errors.bankName} idPrefix="exporter" />
                        <FormField label="Bank Account Name" required error={errors.bankAccountName}>
                            <TextInput value={x.bankAccountName} onChange={(e) => update({ bankAccountName: e.target.value })} />
                        </FormField>
                        <FormField label="Bank Account Number" required error={errors.bankAccountNumber}>
                            <TextInput value={x.bankAccountNumber} onChange={(e) => update({ bankAccountNumber: e.target.value })} />
                        </FormField>
                        <FormField label="Currency">
                            <TextInput value={x.currency} onChange={(e) => update({ currency: e.target.value })} />
                        </FormField>
                        <FormField label="Balance / Equivalent in USD" required error={errors.bankBalance}>
                            <TextInput type="number" min={0} value={x.bankBalance} onChange={(e) => update({ bankBalance: e.target.value })} />
                        </FormField>
                        <FormField label="Bank Statement Date">
                            <TextInput type="date" value={x.bankStatementDate} onChange={(e) => update({ bankStatementDate: e.target.value })} />
                        </FormField>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <Alert variant="info" title="No additional owners or personnel required">
            This section does not apply to Local Produce Buyer applications — you may continue to the next step.
        </Alert>
    );
};

export default Step3OwnersPersonnel;

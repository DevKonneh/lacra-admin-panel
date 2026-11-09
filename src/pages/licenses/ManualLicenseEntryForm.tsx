import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, Loader2, FileBadge, Sprout,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { buttonClasses } from '../../components/ui/buttonStyles';
import FormField from '../../components/forms/FormField';
import { TextInput, SelectInput, TextArea, Checkbox } from '../../components/forms/inputs';
import CountyDistrictFields from '../../components/forms/CountyDistrictFields';
import PhoneInput from '../../components/forms/PhoneInput';
import DateField from '../../components/forms/DateField';
import DocumentUpload from '../../components/forms/DocumentUpload';
import Alert from '../../components/forms/Alert';
import type { UploadedFile } from '../apply/types';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import {
    createManualLicenseEntry,
    type ManualLicenseEntryCategory,
    type ManualLicenseEntryPayload,
    type ManualLicenseEntryResult,
} from '../../api/manualLicenseEntry';

// ---------------------------------------------------------------------------
// "Register Manual/Historical License" — a separate, dedicated action from
// the normal License Registry (/licenses) list view. This is NOT the
// /apply 41-status DG-approval wizard, and it does NOT replace the old
// simple License entity's apply flow — it is a new, lightweight pathway for
// Commercial/Marketing staff to backfill a license/permit (Local Produce
// Buyer, Agency, Cooperative, or Exporter) that was already approved and
// issued manually on paper in the past. Submitting here lands the record
// straight into ISSUED status and it immediately appears in that
// category's register (Local Produce Buyers / Agencies / Cooperatives /
// Exporters), each openable as its own profile page — see
// ManualLicenseEntryService.ts on the backend for the full write-path.
//
// Access: Commercial/Marketing staff + Admins only (mirrors the backend's
// own authMiddleware([UserRole.COMMERCIAL, UserRole.ADMIN]) gate on
// POST /api/manual-license-entries). Any other role is redirected away
// entirely rather than shown a form that would just 403 on submit.
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: ManualLicenseEntryCategory; label: string }[] = [
    { value: 'LOCAL_BUYER', label: 'Local Produce Buyer' },
    { value: 'AGENCY', label: 'Agency' },
    { value: 'COOPERATIVE', label: 'Cooperative' },
    { value: 'EXPORTER', label: 'Exporter' },
];

const CATEGORY_REGISTER_PATH: Record<ManualLicenseEntryCategory, string> = {
    LOCAL_BUYER: '/permits/local-produce-buyers',
    AGENCY: '/permits/agencies',
    COOPERATIVE: '/permits/cooperatives',
    EXPORTER: '/permits/exporters',
};

const COMMODITY_OPTIONS = [
    { value: 'COCOA', label: 'Cocoa' },
    { value: 'COFFEE', label: 'Coffee' },
    { value: 'PALM_OIL', label: 'Palm Oil' },
    { value: 'RUBBER', label: 'Rubber' },
    { value: 'OTHER', label: 'Other' },
];

const ID_TYPE_OPTIONS = [
    { value: 'NATIONAL_ID', label: 'National ID' },
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'DRIVER_LICENSE', label: "Driver's License" },
    { value: 'VOTER_ID', label: 'Voter ID' },
    { value: 'OTHER', label: 'Other' },
];

interface FormState {
    category: ManualLicenseEntryCategory | '';
    // Section A
    businessName: string;
    tinNumber: string;
    businessRegistrationNumber: string;
    county: string;
    district: string;
    businessAddress: string;
    contactPerson: string;
    email: string;
    whatsapp: string;
    // Section B
    ownerManagerName: string;
    dateOfBirth: string;
    gender: '' | 'Male' | 'Female';
    placeOfBirth: string;
    nationality: string;
    position: string;
    idType: string;
    idNumber: string;
    // Section C
    intendedCommodities: string[];
    estimatedAnnualPurchaseVolume: string;
    expectedAreasOfOperation: string;
    // Backfill-specific fields
    licenseNumber: string;
    issuedOn: string;
    notes: string;
    // Exporter-only, optional — see ManualLicenseEntryPayload's doc
    // comment in ../../api/manualLicenseEntry.ts for why this is not
    // required: SBA tracking is new going forward, and historical
    // records being backfilled here were never asked for it.
    sbaExecuted: boolean;
    sbaNotes: string;
}

const emptyForm: FormState = {
    category: '',
    businessName: '',
    tinNumber: '',
    businessRegistrationNumber: '',
    county: '',
    district: '',
    businessAddress: '',
    contactPerson: '',
    email: '',
    whatsapp: '',
    ownerManagerName: '',
    dateOfBirth: '',
    gender: '',
    placeOfBirth: '',
    nationality: 'Liberian',
    position: '',
    idType: '',
    idNumber: '',
    intendedCommodities: [],
    estimatedAnnualPurchaseVolume: '',
    expectedAreasOfOperation: '',
    licenseNumber: '',
    issuedOn: '',
    notes: '',
    sbaExecuted: false,
    sbaNotes: '',
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const todayIso = () => new Date().toISOString().slice(0, 10);

const ManualLicenseEntryForm: React.FC = () => {
    const { user } = useAuth();
    const isAuthorized = user?.role === UserRole.COMMERCIAL || user?.role === UserRole.ADMIN;

    const [form, setForm] = useState<FormState>(emptyForm);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [documents, setDocuments] = useState<Record<string, UploadedFile | null>>({
        supportingDocument1: null,
        supportingDocument2: null,
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [result, setResult] = useState<ManualLicenseEntryResult | null>(null);
    const [resultCategory, setResultCategory] = useState<ManualLicenseEntryCategory | null>(null);

    const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

    const toggleCommodity = (value: string) => {
        setForm((f) => {
            const has = f.intendedCommodities.includes(value);
            return {
                ...f,
                intendedCommodities: has
                    ? f.intendedCommodities.filter((c) => c !== value)
                    : [...f.intendedCommodities, value],
            };
        });
    };

    const uploadingCount = useMemo(
        () => Object.values(documents).filter((d) => d && d.status === 'uploading').length,
        [documents]
    );

    const validate = (): FieldErrors => {
        const next: FieldErrors = {};
        const req = (key: keyof FormState, label: string) => {
            const val = form[key];
            if (typeof val === 'string' ? !val.trim() : !val || (Array.isArray(val) && val.length === 0)) {
                next[key] = `${label} is required.`;
            }
        };

        req('category', 'License/Permit type');
        req('businessName', 'Business/Entity name');
        req('businessRegistrationNumber', 'Business registration number');
        req('county', 'County');
        req('district', 'District');
        req('businessAddress', 'Business address');
        req('contactPerson', 'Contact person');
        req('ownerManagerName', 'Owner/Manager name');
        req('dateOfBirth', 'Date of birth');
        req('gender', 'Gender');
        req('placeOfBirth', 'Place of birth');
        req('nationality', 'Nationality');
        req('position', 'Position');
        req('idType', 'ID type');
        req('idNumber', 'ID number');
        if (form.intendedCommodities.length === 0) {
            next.intendedCommodities = 'Select at least one intended commodity.';
        }
        req('estimatedAnnualPurchaseVolume', 'Estimated annual purchase volume');
        if (form.estimatedAnnualPurchaseVolume && (Number.isNaN(Number(form.estimatedAnnualPurchaseVolume)) || Number(form.estimatedAnnualPurchaseVolume) < 0)) {
            next.estimatedAnnualPurchaseVolume = 'Enter a non-negative number.';
        }
        req('expectedAreasOfOperation', 'Expected areas of operation');

        return next;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');
        setResult(null);

        const fieldErrors = validate();
        setErrors(fieldErrors);
        if (Object.keys(fieldErrors).length > 0) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        if (uploadingCount > 0) {
            setSubmitError('Please wait for document uploads to finish before submitting.');
            return;
        }

        const documentList = Object.entries(documents)
            .filter(([, f]) => f && f.status === 'done' && f.url)
            .map(([key, f]) => ({ key, url: f!.url!, name: f!.name }));

        const payload: ManualLicenseEntryPayload = {
            category: form.category as ManualLicenseEntryCategory,
            businessName: form.businessName.trim(),
            tinNumber: form.tinNumber.trim() || undefined,
            businessRegistrationNumber: form.businessRegistrationNumber.trim(),
            county: form.county.trim(),
            district: form.district.trim(),
            businessAddress: form.businessAddress.trim(),
            contactPerson: form.contactPerson.trim(),
            email: form.email.trim() || undefined,
            whatsapp: form.whatsapp.trim() || undefined,
            ownerManagerName: form.ownerManagerName.trim(),
            dateOfBirth: form.dateOfBirth,
            gender: form.gender,
            placeOfBirth: form.placeOfBirth.trim(),
            nationality: form.nationality.trim(),
            position: form.position.trim(),
            idType: form.idType,
            idNumber: form.idNumber.trim(),
            intendedCommodities: form.intendedCommodities,
            estimatedAnnualPurchaseVolume: form.estimatedAnnualPurchaseVolume,
            expectedAreasOfOperation: form.expectedAreasOfOperation.trim(),
            licenseNumber: form.licenseNumber.trim() || undefined,
            issuedOn: form.issuedOn || undefined,
            documents: documentList,
            notes: form.notes.trim() || undefined,
            // Exporter-only, optional — omitted entirely for every other
            // category so the backend's per-category null-out logic is
            // never relied upon to hide a value that was never meant to
            // apply in the first place.
            ...(form.category === 'EXPORTER'
                ? { sbaExecuted: form.sbaExecuted, sbaNotes: form.sbaNotes.trim() || undefined }
                : {}),
        };

        setSubmitting(true);
        try {
            const res = await createManualLicenseEntry(payload);
            setResult(res.data.data);
            setResultCategory(payload.category);
            setForm(emptyForm);
            setDocuments({ supportingDocument1: null, supportingDocument2: null });
            setErrors({});
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            const apiErrors: string[] | undefined = err?.response?.data?.errors;
            const message =
                (Array.isArray(apiErrors) && apiErrors.length > 0 ? apiErrors.join(' ') : null) ||
                err?.response?.data?.message ||
                'Failed to record the license/permit. Please check the form and try again.';
            setSubmitError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isAuthorized) {
        return (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <PageHeader
                    breadcrumb={[{ label: 'License Registry', to: '/licenses' }, { label: 'Register Manual/Historical License' }]}
                    title="Register Manual/Historical License"
                    description="Not available for your account."
                />
                <Alert variant="error" title="Restricted to Commercial/Marketing staff and Admins">
                    This action is only available to Commercial and Marketing Officers and Administrators.
                    If you believe you should have access, please contact an administrator.
                </Alert>
                <div className="mt-4">
                    <Link to="/licenses" className={buttonClasses('secondary')}>
                        <ArrowLeft className="h-4 w-4" /> Back to License Registry
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PageHeader
                breadcrumb={[{ label: 'License Registry', to: '/licenses' }, { label: 'Register Manual/Historical License' }]}
                title="Register Manual/Historical License"
                description="Backfill a license or permit that was already approved and issued manually on paper in the past. The record is created directly as Issued and appears immediately in the relevant register."
                actions={
                    <Link to="/licenses" className={buttonClasses('secondary')}>
                        <ArrowLeft className="h-4 w-4" /> Back to License Registry
                    </Link>
                }
            />

            {result && (
                <div className="mb-6">
                    <Alert variant="success" title="License/Permit recorded and issued">
                        <p>
                            Certificate number <span className="font-mono font-semibold">{result.certificate.certificateNumber}</span> has
                            been issued and the record now appears in its register.
                        </p>
                        {resultCategory && (
                            <div className="mt-2">
                                <Link to={CATEGORY_REGISTER_PATH[resultCategory]} className="font-semibold underline">
                                    View in register &rarr;
                                </Link>
                            </div>
                        )}
                    </Alert>
                </div>
            )}

            {submitError && (
                <div className="mb-6">
                    <Alert variant="error" title="Could not record this entry">
                        {submitError}
                    </Alert>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* License / Permit Type + original issuance info */}
                <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
                    <div className="flex items-center gap-2">
                        <FileBadge className="h-4 w-4 text-brand-green" />
                        <h3 className="text-base font-bold text-slate-800 tracking-tight">License / Permit Type</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="License/Permit Type" required error={errors.category}>
                            <SelectInput
                                value={form.category}
                                onChange={(e) => update({ category: e.target.value as ManualLicenseEntryCategory })}
                                hasError={!!errors.category}
                            >
                                <option value="">Select...</option>
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </SelectInput>
                        </FormField>
                        <FormField
                            label="Original Paper License/Permit Number"
                            hint="Enter it exactly as it appears on the original paper record. Leave blank to have the system assign the next available number automatically."
                        >
                            <TextInput
                                value={form.licenseNumber}
                                onChange={(e) => update({ licenseNumber: e.target.value })}
                                placeholder="e.g. LACRA-045-2022 (leave blank for auto-numbering)"
                            />
                        </FormField>
                        <FormField
                            label="Original Issue Date"
                            hint="The date the license/permit was actually approved and issued on paper. Defaults to today if left blank."
                        >
                            <DateField
                                value={form.issuedOn}
                                onChange={(v) => update({ issuedOn: v })}
                                max={todayIso()}
                            />
                        </FormField>
                    </div>
                </section>

                {/* Section A — Business / Applicant Information */}
                <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
                    <h3 className="text-base font-bold text-slate-800 tracking-tight">Section A — Business / Applicant Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Business / Entity Name" required error={errors.businessName} full>
                            <TextInput value={form.businessName} onChange={(e) => update({ businessName: e.target.value })} hasError={!!errors.businessName} />
                        </FormField>
                        <FormField label="TIN Number" hint="Optional">
                            <TextInput value={form.tinNumber} onChange={(e) => update({ tinNumber: e.target.value })} />
                        </FormField>
                        <FormField label="Business Registration Number" required error={errors.businessRegistrationNumber}>
                            <TextInput value={form.businessRegistrationNumber} onChange={(e) => update({ businessRegistrationNumber: e.target.value })} hasError={!!errors.businessRegistrationNumber} />
                        </FormField>
                        <CountyDistrictFields
                            county={form.county}
                            district={form.district}
                            onChange={(county, district) => update({ county, district })}
                            countyError={errors.county}
                            districtError={errors.district}
                            districtRequired
                            idPrefix="manual-entry"
                        />
                        <FormField label="Business Address" required error={errors.businessAddress} full>
                            <TextArea rows={2} value={form.businessAddress} onChange={(e) => update({ businessAddress: e.target.value })} hasError={!!errors.businessAddress} />
                        </FormField>
                        <FormField label="Contact Person" required error={errors.contactPerson}>
                            <TextInput value={form.contactPerson} onChange={(e) => update({ contactPerson: e.target.value })} hasError={!!errors.contactPerson} />
                        </FormField>
                        <FormField label="Email Address" hint="Optional">
                            <TextInput type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} />
                        </FormField>
                        <FormField label="WhatsApp Number" hint="Optional">
                            <PhoneInput value={form.whatsapp} onChange={(v) => update({ whatsapp: v })} />
                        </FormField>
                    </div>
                </section>

                {/* Section B — Ownership and Management */}
                <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
                    <h3 className="text-base font-bold text-slate-800 tracking-tight">Section B — Ownership and Management</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Owner/Manager Name" required error={errors.ownerManagerName}>
                            <TextInput value={form.ownerManagerName} onChange={(e) => update({ ownerManagerName: e.target.value })} hasError={!!errors.ownerManagerName} />
                        </FormField>
                        <FormField label="Date of Birth" required error={errors.dateOfBirth}>
                            <DateField value={form.dateOfBirth} onChange={(v) => update({ dateOfBirth: v })} hasError={!!errors.dateOfBirth} max={todayIso()} />
                        </FormField>
                        <FormField label="Gender" required error={errors.gender}>
                            <SelectInput value={form.gender} onChange={(e) => update({ gender: e.target.value as FormState['gender'] })} hasError={!!errors.gender}>
                                <option value="">Select...</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </SelectInput>
                        </FormField>
                        <FormField label="Place of Birth" required error={errors.placeOfBirth}>
                            <TextInput value={form.placeOfBirth} onChange={(e) => update({ placeOfBirth: e.target.value })} hasError={!!errors.placeOfBirth} />
                        </FormField>
                        <FormField label="Nationality" required error={errors.nationality}>
                            <TextInput value={form.nationality} onChange={(e) => update({ nationality: e.target.value })} hasError={!!errors.nationality} />
                        </FormField>
                        <FormField label="Position" required error={errors.position} hint="e.g. Owner, General Manager, Chairperson">
                            <TextInput value={form.position} onChange={(e) => update({ position: e.target.value })} hasError={!!errors.position} />
                        </FormField>
                        <FormField label="ID Type" required error={errors.idType}>
                            <SelectInput value={form.idType} onChange={(e) => update({ idType: e.target.value })} hasError={!!errors.idType}>
                                <option value="">Select...</option>
                                {ID_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </SelectInput>
                        </FormField>
                        <FormField label="ID Number" required error={errors.idNumber}>
                            <TextInput value={form.idNumber} onChange={(e) => update({ idNumber: e.target.value })} hasError={!!errors.idNumber} />
                        </FormField>
                    </div>
                </section>

                {/* Exporter-only — Standard Basic Agreement (SBA), optional */}
                {form.category === 'EXPORTER' && (
                    <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 tracking-tight">Standard Basic Agreement (SBA)</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Per LACRA&rsquo;s Exporter requirements, an SBA must be executed before operational commencement where
                                required as part of issuance/control. This field is currently <span className="font-semibold">optional</span> —
                                it will become mandatory for new entries later, but historical records being backfilled here were never
                                asked for it, so leave it blank if this information was not collected at the time.
                            </p>
                        </div>
                        <Checkbox
                            id="sba-executed"
                            label="Standard Basic Agreement (SBA) has been executed for this Exporter"
                            checked={form.sbaExecuted}
                            onChange={(e) => update({ sbaExecuted: e.target.checked })}
                        />
                        <FormField label="SBA Notes" hint="Optional — e.g. execution date, reference number, or why this was not collected">
                            <TextArea rows={2} value={form.sbaNotes} onChange={(e) => update({ sbaNotes: e.target.value })} />
                        </FormField>
                    </section>
                )}

                {/* Section C — Operational Information */}
                <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
                    <h3 className="text-base font-bold text-slate-800 tracking-tight">Section C — Operational Information</h3>
                    <FormField label="Intended Commodities" required error={errors.intendedCommodities}>
                        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-1">
                            {COMMODITY_OPTIONS.map((opt) => (
                                <Checkbox
                                    key={opt.value}
                                    id={`commodity-${opt.value}`}
                                    label={opt.label}
                                    checked={form.intendedCommodities.includes(opt.value)}
                                    onChange={() => toggleCommodity(opt.value)}
                                />
                            ))}
                        </div>
                    </FormField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Estimated Annual Purchase Volume (MT)" required error={errors.estimatedAnnualPurchaseVolume}>
                            <TextInput
                                type="number"
                                min="0"
                                step="any"
                                value={form.estimatedAnnualPurchaseVolume}
                                onChange={(e) => update({ estimatedAnnualPurchaseVolume: e.target.value })}
                                hasError={!!errors.estimatedAnnualPurchaseVolume}
                            />
                        </FormField>
                        <FormField label="Expected Areas of Operation" required error={errors.expectedAreasOfOperation} hint="Counties/districts where operations will take place">
                            <TextInput value={form.expectedAreasOfOperation} onChange={(e) => update({ expectedAreasOfOperation: e.target.value })} hasError={!!errors.expectedAreasOfOperation} />
                        </FormField>
                    </div>
                </section>

                {/* Supporting Documents (optional) */}
                <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
                    <div>
                        <h3 className="text-base font-bold text-slate-800 tracking-tight">Supporting Documents</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Optional for manual/historical entries — attach a scan of the original paper license/permit or
                            supporting records if available, but this is not required to complete the registration.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <DocumentUpload
                            label="Original Paper License/Permit (scan)"
                            required={false}
                            accept=".pdf,.jpg,.jpeg,.png"
                            acceptDisplay="PDF, JPG, PNG"
                            maxSizeMb={10}
                            value={documents.supportingDocument1}
                            onChange={(f) => setDocuments((d) => ({ ...d, supportingDocument1: f }))}
                        />
                        <DocumentUpload
                            label="Other Supporting Document"
                            required={false}
                            accept=".pdf,.jpg,.jpeg,.png"
                            acceptDisplay="PDF, JPG, PNG"
                            maxSizeMb={10}
                            value={documents.supportingDocument2}
                            onChange={(f) => setDocuments((d) => ({ ...d, supportingDocument2: f }))}
                        />
                    </div>
                </section>

                {/* Notes */}
                <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
                    <FormField label="Internal Notes" hint="Optional — any context useful for future reference (e.g. where the paper file is stored).">
                        <TextArea rows={3} value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
                    </FormField>
                </section>

                <div className="flex items-center justify-end gap-3">
                    {uploadingCount > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading documents…
                        </span>
                    )}
                    <button
                        type="submit"
                        disabled={submitting || uploadingCount > 0}
                        className={`${buttonClasses('primary', 'md')} disabled:opacity-60`}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Recording...
                            </>
                        ) : (
                            <>
                                <Sprout className="h-4 w-4" /> Record & Issue License/Permit
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ManualLicenseEntryForm;

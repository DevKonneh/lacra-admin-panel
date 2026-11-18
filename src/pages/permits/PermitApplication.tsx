import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPermit, updatePermit, submitPermit } from '../../api/permits';
import type { Permit } from '../../api/permits';
import { getMyBusiness } from '../../api/business';
import { Save, ArrowLeft, AlertCircle, CheckCircle2, SendHorizontal, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Online Permit Application Form
// Mirrors LACRA Form No. 0050 "LACRA Permit Application Form — For Local
// Produce Buyer, Agency, and Cooperative Applicants" section-for-section.
// One unified form is used for all three eligible business types (Local
// Buyer / Agency / Cooperative) — only the "Type of Entity" answer differs,
// not the form structure itself.
// ---------------------------------------------------------------------------

type FormState = {
    // Section A — Applicant Information
    businessName: string;
    typeOfEntity: '' | 'LOCAL_BUYER' | 'AGENCY' | 'COOPERATIVE';
    tinNumber: string;
    county: string;
    district: string;
    businessAddress: string;
    contactPerson: string;
    phoneNumber: string;
    emailAddress: string;
    whatsapp: string;
    // Section B — Ownership and Management
    ownerManagerName: string;
    dateOfBirth: string;
    gender: '' | 'MALE' | 'FEMALE';
    placeOfBirth: string;
    nationality: string;
    position: string;
    idType: '' | 'NATIONAL_ID' | 'PASSPORT' | 'DRIVER_LICENSE' | 'VOTER_ID' | 'OTHER';
    idNumber: string;
    // Section C — Operational Information
    intendedCommodities: ('COCOA' | 'COFFEE' | 'PALM')[];
    estimatedPurchaseVolume: string;
    warehousingLocation: string;
    expectedAreasOfOperation: string;
    // Section D — Declaration
    declarationAccepted: boolean;
    declarationName: string;
    declarationDate: string;
};

const emptyForm: FormState = {
    businessName: '',
    typeOfEntity: '',
    tinNumber: '',
    county: '',
    district: '',
    businessAddress: '',
    contactPerson: '',
    phoneNumber: '',
    emailAddress: '',
    whatsapp: '',
    ownerManagerName: '',
    dateOfBirth: '',
    gender: '',
    placeOfBirth: '',
    nationality: '',
    position: '',
    idType: '',
    idNumber: '',
    intendedCommodities: [],
    estimatedPurchaseVolume: '',
    warehousingLocation: '',
    expectedAreasOfOperation: '',
    declarationAccepted: false,
    declarationName: '',
    declarationDate: '',
};

const ENTITY_TYPES: { value: FormState['typeOfEntity']; label: string }[] = [
    { value: 'LOCAL_BUYER', label: 'Local Produce Buyer' },
    { value: 'AGENCY', label: 'Agency' },
    { value: 'COOPERATIVE', label: 'Cooperative' },
];

const ID_TYPES: { value: FormState['idType']; label: string }[] = [
    { value: 'NATIONAL_ID', label: 'National ID' },
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'DRIVER_LICENSE', label: "Driver's License" },
    { value: 'VOTER_ID', label: "Voter's ID" },
    { value: 'OTHER', label: 'Other' },
];

const COMMODITIES: ('COCOA' | 'COFFEE' | 'PALM')[] = ['COCOA', 'COFFEE', 'PALM'];

function toDateInputValue(v?: string) {
    if (!v) return '';
    return v.length >= 10 ? v.slice(0, 10) : v;
}

function permitToForm(p: Permit): FormState {
    return {
        businessName: p.businessName || '',
        typeOfEntity: (p.typeOfEntity as FormState['typeOfEntity']) || '',
        tinNumber: p.tinNumber || '',
        county: p.county || '',
        district: p.district || '',
        businessAddress: p.businessAddress || '',
        contactPerson: p.contactPerson || '',
        phoneNumber: p.phoneNumber || '',
        emailAddress: p.emailAddress || '',
        whatsapp: p.whatsapp || '',
        ownerManagerName: p.ownerManagerName || '',
        dateOfBirth: toDateInputValue(p.dateOfBirth),
        gender: (p.gender as FormState['gender']) || '',
        placeOfBirth: p.placeOfBirth || '',
        nationality: p.nationality || '',
        position: p.position || '',
        idType: (p.idType as FormState['idType']) || '',
        idNumber: p.idNumber || '',
        intendedCommodities: p.intendedCommodities || [],
        estimatedPurchaseVolume: p.estimatedPurchaseVolume || '',
        warehousingLocation: p.warehousingLocation || '',
        expectedAreasOfOperation: p.expectedAreasOfOperation || '',
        declarationAccepted: !!p.declarationAccepted,
        declarationName: p.declarationName || '',
        declarationDate: toDateInputValue(p.declarationDate),
    };
}

const SectionCard: React.FC<{ letter: string; title: string; subtitle?: string; children: React.ReactNode }> = ({
    letter,
    title,
    subtitle,
    children,
}) => (
    <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900">
                Section {letter} — {title}
            </h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">{children}</div>
    </div>
);

const Field: React.FC<{ label: string; required?: boolean; full?: boolean; children: React.ReactNode }> = ({
    label,
    required,
    full,
    children,
}) => (
    <div className={full ? 'sm:col-span-2' : ''}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {children}
    </div>
);

const inputClass =
    'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:ring-green-500';

const PermitApplication: React.FC = () => {
    const navigate = useNavigate();
    const [checkingEligibility, setCheckingEligibility] = useState(true);
    const [business, setBusiness] = useState<any>(null);
    const [eligibilityError, setEligibilityError] = useState('');

    const [permitId, setPermitId] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('DRAFT');
    const [form, setForm] = useState<FormState>(emptyForm);

    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [missingFields, setMissingFields] = useState<string[]>([]);
    const [savedMessage, setSavedMessage] = useState('');

    useEffect(() => {
        checkEligibility();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkEligibility = async () => {
        try {
            const res = await getMyBusiness();
            if (res.data.status) {
                const biz = res.data.data;
                setBusiness(biz);
                if (biz.eligibility !== 'PERMIT_ALLOWED') {
                    setEligibilityError(
                        'Your business type (Exporter) is NOT eligible for Local Permits. You must apply for a License instead.'
                    );
                } else {
                    // Pre-fill Section A fields already captured at business registration.
                    setForm((f) => ({
                        ...f,
                        businessName: biz.name || '',
                        typeOfEntity:
                            biz.type === 'LOCAL_BUYER' || biz.type === 'AGENCY' || biz.type === 'COOPERATIVE'
                                ? biz.type
                                : '',
                    }));
                }
            }
        } catch (err) {
            setEligibilityError('Could not fetch business profile. Please ensure you have registered your business.');
        } finally {
            setCheckingEligibility(false);
        }
    };

    const handleChange = (field: keyof FormState, value: any) => {
        setForm((f) => ({ ...f, [field]: value }));
        setSavedMessage('');
    };

    const toggleCommodity = (c: 'COCOA' | 'COFFEE' | 'PALM') => {
        setForm((f) => {
            const has = f.intendedCommodities.includes(c);
            return {
                ...f,
                intendedCommodities: has
                    ? f.intendedCommodities.filter((x) => x !== c)
                    : [...f.intendedCommodities, c],
            };
        });
        setSavedMessage('');
    };

    const buildPayload = (): Partial<Permit> => ({
        ...form,
        typeOfEntity: form.typeOfEntity || undefined,
        gender: form.gender || undefined,
        idType: form.idType || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        declarationDate: form.declarationDate || undefined,
    });

    const handleSaveDraft = async () => {
        setSaving(true);
        setFormError('');
        setMissingFields([]);
        try {
            if (!permitId) {
                const res = await createPermit(buildPayload());
                const created = res.data.data;
                setPermitId(created.id);
                setStatus(created.status);
                setForm(permitToForm(created));
            } else {
                const res = await updatePermit(permitId, buildPayload());
                const updated = res.data.data;
                setStatus(updated.status);
                setForm(permitToForm(updated));
            }
            setSavedMessage('Draft saved successfully.');
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'Failed to save draft');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitApplication = async () => {
        setSubmitting(true);
        setFormError('');
        setMissingFields([]);
        try {
            // Always persist the latest edits first, so submit() validates
            // against what's actually in the form right now.
            let idToSubmit = permitId;
            if (!idToSubmit) {
                const res = await createPermit(buildPayload());
                const created = res.data.data;
                idToSubmit = created.id;
                setPermitId(created.id);
                setStatus(created.status);
                setForm(permitToForm(created));
            } else {
                const res = await updatePermit(idToSubmit, buildPayload());
                setForm(permitToForm(res.data.data));
            }

            const submitRes = await submitPermit(idToSubmit as string);
            setStatus(submitRes.data.data.status);
            setSavedMessage('');
            navigate('/permits');
        } catch (err: any) {
            const errors = err.response?.data?.errors;
            if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'string') {
                setMissingFields(errors as string[]);
                setFormError(err.response?.data?.message || 'Please complete all required fields before submitting');
            } else {
                setFormError(err.response?.data?.message || 'Failed to submit application');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (checkingEligibility) {
        return (
            <div className="flex items-center justify-center py-20 text-gray-500">
                <Loader2 className="animate-spin h-5 w-5 mr-2" /> Checking eligibility...
            </div>
        );
    }

    if (eligibilityError) {
        return (
            <div className="max-w-3xl mx-auto mt-10 p-6 bg-red-50 rounded-lg border border-red-200 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-red-800">Eligibility Error</h3>
                <p className="mt-2 text-sm text-red-700">{eligibilityError}</p>
                <div className="mt-6">
                    <button onClick={() => navigate('/licenses/apply')} className="text-blue-700 underline font-medium hover:text-blue-800">
                        Go to License Application
                    </button>
                    <span className="mx-2 text-gray-400">|</span>
                    <button onClick={() => navigate(-1)} className="text-gray-600 underline hover:text-gray-800">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-16">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} className="text-gray-500" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Permit Application</h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                        LACRA Form No. 0050 — For Local Produce Buyer, Agency, and Cooperative Applicants
                    </p>
                </div>
                <span className="ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    Status: {status.replace(/_/g, ' ')}
                </span>
            </div>

            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
                <div className="flex">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">Eligible Applicant</h3>
                        <p className="text-sm text-green-700 mt-1">
                            Applying on behalf of <strong>{business?.name}</strong> ({business?.type})
                        </p>
                    </div>
                </div>
            </div>

            {formError && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                    <div className="flex">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">{formError}</h3>
                            {missingFields.length > 0 && (
                                <ul className="list-disc list-inside text-sm text-red-700 mt-1 space-y-0.5">
                                    {missingFields.map((m) => (
                                        <li key={m}>{m}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {savedMessage && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded text-sm text-blue-800">
                    {savedMessage}
                </div>
            )}

            {/* Section A — Applicant Information */}
            <SectionCard letter="A" title="Applicant Information">
                <Field label="Business Name" required>
                    <input
                        className={inputClass}
                        value={form.businessName}
                        onChange={(e) => handleChange('businessName', e.target.value)}
                    />
                </Field>
                <Field label="Type of Entity" required>
                    <select
                        className={inputClass}
                        value={form.typeOfEntity}
                        onChange={(e) => handleChange('typeOfEntity', e.target.value)}
                    >
                        <option value="">Select type...</option>
                        {ENTITY_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="TIN Number" required>
                    <input className={inputClass} value={form.tinNumber} onChange={(e) => handleChange('tinNumber', e.target.value)} />
                </Field>
                <Field label="County / District" required>
                    <input className={inputClass} value={form.county} onChange={(e) => handleChange('county', e.target.value)} />
                </Field>
                <Field label="District (if applicable)">
                    <input className={inputClass} value={form.district} onChange={(e) => handleChange('district', e.target.value)} />
                </Field>
                <Field label="Business Address" required>
                    <input
                        className={inputClass}
                        value={form.businessAddress}
                        onChange={(e) => handleChange('businessAddress', e.target.value)}
                    />
                </Field>
                <Field label="Contact Person" required>
                    <input
                        className={inputClass}
                        value={form.contactPerson}
                        onChange={(e) => handleChange('contactPerson', e.target.value)}
                    />
                </Field>
                <Field label="Phone Number" required>
                    <input className={inputClass} value={form.phoneNumber} onChange={(e) => handleChange('phoneNumber', e.target.value)} />
                </Field>
                <Field label="Email Address">
                    <input
                        type="email"
                        className={inputClass}
                        value={form.emailAddress}
                        onChange={(e) => handleChange('emailAddress', e.target.value)}
                    />
                </Field>
                <Field label="WhatsApp Number">
                    <input className={inputClass} value={form.whatsapp} onChange={(e) => handleChange('whatsapp', e.target.value)} />
                </Field>
            </SectionCard>

            {/* Section B — Ownership and Management */}
            <SectionCard letter="B" title="Ownership and Management">
                <Field label="Owner / Manager Name(s)" required full>
                    <input
                        className={inputClass}
                        value={form.ownerManagerName}
                        onChange={(e) => handleChange('ownerManagerName', e.target.value)}
                    />
                </Field>
                <Field label="Date of Birth" required>
                    <input
                        type="date"
                        className={inputClass}
                        value={form.dateOfBirth}
                        onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    />
                </Field>
                <Field label="Gender" required>
                    <select className={inputClass} value={form.gender} onChange={(e) => handleChange('gender', e.target.value)}>
                        <option value="">Select...</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                    </select>
                </Field>
                <Field label="Place of Birth" required>
                    <input
                        className={inputClass}
                        value={form.placeOfBirth}
                        onChange={(e) => handleChange('placeOfBirth', e.target.value)}
                    />
                </Field>
                <Field label="Nationality" required>
                    <input
                        className={inputClass}
                        value={form.nationality}
                        onChange={(e) => handleChange('nationality', e.target.value)}
                    />
                </Field>
                <Field label="Position" required>
                    <input className={inputClass} value={form.position} onChange={(e) => handleChange('position', e.target.value)} />
                </Field>
                <Field label="ID Type" required>
                    <select className={inputClass} value={form.idType} onChange={(e) => handleChange('idType', e.target.value)}>
                        <option value="">Select...</option>
                        {ID_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="ID Number" required>
                    <input className={inputClass} value={form.idNumber} onChange={(e) => handleChange('idNumber', e.target.value)} />
                </Field>
            </SectionCard>

            {/* Section C — Operational Information */}
            <SectionCard letter="C" title="Operational Information">
                <Field label="Intended Commodity" required full>
                    <div className="flex gap-6 mt-1">
                        {COMMODITIES.map((c) => (
                            <label key={c} className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    checked={form.intendedCommodities.includes(c)}
                                    onChange={() => toggleCommodity(c)}
                                />
                                {c.charAt(0) + c.slice(1).toLowerCase()}
                            </label>
                        ))}
                    </div>
                </Field>
                <Field label="Estimated Purchase Volume" required>
                    <input
                        className={inputClass}
                        placeholder="e.g. 500 MT / season"
                        value={form.estimatedPurchaseVolume}
                        onChange={(e) => handleChange('estimatedPurchaseVolume', e.target.value)}
                    />
                </Field>
                <Field label="Warehousing Location" required>
                    <input
                        className={inputClass}
                        value={form.warehousingLocation}
                        onChange={(e) => handleChange('warehousingLocation', e.target.value)}
                    />
                </Field>
                <Field label="Expected Areas of Operation" required full>
                    <textarea
                        className={inputClass}
                        rows={2}
                        value={form.expectedAreasOfOperation}
                        onChange={(e) => handleChange('expectedAreasOfOperation', e.target.value)}
                    />
                </Field>
            </SectionCard>

            {/* Section D — Declaration */}
            <SectionCard letter="D" title="Declaration">
                <Field label="" full>
                    <p className="text-sm text-gray-600 -mt-1">
                        I hereby declare that the information provided above is true and accurate to the best of my
                        knowledge, and I agree to comply with all applicable laws and regulations governing the
                        purchase, handling, and sale of agricultural commodities in Liberia.
                    </p>
                </Field>
                <Field label="Name of Applicant" required>
                    <input
                        className={inputClass}
                        value={form.declarationName}
                        onChange={(e) => handleChange('declarationName', e.target.value)}
                    />
                </Field>
                <Field label="Date" required>
                    <input
                        type="date"
                        className={inputClass}
                        value={form.declarationDate}
                        onChange={(e) => handleChange('declarationDate', e.target.value)}
                    />
                </Field>
                <Field label="" full>
                    <label className="inline-flex items-start gap-2 text-sm text-gray-800">
                        <input
                            type="checkbox"
                            className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            checked={form.declarationAccepted}
                            onChange={(e) => handleChange('declarationAccepted', e.target.checked)}
                        />
                        <span>
                            I confirm the above declaration and agree to the terms stated. <span className="text-red-500">*</span>
                        </span>
                    </label>
                </Field>
            </SectionCard>

            <div className="flex justify-end gap-3 pt-2">
                <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving || submitting}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                    type="button"
                    onClick={handleSubmitApplication}
                    disabled={saving || submitting}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                    {submitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <SendHorizontal className="h-4 w-4 mr-2" />
                    )}
                    {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
            </div>
        </div>
    );
};

export default PermitApplication;

import React, { useEffect } from 'react';
import { useRegistration } from '../RegistrationContext';
import type { BuyerInfo, AgencyInfo, CooperativeInfo, ExporterInfo, IdType, EntityType } from '../types';
import { COMMODITY_LABELS, ENTITY_TYPE_LABELS } from '../types';
import FormField from '../../../components/forms/FormField';
import { TextInput, SelectInput, TextArea } from '../../../components/forms/inputs';
import CountyDistrictFields from '../../../components/forms/CountyDistrictFields';
import DocumentUpload from '../../../components/forms/DocumentUpload';
import PhoneInput from '../../../components/forms/PhoneInput';
import { isValidEmail, isValidPhone, type FieldErrors } from '../validators';

// Reusable Entity Type dropdown (Sole Proprietorship / Partnership / LLC /
// Corporation / Cooperative Society) shared by every category branch below.
const EntityTypeSelect: React.FC<{ value: EntityType | ''; onChange: (v: EntityType | '') => void; error?: string }> = ({ value, onChange, error }) => (
    <FormField label="Entity Type" error={error} hint="Legal structure of the business">
        <SelectInput value={value} onChange={(e) => onChange(e.target.value as EntityType | '')}>
            <option value="">Select...</option>
            {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
            ))}
        </SelectInput>
    </FormField>
);

export function validateStep2(category: string, state: ReturnType<typeof useRegistration>['state']): FieldErrors {
    const errors: FieldErrors = {};
    const req = (val: string, key: string, label: string) => { if (!val || !val.trim()) errors[key] = `${label} is required.`; };

    if (category === 'LOCAL_BUYER') {
        const b = state.buyer;
        req(b.fullName, 'fullName', 'Full name');
        req(b.idType, 'idType', 'ID type');
        req(b.idNumber, 'idNumber', 'National ID/passport number');
        req(b.phone, 'phone', 'Phone number');
        if (b.phone && !isValidPhone(b.phone)) errors.phone = 'Enter a valid Liberian phone number (8-9 digits after +231).';
        if (b.email && !isValidEmail(b.email)) errors.email = 'Enter a valid email address.';
        req(b.county, 'county', 'County');
        req(b.businessName, 'businessName', 'Business/trading name');
    } else if (category === 'AGENCY') {
        const a = state.agency;
        req(a.legalName, 'legalName', "Organization's legal name");
        req(a.businessRegNumber, 'businessRegNumber', 'Business registration number');
        req(a.tin, 'tin', 'TIN');
        req(a.phone, 'phone', 'Phone number');
        if (a.phone && !isValidPhone(a.phone)) errors.phone = 'Enter a valid Liberian phone number (8-9 digits after +231).';
        if (a.email && !isValidEmail(a.email)) errors.email = 'Enter a valid email address.';
        req(a.county, 'county', 'County');
    } else if (category === 'COOPERATIVE') {
        const c = state.cooperative;
        req(c.legalName, 'legalName', "Cooperative's legal name");
        req(c.cdaNumber, 'cdaNumber', 'CDA registration number');
        req(c.businessRegNumber, 'businessRegNumber', 'Business registration number');
        req(c.tin, 'tin', 'TIN');
        req(c.phone, 'phone', 'Phone number');
        if (c.phone && !isValidPhone(c.phone)) errors.phone = 'Enter a valid Liberian phone number (8-9 digits after +231).';
        if (c.email && !isValidEmail(c.email)) errors.email = 'Enter a valid email address.';
        req(c.county, 'county', 'County');
    } else if (category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER') {
        const x = state.exporter;
        req(x.legalName, 'legalName', "Company's legal name");
        req(x.businessRegNumber, 'businessRegNumber', 'Business registration number');
        req(x.tin, 'tin', 'TIN');
        req(x.countryOfIncorporation, 'countryOfIncorporation', 'Country of incorporation');
        req(x.phone, 'phone', 'Phone number');
        if (x.phone && !isValidPhone(x.phone)) errors.phone = 'Enter a valid Liberian phone number (8-9 digits after +231).';
        if (x.email && !isValidEmail(x.email)) errors.email = 'Enter a valid email address.';
        req(x.county, 'county', 'County');
    }
    return errors;
}

interface Step2Props {
    errors: FieldErrors;
}

// Step 2: Applicant/Business Information. Renders a different set of
// fields depending on the selected application category (Step 1), each
// slice matching exactly what the spec defines for "Business Information"
// (Local Buyer), "Organization Information" (Agency), "Cooperative
// Information" (Cooperative) or "Company Information" (Exporter).
const Step2BusinessInfo: React.FC<Step2Props> = ({ errors }) => {
    const { state, setBuyer, setAgency, setCooperative, setExporter } = useRegistration();
    const category = state.step1.category;
    const applicantKind = state.step1.applicantKind;

    // A Local Produce Buyer applying as an Individual is, for legal-structure
    // purposes, always a Sole Proprietorship - auto-set (and hide, see below)
    // the Entity Type field rather than asking the applicant to pick it.
    useEffect(() => {
        if (category === 'LOCAL_BUYER' && applicantKind === 'INDIVIDUAL' && state.buyer.entityType !== 'SOLE_PROPRIETORSHIP') {
            setBuyer({ ...state.buyer, entityType: 'SOLE_PROPRIETORSHIP' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, applicantKind]);

    // A Cooperative application is, by definition, a Cooperative Society -
    // auto-set (and lock, see below) the Entity Type field for this category.
    useEffect(() => {
        if (category === 'COOPERATIVE' && state.cooperative.entityType !== 'COOPERATIVE_SOCIETY') {
            setCooperative({ ...state.cooperative, entityType: 'COOPERATIVE_SOCIETY' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category]);

    // A Local Produce Buyer is only permitted to buy within the single
    // county they registered under (e.g. selecting Nimba means the
    // applicant may only buy in Nimba) - so both the "Proposed Buying
    // Location" and "County/Counties of Operation" values are derived
    // directly from the registered County field rather than being
    // separately entered, and are kept in sync whenever the county changes.
    useEffect(() => {
        if (category !== 'LOCAL_BUYER') return;
        const county = state.buyer.county;
        const nextBuyingCounties = county ? [county] : [];
        const countiesChanged = nextBuyingCounties.join('|') !== state.buyer.buyingCounties.join('|');
        if (state.buyer.buyingLocation !== county || countiesChanged) {
            setBuyer({ ...state.buyer, buyingLocation: county, buyingCounties: nextBuyingCounties });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, state.buyer.county]);

    if (category === 'LOCAL_BUYER') {
        const b = state.buyer;
        const update = (patch: Partial<BuyerInfo>) => setBuyer({ ...b, ...patch });
        return (
            <div className="space-y-8">
                <section>
                    <h2 className="text-base font-semibold text-slate-800 mb-4">Personal Information</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Full Name" required error={errors.fullName}>
                            <TextInput value={b.fullName} onChange={(e) => update({ fullName: e.target.value })} />
                        </FormField>
                        <FormField label="Nationality" required>
                            <TextInput value={b.nationality} onChange={(e) => update({ nationality: e.target.value })} />
                        </FormField>
                        <FormField label="ID Type" required error={errors.idType}>
                            <SelectInput value={b.idType} onChange={(e) => update({ idType: e.target.value as IdType })}>
                                <option value="">Select...</option>
                                <option value="NATIONAL_ID">National ID</option>
                                <option value="PASSPORT">Passport</option>
                            </SelectInput>
                        </FormField>
                        <FormField label="National ID / Passport Number" required error={errors.idNumber}>
                            <TextInput value={b.idNumber} onChange={(e) => update({ idNumber: e.target.value })} />
                        </FormField>
                        <FormField label="Phone Number" required error={errors.phone}>
                            <PhoneInput value={b.phone} onChange={(v) => update({ phone: v })} hasError={!!errors.phone} />
                        </FormField>
                        <FormField label="Alternative Phone Number">
                            <PhoneInput value={b.altPhone} onChange={(v) => update({ altPhone: v })} />
                        </FormField>
                        <FormField label="Email Address" error={errors.email}>
                            <TextInput type="email" value={b.email} onChange={(e) => update({ email: e.target.value })} />
                        </FormField>
                        <CountyDistrictFields
                            county={b.county} district={b.district}
                            onChange={(county, district) => update({ county, district })}
                            countyError={errors.county}
                            idPrefix="buyer-personal"
                        />
                        <FormField label="Community or Town">
                            <TextInput value={b.community} onChange={(e) => update({ community: e.target.value })} />
                        </FormField>
                        <FormField label="Complete Physical Address" full>
                            <TextArea rows={2} value={b.address} onChange={(e) => update({ address: e.target.value })} />
                        </FormField>
                        <div className="sm:col-span-2">
                            <DocumentUpload
                                label="Passport-size Photograph"
                                required
                                accept=".jpg,.jpeg,.png"
                                acceptDisplay="JPG, PNG"
                                maxSizeMb={2}
                                value={b.photo}
                                onChange={(f) => update({ photo: f })}
                            />
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-base font-semibold text-slate-800 mb-4">Business Information</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Business / Trading Name" required error={errors.businessName}>
                            <TextInput value={b.businessName} onChange={(e) => update({ businessName: e.target.value })} />
                        </FormField>
                        {applicantKind !== 'INDIVIDUAL' && (
                            <EntityTypeSelect value={b.entityType} onChange={(v) => update({ entityType: v })} />
                        )}
                        <FormField label="Business Registration Number">
                            <TextInput value={b.businessRegNumber} onChange={(e) => update({ businessRegNumber: e.target.value })} />
                        </FormField>
                        <FormField label="TIN">
                            <TextInput value={b.tin} onChange={(e) => update({ tin: e.target.value })} />
                        </FormField>
                        <FormField label="Proposed Buying Location" hint="Automatically set to your registered county — a Local Produce Buyer may only buy in the county they registered under">
                            <TextInput value={b.buyingLocation || 'Select a county above'} disabled className="bg-slate-50 text-slate-500" />
                        </FormField>
                        <FormField label="Years of Experience" hint="Where applicable">
                            <TextInput type="number" min={0} value={b.yearsExperience} onChange={(e) => update({ yearsExperience: e.target.value })} />
                        </FormField>
                        <FormField label="Commodity to Purchase" full hint="Selected in Step 1 — go back to change this">
                            <p className="text-sm text-slate-600">{state.step1.commodity ? COMMODITY_LABELS[state.step1.commodity] : 'None selected'}</p>
                        </FormField>
                        <FormField label="County of Operation" full hint="Matches your registered county — Local Produce Buyers are only permitted to buy commodities within this county">
                            <TextInput value={b.buyingCounties.join(', ') || 'Select a county above'} disabled className="bg-slate-50 text-slate-500" />
                        </FormField>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                        National ID/passport, business registration and other supporting documents are uploaded in Step 5 (Supporting Documents).
                    </p>
                </section>
            </div>
        );
    }

    if (category === 'AGENCY') {
        const a = state.agency;
        const update = (patch: Partial<AgencyInfo>) => setAgency({ ...a, ...patch });
        return (
            <section>
                <h2 className="text-base font-semibold text-slate-800 mb-4">Organization Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Organization's Legal Name" required error={errors.legalName}>
                        <TextInput value={a.legalName} onChange={(e) => update({ legalName: e.target.value })} />
                    </FormField>
                    <FormField label="Trading Name">
                        <TextInput value={a.tradingName} onChange={(e) => update({ tradingName: e.target.value })} />
                    </FormField>
                    <EntityTypeSelect value={a.entityType} onChange={(v) => update({ entityType: v })} />
                    <FormField label="Business Registration Number" required error={errors.businessRegNumber}>
                        <TextInput value={a.businessRegNumber} onChange={(e) => update({ businessRegNumber: e.target.value })} />
                    </FormField>
                    <FormField label="TIN" required error={errors.tin}>
                        <TextInput value={a.tin} onChange={(e) => update({ tin: e.target.value })} />
                    </FormField>
                    <FormField label="Tax-Clearance Number">
                        <TextInput value={a.taxClearanceNumber} onChange={(e) => update({ taxClearanceNumber: e.target.value })} />
                    </FormField>
                    <FormField label="Contact Phone Number" required error={errors.phone}>
                        <PhoneInput value={a.phone} onChange={(v) => update({ phone: v })} hasError={!!errors.phone} />
                    </FormField>
                    <FormField label="Alternative Phone Number">
                        <PhoneInput value={a.altPhone} onChange={(v) => update({ altPhone: v })} />
                    </FormField>
                    <FormField label="Contact Email" error={errors.email}>
                        <TextInput type="email" value={a.email} onChange={(e) => update({ email: e.target.value })} />
                    </FormField>
                    <CountyDistrictFields
                        county={a.county} district={a.district}
                        onChange={(county, district) => update({ county, district })}
                        countyError={errors.county}
                        idPrefix="agency-org"
                    />
                    <FormField label="Community">
                        <TextInput value={a.community} onChange={(e) => update({ community: e.target.value })} />
                    </FormField>
                    <FormField label="Complete Physical Address" full>
                        <TextArea rows={2} value={a.address} onChange={(e) => update({ address: e.target.value })} />
                    </FormField>
                    <FormField label="Selected Commodity" full>
                        <p className="text-sm text-slate-600">{state.step1.commodity ? COMMODITY_LABELS[state.step1.commodity] : 'None selected in Step 1'}</p>
                    </FormField>
                </div>
            </section>
        );
    }

    if (category === 'COOPERATIVE') {
        const c = state.cooperative;
        const update = (patch: Partial<CooperativeInfo>) => setCooperative({ ...c, ...patch });
        return (
            <section>
                <h2 className="text-base font-semibold text-slate-800 mb-4">Cooperative Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Cooperative's Legal Name" required error={errors.legalName}>
                        <TextInput value={c.legalName} onChange={(e) => update({ legalName: e.target.value })} />
                    </FormField>
                    <FormField label="Trading Name" hint="Where applicable">
                        <TextInput value={c.tradingName} onChange={(e) => update({ tradingName: e.target.value })} />
                    </FormField>
                    <FormField label="Entity Type" hint="Cooperative applications are automatically registered as a Cooperative Society">
                        <TextInput value={ENTITY_TYPE_LABELS.COOPERATIVE_SOCIETY} disabled />
                    </FormField>
                    <FormField label="CDA Registration / Certification Number" required error={errors.cdaNumber}>
                        <TextInput value={c.cdaNumber} onChange={(e) => update({ cdaNumber: e.target.value })} />
                    </FormField>
                    <FormField label="Business Registration Number" required error={errors.businessRegNumber}>
                        <TextInput value={c.businessRegNumber} onChange={(e) => update({ businessRegNumber: e.target.value })} />
                    </FormField>
                    <FormField label="TIN" required error={errors.tin}>
                        <TextInput value={c.tin} onChange={(e) => update({ tin: e.target.value })} />
                    </FormField>
                    <FormField label="Tax-Clearance Number">
                        <TextInput value={c.taxClearanceNumber} onChange={(e) => update({ taxClearanceNumber: e.target.value })} />
                    </FormField>
                    <FormField label="Date Established">
                        <TextInput type="date" value={c.dateEstablished} onChange={(e) => update({ dateEstablished: e.target.value })} />
                    </FormField>
                    <FormField label="Contact Phone Number" required error={errors.phone}>
                        <PhoneInput value={c.phone} onChange={(v) => update({ phone: v })} hasError={!!errors.phone} />
                    </FormField>
                    <FormField label="Alternative Phone Number">
                        <PhoneInput value={c.altPhone} onChange={(v) => update({ altPhone: v })} />
                    </FormField>
                    <FormField label="Contact Email" error={errors.email}>
                        <TextInput type="email" value={c.email} onChange={(e) => update({ email: e.target.value })} />
                    </FormField>
                    <CountyDistrictFields
                        county={c.county} district={c.district}
                        onChange={(county, district) => update({ county, district })}
                        countyError={errors.county}
                        idPrefix="coop-info"
                    />
                    <FormField label="Community">
                        <TextInput value={c.community} onChange={(e) => update({ community: e.target.value })} />
                    </FormField>
                    <FormField label="Complete Physical Address" full>
                        <TextArea rows={2} value={c.address} onChange={(e) => update({ address: e.target.value })} />
                    </FormField>
                    <FormField label="Selected Commodity" full>
                        <p className="text-sm text-slate-600">{state.step1.commodity ? COMMODITY_LABELS[state.step1.commodity] : 'None selected in Step 1'}</p>
                    </FormField>
                </div>
            </section>
        );
    }

    if (category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER') {
        const x = state.exporter;
        const update = (patch: Partial<ExporterInfo>) => setExporter({ ...x, ...patch });
        return (
            <section>
                <h2 className="text-base font-semibold text-slate-800 mb-4">Company Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Organization's Legal Name" required error={errors.legalName}>
                        <TextInput value={x.legalName} onChange={(e) => update({ legalName: e.target.value })} />
                    </FormField>
                    <FormField label="Trading Name">
                        <TextInput value={x.tradingName} onChange={(e) => update({ tradingName: e.target.value })} />
                    </FormField>
                    <FormField label="Exporter Category">
                        <TextInput value={category === 'LOCAL_EXPORTER' ? 'Local Exporter' : 'Foreign Exporter'} disabled />
                    </FormField>
                    <EntityTypeSelect value={x.entityType} onChange={(v) => update({ entityType: v })} />
                    <FormField label="Business Registration Number" required error={errors.businessRegNumber}>
                        <TextInput value={x.businessRegNumber} onChange={(e) => update({ businessRegNumber: e.target.value })} />
                    </FormField>
                    <FormField label="TIN" required error={errors.tin}>
                        <TextInput value={x.tin} onChange={(e) => update({ tin: e.target.value })} />
                    </FormField>
                    <FormField label="Tax-Clearance Number">
                        <TextInput value={x.taxClearanceNumber} onChange={(e) => update({ taxClearanceNumber: e.target.value })} />
                    </FormField>
                    <FormField label="Country of Incorporation" required error={errors.countryOfIncorporation}>
                        <TextInput value={x.countryOfIncorporation} onChange={(e) => update({ countryOfIncorporation: e.target.value })} />
                    </FormField>
                    <FormField label="Date of Incorporation">
                        <TextInput type="date" value={x.dateOfIncorporation} onChange={(e) => update({ dateOfIncorporation: e.target.value })} />
                    </FormField>
                    <FormField label="Contact Phone Number" required error={errors.phone}>
                        <PhoneInput value={x.phone} onChange={(v) => update({ phone: v })} hasError={!!errors.phone} />
                    </FormField>
                    <FormField label="Alternative Phone Number">
                        <PhoneInput value={x.altPhone} onChange={(v) => update({ altPhone: v })} />
                    </FormField>
                    <FormField label="Contact Email" error={errors.email}>
                        <TextInput type="email" value={x.email} onChange={(e) => update({ email: e.target.value })} />
                    </FormField>
                    <CountyDistrictFields
                        county={x.county} district={x.district}
                        onChange={(county, district) => update({ county, district })}
                        countyError={errors.county}
                        idPrefix="exporter-info"
                    />
                    <FormField label="Community">
                        <TextInput value={x.community} onChange={(e) => update({ community: e.target.value })} />
                    </FormField>
                    <FormField label="Complete Physical Address" full>
                        <TextArea rows={2} value={x.address} onChange={(e) => update({ address: e.target.value })} />
                    </FormField>
                    <FormField label="Selected Commodity" full>
                        <p className="text-sm text-slate-600">{state.step1.commodity ? COMMODITY_LABELS[state.step1.commodity] : 'None selected in Step 1'}</p>
                    </FormField>
                </div>
            </section>
        );
    }

    return <p className="text-sm text-slate-500">Please go back to Step 1 and select an application category.</p>;
};

export default Step2BusinessInfo;

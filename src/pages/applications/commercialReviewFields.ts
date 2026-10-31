// Field-label configuration for the Commercial Application Review page.
// Maps the raw keys found in the category-specific sub-objects of the
// application's `data` blob (see pages/apply/types.ts) onto human-readable
// labels, grouped the way the redesign spec asks for: "Personal
// Information", "Business Information", "Contact and Location" for the
// applicant/business fields, plus the pre-existing "Licence and Commodity
// Details" and "Operations and Warehouse" sections. This is purely a
// presentation-layer mapping - it does not change what data is collected
// or how it's stored.

import type { IdType, EntityType } from '../apply/types';
import { ENTITY_TYPE_LABELS } from '../apply/types';

export interface FieldSection {
    title: string;
    keys: string[];
}

// -----------------------------------------------------------------
// Personal Information - the individual person's identity details
// (the applicant themself, an owner, an authorized signatory, or a
// cooperative's representative - whichever applies to this category).
// -----------------------------------------------------------------
export const PERSONAL_INFO_KEYS = [
    'fullName', 'nationality', 'idType', 'idNumber',
    'ownerFullName', 'ownerNationality', 'ownerIdType', 'ownerIdNumber',
    'signatoryName', 'signatoryPosition', 'signatoryIdNumber',
    'repFullName', 'repPosition', 'repNationalId',
];

// -----------------------------------------------------------------
// Business Information - the legal entity/registration/financial details
// of the business itself.
// -----------------------------------------------------------------
export const BUSINESS_INFO_KEYS = [
    'businessName', 'legalName', 'tradingName', 'entityType', 'businessRegNumber', 'tin',
    'taxClearanceNumber', 'cdaNumber', 'dateEstablished', 'countryOfIncorporation',
    'dateOfIncorporation', 'yearsExperience', 'buyingCounties', 'buyingLocation',
    'bankName', 'bankAccountName', 'bankAccountNumber', 'currency', 'bankBalance', 'bankStatementDate',
];

// -----------------------------------------------------------------
// Contact and Location - how to reach the applicant/representative and
// where they are based.
// -----------------------------------------------------------------
export const CONTACT_LOCATION_KEYS = [
    'phone', 'altPhone', 'email', 'county', 'district', 'community', 'address',
    'signatoryPhone', 'signatoryEmail', 'repPhone', 'repEmail', 'repCounty', 'repDistrict', 'repAddress',
];

// All labels for the three sections above, merged into one lookup so any
// renderer can label a field regardless of which section it ends up in.
export const APPLICANT_FIELD_LABELS: Record<string, string> = {
    fullName: 'Full Name',
    legalName: 'Legal / Business Name',
    businessName: 'Business Name',
    tradingName: 'Trading Name',
    nationality: 'Nationality',
    idType: 'ID Type',
    idNumber: 'ID Number',
    phone: 'Phone',
    altPhone: 'Alternate Phone',
    email: 'Email',
    county: 'County',
    district: 'District',
    community: 'Community',
    address: 'Address',
    entityType: 'Entity Type',
    businessRegNumber: 'Business Registration Number',
    tin: 'Tax Identification Number (TIN)',
    taxClearanceNumber: 'Tax Clearance Number',
    cdaNumber: 'CDA Number',
    dateEstablished: 'Date Established',
    countryOfIncorporation: 'Country of Incorporation',
    dateOfIncorporation: 'Date of Incorporation',
    yearsExperience: 'Years of Experience',
    buyingCounties: 'Buying Counties',
    buyingLocation: 'Buying Location',
    currency: 'Currency',
};

export const LEADERSHIP_FIELD_LABELS: Record<string, string> = {
    ownerFullName: "Owner's Full Name",
    ownerNationality: "Owner's Nationality",
    ownerIdType: "Owner's ID Type",
    ownerIdNumber: "Owner's ID Number",
    signatoryName: 'Authorized Signatory',
    signatoryPosition: 'Signatory Position',
    signatoryPhone: 'Signatory Phone',
    signatoryEmail: 'Signatory Email',
    signatoryIdNumber: 'Signatory ID Number',
    repFullName: 'Authorized Representative',
    repPosition: 'Representative Position',
    repNationalId: "Representative's National ID",
    repPhone: 'Representative Phone',
    repEmail: 'Representative Email',
    repCounty: 'Representative County',
    repDistrict: 'Representative District',
    repAddress: 'Representative Address',
};

export const BANK_FIELD_LABELS: Record<string, string> = {
    bankName: 'Bank Name',
    bankAccountName: 'Bank Account Name',
    bankAccountNumber: 'Bank Account Number',
    currency: 'Currency',
    bankBalance: 'Bank Balance',
    bankStatementDate: 'Bank Statement Date',
};

// Licence and Commodity Details - pulled from step1 + category-specific
// trade/export fields.
export const LICENCE_FIELD_LABELS: Record<string, string> = {
    commodity: 'Commodity',
    applicantKind: 'Applicant Type',
    isRenewal: 'Renewal Application',
    previousNumber: 'Previous Licence/Permit Number',
    buyingCounties: 'Buying Counties',
    buyingLocation: 'Buying Location',
    exportVolume: 'Export Volume',
    exportUnit: 'Export Unit',
    destinationCountries: 'Destination Countries',
    exitPoint: 'Exit Point',
    sourceOfCommodities: 'Source of Commodities',
    sourceFarmGeo: 'Source Farm Geolocation',
    traceabilityNotes: 'Traceability Notes',
};

export const WAREHOUSE_FIELD_LABELS: Record<string, string> = {
    name: 'Warehouse Name',
    code: 'Warehouse Code',
    type: 'Warehouse Type',
    county: 'County',
    district: 'District',
    community: 'Community',
    address: 'Address',
    gps: 'GPS Coordinates',
    capacity: 'Capacity',
    capacityUnit: 'Capacity Unit',
    distanceToOffice: 'Distance to LACRA Office',
    scaleType: 'Scale Type',
    ownership: 'Ownership Status',
    qualityControlNotes: 'Quality Control Notes',
    fumigationNotes: 'Fumigation Notes',
};

// Readable document labels, matching the redesign spec's examples. Falls
// back to a title-cased version of the raw key when a mapping isn't found
// (e.g. category-specific keys not listed here), so nothing ever renders
// as a raw camelCase key.
export const DOCUMENT_LABELS: Record<string, string> = {
    nationalIdOrPassport: 'National ID / Passport',
    businessRegistration: 'Business Registration Certificate',
    passportPhoto: 'Passport Photograph',
    otherDocs: 'Other Supporting Documents',
    ownerIdOrPassport: "Owner's National ID / Passport",
    citizenshipProof: 'Proof of Liberian Citizenship',
    bankStatement: 'Bank Statement',
    personnelIds: 'Personnel Identity Documents',
    warehouseDocs: 'Warehouse Documents',
    cdaCertificate: 'CDA Certificate',
    taxClearance: 'Tax Clearance Certificate',
    articlesOfIncorporation: 'Articles of Incorporation',
    bylaws: 'Bylaws',
    constitution: 'Constitution',
    leadershipList: 'Leadership List',
    farmerMemberList: 'Farmer / Member List',
    leadershipIds: 'Leadership Identity Documents',
    bankConfirmation: 'Bank Statement or Confirmation',
    ownersIds: "Owners' Identity Documents",
    sbaAcknowledgement: 'SBA Acknowledgement / Record',
    qualityControlDocs: 'Quality Control Documents',
    fumigationDocs: 'Fumigation Documents',
    supplierInfo: 'Supplier Information',
};

export function documentLabel(key: string): string {
    if (DOCUMENT_LABELS[key]) return DOCUMENT_LABELS[key];
    return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

export function fieldLabel(key: string): string {
    return (
        APPLICANT_FIELD_LABELS[key] ||
        LEADERSHIP_FIELD_LABELS[key] ||
        BANK_FIELD_LABELS[key] ||
        LICENCE_FIELD_LABELS[key] ||
        key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
    );
}

// Which section a given applicant/business field key belongs in. Returns
// null for keys that aren't part of the applicant/business grid at all
// (e.g. licence or warehouse fields, handled by their own sections).
export function applicantFieldSection(key: string): 'personal' | 'business' | 'contact' | null {
    if (PERSONAL_INFO_KEYS.includes(key)) return 'personal';
    if (BUSINESS_INFO_KEYS.includes(key)) return 'business';
    if (CONTACT_LOCATION_KEYS.includes(key)) return 'contact';
    return null;
}

// Human-readable labels for the IdType enum ('NATIONAL_ID' / 'PASSPORT'),
// matching the redesign spec's instruction to never surface raw enum
// values such as NATIONAL_ID in the UI.
export const ID_TYPE_LABELS: Record<IdType, string> = {
    NATIONAL_ID: 'National ID',
    PASSPORT: 'Passport',
};

function enumLabelForKey(key: string, value: unknown): string | null {
    if (typeof value !== 'string' || !value) return null;
    if (key === 'idType' || key === 'ownerIdType') {
        return ID_TYPE_LABELS[value as IdType] || null;
    }
    if (key === 'entityType') {
        return ENTITY_TYPE_LABELS[value as EntityType] || null;
    }
    return null;
}

// Fields that are genuinely optional on the /apply wizard (see
// pages/apply/types.ts) - a blank value here is normal and must NOT be
// flagged with a red "missing" warning, per the redesign spec's "red
// warnings only for missing required information" instruction.
export const OPTIONAL_FIELD_KEYS = new Set([
    'altPhone', 'tradingName', 'previousNumber', 'sourceFarmGeo', 'traceabilityNotes',
    'distanceToOffice', 'scaleType', 'qualityControlNotes', 'fumigationNotes',
    'buyingLocation', 'community', 'repDistrict', 'repCounty', 'repAddress',
    'taxClearanceNumber', 'dateOfIncorporation', 'dateEstablished', 'bankStatementDate',
    'capacity', 'capacityUnit', 'ownership', 'gps', 'district',
]);

// Keys that should never be rendered as a plain value row (file objects,
// nested arrays, internal bookkeeping) - handled by their own dedicated
// sections instead.
export const SKIP_KEYS = new Set(['photo', 'signatoryPhoto', 'repPhoto', 'ownerCitizenshipProof', 'businessLogo']);

export function displayValue(value: unknown): string {
    if (value === undefined || value === null || value === '') return 'Not provided';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Not provided';
    return String(value);
}

// Context used by fieldDisplayValue()/isFieldMissing() to resolve fields
// whose applicability depends on another field's value - currently just
// "is this a renewal application", which governs whether
// previousNumber/Previous Licence Number should read "Not applicable"
// (new application) instead of "Not provided" (renewal, but left blank).
export interface FieldDisplayContext {
    isRenewal?: boolean;
}

// Field-aware version of displayValue(): translates known enum values
// (idType, entityType, ...) into readable text, and renders "Not
// applicable" instead of "Not provided" for fields that are inapplicable
// given the rest of the application (e.g. previous licence number on a
// brand-new, non-renewal application) rather than merely left blank.
export function fieldDisplayValue(key: string, value: unknown, context?: FieldDisplayContext): string {
    if (key === 'previousNumber' && context && context.isRenewal === false) {
        return 'Not applicable';
    }
    const enumLabel = enumLabelForKey(key, value);
    if (enumLabel) return enumLabel;
    return displayValue(value);
}

// Whether a field's current display value should be treated as a missing-
// required-information warning (red, with an alert icon). Optional fields
// and fields correctly showing "Not applicable" are never flagged, no
// matter how they render.
export function isFieldMissing(key: string, value: unknown, context?: FieldDisplayContext): boolean {
    const display = fieldDisplayValue(key, value, context);
    if (display === 'Not applicable') return false;
    if (display !== 'Not provided') return false;
    return !OPTIONAL_FIELD_KEYS.has(key);
}

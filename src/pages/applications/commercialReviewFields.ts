// Field-label configuration for the Commercial Application Review page.
// Maps the raw keys found in the category-specific sub-objects of the
// application's `data` blob (see pages/apply/types.ts) onto human-readable
// labels, grouped the way the redesign spec asks for ("Applicant and
// Business Information", "Licence and Commodity Details", "Operations and
// Warehouse"). This is purely a presentation-layer mapping - it does not
// change what data is collected or how it's stored.

export interface FieldSection {
    title: string;
    keys: string[];
}

// Applicant / Business Information - identity, contact, and registration
// details. Several categories use different key names for the same
// concept (fullName vs legalName, etc.) - both are listed so whichever is
// present on a given category's record renders under one shared label.
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

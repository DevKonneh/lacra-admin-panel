// ---------------------------------------------------------------------------
// Type definitions for the LACRA Supply Chain Actor Online Registration form.
//
// This is the applicant-facing registration module (Phase 1 of the CMIS
// workflow implementation). Submissions are persisted via
// POST /api/applications (see ../../api/applications.ts) into the
// `application` / `application_status_history` tables, entering the
// Commercial and Marketing work queue at AWAITING_COMMERCIAL_VERIFICATION.
// The internal approval/review/DG-authorization/billing/payment/
// certificate-issuance workflow (12 roles, 12 stages, 41 statuses) is
// implemented separately on top of this same Application record in later
// phases. This module has no dependency on the separate farm-mapping
// module.
// ---------------------------------------------------------------------------

export type Commodity = 'COCOA' | 'COFFEE' | 'PALM_OIL';

export type ApplicationCategory =
    | 'LOCAL_BUYER'
    | 'AGENCY'
    | 'COOPERATIVE'
    | 'LOCAL_EXPORTER'
    | 'FOREIGN_EXPORTER';

export type ApplicantKind = 'INDIVIDUAL' | 'ORGANIZATION';

export type IdType = 'NATIONAL_ID' | 'PASSPORT';

export type EntityType =
    | 'SOLE_PROPRIETORSHIP'
    | 'PARTNERSHIP'
    | 'LLC'
    | 'CORPORATION'
    | 'COOPERATIVE_SOCIETY';

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
    SOLE_PROPRIETORSHIP: 'Sole Proprietorship',
    PARTNERSHIP: 'Partnership',
    LLC: 'Limited Liability Company (LLC)',
    CORPORATION: 'Corporation',
    COOPERATIVE_SOCIETY: 'Cooperative Society',
};

export type PersonnelStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export type OwnershipStatus = 'OWNED' | 'RENTED' | 'LEASED';

export type CapacityUnit = 'KG' | 'TON' | 'METRIC_TON';

// ---- Repeatable record shapes ---------------------------------------------

export interface UploadedFile {
    id: string;
    name: string;
    size: number;
    type: string;
    // Object URL used for immediate local preview only - ephemeral, does
    // NOT survive a page reload (see RegistrationContext's draft-persist
    // logic, which strips this field before saving to localStorage).
    previewUrl?: string;
    // Real, persistent Cloudinary URL returned by
    // POST /api/applications/upload once the file has actually been
    // uploaded to the backend. This is what gets stored in the draft and
    // is what is ultimately submitted as part of the application's `data`
    // blob - unlike previewUrl, this survives reloads and is usable by
    // internal LACRA staff reviewing the application later.
    url?: string;
    status: 'uploading' | 'done' | 'error';
    progress: number;
    errorMessage?: string;
}

export interface PersonnelRecord {
    id: string;
    role: string; // 'Local Produce Buyer' | 'Weighing Clerk' | free text for leadership positions
    fullName: string;
    nationalId: string;
    phone: string;
    email: string;
    county: string;
    district: string;
    community: string;
    address: string;
    photo: UploadedFile | null;
    startDate: string;
    status: PersonnelStatus;
}

export interface FarmerRecord {
    id: string;
    memberId: string;
    fullName: string;
    gender: 'Male' | 'Female' | '';
    phone: string;
    county: string;
    district: string;
    community: string;
    commodity: string;
    gps: string;
}

export interface OwnerRecord {
    id: string;
    fullName: string;
    nationality: string;
    idType: IdType | '';
    idNumber: string;
    ownershipPercent: number | '';
    phone: string;
    email: string;
    citizenshipProof: UploadedFile | null;
}

export interface SupplierRecord {
    id: string;
    supplierType: string;
    supplierName: string;
    permitNumber: string;
    commodity: string;
    county: string;
    district: string;
    contact: string;
}

// ---- Step 1: Application type ----------------------------------------------

export interface StepApplicationType {
    category: ApplicationCategory | '';
    // Applicants are only permitted to select ONE commodity per
    // registration - changed from a multi-select array to a single value.
    commodity: Commodity | '';
    applicantKind: ApplicantKind | '';
    isRenewal: boolean;
    previousNumber: string;
}

// ---- Step 2: Applicant / business information (union of all category shapes) --

export interface BuyerInfo {
    fullName: string;
    nationality: string;
    idType: IdType | '';
    idNumber: string;
    phone: string;
    altPhone: string;
    email: string;
    county: string;
    district: string;
    community: string;
    address: string;
    photo: UploadedFile | null;

    businessName: string;
    entityType: EntityType | '';
    businessRegNumber: string;
    tin: string;
    buyingCounties: string[];
    buyingLocation: string;
    yearsExperience: string;
}

export interface AgencyInfo {
    legalName: string;
    entityType: EntityType | '';
    businessRegNumber: string;
    tin: string;
    taxClearanceNumber: string;
    phone: string;
    altPhone: string;
    email: string;
    county: string;
    district: string;
    community: string;
    address: string;

    ownerFullName: string;
    ownerNationality: string;
    ownerIdType: IdType | '';
    ownerIdNumber: string;
    ownerCitizenshipProof: UploadedFile | null;
    signatoryName: string;
    signatoryPosition: string;
    signatoryPhone: string;
    signatoryEmail: string;
    signatoryPhoto: UploadedFile | null;

    businessLogo: UploadedFile | null;

    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankBalance: string;
    bankStatementDate: string;
}

export interface CooperativeInfo {
    legalName: string;
    entityType: EntityType | '';
    cdaNumber: string;
    businessRegNumber: string;
    tin: string;
    taxClearanceNumber: string;
    dateEstablished: string;
    phone: string;
    altPhone: string;
    email: string;
    county: string;
    district: string;
    community: string;
    address: string;

    repFullName: string;
    repPosition: string;
    repNationalId: string;
    repPhone: string;
    repEmail: string;
    repCounty: string;
    repDistrict: string;
    repAddress: string;
    repPhoto: UploadedFile | null;

    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankBalance: string;
    bankStatementDate: string;
}

export interface ExporterInfo {
    legalName: string;
    tradingName: string;
    entityType: EntityType | '';
    businessRegNumber: string;
    tin: string;
    taxClearanceNumber: string;
    countryOfIncorporation: string;
    dateOfIncorporation: string;
    phone: string;
    altPhone: string;
    email: string;
    county: string;
    district: string;
    community: string;
    address: string;

    signatoryName: string;
    signatoryPosition: string;
    signatoryIdNumber: string;
    signatoryPhone: string;
    signatoryEmail: string;
    signatoryPhoto: UploadedFile | null;

    businessLogo: UploadedFile | null;

    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    currency: string;
    bankBalance: string;
    bankStatementDate: string;

    exportVolume: string;
    exportUnit: string;
    destinationCountries: string;
    exitPoint: string;
    sourceOfCommodities: string;
    sourceFarmGeo: string;
    traceabilityNotes: string;
}

// ---- Warehouse (shared shape, reused by every category) --------------------

export interface WarehouseInfo {
    name: string;
    code: string;
    type: string;
    county: string;
    district: string;
    community: string;
    address: string;
    gps: string;
    capacity: string;
    capacityUnit: CapacityUnit | '';
    distanceToOffice: string;
    scaleType: string;
    ownership: OwnershipStatus | '';
    qualityControlNotes: string;
    fumigationNotes: string;
}

// ---- Declaration -------------------------------------------------------------

export interface DeclarationInfo {
    confirmTrue: boolean;
    understandFalseInfo: boolean;
    agreeRegulations: boolean;
    authorizeVerification: boolean;
    consentProcessing: boolean;
    fullName: string;
    position: string;
    signature: string;
    submissionDate: string;
    captchaAnswer: string;
}

// ---- The complete application state ------------------------------------------

export interface ApplicationState {
    step1: StepApplicationType;
    buyer: BuyerInfo;
    agency: AgencyInfo;
    cooperative: CooperativeInfo;
    exporter: ExporterInfo;
    warehouse: WarehouseInfo;
    personnel: PersonnelRecord[]; // buyers + weighing clerk (Agency/Cooperative)
    leadership: PersonnelRecord[]; // Cooperative leadership
    farmers: FarmerRecord[]; // Cooperative members
    owners: OwnerRecord[]; // Exporter shareholders
    suppliers: SupplierRecord[]; // Exporter suppliers
    documents: Record<string, UploadedFile | null>;
    declaration: DeclarationInfo;
    applicationNumber?: string;
    submittedAt?: string;
}

export const emptyBuyerInfo: BuyerInfo = {
    fullName: '', nationality: 'Liberian', idType: '', idNumber: '', phone: '', altPhone: '', email: '',
    county: '', district: '', community: '', address: '', photo: null,
    businessName: '', entityType: '', businessRegNumber: '', tin: '', buyingCounties: [], buyingLocation: '', yearsExperience: '',
};

export const emptyAgencyInfo: AgencyInfo = {
    legalName: '', entityType: '', businessRegNumber: '', tin: '', taxClearanceNumber: '',
    phone: '', altPhone: '', email: '', county: '', district: '', community: '', address: '',
    ownerFullName: '', ownerNationality: 'Liberian', ownerIdType: '', ownerIdNumber: '', ownerCitizenshipProof: null,
    signatoryName: '', signatoryPosition: '', signatoryPhone: '', signatoryEmail: '', signatoryPhoto: null,
    businessLogo: null,
    bankName: '', bankAccountName: '', bankAccountNumber: '', bankBalance: '', bankStatementDate: '',
};

export const emptyCooperativeInfo: CooperativeInfo = {
    legalName: '', entityType: 'COOPERATIVE_SOCIETY', cdaNumber: '', businessRegNumber: '', tin: '', taxClearanceNumber: '',
    dateEstablished: '', phone: '', altPhone: '', email: '', county: '', district: '', community: '', address: '',
    repFullName: '', repPosition: '', repNationalId: '', repPhone: '', repEmail: '', repCounty: '', repDistrict: '',
    repAddress: '', repPhoto: null,
    bankName: '', bankAccountName: '', bankAccountNumber: '', bankBalance: '', bankStatementDate: '',
};

export const emptyExporterInfo: ExporterInfo = {
    legalName: '', tradingName: '', entityType: '', businessRegNumber: '', tin: '', taxClearanceNumber: '',
    countryOfIncorporation: 'Liberia', dateOfIncorporation: '', phone: '', altPhone: '', email: '',
    county: '', district: '', community: '', address: '',
    signatoryName: '', signatoryPosition: '', signatoryIdNumber: '', signatoryPhone: '', signatoryEmail: '', signatoryPhoto: null,
    businessLogo: null,
    bankName: '', bankAccountName: '', bankAccountNumber: '', currency: 'USD', bankBalance: '', bankStatementDate: '',
    exportVolume: '', exportUnit: 'Metric Ton', destinationCountries: '', exitPoint: '', sourceOfCommodities: '',
    sourceFarmGeo: '', traceabilityNotes: '',
};

export const emptyWarehouseInfo: WarehouseInfo = {
    name: '', code: '', type: '', county: '', district: '', community: '', address: '', gps: '',
    capacity: '', capacityUnit: '', distanceToOffice: '', scaleType: '', ownership: '',
    qualityControlNotes: '', fumigationNotes: '',
};

export const emptyDeclaration: DeclarationInfo = {
    confirmTrue: false, understandFalseInfo: false, agreeRegulations: false,
    authorizeVerification: false, consentProcessing: false,
    fullName: '', position: '', signature: '', submissionDate: '', captchaAnswer: '',
};

export function createEmptyApplication(): ApplicationState {
    return {
        step1: { category: '', commodity: '', applicantKind: '', isRenewal: false, previousNumber: '' },
        buyer: { ...emptyBuyerInfo },
        agency: { ...emptyAgencyInfo },
        cooperative: { ...emptyCooperativeInfo },
        exporter: { ...emptyExporterInfo },
        warehouse: { ...emptyWarehouseInfo },
        personnel: [],
        leadership: [],
        farmers: [],
        owners: [],
        suppliers: [],
        documents: {},
        declaration: { ...emptyDeclaration },
    };
}

export const CATEGORY_LABELS: Record<ApplicationCategory, string> = {
    LOCAL_BUYER: 'Local Produce Buyer',
    AGENCY: 'Agency',
    COOPERATIVE: 'Cooperative',
    LOCAL_EXPORTER: 'Local Exporter',
    FOREIGN_EXPORTER: 'Foreign Exporter',
};

export const COMMODITY_LABELS: Record<Commodity, string> = {
    COCOA: 'Cocoa',
    COFFEE: 'Coffee',
    PALM_OIL: 'Palm Oil',
};

import type { ApplicationCategory } from './types';

export interface DocumentRequirement {
    key: string;
    label: string;
    required: boolean;
    accept: string; // human-readable, matches acceptAttr below
    acceptAttr: string; // for the <input accept> attribute
    maxSizeMb: number;
    helpText?: string;
}

const commonAccept = {
    accept: 'PDF, JPG, PNG',
    acceptAttr: '.pdf,.jpg,.jpeg,.png',
};

const docAccept = {
    accept: 'PDF, DOC, DOCX',
    acceptAttr: '.pdf,.doc,.docx',
};

const spreadsheetAccept = {
    accept: 'CSV, XLS, XLSX',
    acceptAttr: '.csv,.xls,.xlsx',
};

const anyDocAccept = {
    accept: 'PDF, JPG, PNG, DOC, DOCX',
    acceptAttr: '.pdf,.jpg,.jpeg,.png,.doc,.docx',
};

// Maps each application category to the exact set of required/optional
// uploads specified for that path. Keys are stable identifiers used
// throughout Step 5 and the final Review page.
export const DOCUMENT_REQUIREMENTS: Record<ApplicationCategory, DocumentRequirement[]> = {
    // Local Produce Buyer has no warehouse/operational requirements at
    // all (see ApplicationWizard.tsx's skipStep4), so the
    // warehouse/lease document that used to appear here was removed too.
    LOCAL_BUYER: [
        { key: 'nationalIdOrPassport', label: 'National ID or Passport', required: true, maxSizeMb: 5, ...commonAccept },
        { key: 'businessRegistration', label: 'Valid Business Registration', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'passportPhoto', label: 'Passport-size Photograph', required: true, maxSizeMb: 2, accept: 'JPG, PNG', acceptAttr: '.jpg,.jpeg,.png' },
        { key: 'otherDocs', label: 'Other Supporting Documents', required: false, maxSizeMb: 10, ...anyDocAccept },
    ],
    // Matches LACRA's official Agency checklist EXACTLY as confirmed by the
    // user (8 required items) \u2014 this intentionally DROPS the previously
    // present warehouseDocs item (not part of the official regulation's
    // document list; Warehouse remains a required set of INFO fields in
    // Step 4, just not a document upload) and breaks the single combined
    // "personnelIds"/photo items out into the distinct line items LACRA's
    // list calls for: registration records for the 4 linked persons, plus
    // 3 SEPARATE passport-photo items (agency head, the 3 buyers as one
    // combined item, the weighing clerk) rather than one bundled
    // "personnelIds" upload.
    AGENCY: [
        { key: 'ownersLiberianProof', label: 'Proof that All Owners are Liberian', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'ownersIds', label: 'Liberian National ID Cards or Passports of All Owners', required: true, maxSizeMb: 10, ...commonAccept },
        { key: 'businessRegistration', label: 'Valid Business Registration', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'bankStatement', label: 'Bank Statement Showing at Least US$5,000 or Equivalent', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'personnelRegistration', label: 'Registration Records for Three Local Produce Buyers and One Weighing Clerk', required: true, maxSizeMb: 10, helpText: 'Combine into one file if needed', ...anyDocAccept },
        { key: 'agencyHeadPhoto', label: 'Passport-size Photo of the Agency Head', required: true, maxSizeMb: 2, accept: 'JPG, PNG', acceptAttr: '.jpg,.jpeg,.png' },
        { key: 'buyersPhotos', label: 'Passport-size Photos of All Three Local Produce Buyers', required: true, maxSizeMb: 5, helpText: 'Combine into one file if needed', accept: 'JPG, PNG, PDF', acceptAttr: '.jpg,.jpeg,.png,.pdf' },
        { key: 'clerkPhoto', label: 'Passport-size Photo of the Weighing Clerk', required: true, maxSizeMb: 2, accept: 'JPG, PNG', acceptAttr: '.jpg,.jpeg,.png' },
        { key: 'otherDocs', label: 'Other Supporting Documents', required: false, maxSizeMb: 10, ...anyDocAccept },
    ],
    // Mirrors Agency's checklist structure (and its removal of a standalone
    // warehouse-document item) applied to Cooperative's own official
    // regulation requirements: CDA certificate, Articles of Incorporation,
    // Bylaws, Constitution and the $3,000 minimum bank balance, plus the
    // same 4-linked-persons registration + photo breakdown as Agency.
    COOPERATIVE: [
        { key: 'cdaCertificate', label: 'CDA Certificate', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'businessRegistration', label: 'Valid Business Registration', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'taxClearance', label: 'Current Tax Clearance', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'articlesOfIncorporation', label: 'Articles of Incorporation', required: true, maxSizeMb: 5, ...docAccept },
        { key: 'bylaws', label: 'Bylaws', required: true, maxSizeMb: 5, ...docAccept },
        { key: 'constitution', label: 'Constitution', required: true, maxSizeMb: 5, ...docAccept },
        { key: 'bankStatement', label: 'Bank Statement Showing at Least US$3,000 or Equivalent', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'leadershipList', label: 'Leadership List', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'farmerMemberList', label: 'Farmer/Member List with Addresses', required: true, maxSizeMb: 10, ...spreadsheetAccept },
        { key: 'leadershipIds', label: 'Leadership Identity Documents', required: true, maxSizeMb: 10, ...anyDocAccept },
        { key: 'personnelRegistration', label: 'Registration Records for Three Local Produce Buyers and One Weighing Clerk', required: true, maxSizeMb: 10, helpText: 'Combine into one file if needed', ...anyDocAccept },
        { key: 'leadershipPhotos', label: 'Passport-size Photo(s) of Leadership', required: true, maxSizeMb: 5, helpText: 'Combine into one file if needed', accept: 'JPG, PNG, PDF', acceptAttr: '.jpg,.jpeg,.png,.pdf' },
        { key: 'buyersPhotos', label: 'Passport-size Photos of All Three Local Produce Buyers', required: true, maxSizeMb: 5, helpText: 'Combine into one file if needed', accept: 'JPG, PNG, PDF', acceptAttr: '.jpg,.jpeg,.png,.pdf' },
        { key: 'clerkPhoto', label: 'Passport-size Photo of the Weighing Clerk', required: true, maxSizeMb: 2, accept: 'JPG, PNG', acceptAttr: '.jpg,.jpeg,.png' },
        { key: 'otherDocs', label: 'Other Compliance Documents', required: false, maxSizeMb: 10, ...anyDocAccept },
    ],
    // Mirrors Agency's removal of the warehouseDocs/qualityControlDocs/
    // supplierInfo items (not part of LACRA's official Exporter document
    // list) \u2014 Exporter's regulation-sourced checklist is business
    // registration, tax clearance, the Local/Foreign-specific minimum bank
    // balance, owners' IDs and proof of Liberian citizenship for local
    // owners. sbaAcknowledgement stays OPTIONAL (it will become mandatory
    // later per the standing SBA decision \u2014 see ManualLicenseEntryService
    // for the historical-backfill equivalent of this same field).
    LOCAL_EXPORTER: [
        { key: 'businessRegistration', label: 'Valid Business Registration', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'taxClearance', label: 'Current Tax Clearance', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'bankStatement', label: 'Bank Statement Showing at Least US$25,000 or Equivalent', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'ownersIds', label: "Owners' Identity Documents", required: true, maxSizeMb: 10, ...anyDocAccept },
        { key: 'citizenshipProof', label: 'Proof of Liberian Citizenship (Local Owners)', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'sbaAcknowledgement', label: 'SBA Acknowledgement or Record', required: false, maxSizeMb: 5, helpText: 'Optional for now \u2014 will become mandatory later; leave blank if not yet executed', ...anyDocAccept },
        { key: 'otherDocs', label: 'Other Compliance Documents', required: false, maxSizeMb: 10, ...anyDocAccept },
    ],
    FOREIGN_EXPORTER: [
        { key: 'businessRegistration', label: 'Valid Business Registration', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'taxClearance', label: 'Current Tax Clearance', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'bankStatement', label: 'Bank Statement Showing at Least US$50,000 or Equivalent', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'ownersIds', label: "Owners' Identity Documents", required: true, maxSizeMb: 10, ...anyDocAccept },
        { key: 'sbaAcknowledgement', label: 'SBA Acknowledgement or Record', required: false, maxSizeMb: 5, helpText: 'Optional for now \u2014 will become mandatory later; leave blank if not yet executed', ...anyDocAccept },
        { key: 'otherDocs', label: 'Other Compliance Documents', required: false, maxSizeMb: 10, ...anyDocAccept },
    ],
};

// Minimum bank-statement balance (USD or USD-equivalent), per LACRA's
// regulation, enforced per category. Previously only Exporter's two
// sub-categories were listed here (and even those were only ever
// displayed as an informational hint, never actually enforced anywhere) —
// Agency ($5,000) and Cooperative ($3,000) are new additions, and this
// map is now actually read by validateStep3() below to block submission,
// not just shown as a hint.
export const MIN_BANK_BALANCE: Record<string, number> = {
    AGENCY: 5000,
    COOPERATIVE: 3000,
    LOCAL_EXPORTER: 25000,
    FOREIGN_EXPORTER: 50000,
};

// Maximum allowed distance (in metres) between an applicant's registered
// office and their warehouse, per LACRA's regulation ("Office distance
// from warehouse ... must be no more than 50 metres"). Applies to every
// category that has a warehouse step (i.e. every category except Local
// Produce Buyer, which skips Step 4 entirely).
export const MAX_OFFICE_WAREHOUSE_DISTANCE_METRES = 50;

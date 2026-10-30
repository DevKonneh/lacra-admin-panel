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
    LOCAL_BUYER: [
        { key: 'nationalIdOrPassport', label: 'National ID or Passport', required: true, maxSizeMb: 5, ...commonAccept },
        { key: 'businessRegistration', label: 'Valid Business Registration', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'passportPhoto', label: 'Passport-size Photograph', required: true, maxSizeMb: 2, accept: 'JPG, PNG', acceptAttr: '.jpg,.jpeg,.png' },
        { key: 'warehouseLeaseDoc', label: 'Warehouse or Lease Document', required: false, maxSizeMb: 5, helpText: 'Where applicable', ...anyDocAccept },
        { key: 'otherDocs', label: 'Other Supporting Documents', required: false, maxSizeMb: 10, ...anyDocAccept },
    ],
    AGENCY: [
        { key: 'ownerIdOrPassport', label: "Owner's National ID or Passport", required: true, maxSizeMb: 5, ...commonAccept },
        { key: 'citizenshipProof', label: 'Proof of Liberian Citizenship', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'businessRegistration', label: 'Business Registration', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'bankStatement', label: 'Bank Statement Showing Required Balance', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'personnelIds', label: 'IDs for All Registered Personnel', required: true, maxSizeMb: 10, helpText: 'Combine into one file if needed', ...anyDocAccept },
        { key: 'warehouseDocs', label: 'Warehouse Documents', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'otherDocs', label: 'Other Supporting Documents', required: false, maxSizeMb: 10, ...anyDocAccept },
    ],
    COOPERATIVE: [
        { key: 'cdaCertificate', label: 'CDA Certificate', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'businessRegistration', label: 'Business Registration', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'taxClearance', label: 'Current Tax Clearance', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'articlesOfIncorporation', label: 'Articles of Incorporation', required: true, maxSizeMb: 5, ...docAccept },
        { key: 'bylaws', label: 'Bylaws', required: true, maxSizeMb: 5, ...docAccept },
        { key: 'constitution', label: 'Constitution', required: true, maxSizeMb: 5, ...docAccept },
        { key: 'bankStatement', label: 'Bank Statement', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'leadershipList', label: 'Leadership List', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'farmerMemberList', label: 'Farmer/Member List with Addresses', required: true, maxSizeMb: 10, ...spreadsheetAccept },
        { key: 'leadershipIds', label: 'Leadership Identity Documents', required: true, maxSizeMb: 10, ...anyDocAccept },
        { key: 'personnelIds', label: 'Personnel Identity Documents', required: true, maxSizeMb: 10, ...anyDocAccept },
        { key: 'warehouseDocs', label: 'Warehouse Documents', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'otherDocs', label: 'Other Compliance Documents', required: false, maxSizeMb: 10, ...anyDocAccept },
    ],
    LOCAL_EXPORTER: [
        { key: 'businessRegistration', label: 'Business Registration', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'taxClearance', label: 'Recent Tax Clearance', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'bankConfirmation', label: 'Bank Statement or Bank Confirmation', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'ownersIds', label: "Owners' Identity Documents", required: true, maxSizeMb: 10, ...anyDocAccept },
        { key: 'citizenshipProof', label: 'Proof of Liberian Citizenship (Local Owners)', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'sbaAcknowledgement', label: 'SBA Acknowledgement or Record', required: false, maxSizeMb: 5, helpText: 'Where applicable', ...anyDocAccept },
        { key: 'warehouseDocs', label: 'Warehouse Documents', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'qualityControlDocs', label: 'Quality-Control Documents', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'fumigationDocs', label: 'Fumigation Documents', required: false, maxSizeMb: 5, helpText: 'Where applicable', ...anyDocAccept },
        { key: 'supplierInfo', label: 'Supplier Information', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'otherDocs', label: 'Other Compliance Documents', required: false, maxSizeMb: 10, ...anyDocAccept },
    ],
    FOREIGN_EXPORTER: [
        { key: 'businessRegistration', label: 'Business Registration', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'taxClearance', label: 'Recent Tax Clearance', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'bankConfirmation', label: 'Bank Statement or Bank Confirmation', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'ownersIds', label: "Owners' Identity Documents", required: true, maxSizeMb: 10, ...anyDocAccept },
        { key: 'sbaAcknowledgement', label: 'SBA Acknowledgement or Record', required: false, maxSizeMb: 5, helpText: 'Where applicable', ...anyDocAccept },
        { key: 'warehouseDocs', label: 'Warehouse Documents', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'qualityControlDocs', label: 'Quality-Control Documents', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'fumigationDocs', label: 'Fumigation Documents', required: false, maxSizeMb: 5, helpText: 'Where applicable', ...anyDocAccept },
        { key: 'supplierInfo', label: 'Supplier Information', required: true, maxSizeMb: 5, ...anyDocAccept },
        { key: 'otherDocs', label: 'Other Compliance Documents', required: false, maxSizeMb: 10, ...anyDocAccept },
    ],
};

export const MIN_BANK_BALANCE: Record<string, number> = {
    LOCAL_EXPORTER: 25000,
    FOREIGN_EXPORTER: 50000,
};

import api from './index';
import type { ApiResponse } from './types';

// Manual License Entry — talks to the backend's NEW
// POST /api/manual-license-entries endpoint (ManualLicenseEntryController),
// which backs the "License Registry -> Apply for New License" staff form.
//
// Lets Commercial/Marketing staff record a license/permit (Local Buyer,
// Agency, Cooperative, or Exporter) that was already approved and issued
// manually on paper in the past — the record lands straight in ISSUED
// status and immediately appears in that category's register (see
// ManualLicenseEntryService.ts on the backend for the full write-path
// details). This is a DIFFERENT pathway from:
//   - src/api/applications.ts's createApplication() — the full /apply
//     41-status DG-approval workflow, used for genuinely NEW applications.
//   - src/api/licenses.ts — the old, simple License entity this form
//     replaces at /licenses.

export type ManualLicenseEntryCategory = 'LOCAL_BUYER' | 'AGENCY' | 'COOPERATIVE' | 'EXPORTER';

export interface ManualLicenseEntryDocument {
    key: string;
    url: string;
    name?: string;
}

export interface ManualLicenseEntryPayload {
    category: ManualLicenseEntryCategory;

    // Section A — Business / Applicant Information
    businessName: string;
    tinNumber?: string;
    businessRegistrationNumber: string;
    county: string;
    district: string;
    businessAddress: string;
    contactPerson: string;
    email?: string;
    whatsapp?: string;

    // Section B — Ownership and Management
    ownerManagerName: string;
    dateOfBirth: string;
    gender: string;
    placeOfBirth: string;
    nationality: string;
    position: string;
    idType: string;
    idNumber: string;

    // Section C — Operational Information
    intendedCommodities: string[];
    estimatedAnnualPurchaseVolume: number | string;
    expectedAreasOfOperation: string;

    // Optional overrides / backfill-specific fields
    licenseNumber?: string;
    issuedOn?: string;
    validityMonths?: number;
    documents?: ManualLicenseEntryDocument[];
    notes?: string;
}

export interface ManualLicenseEntryResult {
    application: { id: string; applicationNumber: string; category: string; status: string };
    certificate: { id: string; certificateNumber: string; permitOrLicenceType: string; issueDate: string; expiryDate: string };
}

export const createManualLicenseEntry = (payload: ManualLicenseEntryPayload) => {
    return api.post<ApiResponse<ManualLicenseEntryResult>>('/manual-license-entries', payload);
};

// Generic document upload reused from the /apply wizard's own endpoint
// (POST /api/applications/upload) — the manual-entry form's optional
// supporting-document uploads use the exact same Cloudinary-backed upload
// path as every other document upload in this app, just attached to a
// different downstream record.
export const uploadManualEntryDocument = (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<{ url: string; name: string; size: number; type: string }>>(
        '/applications/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
};

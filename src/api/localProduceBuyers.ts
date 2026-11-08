import api from './index';
import type { ApiResponse } from './types';

// Local Produce Buyer Register — a NEW, SIBLING api module to
// src/api/permits.ts (which is off-limits to edit in this phase). This
// talks to the backend's new /api/local-produce-buyers routes, which back
// the "Local Produce Buyers" admin page and the historical-register import
// workflow. It deliberately does not touch permits.ts or PermitList.tsx.

export type LocalProduceBuyerStatus =
    | 'VALID'
    | 'EXPIRED'
    | 'SUSPENDED'
    | 'REVOKED'
    | 'NOT_YET_ISSUED'
    | 'PENDING';

export interface LocalProduceBuyerRecord {
    id: string;
    buyerName: string;
    county: string | null;
    locality: string | null;
    // The real, issuable permit number. Null for a record currently held
    // in conflict (see stagedPermitNumber below).
    permitNumber: string | null;
    // Set only for a record that lost a shared-permit-number conflict at
    // import time — holds its ORIGINAL register number pending staff
    // resolution. Mutually exclusive with permitNumber being non-null.
    stagedPermitNumber: string | null;
    issuanceDate: string | null;
    expirationDate: string | null;
    status: LocalProduceBuyerStatus;
    isPubliclyBlocked: boolean;
    publicBlockReason: string | null;
    isHistoricalImport: boolean;
    isRenewal: boolean;
    isAgent: boolean;
    agencyCertificateId: string | null;
    hasVerificationToken: boolean;
    applicationId: string;
    // The Buyer's own profile photo (Cloudinary secure_url), set via
    // uploadLocalProduceBuyerPhoto() below. Reuses the same generic
    // Certificate.logoUrl column the Agency Register uses for its logo —
    // only the UI label differs per register. Null until a photo has been
    // uploaded.
    photoUrl: string | null;
}

export interface LocalProduceBuyerListResponse {
    records: LocalProduceBuyerRecord[];
    total: number;
    page: number;
    pageSize: number;
}

export interface LocalProduceBuyerListParams {
    search?: string;
    county?: string;
    // Only the live-computed statuses the backend actually understands are
    // ever sent as the `status` query param (VALID/EXPIRED/SUSPENDED/
    // REVOKED/PENDING). "Held" is NOT a backend status filter — it's
    // derived client-side from isPubliclyBlocked (see
    // LocalProduceBuyerRegister.tsx), because a held record can carry any
    // underlying status and must stay visible to staff regardless.
    status?: LocalProduceBuyerStatus;
    page?: number;
    pageSize?: number;
}

export const getLocalProduceBuyers = (params: LocalProduceBuyerListParams = {}) => {
    return api.get<ApiResponse<LocalProduceBuyerListResponse>>('/local-produce-buyers', { params });
};

export const getLocalProduceBuyerCounties = () => {
    return api.get<ApiResponse<string[]>>('/local-produce-buyers/counties');
};

// Returns the raw axios response with responseType 'blob' so callers can
// turn it into an object URL for download/preview without a second
// request or exposing the auth token in a plain <a href> (the backend
// route requires a Bearer token, so this must go through the shared
// authenticated axios instance rather than a bare browser navigation).
export const downloadLocalProduceBuyerQrCode = (id: string) => {
    return api.get(`/local-produce-buyers/${id}/qr-code`, { responseType: 'blob' });
};

export interface ImportRecordResult {
    sourceRecordId: string;
    name: string;
    permitNumber: string;
    county: string | null;
    status: 'MATCHED' | 'ADDED' | 'CONFLICT';
    conflictReason?: string;
    isPubliclyBlocked: boolean;
}

export interface ImportSummary {
    source: string;
    totalSourceRecords: number;
    matchedCount: number;
    addedCount: number;
    conflictCount: number;
    records: ImportRecordResult[];
}

export const previewLocalProduceBuyerImport = () => {
    return api.get<ApiResponse<ImportSummary>>('/local-produce-buyers/import/preview');
};

export const applyLocalProduceBuyerImport = () => {
    return api.post<ApiResponse<ImportSummary>>('/local-produce-buyers/import/apply');
};

export const getLocalProduceBuyerImportRuns = () => {
    return api.get<ApiResponse<any[]>>('/local-produce-buyers/import/runs');
};

export const resolveLocalProduceBuyerConflict = (id: string, certificateNumber: string, resolutionNotes?: string) => {
    return api.patch<ApiResponse<LocalProduceBuyerRecord>>(`/local-produce-buyers/${id}/resolve-conflict`, {
        certificateNumber,
        resolutionNotes,
    });
};

export const linkLocalProduceBuyerAgency = (id: string, agencyCertificateId: string) => {
    return api.post<ApiResponse<LocalProduceBuyerRecord>>(`/local-produce-buyers/${id}/link-agency`, {
        agencyCertificateId,
    });
};

// Profile-photo upload — multipart, field name "file", same convention as
// uploadAgencyLogo() in src/api/agencies.ts. Stored on Cloudinary
// server-side; the returned URL is persisted on Certificate.logoUrl and
// reflected immediately in both this register's list view and the public
// QR-scan verification page.
export const uploadLocalProduceBuyerPhoto = (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<{ photoUrl: string }>>(`/local-produce-buyers/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

// Public, token-based verification result — the exact field whitelist
// returned by GET /api/public/permits/verify/:token (see the backend's
// PermitVerificationService.toPublicPermitView(), the single source of
// truth for what's ever exposed publicly). Intentionally a SEPARATE type
// from LocalProduceBuyerRecord above, which is the richer admin-only view.
export interface PublicPermitVerificationResult {
    permitNumber: string;
    buyerName: string;
    county: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    status: LocalProduceBuyerStatus;
    // Already returned by the backend's toPublicPermitView() (same field
    // used by the Agency's public verify page) — just wasn't surfaced in
    // this type/page until now.
    logoUrl: string | null;
}

// Public verify-by-token endpoint — deliberately uses a bare axios call
// (not the shared `api` instance) because this page must be reachable by
// an unauthenticated member of the public scanning a QR code, and must
// never attach a stored admin Bearer token to the request. Goes through
// the same relative '/api' base (Vite proxy in dev, real backend URL in
// prod) as every other module here.
import axios from 'axios';
const publicApi = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL || 'https://lacra-eudr-backend.onrender.com/api'}/public`,
    headers: { 'Content-Type': 'application/json' },
});

export const verifyLocalProduceBuyerToken = (token: string) => {
    return publicApi.get<{ success: boolean; data?: PublicPermitVerificationResult; message?: string }>(
        `/permits/verify/${token}`
    );
};

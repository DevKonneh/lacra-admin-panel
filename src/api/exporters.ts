import api from './index';
import type { ApiResponse } from './types';

// Exporter Register — a NEW, SIBLING api module to src/api/agencies.ts and
// src/api/localProduceBuyers.ts. Talks to the backend's /api/exporters
// routes (ExporterController), which back the "Exporter Register" admin
// page, the exporter profile, and the public export-license QR
// verification page.
//
// Unlike Agencies, Exporters have NO staffing/personnel concept — this
// module deliberately omits every AgentPersonnel-equivalent type/endpoint.
// The register itself also has no Local/Foreign column (both
// LOCAL_EXPORTER and FOREIGN_EXPORTER applications collapse into a single
// unified "EXPORTER" permitOrLicenceType on the backend) — see
// ExporterImportService.ts's doc comment on the backend for the full
// rationale.

export type ExporterLicenseStatus =
    | 'VALID'
    | 'EXPIRED'
    | 'SUSPENDED'
    | 'REVOKED'
    | 'NOT_YET_ISSUED'
    | 'PENDING';

export interface ExporterRecord {
    id: string;
    exporterName: string | null;
    county: string | null;
    // Set only for a record held for review due to a county discrepancy
    // between the batch overview and a historical QR (e.g. Meridian
    // Commodity Inc.) — holds the alternate county candidate that was
    // NOT chosen as the primary `county` value above. Preserved
    // permanently as an audit record even after staff resolve the
    // conflict; non-null for a resolved-but-previously-disputed record
    // too.
    disputedCounty: string | null;
    locality: string | null;
    // The real, issuable export license number. The license number
    // itself is never withheld for this register (unlike a shared-number
    // conflict on other registers) — only the county can be disputed —
    // so this is non-null for every imported record, including a
    // held-for-review one.
    licenseNumber: string | null;
    stagedPermitNumber: string | null;
    issuanceDate: string | null;
    expirationDate: string | null;
    status: ExporterLicenseStatus;
    isPubliclyBlocked: boolean;
    publicBlockReason: string | null;
    isHistoricalImport: boolean;
    hasVerificationToken: boolean;
    applicationId: string;
    logoUrl: string | null;
}

export interface ExporterListResponse {
    records: ExporterRecord[];
    total: number;
    page: number;
    pageSize: number;
}

export interface ExporterListParams {
    search?: string;
    county?: string;
    status?: ExporterLicenseStatus;
    page?: number;
    pageSize?: number;
}

export const getExporters = (params: ExporterListParams = {}) => {
    return api.get<ApiResponse<ExporterListResponse>>('/exporters', { params });
};

export const getExporterCounties = () => {
    return api.get<ApiResponse<string[]>>('/exporters/counties');
};

export const getExporter = (id: string) => {
    return api.get<ApiResponse<ExporterRecord>>(`/exporters/${id}`);
};

// Returns the raw axios response with responseType 'blob' so callers can
// turn it into an object URL for download without a second request or
// exposing the auth token in a plain <a href>.
export const downloadExporterQrCode = (id: string) => {
    return api.get(`/exporters/${id}/qr-code`, { responseType: 'blob' });
};

export const resolveExporterConflict = (id: string, county?: string, resolutionNotes?: string) => {
    return api.patch<ApiResponse<ExporterRecord>>(`/exporters/${id}/resolve-conflict`, {
        county,
        resolutionNotes,
    });
};

export interface ExporterImportRecordResult {
    sourceRecordId: string;
    exporterName: string;
    licenseNumber: string;
    county: string;
    status: 'MATCHED' | 'ADDED' | 'CONFLICT';
    conflictReason?: string;
    isPubliclyBlocked: boolean;
}

export interface ExporterImportSummary {
    source: string;
    totalSourceRecords: number;
    matchedCount: number;
    addedCount: number;
    conflictCount: number;
    records: ExporterImportRecordResult[];
}

export const previewExporterImport = () => {
    return api.get<ApiResponse<ExporterImportSummary>>('/exporters/import/preview');
};

export const applyExporterImport = () => {
    return api.post<ApiResponse<ExporterImportSummary>>('/exporters/import/apply');
};

export const getExporterImportRuns = () => {
    return api.get<ApiResponse<any[]>>('/exporters/import/runs');
};

// ---------------------------------------------------------------------
// Public, token-based verification — the exact field whitelist returned
// by GET /api/public/exporters/verify/:token (see the backend's
// PermitVerificationService.toPublicPermitView(), the single source of
// truth for what's ever exposed publicly). Deliberately a separate type
// from ExporterRecord above, which is the richer admin-only view.
// ---------------------------------------------------------------------
export interface PublicExporterVerificationResult {
    permitNumber: string;
    buyerName: string;
    county: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    status: ExporterLicenseStatus;
    logoUrl: string | null;
}

// Public verify-by-token endpoint — deliberately uses a bare axios call
// (not the shared `api` instance) because this page must be reachable by
// an unauthenticated member of the public scanning a QR code, and must
// never attach a stored admin Bearer token to the request. Mirrors
// agencies.ts's publicApi instance exactly (kept as its own instance here
// rather than shared, since this module must not depend on that sibling
// module).
import axios from 'axios';
const publicApi = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL || 'https://lacra-eudr-backend.onrender.com/api'}/public`,
    headers: { 'Content-Type': 'application/json' },
});

export const verifyExporterToken = (token: string) => {
    return publicApi.get<{ success: boolean; data?: PublicExporterVerificationResult; message?: string }>(
        `/exporters/verify/${token}`
    );
};

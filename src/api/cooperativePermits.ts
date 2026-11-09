import api from './index';
import type { ApiResponse } from './types';

// Cooperative (Certificate-based) Register — a NEW, SIBLING api module to
// src/api/agencies.ts, src/api/localProduceBuyers.ts, and
// src/api/exporters.ts. Talks to the backend's NEW /api/cooperative-permits
// routes (CooperativePermitController), which back the "Cooperative
// Register" admin page, the cooperative profile, and the public permit QR
// verification page.
//
// Deliberately a SEPARATE module from src/api/cooperatives.ts, which talks
// to the pre-existing, UNRELATED /api/cooperatives routes for the CDA
// Cooperative directory (membership/location reference data, no
// Certificate linkage) — these two modules must never be confused with
// each other.
//
// Like Exporters, Cooperatives have no staffing/personnel concept and no
// bulk historical-import batch — every record here is created one at a
// time via the new manual license-entry form (src/api/manualLicenseEntry.ts)
// or, in the future, a live Application reaching ISSUED.

export type CooperativePermitStatus =
    | 'VALID'
    | 'EXPIRED'
    | 'SUSPENDED'
    | 'REVOKED'
    | 'NOT_YET_ISSUED'
    | 'PENDING';

export interface CooperativePermitRecord {
    id: string;
    cooperativeName: string | null;
    county: string | null;
    locality: string | null;
    permitNumber: string | null;
    stagedPermitNumber: string | null;
    issuanceDate: string | null;
    expirationDate: string | null;
    status: CooperativePermitStatus;
    isPubliclyBlocked: boolean;
    publicBlockReason: string | null;
    isHistoricalImport: boolean;
    hasVerificationToken: boolean;
    applicationId: string;
}

export interface CooperativePermitListResponse {
    records: CooperativePermitRecord[];
    total: number;
    page: number;
    pageSize: number;
}

export interface CooperativePermitListParams {
    search?: string;
    county?: string;
    status?: CooperativePermitStatus;
    page?: number;
    pageSize?: number;
}

export const getCooperativePermits = (params: CooperativePermitListParams = {}) => {
    return api.get<ApiResponse<CooperativePermitListResponse>>('/cooperative-permits', { params });
};

export const getCooperativePermitCounties = () => {
    return api.get<ApiResponse<string[]>>('/cooperative-permits/counties');
};

export const getCooperativePermit = (id: string) => {
    return api.get<ApiResponse<CooperativePermitRecord>>(`/cooperative-permits/${id}`);
};

// Returns the raw axios response with responseType 'blob' so callers can
// turn it into an object URL for download without a second request or
// exposing the auth token in a plain <a href>.
export const downloadCooperativePermitQrCode = (id: string) => {
    return api.get(`/cooperative-permits/${id}/qr-code`, { responseType: 'blob' });
};

// ---------------------------------------------------------------------
// Public, token-based verification — the exact field whitelist returned
// by GET /api/public/cooperatives/verify/:token (see the backend's
// PermitVerificationService.toPublicPermitView(), the single source of
// truth for what's ever exposed publicly). Deliberately a separate type
// from CooperativePermitRecord above, which is the richer admin-only view.
// ---------------------------------------------------------------------
export interface PublicCooperativeVerificationResult {
    permitNumber: string;
    buyerName: string;
    county: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    status: CooperativePermitStatus;
    logoUrl: string | null;
}

// Public verify-by-token endpoint — deliberately uses a bare axios call
// (not the shared `api` instance) because this page must be reachable by
// an unauthenticated member of the public scanning a QR code, and must
// never attach a stored admin Bearer token to the request. Mirrors
// exporters.ts's publicApi instance exactly (kept as its own instance here
// rather than shared, since this module must not depend on that sibling
// module).
import axios from 'axios';
const publicApi = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL || 'https://lacra-eudr-backend.onrender.com/api'}/public`,
    headers: { 'Content-Type': 'application/json' },
});

export const verifyCooperativeToken = (token: string) => {
    return publicApi.get<{ success: boolean; data?: PublicCooperativeVerificationResult; message?: string }>(
        `/cooperatives/verify/${token}`
    );
};

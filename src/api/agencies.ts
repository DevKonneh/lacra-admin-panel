import api from './index';
import type { ApiResponse } from './types';

// Agency Register — a NEW, SIBLING api module to src/api/permits.ts and
// src/api/localProduceBuyers.ts (both off-limits to edit in this phase).
// Talks to the backend's /api/agencies routes (AgencyController), which
// back the "Agency Register" admin page, the Agency profile (staffing
// roster management), and the public Agency/Agent QR verification pages.

export type AgencyPermitStatus =
    | 'VALID'
    | 'EXPIRED'
    | 'SUSPENDED'
    | 'REVOKED'
    | 'NOT_YET_ISSUED'
    | 'PENDING';

export interface AgencyStaffingSummary {
    activeAgents: number;
    activeClerks: number;
    requiredAgents: number;
    requiredClerks: number;
    meetsRequirement: boolean;
    flagged: boolean;
    flagReason: string | null;
    summaryLabel?: string;
}

export interface AgencyRecord {
    id: string;
    agencyName: string | null;
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
    status: AgencyPermitStatus;
    isPubliclyBlocked: boolean;
    publicBlockReason: string | null;
    isHistoricalImport: boolean;
    hasVerificationToken: boolean;
    applicationId: string;
    // The Agency's own logo image (Cloudinary secure_url), set via
    // uploadAgencyLogo() below. Null until a logo has been uploaded.
    logoUrl: string | null;
    staffing: AgencyStaffingSummary;
}

export type AgentPersonnelRole = 'AGENT' | 'CLERK';
export type AgentPersonnelStatus = 'ACTIVE' | 'INACTIVE' | 'REPLACED';

export interface AgentPersonnelHistoryEntry {
    action: string;
    date: string;
    note?: string;
    performedByName?: string;
}

export interface AgentPersonnelRecord {
    id: string;
    agencyCertificateId: string | null;
    role: AgentPersonnelRole;
    fullName: string;
    permitNumber: string | null;
    county: string | null;
    nationalId: string | null;
    phone: string | null;
    // This person's own photo (Cloudinary secure_url), set via
    // uploadAgencyPersonnelPhoto() below. Null until a photo has been
    // uploaded. Available for either role — a Clerk's photo is only ever
    // shown on this internal roster view, never on a public page.
    photoUrl: string | null;
    status: AgentPersonnelStatus;
    appointedAt: string | null;
    deactivatedAt: string | null;
    deactivationReason: string | null;
    isPubliclyBlocked: boolean;
    publicBlockReason: string | null;
    requiresAgencyConfirmation: boolean;
    historyLog: AgentPersonnelHistoryEntry[];
    sourceRecordId: string | null;
    isHistoricalImport: boolean;
}

export interface AgencyProfile extends AgencyRecord {
    agents: AgentPersonnelRecord[];
    clerks: AgentPersonnelRecord[];
}

export interface AgencyListResponse {
    records: AgencyRecord[];
    total: number;
    page: number;
    pageSize: number;
}

export interface AgencyListParams {
    search?: string;
    county?: string;
    status?: AgencyPermitStatus;
    // Staffing-completeness filter — new filter dimension not present on
    // the Local Produce Buyer register, per the spec's requirement for a
    // staffing-completeness view on the Agency Register specifically.
    staffing?: 'COMPLETE' | 'INCOMPLETE';
    page?: number;
    pageSize?: number;
}

export const getAgencies = (params: AgencyListParams = {}) => {
    return api.get<ApiResponse<AgencyListResponse>>('/agencies', { params });
};

export const getAgencyCounties = () => {
    return api.get<ApiResponse<string[]>>('/agencies/counties');
};

export const getAgency = (id: string) => {
    return api.get<ApiResponse<AgencyProfile>>(`/agencies/${id}`);
};

// Both return the raw axios response with responseType 'blob' so callers
// can turn it into an object URL for download without a second request or
// exposing the auth token in a plain <a href>.
export const downloadAgencyQrCode = (id: string) => {
    return api.get(`/agencies/${id}/qr-code`, { responseType: 'blob' });
};

export const downloadAgentQrCode = (agencyId: string, personnelId: string) => {
    return api.get(`/agencies/${agencyId}/personnel/${personnelId}/qr-code`, { responseType: 'blob' });
};

// Logo/photo uploads — multipart, field name "file", same convention as
// uploadApplicationDocument() in src/api/applications.ts. Stored on
// Cloudinary server-side; the returned URL is persisted on
// Certificate.logoUrl / AgentPersonnel.photoUrl and reflected immediately
// in both the admin views and the public verification pages.
export const uploadAgencyLogo = (agencyId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<{ logoUrl: string }>>(`/agencies/${agencyId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export const uploadAgencyPersonnelPhoto = (agencyId: string, personnelId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<{ photoUrl: string }>>(`/agencies/${agencyId}/personnel/${personnelId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export interface AppointPersonnelPayload {
    role: AgentPersonnelRole;
    fullName: string;
    county?: string;
    nationalId?: string;
    phone?: string;
}

export const appointAgencyPersonnel = (agencyId: string, payload: AppointPersonnelPayload) => {
    return api.post<ApiResponse<{ person: AgentPersonnelRecord; staffing: AgencyStaffingSummary }>>(
        `/agencies/${agencyId}/personnel`,
        payload
    );
};

export interface ReplacePersonnelPayload {
    fullName: string;
    county?: string;
    nationalId?: string;
    phone?: string;
    reason?: string;
}

export const replaceAgencyPersonnel = (agencyId: string, personnelId: string, payload: ReplacePersonnelPayload) => {
    return api.post<ApiResponse<{ outgoing: AgentPersonnelRecord; incoming: AgentPersonnelRecord; staffing: AgencyStaffingSummary }>>(
        `/agencies/${agencyId}/personnel/${personnelId}/replace`,
        payload
    );
};

export const deactivateAgencyPersonnel = (agencyId: string, personnelId: string, reason?: string) => {
    return api.patch<ApiResponse<{ person: AgentPersonnelRecord; staffing: AgencyStaffingSummary }>>(
        `/agencies/${agencyId}/personnel/${personnelId}/deactivate`,
        { reason }
    );
};

export const linkAgencyPersonnel = (agencyId: string, personnelId: string) => {
    return api.post<ApiResponse<{ person: AgentPersonnelRecord; staffing: AgencyStaffingSummary }>>(
        `/agencies/${agencyId}/personnel/${personnelId}/link`
    );
};

export const getUnassignedAgencyPersonnel = () => {
    return api.get<ApiResponse<AgentPersonnelRecord[]>>('/agencies/personnel/unassigned');
};

export const resolveAgencyConflict = (id: string, certificateNumber: string, resolutionNotes?: string) => {
    return api.patch<ApiResponse<AgencyRecord>>(`/agencies/${id}/resolve-conflict`, {
        certificateNumber,
        resolutionNotes,
    });
};

export interface AgencyImportRecordResult {
    sourceRecordId: string;
    agencyName: string;
    permitNumber: string;
    county: string | null;
    status: 'MATCHED' | 'ADDED' | 'CONFLICT';
    conflictReason?: string;
    isPubliclyBlocked: boolean;
}

export interface PersonnelImportRecordResult {
    sourceRecordId: string;
    name: string;
    sharedAgencyPermitNumber: string;
    candidateAgencySourceRecordId: string | null;
    status: 'MATCHED' | 'ADDED';
    requiresAgencyConfirmation: boolean;
    isPubliclyBlocked: boolean;
    note?: string;
}

export interface AgencyImportSummary {
    source: string;
    totalAgencySourceRecords: number;
    matchedAgencyCount: number;
    addedAgencyCount: number;
    conflictAgencyCount: number;
    agencyRecords: AgencyImportRecordResult[];
    totalPersonnelSourceRecords: number;
    matchedPersonnelCount: number;
    addedPersonnelCount: number;
    personnelRecords: PersonnelImportRecordResult[];
    staffingProjection?: Array<{
        sourceRecordId: string;
        agencyName: string;
        projectedAgents: number;
        projectedClerks: number;
        meetsRequirement: boolean;
    }>;
}

export const previewAgencyImport = () => {
    return api.get<ApiResponse<AgencyImportSummary>>('/agencies/import/preview');
};

export const applyAgencyImport = () => {
    return api.post<ApiResponse<AgencyImportSummary>>('/agencies/import/apply');
};

export const getAgencyImportRuns = () => {
    return api.get<ApiResponse<any[]>>('/agencies/import/runs');
};

// ---------------------------------------------------------------------
// Public, token-based verification — the exact field whitelists returned
// by GET /api/public/agencies/verify/:token and
// GET /api/public/agents/verify/:token (see the backend's
// PermitVerificationService.toPublicPermitView() /
// toPublicAgentView(), the single source of truth for what's ever
// exposed publicly). Deliberately separate types from AgencyRecord /
// AgentPersonnelRecord above, which are the richer admin-only views.
// ---------------------------------------------------------------------
export interface PublicAgencyVerificationResult {
    permitNumber: string;
    buyerName: string;
    county: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    status: AgencyPermitStatus;
    logoUrl: string | null;
}

export type PublicAgentStatus = AgencyPermitStatus | 'AGENT_NOT_ACTIVE';

export interface PublicAgentVerificationResult {
    permitNumber: string;
    agentName: string;
    role: 'AGENT';
    county: string | null;
    agencyName: string;
    agencyStatus: AgencyPermitStatus;
    status: PublicAgentStatus;
    photoUrl: string | null;
    agencyLogoUrl: string | null;
}

// Public verify-by-token endpoints — deliberately use a bare axios call
// (not the shared `api` instance) because these pages must be reachable
// by an unauthenticated member of the public scanning a QR code, and must
// never attach a stored admin Bearer token to the request. Goes through
// the same relative '/api' base (Vite proxy in dev, real backend URL in
// prod) as every other module here — mirrors localProduceBuyers.ts's
// publicApi instance exactly (kept as its own instance here rather than
// shared, since this module must not depend on that sibling module).
import axios from 'axios';
const publicApi = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL || 'https://lacra-eudr-backend.onrender.com/api'}/public`,
    headers: { 'Content-Type': 'application/json' },
});

export const verifyAgencyToken = (token: string) => {
    return publicApi.get<{ success: boolean; data?: PublicAgencyVerificationResult; message?: string }>(
        `/agencies/verify/${token}`
    );
};

export const verifyAgentToken = (token: string) => {
    return publicApi.get<{ success: boolean; data?: PublicAgentVerificationResult; message?: string }>(
        `/agents/verify/${token}`
    );
};

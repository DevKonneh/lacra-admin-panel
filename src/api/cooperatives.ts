import apiClient from './client';
import type { ApiResponse } from './types';

/**
 * Real CDA (Cooperative Development Agency) cooperative registry, served
 * by the backend's Cooperative entity/table (see
 * gh-backend-clone/src/entities/Cooperative.ts and
 * src/controllers/CooperativeController.ts). Pure lookup/reference data -
 * no FK relation back to Farmer/Farm - mirrors the Commodity lookup
 * pattern already used elsewhere in this app.
 *
 * GET /api/cooperatives is deliberately public/no-auth on the backend
 * (non-sensitive reference data, also needed by the unauthenticated
 * public /apply wizard), but apiClient's Bearer-token interceptor is
 * harmless to keep here since RegisterFarmer.tsx itself is only reachable
 * from inside the authenticated admin panel.
 */
export interface Cooperative {
    id: string;
    slug: string;
    name: string;
    county?: string | null;
    district?: string | null;
    community?: string | null;
    address?: string | null;
    location?: string | null;
    commodities?: string[];
    membershipTotal?: number | null;
    membershipMale?: number | null;
    membershipFemale?: number | null;
    contactName?: string | null;
    contactRole?: string | null;
    contactPhones?: string[];
    rawMembership?: string | null;
    rawContact?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

/** Directory row — Cooperative plus derived fields only the staff
 * directory needs (CMIS-linked farmer count, open data-quality flag
 * count). openFlagCount is always 0 for non-ADMIN callers (the backend
 * only populates it for authorised staff). */
export interface CooperativeDirectoryItem extends Cooperative {
    cmisLinkedFarmerCount: number;
    openFlagCount: number;
}

export const getCooperatives = async (params?: { county?: string; commodity?: string }) => {
    return apiClient.get<ApiResponse<Cooperative[]>>('/cooperatives', { params });
};

/** Authenticated staff directory listing — every cooperative (active and
 * inactive), with derived counts. Backing data source for the
 * CooperativeRegistry page; all search/filter/sort/pagination is applied
 * client-side against this one fetch (mirrors CommercialQueue.tsx). */
export const getCooperativeDirectory = async () => {
    return apiClient.get<ApiResponse<CooperativeDirectoryItem[]>>('/cooperatives/directory');
};

export type CooperativeFlagType = 'SUSPECTED_DUPLICATE' | 'MISSING_INFORMATION' | 'COMMODITY_INCONSISTENCY';
export type CooperativeFlagStatus = 'OPEN' | 'REVIEWED';

export interface CooperativeFlag {
    id: string;
    cooperativeId: string;
    type: CooperativeFlagType;
    reason: string;
    relatedCooperativeId?: string | null;
    status: CooperativeFlagStatus;
    createdByUserId?: string | null;
    createdByName?: string | null;
    reviewOutcome?: string | null;
    reviewedByUserId?: string | null;
    reviewedByName?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export type CooperativeChangeSource = 'MANUAL_CORRECTION' | 'CDA_IMPORT';

export interface CooperativeChangeLogEntry {
    id: string;
    cooperativeId: string;
    fieldName: string;
    previousValue?: string | null;
    newValue?: string | null;
    source: CooperativeChangeSource;
    performedByUserId?: string | null;
    performedByName?: string | null;
    importRunId?: string | null;
    notes?: string | null;
    createdAt: string;
}

export interface CooperativeLinkedFarmer {
    id: string;
    farmerId?: string | null;
    name: string;
    region?: string | null;
    cooperativeSource?: string | null;
}

export interface CooperativeDetail {
    cooperative: Cooperative;
    linkedFarmers: CooperativeLinkedFarmer[];
    flags: CooperativeFlag[];
    changeHistory: CooperativeChangeLogEntry[];
}

/** Full detail backing the registry's side panel: record + CMIS-linked
 * farmers + (for authorised staff) data-quality flags + change history. */
export const getCooperativeDetail = async (id: string) => {
    return apiClient.get<ApiResponse<CooperativeDetail>>(`/cooperatives/${id}/detail`);
};

export interface CooperativeCorrectionPayload {
    name?: string;
    county?: string | null;
    district?: string | null;
    community?: string | null;
    address?: string | null;
    location?: string | null;
    commodities?: string[];
    membershipTotal?: number | null;
    membershipMale?: number | null;
    membershipFemale?: number | null;
    contactName?: string | null;
    contactRole?: string | null;
    contactPhones?: string[];
    notes?: string;
}

/** ADMIN-only: applies a manual correction to one or more structured
 * fields. Every changed field is written to an audit-trail row on the
 * backend (CooperativeChangeLog) — see correct()'s doc comment there. */
export const correctCooperative = async (id: string, payload: CooperativeCorrectionPayload) => {
    return apiClient.patch<ApiResponse<{ cooperative: Cooperative; changed: number }>>(`/cooperatives/${id}/correct`, payload);
};

/** ADMIN-only: runs the automated duplicate/missing-info/commodity scan
 * across the whole registry, raising new OPEN flags where appropriate. */
export const scanCooperativeDataQuality = async () => {
    return apiClient.post<ApiResponse<{ created: number }>>('/cooperatives/scan');
};

/** ADMIN-only: manually raises a flag against a cooperative. */
export const createCooperativeFlag = async (
    id: string,
    payload: { type: CooperativeFlagType; reason: string; relatedCooperativeId?: string }
) => {
    return apiClient.post<ApiResponse<CooperativeFlag>>(`/cooperatives/${id}/flags`, payload);
};

/** ADMIN-only: records a review outcome for an open flag. Never merges
 * or alters the cooperative itself — any correction is a separate call
 * to correctCooperative() above. */
export const reviewCooperativeFlag = async (flagId: string, outcome: string) => {
    return apiClient.patch<ApiResponse<CooperativeFlag>>(`/cooperatives/flags/${flagId}/review`, { outcome });
};

export interface ImportFieldChange {
    field: string;
    previousValue: string | null;
    newValue: string | null;
}

export interface ImportPreviewRecord {
    slug: string;
    name: string;
    county: string | null;
    status: 'NEW' | 'CHANGED' | 'UNCHANGED';
    changes: ImportFieldChange[];
}

export interface ImportPreviewResult {
    source: string;
    summary: { newCount: number; changedCount: number; unchangedCount: number; flaggedCount: number };
    records: ImportPreviewRecord[];
    notInSource: { id: string; slug: string; name: string; county: string | null }[];
}

/** ADMIN-only: dry-run comparison of the embedded CDA listing against the
 * current registry — classifies every source record as new/changed/
 * unchanged without writing anything. See ImportPreviewResult. */
export const previewCooperativeImport = async () => {
    return apiClient.get<ApiResponse<ImportPreviewResult>>('/cooperatives/import/preview');
};

export interface ImportApplyResult {
    importRunId: string;
    created: number;
    updated: number;
    unchanged: number;
    total: number;
}

/** ADMIN-only: applies the previewed import. Upserts by stable slug so
 * existing cooperative ids/names (and therefore farmer-registration
 * links) are preserved — never deletes, never duplicates. */
export const applyCooperativeImport = async () => {
    return apiClient.post<ApiResponse<ImportApplyResult>>('/cooperatives/import/apply');
};

export interface CooperativeImportRun {
    id: string;
    source: string;
    performedByUserId?: string | null;
    performedByName?: string | null;
    newCount: number;
    changedCount: number;
    unchangedCount: number;
    flaggedCount: number;
    detailsJson?: string | null;
    createdAt: string;
}

/** ADMIN-only: history of past import runs, most recent first. */
export const getCooperativeImportRuns = async () => {
    return apiClient.get<ApiResponse<CooperativeImportRun[]>>('/cooperatives/import/runs');
};

export interface CooperativeSeedResult {
    created: number;
    updated: number;
    total: number;
}

/**
 * ADMIN-only: (re-)seeds the Cooperative table on the backend from its
 * embedded CDA registry data. Kept for backward compatibility — the
 * registry maintenance screen now uses the preview/apply import workflow
 * above instead, which shows exactly what will change before it is
 * applied.
 * @deprecated prefer previewCooperativeImport() + applyCooperativeImport()
 */
export const seedCooperatives = async () => {
    return apiClient.post<ApiResponse<CooperativeSeedResult>>('/cooperatives/seed');
};

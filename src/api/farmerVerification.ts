import apiClient from './client';
import type { ApiResponse } from './types';

/**
 * Identity Verification feature — API client.
 *
 * Kept in its own file (rather than src/api/farmers.ts) to avoid touching
 * that file's larger in-progress work-in-progress changes, same rationale
 * as farmerActions.ts.
 *
 * IMPORTANT: this verifies the farmer's IDENTITY ONLY. A "Verified" farmer
 * says nothing about whether their farm boundaries, land rights, or EUDR
 * requirements have been validated — those are entirely separate concerns
 * (see the Data Correction Queue / Risk Analysis for those). Always label
 * this feature "Identity Verification" in the UI, never just "Verification".
 *
 * Mirrors FarmerController.setVerificationStatus()/bulkSetVerificationStatus()/
 * getVerificationQueue() on the backend exactly.
 */

export type IdentityStatus = 'Verified' | 'Unverified' | 'Conflict';
export type DataReadiness = 'Ready for Review' | 'Missing Information' | 'Potential Issue';

export interface VerificationQueueItem {
    id: string;
    farmerId?: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    nationalId?: string;
    profilePhoto?: string;
    community?: string;
    district?: string;
    region?: string;
    farmCount: number;
    identityStatus: IdentityStatus;
    identityStatusReason?: string | null;
    identityVerifiedAt?: string | null;
    createdAt: string;
    dataReadiness: DataReadiness;
    missingFields: string[];
    potentialIssues: string[];
}

export interface VerificationQueueResponse {
    summary: {
        total: number;
        byStatus: { Unverified: number; Conflict: number };
        byReadiness: Record<DataReadiness, number>;
    };
    farmers: VerificationQueueItem[];
}

/**
 * Fetch the Identity Verification queue — every farmer whose
 * identityStatus is Unverified or Conflict, each annotated with a
 * data-readiness triage (see DataReadiness above). Readiness is a triage
 * aid only, never itself a verification decision.
 */
export const getVerificationQueue = async (params?: { status?: 'Unverified' | 'Conflict'; readiness?: DataReadiness }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.readiness) qs.set('readiness', params.readiness);
    const query = qs.toString();
    return apiClient.get<ApiResponse<VerificationQueueResponse>>(`/farmers/verification/queue${query ? `?${query}` : ''}`);
};

/**
 * Set a single farmer's identity status. ADMIN-only on the backend.
 * `reason` is REQUIRED when status === 'Conflict', or when reversing an
 * existing 'Verified' status back to 'Unverified' — the backend enforces
 * this and returns a 400 with a clear message if omitted.
 */
export const setFarmerVerificationStatus = async (farmerId: string, status: IdentityStatus, reason?: string) => {
    return apiClient.patch<ApiResponse<any>>(`/farmers/${farmerId}/verification`, { status, reason });
};

export interface BulkVerificationResult {
    successCount: number;
    failureCount: number;
    results: { farmerId: string; success: boolean; message: string }[];
}

/**
 * Bulk verify/flag-conflict a set of EXPLICITLY selected farmers.
 * `reason` is REQUIRED when status === 'Conflict' and applies to every
 * farmer in the batch. The backend re-checks eligibility and permission
 * per-farmer and writes one audit row per farmer actually changed — this
 * is a client-side convenience only, never trusted for authorization.
 */
export const bulkSetFarmerVerificationStatus = async (farmerIds: string[], status: 'Verified' | 'Conflict', reason?: string) => {
    return apiClient.post<ApiResponse<BulkVerificationResult>>(`/farmers/verification/bulk`, { farmerIds, status, reason });
};

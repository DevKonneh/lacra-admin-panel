import apiClient from './client';
import type { ApiResponse } from './types';

/**
 * Farmer Audit Log — API client.
 *
 * Kept in its own file (rather than src/api/farmers.ts) to avoid touching
 * that file's larger in-progress work-in-progress changes, same rationale
 * as farmerActions.ts / farmerVerification.ts.
 *
 * Mirrors FarmerController.getAuditLog() / entities/FarmerAuditLog.ts on the
 * backend exactly. One row per change event — contact-info corrections,
 * farms added, commodity changes, and every identity-verification decision
 * (verified / conflict flagged / reverted to unverified) — most-recent
 * first. Powers the Farmer Profile's "Activity" tab.
 */

export type FarmerAuditAction =
    | 'CONTACT_UPDATED'
    | 'FARM_ADDED'
    | 'IDENTITY_CONFIRMED'
    | 'COMMODITY_ADDED'
    | 'COMMODITY_UPDATED'
    | 'COMMODITY_DEACTIVATED'
    | 'IDENTITY_VERIFIED'
    | 'IDENTITY_CONFLICT_FLAGGED'
    | 'IDENTITY_REVERTED_TO_UNVERIFIED';

export interface FarmerAuditLogEntry {
    id: string;
    farmerId: string;
    action: FarmerAuditAction;
    fieldName?: string | null;
    previousValue?: string | null;
    newValue?: string | null;
    farmId?: string | null;
    performedByUserId?: string | null;
    performedByName?: string | null;
    notes?: string | null;
    createdAt: string;
}

/**
 * Fetch the full audit trail for one farmer, most-recent first.
 * ADMIN + INSPECTOR can read (matches GET /farmers/:id/audit-log on the
 * backend); no additional role gating needed client-side beyond the route
 * already requiring an authenticated staff session.
 */
export const getFarmerAuditLog = async (farmerId: string) => {
    return apiClient.get<ApiResponse<FarmerAuditLogEntry[]>>(`/farmers/${farmerId}/audit-log`);
};

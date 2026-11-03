import apiClient from './client';
import type { ApiResponse } from './types';

/**
 * Permanently deletes a farmer profile that is no longer needed, along with
 * everything that belongs to them (farm(s), plots/commodities, documents,
 * risk assessments, satellite alerts, audit log, their own login account).
 * ADMIN-only on the backend (DELETE /farmers/:id). Irreversible.
 *
 * Kept in its own file (rather than src/api/farmers.ts) to avoid touching
 * that file's larger in-progress work-in-progress changes.
 */
export const deleteFarmer = async (id: string) => {
    return apiClient.delete<ApiResponse<{ deleted: boolean; farmsDeleted: number; userAccountDeleted: boolean }>>(`/farmers/${id}`);
};

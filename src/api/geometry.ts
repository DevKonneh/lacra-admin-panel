import apiClient from './client';
import type { ApiResponse } from './types';
import type { FarmWithFarmer } from './farms';

/**
 * Data Correction Queue: farms whose most recently cached GPS-polygon
 * validation result is Invalid, Needs Review, or Missing (including
 * farms that predate the geometry-validation feature and have never been
 * validated at all — they default to "Missing"). Mirrors
 * FarmController.getDataCorrectionQueue() on the backend exactly.
 */
export interface DataCorrectionQueueResponse {
    summary: {
        total: number;
        byStatus: {
            Invalid: number;
            'Needs Review': number;
            Missing: number;
        };
    };
    farms: FarmWithFarmer[];
}

export const getDataCorrectionQueue = async (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiClient.get<ApiResponse<DataCorrectionQueueResponse>>(`/farms/geometry/data-correction-queue${qs}`);
};

// Mirrors FarmController.revalidateGeometry()'s response shape exactly
// (farmId + the raw GeometryValidationResult, not just the cached Farm
// columns), so callers that only need a success/failure signal (the Data
// Correction Queue re-validates then simply re-fetches the queue) don't
// need to parse this payload in detail.
export interface RevalidateGeometryResult {
    farmId: string;
    geometryValidation: {
        status: 'Valid' | 'Needs Review' | 'Invalid' | 'Missing';
        calculatedAreaHa?: number | null;
        areaDifferenceHa?: number | null;
        areaDifferencePercent?: number | null;
        gpsAccuracyM?: number | null;
    };
}

export const revalidateFarmGeometry = async (farmId: string) => {
    return apiClient.post<ApiResponse<RevalidateGeometryResult>>(`/farms/${farmId}/geometry/revalidate`);
};

// Mirrors FarmController.revalidateAllGeometry()'s response shape exactly.
export interface RevalidateAllGeometryResult {
    total: number;
    validCount: number;
    needsReviewCount: number;
    invalidCount: number;
    missingCount: number;
}

export const revalidateAllFarmGeometry = async () => {
    return apiClient.post<ApiResponse<RevalidateAllGeometryResult>>('/farms/geometry/revalidate-all');
};

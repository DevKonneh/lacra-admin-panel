import apiClient from './client';
import type { ApiResponse } from './types';

export interface FarmDocument {
    id: string;
    farmId: string;
    type: 'Land Title' | 'Consent' | 'Registration' | 'Other';
    documentUrl: string;
    status: 'Valid' | 'Invalid' | 'Pending';
    uploadedAt: string;
}

export const getFarmDocuments = (farmId: string) => {
    return apiClient.get<ApiResponse<FarmDocument[]>>(`/documents/${farmId}`);
};

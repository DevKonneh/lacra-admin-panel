import apiClient from './client';
import type { ApiResponse } from './types';

export type FarmDocumentType =
    | 'Land Title'
    | 'Consent'
    | 'Registration'
    | 'Other'
    | 'National ID / Identification Document'
    | 'Land Deed / Land Ownership Document'
    | 'Lease / Land-Use Agreement'
    | 'Customary or Community Land Authorization'
    | 'Cooperative/Association Membership Document';

export interface FarmDocument {
    id: string;
    farmId: string;
    type: FarmDocumentType;
    documentUrl: string;
    status: 'Valid' | 'Invalid' | 'Pending';
    uploadedAt: string;
}

export const getFarmDocuments = (farmId: string) => {
    return apiClient.get<ApiResponse<FarmDocument[]>>(`/documents/${farmId}`);
};

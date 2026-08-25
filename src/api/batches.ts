import apiClient from './client';
import type { ApiResponse } from './types';

export interface Batch {
    id: string;
    batchId: string;
    weightKg: number;
    cropType: string;
    status: 'COLLECTED' | 'IN_TRANSIT' | 'WAREHOUSE' | 'PROCESSING' | 'SHIPPED';
    qrCode: string;
    farmers: any[];
    createdBy: any;
    createdAt: string;
}

export const createBatch = (farmersIds: string[], weightKg: number, cropType: string) => {
    return apiClient.post<ApiResponse<Batch>>('/batches', { farmersIds, weightKg, cropType });
};

export const getAllBatches = () => {
    return apiClient.get<ApiResponse<Batch[]>>('/batches');
};

export const updateBatchStatus = (id: string, status: string) => {
    return apiClient.put<ApiResponse<Batch>>(`/batches/${id}/status`, { status });
};

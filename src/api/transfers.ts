import apiClient from './client';
import type { ApiResponse } from './types';

export type TransferType = 'PURCHASE' | 'HANDOVER' | 'RECEIVE';

export interface Transfer {
    id: string;
    batchId: string;
    batch?: { batchId: string; weightKg: number; cropType: string };
    fromBusinessId?: string;
    fromBusiness?: { id: string; name: string };
    fromFarmerId?: string;
    fromFarmer?: { id: string; firstName: string; lastName: string };
    toBusinessId?: string;
    toBusiness?: { id: string; name: string };
    quantityKg: number;
    transferDate: string;
    type: TransferType;
    notes?: string;
    createdAt: string;
}

export interface CustodyHistoryData {
    batch: { id: string; batchId: string; weightKg: number; cropType: string };
    custodyChain: { id: string; type: string; date: string; from: string; to: string; quantityKg: number; notes?: string }[];
    currentHolder: string;
}

export const createTransfer = (data: {
    batchId: string;
    fromBusinessId?: string;
    fromFarmerId?: string;
    toBusinessId?: string;
    quantityKg: number;
    transferDate: string;
    type: TransferType;
    notes?: string;
}) => apiClient.post<ApiResponse<Transfer>>('/transfers', data);

export const getTransfers = (params?: { batchId?: string }) =>
    apiClient.get<ApiResponse<Transfer[]>>('/transfers', { params });

export const getCustodyHistory = (batchId: string) =>
    apiClient.get<ApiResponse<CustodyHistoryData>>(`/batches/${batchId}/custody-history`);

export const getAuditDashboard = (params?: {
    batchId?: string;
    fromBusinessId?: string;
    toBusinessId?: string;
    startDate?: string;
    endDate?: string;
}) => apiClient.get<ApiResponse<{ transfers: Transfer[]; summary: { totalTransfers: number; totalQuantityKg: number } }>>('/transfers/audit', { params });

export const getReconciliation = (batchId: string) =>
    apiClient.get<
        ApiResponse<{
            batchId: string;
            batchWeightKg: number;
            sumReceivedKg: number;
            sumTransferredKg: number;
            varianceKg: number;
            reconciled: boolean;
        }>
    >('/transfers/reconciliation', { params: { batchId } });

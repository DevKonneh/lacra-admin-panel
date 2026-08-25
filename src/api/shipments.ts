import apiClient from './client';
import type { ApiResponse } from './types';

export interface Shipment {
    id: string;
    shipmentId: string;
    destinationCountry: string;
    vesselName: string;
    status: 'DRAFT' | 'VALIDATED' | 'ISSUED' | 'SHIPPED';
    ddsNumber?: string;
    batches: any[];
    createdAt: string;
}

export const createShipment = (batchIds: string[], destinationCountry: string, vesselName: string) => {
    return apiClient.post<ApiResponse<Shipment>>('/shipments', { batchIds, destinationCountry, vesselName });
};

export const validateShipment = (id: string) => {
    return apiClient.post<ApiResponse<any>>(`/shipments/${id}/validate`);
};

export const getAllShipments = () => {
    return apiClient.get<ApiResponse<Shipment[]>>('/shipments');
};

export interface DDSData {
    ddsNumber: string;
    shipmentId: string;
    destinationCountry: string;
    vesselName: string;
    createdAt: string;
    operator: { name: string; registrationNumber: string; address: string; eori: string | null };
    product: {
        description: string;
        hsCode: string;
        volumeKg: number;
        batches: { batchId: string; cropType: string; weightKg: number }[];
    };
    geolocations: { country: string; coordinates: string; farmName: string; farmerName: string; areaHa?: number }[];
    riskCompliance: string;
    signature: { issuedBy: string; date: string; statement: string };
}

export const getDDSData = (shipmentId: string) => {
    return apiClient.get<ApiResponse<DDSData>>(`/shipments/${shipmentId}/dds-data`);
};

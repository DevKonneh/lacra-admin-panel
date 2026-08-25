import apiClient from './client';
import type { Farm } from './farmers';

export interface FarmWithFarmer extends Farm {
    farmer: {
        id: string;
        firstName: string;
        lastName: string;
    };
    riskLevel: 'Low' | 'Medium' | 'High';
    lastRiskAssessmentDate?: string;
}

import type { ApiResponse } from './types';

export const getFarms = async () => {
    return apiClient.get<ApiResponse<FarmWithFarmer[]>>('/farms');
};

export const getFarm = async (id: string) => {
    return apiClient.get<ApiResponse<FarmWithFarmer>>(`/farms/${id}`);
};

export const createFarm = async (data: {
    name: string;
    cropType: string;
    lat: number;
    lng: number;
    location?: any;
    totalAreaHa?: number;
    documentType?: string;
    documentUrl?: string;
    farmerId?: string;
}) => {
    return apiClient.post<ApiResponse<FarmWithFarmer>>('/farms', data);
};

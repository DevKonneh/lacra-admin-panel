import apiClient from './client';
import type { ApiResponse } from './types';

export interface SoilProfileResult {
    latitude: number;
    longitude: number;
    textureClass: string;
    clayPercent: number;
    sandPercent: number;
    siltPercent: number;
    phH2O: number;
    organicCarbonGKg: number;
    cationExchangeCapacity: number | null;
    bulkDensityKgDm3: number | null;
    depthLabel: string;
    notes: string[];
}

export const getFarmSoilProfile = async (farmId: string) => {
    return apiClient.get<ApiResponse<SoilProfileResult>>(`/soil/farm/${farmId}`);
};

export const getSoilProfileByCoordinates = async (lat: number, lon: number) => {
    return apiClient.get<ApiResponse<SoilProfileResult>>(`/soil`, { params: { lat, lon } });
};

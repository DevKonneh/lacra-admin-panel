import apiClient from './client';
import type { ApiResponse } from './types';

export interface DashboardStats {
    totalFarmers: number;
    totalFarms: number;
    activeRisks: number;
    compliantFarms: number;
    complianceRate: number;
    shipmentStats: {
        DRAFT: number;
        VALIDATED: number;
        ISSUED: number;
        SHIPPED: number;
    };
    registrationTrend: { month: string; count: number }[];
}

export const getDashboardStats = async () => {
    return apiClient.get<ApiResponse<DashboardStats>>('/reports/dashboard');
};

export interface FarmMappingStats {
    totalFarmers: number;
    totalFarms: number;
    genderBreakdown: {
        Male: number;
        Female: number;
        Other: number;
        Unspecified: number;
    };
    cropBreakdown: { cropType: string; count: number }[];
    farmsWithPolygon: number;
    farmsWithPointOnly: number;
}

export const getFarmMappingStats = async () => {
    return apiClient.get<ApiResponse<FarmMappingStats>>('/reports/farm-mapping-stats');
};

import apiClient from './client';
import type { Farm, CommodityFormEntry } from './farmers';

export interface FarmWithFarmer extends Farm {
    farmer: {
        id: string;
        firstName: string;
        lastName: string;
        // The backend's farm.farmer relation includes the full Farmer
        // entity (no select projection), so region/district/gender are
        // present on the wire even though earlier versions of this type
        // omitted them. Needed for the Farm Registry's county/district
        // filters (FarmsList.tsx) and RiskAnalysis.tsx's farm detail panel.
        region?: string;
        district?: string;
        gender?: string;
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
    // `cropType` is now optional: the backend accepts either the legacy
    // single-crop `cropType` string OR the richer `commodities` array
    // below (see FarmController.create()'s parseCommodities() fallback) —
    // CreateFarm.tsx's multi-commodity form only ever sends `commodities`.
    cropType?: string;
    lat: number;
    lng: number;
    location?: any;
    totalAreaHa?: number;
    documentType?: string;
    documentUrl?: string;
    farmerId?: string;
    // Full farm-detail field set + multi-commodity structure, matching
    // what FarmController.create() accepts (see CommodityFormEntry and
    // CreateFarm.tsx's "Add Farm to Existing Farmer" form).
    ownershipType?: string;
    farmRegistrationStatus?: string;
    numberOfTrees?: number;
    yearsInCultivation?: number;
    harvestSeason?: string;
    averageYield?: string;
    buyers?: string;
    useChemicals?: boolean;
    extensionServices?: boolean;
    farmAddress?: string;
    commodities?: CommodityFormEntry[];
    farmPhotos?: FileList;
}) => {
    return apiClient.post<ApiResponse<FarmWithFarmer>>('/farms', data);
};

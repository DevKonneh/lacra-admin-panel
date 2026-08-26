import apiClient from './client';
import type { ApiResponse } from './types';

export interface Farm {
    id: string;
    name: string;
    cropType: string;
    location: {
        type: string;
        coordinates: any;
    };
    totalAreaHa?: number;
    farmNotes?: string;
    manualSizeInput?: string;
    manualSizeUnit?: string;
    ownershipType?: string;
    ownershipDocument?: string;
    farmRegistrationStatus?: string;
    numberOfTrees?: number;
    yearsInCultivation?: number;
    harvestSeason?: string;
    averageYield?: string;
    useChemicals?: boolean;
    extensionServices?: boolean;
    farmAddress?: string;
    farmPhotos?: string[];
    /**
     * EUDR-style boundary evidence: one geotagged photo per captured
     * boundary point (minimum 4), attached via the mobile app's
     * "Point + Photo" mapping mode (see PUT /farms/:id/boundary-evidence).
     */
    boundaryEvidence?: {
        sequence: number;
        lat: number;
        lng: number;
        accuracy?: number;
        timestamp?: string;
        photoUrl: string;
    }[];
    riskLevel?: 'Low' | 'Medium' | 'High';
    lastRiskAssessmentDate?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface Farmer {
    id: string;
    farmerId?: string;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber: string;
    gender?: string;
    dob?: string;
    nationality?: string;
    nationalId?: string;
    country?: string;
    district?: string;
    community?: string;
    region?: string;
    directions?: string;
    enumeratorName?: string;
    enumeratorId?: string;
    latitude?: string;
    longitude?: string;
    consent?: boolean;
    identityStatus?: 'Verified' | 'Unverified' | 'Conflict';
    profilePhoto?: string;
    idPhoto?: string;
    farmSelfie?: string;
    signature?: string;
    otherId?: string;
    address?: string;
    cooperativeName?: string;
    cooperativeId?: string;
    qrCode?: string; // For newly registered farmers
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
    farms: Farm[];
}

export const createFarmer = async (data: any) => {
    return apiClient.post<ApiResponse<Farmer>>('/farmers', data);
};

export const getFarmers = async () => {
    return apiClient.get<ApiResponse<Farmer[]>>('/farmers');
};

export const getFarmer = async (id: string) => {
    return apiClient.get<ApiResponse<Farmer>>(`/farmers/${id}`);
};

export const updateFarmer = async (id: string, data: Partial<Farmer>) => {
    return apiClient.put<ApiResponse<Farmer>>(`/farmers/${id}`, data);
};

export const setFarmerActiveStatus = async (id: string, isActive: boolean) => {
    return apiClient.patch<ApiResponse<Farmer>>(`/farmers/${id}/status`, { isActive });
};

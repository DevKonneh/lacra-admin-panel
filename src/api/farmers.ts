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

/**
 * Downloads the full Farmer & Farm Registry as a CSV file (ADMIN-only on
 * the backend). Uses `responseType: 'blob'` + a temporary object URL
 * because this endpoint requires the Authorization header, which a plain
 * `<a href>` navigation cannot send — axios attaches it via the request
 * interceptor in `client.ts`, then we trigger the browser's save dialog
 * manually from the resulting blob.
 */
export const downloadFarmersFarmsCsv = async () => {
    const response = await apiClient.get('/export/farmers-farms.csv', {
        responseType: 'blob',
    });

    // Prefer the filename the backend suggests via Content-Disposition,
    // falling back to a sensible default if it's ever missing.
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || `lacra_farmer_farm_registry_${new Date().toISOString().slice(0, 10)}.csv`;

    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

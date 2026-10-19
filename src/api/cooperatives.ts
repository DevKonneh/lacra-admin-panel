import apiClient from './client';
import type { ApiResponse } from './types';

/**
 * Real CDA (Cooperative Development Agency) cooperative registry, served
 * by the backend's Cooperative entity/table (see
 * gh-backend-clone/src/entities/Cooperative.ts and
 * src/controllers/CooperativeController.ts). Pure lookup/reference data -
 * no FK relation back to Farmer/Farm - mirrors the Commodity lookup
 * pattern already used elsewhere in this app.
 *
 * GET /api/cooperatives is deliberately public/no-auth on the backend
 * (non-sensitive reference data, also needed by the unauthenticated
 * public /apply wizard), but apiClient's Bearer-token interceptor is
 * harmless to keep here since RegisterFarmer.tsx itself is only reachable
 * from inside the authenticated admin panel.
 */
export interface Cooperative {
    id: string;
    slug: string;
    name: string;
    county?: string | null;
    location?: string | null;
    commodities?: string[];
    membershipTotal?: number | null;
    membershipMale?: number | null;
    membershipFemale?: number | null;
    contactName?: string | null;
    contactRole?: string | null;
    contactPhones?: string[];
    isActive: boolean;
}

export const getCooperatives = async (params?: { county?: string; commodity?: string }) => {
    return apiClient.get<ApiResponse<Cooperative[]>>('/cooperatives', { params });
};

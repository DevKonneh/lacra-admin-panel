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

export interface CooperativeSeedResult {
    created: number;
    updated: number;
    total: number;
}

/**
 * ADMIN-only: (re-)seeds the Cooperative table on the backend from its
 * embedded CDA registry data. See
 * gh-backend-clone/src/controllers/CooperativeController.ts#seed for the
 * server-side implementation - exists so production can be seeded with
 * one click from here instead of needing direct database/shell access.
 * Idempotent: safe to click more than once.
 */
export const seedCooperatives = async () => {
    return apiClient.post<ApiResponse<CooperativeSeedResult>>('/cooperatives/seed');
};

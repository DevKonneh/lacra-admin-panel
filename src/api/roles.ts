import apiClient from './client';
import type { Role } from '../types';
import type { ApiResponse } from './types';

// Helper to get headers (if apiClient doesn't auto-inject, but typically it might be handled by interceptor in a real app. 
// here I'll check if I need to add it manually or if I should assume client handles it.
// Looking at farmers.ts, it doesn't add headers manually.
// So I will assume apiClient handles it OR I should add an interceptor to client.ts if it's missing.
// For now, I will follow farmers.ts pattern. If it breaks, I'll fix client.ts globally.)
// ACTUALLY, I should add the interceptor to client.ts to be safe and correct.

export const getRoles = async () => {
    return apiClient.get<ApiResponse<Role[]>>('/roles');
};

export const getRole = async (id: string) => {
    return apiClient.get<ApiResponse<Role>>(`/roles/${id}`);
};

export const createRole = async (data: Partial<Role>) => {
    return apiClient.post<ApiResponse<Role>>('/roles', data);
};

export const updateRole = async (id: string, data: Partial<Role>) => {
    return apiClient.put<ApiResponse<Role>>(`/roles/${id}`, data);
};

export const deleteRole = async (id: string) => {
    return apiClient.delete<ApiResponse<any>>(`/roles/${id}`);
};

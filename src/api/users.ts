import apiClient from './client';
import type { User, UserStatus, UserAuditLogEntry } from '../types';
import type { ApiResponse } from './types';

export const getUsers = async () => {
    return apiClient.get<ApiResponse<User[]>>('/users');
};

export const getUser = async (id: string) => {
    return apiClient.get<ApiResponse<User>>(`/users/${id}`);
};

export const createUser = async (data: any) => {
    return apiClient.post<ApiResponse<User>>('/users', data);
};

export const updateUser = async (id: string, data: any) => {
    return apiClient.put<ApiResponse<User>>(`/users/${id}`, data);
};

// Dedicated, auditable deactivate/reactivate action — distinct from
// deleteUser below, which is a permanent, irreversible removal. Prefer
// this for "this person left / should stop having access" since it
// preserves the account's history and every record it's still referenced
// by, and can be undone by calling it again with ACTIVE.
export const setUserStatus = async (id: string, status: UserStatus) => {
    return apiClient.patch<ApiResponse<User>>(`/users/${id}/status`, { status });
};

// Returns the audit trail (role/status changes, password resets, profile
// updates, approvals, logins) for a user account, most-recent first.
export const getUserAuditLog = async (id: string) => {
    return apiClient.get<ApiResponse<UserAuditLogEntry[]>>(`/users/${id}/audit-log`);
};

export const deleteUser = async (id: string) => {
    return apiClient.delete<ApiResponse<any>>(`/users/${id}`);
};

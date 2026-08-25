import apiClient from './client';
import type { User } from '../types';
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

export const deleteUser = async (id: string) => {
    return apiClient.delete<ApiResponse<any>>(`/users/${id}`);
};

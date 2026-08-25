import api from './index';
import type { ApiResponse } from './types';

export interface Permit {
    id: string;
    permitNumber?: string;
    status: string;
    business?: any;
    validFrom?: string;
    validTo?: string;
    createdAt: string;
}

export const createPermit = (data: any) => {
    return api.post<ApiResponse<Permit>>('/permits', data);
};

export const getAllPermits = () => {
    return api.get<ApiResponse<Permit[]>>('/permits');
};

export const submitPermit = (id: string) => {
    return api.post<ApiResponse<Permit>>(`/permits/${id}/submit`);
};

export const recommendPermit = (id: string) => {
    return api.post<ApiResponse<Permit>>(`/permits/${id}/recommend`);
};

export const approvePermit = (id: string) => {
    return api.post<ApiResponse<Permit>>(`/permits/${id}/approve`);
};

export const issuePermit = (id: string, data: any) => {
    return api.post<ApiResponse<Permit>>(`/permits/${id}/issue`, data);
};

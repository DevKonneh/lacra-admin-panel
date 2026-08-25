import api from './index';
import type { ApiResponse } from './types';

export interface License {
    id: string;
    licenseNumber: string;
    type: string;
    status: string;
    holderName: string;
    validFrom?: string;
    validTo?: string;
    business?: any;
    user?: any;
    createdAt: string;
}

export const applyLicense = (data: any) => {
    return api.post<ApiResponse<License>>('/licenses/apply', data);
};

export const getMyLicenses = () => {
    return api.get<ApiResponse<License[]>>('/licenses/my-licenses');
};

export const getAllLicenses = () => {
    return api.get<ApiResponse<License[]>>('/licenses');
};

export const submitLicense = (id: string) => {
    return api.post<ApiResponse<License>>(`/licenses/${id}/submit`);
};

export const recommendLicense = (id: string) => {
    return api.post<ApiResponse<License>>(`/licenses/${id}/recommend`);
};

export const approveLicense = (id: string, data?: any) => {
    return api.post<ApiResponse<License>>(`/licenses/${id}/approve`, data);
};

export const issueLicense = (id: string, data: any) => {
    return api.post<ApiResponse<License>>(`/licenses/${id}/issue`, data);
};

import api from './index';
import type { ApiResponse } from './types';

export interface Business {
    id: string;
    name: string;
    type: 'EXPORTER' | 'LOCAL_BUYER' | 'AGENCY' | 'COOPERATIVE' | 'TRANSPORTER' | 'WAREHOUSE';
    registrationNumber: string;
    eligibility: string;
    owner: any;
    status?: string;
    createdAt: string;
}

export const registerBusiness = (data: any) => {
    return api.post<ApiResponse<Business>>('/business/register', data);
};

export const getMyBusiness = () => {
    return api.get<ApiResponse<Business>>('/business/me');
};

export const getAllBusinesses = () => {
    return api.get<ApiResponse<Business[]>>('/business');
};

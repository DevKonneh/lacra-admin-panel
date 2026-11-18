import api from './index';
import type { ApiResponse } from './types';

// Mirrors LACRA Form No. 0050 "LACRA Permit Application Form — For Local
// Produce Buyer, Agency, and Cooperative Applicants" section-for-section.
export interface Permit {
    id: string;
    permitNumber?: string;
    status: string;
    business?: any;
    validFrom?: string;
    validTo?: string;
    createdAt: string;

    // Section A — Applicant Information
    businessName?: string;
    typeOfEntity?: 'LOCAL_BUYER' | 'AGENCY' | 'COOPERATIVE';
    tinNumber?: string;
    county?: string;
    district?: string;
    businessAddress?: string;
    contactPerson?: string;
    phoneNumber?: string;
    emailAddress?: string;
    whatsapp?: string;

    // Section B — Ownership and Management
    ownerManagerName?: string;
    dateOfBirth?: string;
    gender?: 'MALE' | 'FEMALE';
    placeOfBirth?: string;
    nationality?: string;
    position?: string;
    idType?: 'NATIONAL_ID' | 'PASSPORT' | 'DRIVER_LICENSE' | 'VOTER_ID' | 'OTHER';
    idNumber?: string;

    // Section C — Operational Information
    intendedCommodities?: ('COCOA' | 'COFFEE' | 'PALM')[];
    estimatedPurchaseVolume?: string;
    warehousingLocation?: string;
    expectedAreasOfOperation?: string;

    // Section D — Declaration
    declarationAccepted?: boolean;
    declarationName?: string;
    declarationDate?: string;

    // Section E — LACRA Internal Use Only
    internalRemarks?: string;
}

export const createPermit = (data: Partial<Permit> = {}) => {
    return api.post<ApiResponse<Permit>>('/permits', data);
};

export const getPermit = (id: string) => {
    return api.get<ApiResponse<Permit>>(`/permits/${id}`);
};

export const updatePermit = (id: string, data: Partial<Permit>) => {
    return api.put<ApiResponse<Permit>>(`/permits/${id}`, data);
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

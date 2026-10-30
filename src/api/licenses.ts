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

// DG decision on a license that Commercial review has recommended.
// `decision` must be 'DG_APPROVED' or 'DG_REJECTED' - the backend validates
// this and will 400 on anything else (and on any other status, since a
// license must be in RECOMMENDED_TO_DG before a DG decision can be made).
export const decideLicense = (id: string, decision: 'DG_APPROVED' | 'DG_REJECTED') => {
    return api.post<ApiResponse<License>>(`/licenses/${id}/approve`, { decision });
};

// Suspend an already-issued/active license. Separate endpoint from the DG
// decision above - previously "Suspend" in the admin UI incorrectly called
// the approve endpoint, which always re-approved the license instead.
export const suspendLicense = (id: string) => {
    return api.post<ApiResponse<License>>(`/licenses/${id}/suspend`);
};

export const issueLicense = (id: string, data: any) => {
    return api.post<ApiResponse<License>>(`/licenses/${id}/issue`, data);
};

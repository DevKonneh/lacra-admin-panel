import apiClient from './client';
import type { ApiResponse } from './types';

/**
 * Every dashboard indicator can be scoped by these filters. All optional —
 * omitting all of them returns platform-wide, all-time totals. Mirrors
 * `DashboardFilters` in gh-backend-clone/src/controllers/ReportsController.ts
 * EXACTLY, field-for-field, so a filter picked on the Dashboard and the same
 * filter applied on a drill-down target page (FarmersList/FarmsList URL
 * params) always describe the identical underlying query.
 */
export interface DashboardFilterParams {
    dateFrom?: string; // ISO date, e.g. "2025-01-01"
    dateTo?: string;
    county?: string;
    district?: string;
    commodity?: string;
    gender?: string;
    complianceStatus?: 'Assessment Pending' | 'Compliant' | 'Needs Review' | 'High Risk';
    verificationStatus?: 'Verified' | 'Unverified' | 'Conflict';
}

function toQueryString(filters?: DashboardFilterParams): string {
    if (!filters) return '';
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, String(value));
        }
    });
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

export interface DashboardStats {
    reportingPeriod: string;
    generatedAt: string;
    filtersApplied: DashboardFilterParams;

    // Farmer indicators
    totalFarmers: number;
    verifiedFarmers: number;
    verifiedFarmerRate: number;
    genderBreakdown: {
        Male: number;
        Female: number;
        Other: number;
        Unspecified: number;
    };

    // Farm / geometry indicators
    totalFarms: number;
    totalMappedHectares: number;
    farmsWithValidPolygons: number;
    farmsNeedingCorrection: number;
    geometryValidRate: number;

    // Compliance / risk indicators — kept SEPARATE from verification/geometry rates.
    // compliantFarms = "Assessed Low Risk, Valid Geometry": requires a COMPLETED
    // risk assessment (lastRiskAssessmentDate set) AND riskLevel='Low' AND
    // geometryStatus='Valid'. A never-assessed farm is NEVER counted here —
    // it is counted separately under assessmentPendingFarms below.
    // complianceRate's denominator is ALL REGISTERED FARMS (totalFarms) —
    // see complianceDenominatorLabel. assessmentCoverageRate (below) is a
    // SEPARATE metric (has this farm been assessed at all?) and must never
    // be blended into complianceRate.
    compliantFarms: number;
    mediumRiskFarms: number;
    highRiskFarms: number;
    complianceRate: number;
    complianceDenominatorLabel: string; // e.g. "All registered farms" — always display alongside complianceRate

    // Assessment-completion indicators — SEPARATE from compliance result.
    // assessmentPendingFarms: farms with lastRiskAssessmentDate IS NULL
    // (no completed risk assessment yet, regardless of defaulted riskLevel).
    assessmentPendingFarms: number;
    assessedFarms: number; // totalFarms - assessmentPendingFarms
    assessmentCoverageRate: number; // assessedFarms / totalFarms * 100

    // Legacy aliases (kept for any not-yet-updated caller)
    activeRisks: number;
    mediumRisks: number;
    geometryNeedsAttentionCount: number;

    // Breakdown indicators
    farmsByCounty: { county: string; count: number }[];
    farmsByCommodity: { commodity: string; count: number }[];

    // Licensing
    activeLicenses: number;
    expiringLicenses: number;
    activePermits: number;
    expiringPermits: number;
    expiringWindowDays: number;

    // Inspectorate / QC / traceability / logistics
    activeInspections: number;
    pendingQualityTests: number;
    traceableBatches: number;
    totalBatches: number;
    activeShipments: number;
    shipmentStats: {
        DRAFT: number;
        VALIDATED: number;
        ISSUED: number;
        SHIPPED: number;
    };

    registrationTrend: { month: string; count: number }[];
}

export const getDashboardStats = async (filters?: DashboardFilterParams) => {
    return apiClient.get<ApiResponse<DashboardStats>>(`/reports/dashboard${toQueryString(filters)}`);
};

export interface FarmMappingStats {
    totalFarmers: number;
    totalFarms: number;
    genderBreakdown: {
        Male: number;
        Female: number;
        Other: number;
        Unspecified: number;
    };
    cropBreakdown: { cropType: string; count: number }[];
    farmsWithPolygon: number;
    farmsWithPointOnly: number;
}

export const getFarmMappingStats = async (filters?: DashboardFilterParams) => {
    return apiClient.get<ApiResponse<FarmMappingStats>>(`/reports/farm-mapping-stats${toQueryString(filters)}`);
};

export interface ComplianceCalculationDetails {
    rule: string;
    numerator: number;
    denominator: number;
    denominatorLabel: string; // e.g. "All registered farms" — always show alongside the raw denominator number
    nonCompliantFarms: number;
    complianceRate: number;
    // Assessment-completion metrics — SEPARATE from the compliance result,
    // never blended into complianceRate. assessmentPendingFarms = farms
    // with no completed risk assessment at all.
    assessmentPendingFarms: number;
    assessedFarms: number;
    assessmentCoverageRate: number;
    filtersApplied: DashboardFilterParams;
}

export const getComplianceCalculationDetails = async (filters?: DashboardFilterParams) => {
    return apiClient.get<ApiResponse<ComplianceCalculationDetails>>(`/reports/compliance-calculation${toQueryString(filters)}`);
};

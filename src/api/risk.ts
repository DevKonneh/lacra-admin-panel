import apiClient from './client';
import type { ApiResponse } from './types';

/** Farmer as returned inside risk analysis farm */
export interface RiskAnalysisFarmer {
    id: string;
    farmerId?: string | null;
    qrCode?: string | null;
    firstName: string;
    lastName: string;
    email?: string | null;
    phoneNumber?: string | null;
    nationalId?: string | null;
    gender?: string | null;
    dob?: string | null;
    nationality?: string | null;
    otherId?: string | null;
    address?: string | null;
    community?: string | null;
    district?: string | null;
    region?: string | null;
    cooperativeName?: string | null;
    cooperativeId?: string | null;
    profilePhoto?: string | null;
    farmSelfie?: string | null;
    idPhoto?: string | null;
    enumeratorName?: string | null;
    enumeratorId?: string | null;
    signature?: string | null;
    consent?: boolean;
    identityStatus?: string | null;
    userId?: string | null;
    directions?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    createdAt: string;
    updatedAt: string;
}

/** Farm as returned inside risk analysis */
export interface RiskAnalysisFarm {
    id: string;
    name: string;
    cropType: string;
    location: { type: string; coordinates: number[][][] | number[] };
    riskLevel?: string | null;
    lastRiskAssessmentDate?: string | null;
    totalAreaHa?: number | null;
    ownershipType?: string | null;
    ownershipDocument?: string | null;
    farmRegistrationStatus?: string | null;
    numberOfTrees?: number | null;
    yearsInCultivation?: number | null;
    harvestSeason?: string | null;
    averageYield?: number | null;
    farmNotes?: string | null;
    manualSizeInput?: string | null;
    manualSizeUnit?: string | null;
    buyers?: unknown;
    useChemicals?: boolean;
    extensionServices?: boolean;
    farmAddress?: string | null;
    farmPhotos?: unknown;
    createdAt: string;
    updatedAt: string;
    farmer: RiskAnalysisFarmer;
}

/** A single year with any measurable disturbance/loss/alert signal (ha). */
export interface WhispYearlyEvent {
    year: number;
    gfcLossHa?: number;
    tmfDeforestationHa?: number;
    tmfDegradationHa?: number;
    raddAlertHa?: number;
    gladLAlertHa?: number;
    gladS2AlertHa?: number;
}

/** Overlap (ha) between the plot and a specific commodity-risk dataset. */
export interface WhispCommodityOverlap {
    commodity: string;
    datasetKey: string;
    overlapHa: number;
}

/** Pre-computed EUDR compliance indicator flags returned directly by Whisp. */
export interface WhispIndicators {
    treecover?: 'yes' | 'no';
    commodities?: 'yes' | 'no';
    disturbanceBefore2020?: 'yes' | 'no';
    disturbanceAfter2020?: 'yes' | 'no';
    primary2020?: 'yes' | 'no';
    natRegForest2020?: 'yes' | 'no';
    plantedPlantations2020?: 'yes' | 'no';
    plantedPlantationsAfter2020?: 'yes' | 'no';
    treecoverAfter2020?: 'yes' | 'no';
    agriAfter2020?: 'yes' | 'no';
    loggingConcessionBefore2020?: 'yes' | 'no';
}

/**
 * Whisp's own commodity-category risk verdict. 'more_info_needed' is a real
 * value Whisp returns when its decision tree could NOT reach a definitive
 * low/high call — the backend maps that to MEDIUM risk, so it must never be
 * rendered as low. 'unknown' means no label came back at all.
 */
export type WhispRiskLabel = 'high' | 'low' | 'more_info_needed' | 'unknown';

/** Real Open Foris Whisp satellite analysis result for a plot (EUDR indicators). */
export interface WhispData {
    resultId: string;
    plotId?: string;
    areaHa: number;
    unit: string;
    country?: string;
    producerCountry?: string;
    adminLevel1?: string;
    centroid?: { lon: number; lat: number };
    inWaterbody?: boolean;

    eufo2020Ha: number;
    gfcTreeCover2020Ha?: number;
    esaTreeCover2020Ha?: number;
    forestFdapHa?: number;
    tmfUndisturbedHa?: number;

    annualEvents: WhispYearlyEvent[];
    commodityOverlaps: WhispCommodityOverlap[];
    indicators: WhispIndicators;

    riskPerennialCrop: WhispRiskLabel;
    riskAnnualCrop: WhispRiskLabel;
    riskTimber: WhispRiskLabel;

    whispVersion?: string;
    processedAt?: string;
}

export interface RiskAnalysisResult {
    farmId: string;
    deforestationRisk: boolean;
    overlapResult?: string;
    legalityRisk: boolean;
    traceabilityRisk: boolean;
    overallRisk: 'Low' | 'Medium' | 'High';
    whispAnalysisId?: string;
    whispData?: WhispData;
    /** Provenance stamped by the backend: only 'whisp_live' is audit-grade. */
    source?: 'whisp_live' | 'mock' | null;
    /** TRUE only when Whisp returned a completed analysis with usable fields. */
    whispVerified?: boolean;
    details: {
        assessedAt: string;
        notes: string;
        narrative?: string;
        commodities?: string[];
    };
    farm?: RiskAnalysisFarm;
    id?: string;
    createdAt?: string;
    overlappingAreas?: string[];
}

/**
 * Why an assessment did not produce a result.
 *
 * The backend now REFUSES to save a mock or failed assessment (see
 * AssessmentAttempt / WhispUnavailableError). When that happens the request
 * fails with a typed body instead of a fake verdict, and the UI must say so
 * plainly — never fall back to showing a stale or blank risk level as if the
 * run had succeeded.
 */
export type AssessmentFailureCode =
    | 'not_configured'
    | 'auth_failed'
    | 'validation_failed'
    | 'service_unavailable'
    | 'timeout'
    | 'incomplete_result'
    | 'request_failed';

export interface AssessmentFailure {
    code: AssessmentFailureCode | string;
    retryable: boolean;
    /** Always false for these failures — no assessment row was written. */
    assessmentRecorded: boolean;
    message: string;
    httpStatus?: number;
}

/** A failed assessment attempt stored by the backend (visible audit trail). */
export interface AssessmentAttemptRecord {
    id: string;
    farmId?: string;
    farmNameSnapshot?: string;
    attemptedAt: string;
    outcome: string;
    failureCode?: string;
    message: string;
    httpStatus?: number;
    retryable?: boolean;
}

/**
 * Normalises an axios error from POST /risk/assess/:farmId into an
 * AssessmentFailure. Handles both the typed Whisp failure envelope and the
 * older generic error shape, so the UI can always explain what happened.
 */
export const toAssessmentFailure = (error: unknown): AssessmentFailure => {
    const anyErr = error as any;
    const status: number | undefined = anyErr?.response?.status;
    const body = anyErr?.response?.data;
    const data = body?.data;

    if (data && typeof data === 'object' && data.code) {
        return {
            code: data.code,
            retryable: Boolean(data.retryable),
            assessmentRecorded: data.assessmentRecorded === true,
            message: body?.message || 'The assessment could not be completed.',
            httpStatus: status,
        };
    }

    if (!anyErr?.response) {
        return {
            code: 'request_failed',
            retryable: true,
            assessmentRecorded: false,
            message:
                'Could not reach the assessment service. No assessment was recorded — check your connection and try again.',
        };
    }

    return {
        code: status === 400 ? 'validation_failed' : 'request_failed',
        retryable: status ? status >= 500 || status === 429 : true,
        assessmentRecorded: false,
        message: body?.message || 'The assessment could not be completed. No assessment was recorded.',
        httpStatus: status,
    };
};

export const assessRisk = async (farmId: string) => {
    return apiClient.post<ApiResponse<RiskAnalysisResult>>(`/risk/assess/${farmId}`);
};

export const getRiskHistory = async (farmId: string) => {
    return apiClient.get<ApiResponse<RiskAnalysisResult[]>>(`/risk/history/${farmId}`);
};

/** Failed attempts for a farm — makes an unsuccessful run visible to staff. */
export const getAssessmentAttempts = async (farmId: string) => {
    return apiClient.get<ApiResponse<AssessmentAttemptRecord[]>>(`/risk/attempts/${farmId}`);
};


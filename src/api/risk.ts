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

export type WhispRiskLabel = 'high' | 'low' | 'unknown';

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
    details: {
        assessedAt: string;
        notes: string;
        commodities?: string[];
    };
    farm?: RiskAnalysisFarm;
    id?: string;
    createdAt?: string;
    overlappingAreas?: string[];
}

export const assessRisk = async (farmId: string) => {
    return apiClient.post<ApiResponse<RiskAnalysisResult>>(`/risk/assess/${farmId}`);
};

export const getRiskHistory = async (farmId: string) => {
    return apiClient.get<ApiResponse<RiskAnalysisResult[]>>(`/risk/history/${farmId}`);
};

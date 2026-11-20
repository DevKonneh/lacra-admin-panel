import apiClient from './client';
import type { ApiResponse } from './types';

/**
 * Automatic per-plot satellite (WhISP / Open Foris) assessment.
 *
 * WHY THIS CLIENT EXISTS
 * ---------------------
 * Assessment used to be something staff started by hand, so a farm could sit
 * with no satellite evidence indefinitely — and nothing in the panel said so.
 * The backend now queues a check automatically the moment a plot with a valid
 * surveyed polygon is committed, and runs it in the background.
 *
 * This module is READ-ONLY apart from `retryPlot`. It never creates a finding:
 * verdicts come from WhISP only. Staff can see status, see WHY something was
 * not assessed, and re-queue a plot that failed.
 *
 * THE DISTINCTION THAT MATTERS
 * ----------------------------
 * `riskLevel: null` does NOT mean "low risk". It means nothing has been
 * verified for this plot against its CURRENT boundary. Rendering it as a clean
 * result is the same class of mistake as the old `Farm.riskLevel` bug, where a
 * DB default of 'Low' was mistaken for a verdict. Every consumer here must
 * present null as "not assessed".
 */

/** Mirrors PlotAssessmentStatus in the backend's PlotAssessmentView service. */
export type PlotAssessmentStatus =
    | 'queued'
    | 'assessing'
    | 'completed'
    | 'failed'
    | 'boundary_review'
    | 'not_queued';

export interface PlotAssessmentView {
    plotId: string;
    plotName: string;
    isDefault: boolean;
    areaHa: number | null;
    /** Human-facing boundary version. Bumped only when the polygon really changes. */
    geometryVersion: number;
    geometryHash: string | null;

    status: PlotAssessmentStatus;
    /** Why a plot is parked for boundary review, or why a run failed. */
    statusReason: string | null;

    jobId: string | null;
    attempts: number;
    /** When a retryable failure will be retried automatically (ISO string). */
    nextAttemptAt: string | null;

    /**
     * The CURRENT verified finding, or null.
     *
     * null means "not assessed against this boundary" — never "no risk".
     */
    riskLevel: 'Low' | 'Medium' | 'High' | null;
    /** WhISP's commodity-category label (low / high / more_info_needed). */
    deforestationFinding: string | null;
    /**
     * True when WhISP returned 'more_info_needed' — it could not decide.
     * This is NOT a pass and must not be shown as one.
     */
    inconclusive: boolean;
    assessedAt: string | null;
    /** Which boundary version the current finding describes. */
    assessedGeometryVersion: number | null;
    attention: string | null;
    narrative: string | null;

    /** Older verdicts retained because the boundary has since been corrected. */
    historyCount: number;
    lastFailureMessage: string | null;
}

export interface FarmPlotAssessmentSummary {
    total: number;
    completed: number;
    queued: number;
    assessing: number;
    failed: number;
    boundaryReview: number;
    /** Plots whose current finding is a verified satellite result. */
    withVerifiedFinding: number;
}

export interface FarmPlotAssessmentView {
    farmId: string;
    farmName: string;
    plots: PlotAssessmentView[];
    summary: FarmPlotAssessmentSummary;
}

/** Result of a manual retry (POST /assessments/retry/plot/:plotId). */
export interface RetryPlotResult {
    jobId?: string;
    status?: string;
    created?: boolean;
    /** Present when the plot was NOT sent to WhISP because of its boundary. */
    boundaryReviewReason?: string;
}

/** Per-plot assessment status and findings for one farm. */
export const getFarmPlotAssessments = async (farmId: string) => {
    return apiClient.get<ApiResponse<FarmPlotAssessmentView>>(`/assessments/farm/${farmId}`);
};

/** Re-queue one plot whose automatic check failed or was never run. */
export const retryPlotAssessment = async (plotId: string) => {
    return apiClient.post<ApiResponse<RetryPlotResult>>(`/assessments/retry/plot/${plotId}`);
};

/**
 * Human-facing label for each queue state.
 *
 * Kept here (rather than in the component) so the wording is identical anywhere
 * a status is shown, and so "Boundary review required" cannot drift into
 * something that sounds like a completed assessment.
 */
export const PLOT_STATUS_LABEL: Record<PlotAssessmentStatus, string> = {
    queued: 'Queued',
    assessing: 'Assessing',
    completed: 'Completed',
    failed: 'Failed',
    boundary_review: 'Boundary review required',
    not_queued: 'Not queued',
};

/**
 * True when a finding is safe to present as this plot's deforestation result.
 *
 * Deliberately strict. `inconclusive` (WhISP said 'more_info_needed') and a
 * null finding both return false: neither is evidence of a clean parcel.
 */
export const hasVerifiedFinding = (plot: PlotAssessmentView): boolean =>
    plot.status === 'completed' &&
    plot.riskLevel !== null &&
    plot.inconclusive === false;

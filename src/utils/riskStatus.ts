/**
 * Single source of truth for "has this farm actually been assessed?".
 *
 * WHY THIS EXISTS
 * Farm.riskLevel is a database enum that DEFAULTS TO 'Low' (see the backend
 * Farm entity). That means a brand-new farm that has never been through a
 * satellite/Whisp assessment still stores riskLevel === 'Low'. Rendering
 * that raw value as a green "Low Risk" badge anywhere in the UI is a false
 * compliance signal for a national regulator: staff would see a clean bill
 * of health for a plot nobody has ever looked at.
 *
 * The ONLY reliable marker of a completed assessment is
 * Farm.lastRiskAssessmentDate (NULL until RiskService.analyzeFarm() runs).
 * Every risk/compliance surface must therefore go through this module
 * rather than reading farm.riskLevel directly.
 *
 * This mirrors the backend rule used by ReportsController's compliance
 * buckets (lastRiskAssessmentDate IS NULL => "Assessment Pending") and
 * FarmsList.complianceStatusOf().
 */

export type RiskLevel = 'Low' | 'Medium' | 'High';
export const RISK_LEVELS: RiskLevel[] = ['Low', 'Medium', 'High'];

/** Anything carrying the two fields the rule depends on. */
export interface AssessableRisk {
    riskLevel?: string | null;
    lastRiskAssessmentDate?: string | null;
}

/** A farm counts as assessed only once a completed assessment date exists. */
export const isAssessed = (farm?: AssessableRisk | null): boolean =>
    Boolean(farm?.lastRiskAssessmentDate);

/**
 * The farm's real risk level, or null when it has never been assessed.
 * Returning null (rather than a defaulted 'Low') is what lets callers show
 * a neutral "Not Assessed" state instead of a misleading green pass.
 */
export const effectiveRiskLevel = (farm?: AssessableRisk | null): RiskLevel | null => {
    if (!isAssessed(farm)) return null;
    const level = farm?.riskLevel;
    return level === 'High' || level === 'Medium' || level === 'Low' ? level : null;
};

/** The four mutually-exclusive compliance buckets used platform-wide. */
export type ComplianceBucket = 'Assessment Pending' | 'Compliant' | 'Needs Review' | 'High Risk';

/**
 * Same 4-bucket rule as FarmsList.complianceStatusOf() and the backend's
 * ReportsController.complianceStatusWhereSql(), so a farm's badge always
 * agrees with which dashboard bucket counted it.
 *
 * IMPORTANT: the never-assessed check comes FIRST — otherwise a farm whose
 * riskLevel is merely the DB default 'Low' plus a Valid geometry would be
 * misclassified as 'Compliant'.
 */
export const complianceBucketOf = (
    farm: AssessableRisk & { geometryStatus?: string | null },
): ComplianceBucket => {
    if (!isAssessed(farm)) return 'Assessment Pending';
    const level = effectiveRiskLevel(farm);
    if (level === 'High') return 'High Risk';
    if (level === 'Low' && farm.geometryStatus === 'Valid') return 'Compliant';
    return 'Needs Review';
};

/** Human-readable label for a bucket (avoids "Compliant" shorthand). */
export const complianceBucketLabel = (bucket: ComplianceBucket): string => {
    switch (bucket) {
        case 'Assessment Pending':
            return 'Assessment Pending';
        case 'Compliant':
            return 'Assessed Low Risk, Valid Geometry';
        case 'High Risk':
            return 'High Risk';
        default:
            return 'Needs Review';
    }
};

/**
 * An assessment older than this is presented as stale — datasets and the
 * physical farm change, and a year-old verdict should not read as current.
 */
export const STALE_AFTER_DAYS = 365;

export const daysSince = (iso?: string | null): number | null => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86_400_000);
};

export const isStaleAssessment = (farm?: AssessableRisk | null): boolean => {
    const days = daysSince(farm?.lastRiskAssessmentDate);
    return days !== null && days > STALE_AFTER_DAYS;
};

/**
 * Whisp "risk" labels as returned by the backend: 'high' | 'low' |
 * 'more_info_needed' | 'unknown'. 'more_info_needed' means Whisp's own
 * decision tree could NOT reach a verdict — it must never be rendered as
 * low risk, and 'unknown' means no label came back at all.
 */
export type WhispRiskLabel = 'high' | 'low' | 'more_info_needed' | 'unknown';

export const whispRiskLabelText = (label?: WhispRiskLabel | null): string => {
    switch (label) {
        case 'high':
            return 'High';
        case 'low':
            return 'Low';
        case 'more_info_needed':
            return 'More info needed';
        default:
            return 'Unknown';
    }
};

/** Tailwind classes for a Whisp label chip (never green for non-'low'). */
export const whispRiskLabelClasses = (label?: WhispRiskLabel | null): string => {
    switch (label) {
        case 'high':
            return 'bg-red-100 text-red-800';
        case 'low':
            return 'bg-green-100 text-green-800';
        case 'more_info_needed':
            return 'bg-amber-100 text-amber-800';
        default:
            return 'bg-gray-100 text-gray-600';
    }
};

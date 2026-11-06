// Shared formatting/derivation helpers for the Farmer Profile page.
// Kept separate from the component (same rationale as farmerListHelpers.ts)
// so the tri-state/eligibility/outstanding-tasks logic is easy to unit-test
// and reuse without duplicating it inline in JSX across multiple tabs.

import * as turf from '@turf/turf';
import type { Farmer, Farm } from '../../api/farmers';
import type { FarmDocument } from '../../api/documents';

/* ------------------------------------------------------------------ */
/* Missing-vs-negative distinction                                     */
/* ------------------------------------------------------------------ */

/**
 * Three-state read of an optional boolean field: 'unknown' when the value
 * is null/undefined (meaning "not assessed yet" / "not recorded"), 'yes'
 * when true, 'no' when explicitly false. Deliberately NEVER collapses
 * "unknown" into "no" — the exact bug this helper exists to fix (the old
 * YesNoBadge rendered undefined and false identically).
 */
export type TriState = 'yes' | 'no' | 'unknown';

export function triState(value: boolean | undefined | null): TriState {
    if (value === undefined || value === null) return 'unknown';
    return value ? 'yes' : 'no';
}

/* ------------------------------------------------------------------ */
/* Farm location / commodity summary (shared by Overview + Farms & Maps) */
/* ------------------------------------------------------------------ */

/**
 * Best-effort location line for ONE farm. Farms don't carry their own
 * community/district/region columns today — `farmAddress` (free-text,
 * farm-specific) is used first when present, otherwise this falls back to
 * the farmer's own registered location. The fallback is intentionally
 * labelled by the caller (not here) as "farmer's registered area" so it's
 * never mistaken for a farm-specific GPS address.
 */
export function formatFarmLocationLine(farm: Farm, farmer: Pick<Farmer, 'community' | 'district' | 'region'>): string {
    if (farm.farmAddress && farm.farmAddress.trim()) return farm.farmAddress;
    const parts = [farmer.district, farmer.region].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '\u2014';
}

export type CommodityEligibility = 'Eligible' | 'Pending' | 'Ineligible';

/**
 * There is no dedicated per-commodity compliance field in the data model
 * yet, so eligibility is derived from `productionStatus` as a reasonable,
 * transparent heuristic: Producing/Declining -> Eligible, Abandoned ->
 * Ineligible, everything else (Not Yet Productive / Dormant / unknown) ->
 * Pending.
 */
export function eligibilityForStatus(status?: string): CommodityEligibility {
    if (status === 'Producing' || status === 'Declining') return 'Eligible';
    if (status === 'Abandoned') return 'Ineligible';
    return 'Pending';
}

export function eligibilityBadgeClass(status: CommodityEligibility): string {
    return status === 'Eligible'
        ? 'bg-green-100 text-green-700'
        : status === 'Ineligible'
            ? 'bg-red-100 text-red-700'
            : 'bg-yellow-100 text-yellow-700';
}

export interface FarmCommoditySummary {
    primary: string | null;
    additional: string[];
    croppingSystems: string[];
    productionSummary: string;
    eligibility: { name: string; status: CommodityEligibility }[];
}

/**
 * Flattens a farm's active Plot -> PlotCommodity rows into the summary the
 * compact farms list / farm detail link need: primary commodity, additional
 * (secondary) commodities, cropping systems in use, a human-readable
 * estimated-production rollup, and a per-commodity eligibility status.
 * Falls back to the legacy single `cropType` field for farms with no
 * Plot/PlotCommodity rows yet.
 */
export function getFarmCommoditySummary(f: Farm): FarmCommoditySummary {
    const activeCommodities = (f.plots || [])
        .filter((p) => p.isActive)
        .flatMap((p) => p.plotCommodities || [])
        .filter((pc) => pc.isActive);

    if (activeCommodities.length === 0) {
        return {
            primary: f.cropType || null,
            additional: [],
            croppingSystems: [],
            productionSummary: '\u2014',
            eligibility: f.cropType ? [{ name: f.cropType, status: 'Pending' as CommodityEligibility }] : [],
        };
    }

    const primaryEntry = activeCommodities.find((pc) => pc.role === 'Primary') || activeCommodities[0];
    const additional = Array.from(new Set(
        activeCommodities.filter((pc) => pc !== primaryEntry).map((pc) => pc.commodityName)
    ));
    const croppingSystems = Array.from(new Set(activeCommodities.map((pc) => pc.croppingSystem).filter(Boolean)));
    const productionSummary = activeCommodities
        .filter((pc) => pc.estimatedAnnualProduction != null)
        .map((pc) => `${pc.estimatedAnnualProduction} ${pc.unitOfMeasurement || ''} (${pc.commodityName})`.trim())
        .join(', ') || '\u2014';
    const eligibility = activeCommodities.map((pc) => ({
        name: pc.commodityName,
        status: eligibilityForStatus(pc.productionStatus),
    }));

    return { primary: primaryEntry.commodityName, additional, croppingSystems, productionSummary, eligibility };
}

/** Calculated area (from the real GeoJSON boundary), null for missing/invalid geometry. */
export function calcAreaHaFor(farm: Farm): number | null {
    const loc = farm.location;
    if (!loc || !loc.coordinates) return null;
    try {
        if (loc.type === 'Polygon') return turf.area(loc as any) / 10000;
    } catch {
        /* ignore malformed geometry */
    }
    return null;
}

/* ------------------------------------------------------------------ */
/* Overview: outstanding tasks                                         */
/* ------------------------------------------------------------------ */

export interface OutstandingTask {
    id: string;
    label: string;
    severity: 'high' | 'medium' | 'low';
}

/**
 * Triage list for the Overview tab — mirrors the SPIRIT of the backend's
 * computeDataReadiness() (FarmerController.ts: missing fields / shared
 * phone number), re-derived client-side so it applies to every farmer
 * (the backend's version only annotates farmers still in the verification
 * queue, i.e. not yet Verified). This is a read-only triage aid, same as
 * the backend's "data readiness" concept — never itself a verification or
 * compliance decision.
 */
export function computeOutstandingTasks(params: {
    farmer: Farmer;
    farms: Farm[];
    documents: FarmDocument[];
    hasSharedPhoneNumber: boolean;
}): OutstandingTask[] {
    const { farmer, farms, documents, hasSharedPhoneNumber } = params;
    const tasks: OutstandingTask[] = [];

    if (!farmer.profilePhoto) tasks.push({ id: 'photo', label: 'Profile photo not captured', severity: 'medium' });
    if (!farmer.idPhoto) tasks.push({ id: 'idphoto', label: 'ID photo not captured', severity: 'medium' });
    if (!farmer.signature) tasks.push({ id: 'signature', label: 'Signature not captured', severity: 'low' });
    if (!farmer.nationalId) tasks.push({ id: 'nationalid', label: 'National ID number missing', severity: 'high' });
    if (!farmer.consent) tasks.push({ id: 'consent', label: 'Consent not recorded', severity: 'high' });

    if (farmer.identityStatus !== 'Verified') {
        tasks.push({
            id: 'identity',
            label: farmer.identityStatus === 'Conflict'
                ? 'Identity conflict flagged — needs resolution'
                : 'Identity not yet verified',
            severity: farmer.identityStatus === 'Conflict' ? 'high' : 'medium',
        });
    }

    if (hasSharedPhoneNumber) {
        tasks.push({
            id: 'shared-phone',
            label: 'Phone number shared with another farmer record — review for a possible duplicate',
            severity: 'medium',
        });
    }

    if (farms.length === 0) {
        tasks.push({ id: 'no-farms', label: 'No farms registered yet', severity: 'high' });
    } else {
        const withoutBoundary = farms.filter((f) => {
            const coords = f.location?.coordinates;
            return !coords || (Array.isArray(coords) && coords.length === 0);
        });
        if (withoutBoundary.length > 0) {
            tasks.push({ id: 'no-boundary', label: `${withoutBoundary.length} farm(s) missing a mapped boundary`, severity: 'high' });
        }

        const neverAssessed = farms.filter((f) => !f.lastRiskAssessmentDate);
        if (neverAssessed.length > 0) {
            tasks.push({ id: 'no-assessment', label: `${neverAssessed.length} farm(s) have never been risk-assessed`, severity: 'medium' });
        }

        const needingGeometryReview = farms.filter((f) => f.geometryStatus === 'Needs Review' || f.geometryStatus === 'Invalid');
        if (needingGeometryReview.length > 0) {
            tasks.push({ id: 'geometry-review', label: `${needingGeometryReview.length} farm(s) flagged for boundary review`, severity: 'high' });
        }

        const possibleFarmOverlap = farms.filter((f) => f.overlapsExistingFarm === true);
        if (possibleFarmOverlap.length > 0) {
            tasks.push({ id: 'farm-overlap', label: `${possibleFarmOverlap.length} farm(s) possibly overlap another registered farm`, severity: 'high' });
        }
    }

    if (documents.length === 0) {
        tasks.push({ id: 'no-docs', label: 'No supporting documents uploaded for the selected farm', severity: 'medium' });
    } else if (documents.some((d) => d.status === 'Invalid')) {
        tasks.push({ id: 'invalid-docs', label: 'Some documents are marked invalid', severity: 'high' });
    } else if (documents.some((d) => d.status === 'Pending')) {
        tasks.push({ id: 'pending-docs', label: 'Some documents are pending review', severity: 'low' });
    }

    return tasks;
}

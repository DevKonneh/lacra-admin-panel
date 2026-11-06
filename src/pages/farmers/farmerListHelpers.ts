// Shared formatting/derivation helpers for the Farmer Registry listing.
// Kept separate from the component so the sort/format rules are easy to
// unit-test and reuse (e.g. from FarmerProfile's "Back to Farmers" link)
// without duplicating logic inline in JSX.

import type { Farmer } from '../../api/farmers';

export type IdentityFilter = 'All' | 'Verified' | 'Unverified' | 'Conflict';
export type SortMode =
    | 'RECENT'
    | 'NAME_ASC'
    | 'NAME_DESC'
    | 'FARMS_DESC'
    | 'FARMS_ASC';

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'RECENT', label: 'Recently Registered' },
    { value: 'NAME_ASC', label: 'Name A–Z' },
    { value: 'NAME_DESC', label: 'Name Z–A' },
    { value: 'FARMS_DESC', label: 'Most Farms' },
    { value: 'FARMS_ASC', label: 'Fewest Farms' },
];

/**
 * Standardized "District, County" location line. Returns null (not an
 * empty string) when neither piece is present, so callers can cleanly
 * decide whether to render a fallback instead of an empty line.
 */
export function formatFarmerLocationLine(farmer: Pick<Farmer, 'district' | 'region'>): string | null {
    const parts = [farmer.district, farmer.region].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Readable Farmer ID for display. Falls back to a short, clearly-labelled
 * placeholder (never a raw internal UUID) when the backend hasn't yet
 * assigned a sequential Farmer ID (farmerId is backfilled asynchronously
 * on some legacy records — see FarmerController.backfillFarmerIds).
 */
export function formatFarmerId(farmer: Pick<Farmer, 'farmerId'>): string {
    return farmer.farmerId || 'ID Pending';
}

export function farmerFullName(farmer: Pick<Farmer, 'firstName' | 'lastName'>): string {
    return `${farmer.firstName} ${farmer.lastName}`.trim();
}

/**
 * True when at least one other farmer in the full (unfiltered) list shares
 * this farmer's phone number — the SAME read-only triage signal the
 * backend's Identity Verification queue already surfaces
 * (computeDataReadiness's "Potential Issue" / shared-phone check in
 * FarmerController.ts). Deliberately NOT a duplicate-record verdict: it
 * only ever points a reviewer at the Identity Verification queue to look
 * closer — this listing never merges, hides, or deletes anything based on
 * it.
 */
export function hasSharedPhoneNumber(farmer: Farmer, allFarmers: Farmer[]): boolean {
    if (!farmer.phoneNumber) return false;
    return allFarmers.some((other) => other.id !== farmer.id && other.phoneNumber === farmer.phoneNumber);
}

export function sortFarmers(farmers: Farmer[], mode: SortMode): Farmer[] {
    const list = [...farmers];
    switch (mode) {
        case 'NAME_ASC':
            return list.sort((a, b) => farmerFullName(a).localeCompare(farmerFullName(b)));
        case 'NAME_DESC':
            return list.sort((a, b) => farmerFullName(b).localeCompare(farmerFullName(a)));
        case 'FARMS_DESC':
            return list.sort((a, b) => (b.farms?.length || 0) - (a.farms?.length || 0));
        case 'FARMS_ASC':
            return list.sort((a, b) => (a.farms?.length || 0) - (b.farms?.length || 0));
        case 'RECENT':
        default:
            // Most recently registered first; legacy records with no
            // createdAt sink to the bottom rather than jumping to the top.
            return list.sort((a, b) => {
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bTime - aTime;
            });
    }
}

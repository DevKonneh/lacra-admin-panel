// Rough tree-count estimation helper.
//
// This is used ONLY as a fallback display when a farm does not have a real,
// user-entered `numberOfTrees` value. It multiplies the farm's measured area
// (totalAreaHa) by a typical planting density (trees per hectare) for the
// farm's crop type. The result is always presented to the user as an
// ESTIMATE, never as a substitute for an actual tree count/inventory.
//
// Density sources (typical smallholder / commercial spacing, West Africa):
// - Cocoa: ~1,000 trees/ha (traditional smallholder spacing, commonly cited
//   range 800-1,100 trees/ha; 1,000 used as a representative midpoint)
// - Coffee: ~1,100 trees/ha (standard Robusta spacing ~3m x 3m)
// - Palm (oil palm): ~143 trees/ha (FAO/industry-standard 9m triangular
//   spacing, widely used across West Africa)
// - Rubber: ~500 trees/ha (standard commercial spacing, ~500-600 trees/ha
//   range commonly recommended)
// - Cassava: not a tree crop (herbaceous root crop) — no tree estimate applies
// - Vegetables: not a tree crop — no tree estimate applies
// - Other: unknown crop type — no reliable density available
export const TREE_DENSITY_PER_HA: Record<string, number> = {
    Cocoa: 1000,
    Coffee: 1100,
    Palm: 143,
    Rubber: 500,
};

export interface TreeCountEstimateResult {
    /** Rounded estimated tree count, or null if it cannot be estimated. */
    estimatedCount: number | null;
    /** Trees/ha density value used for the calculation, if applicable. */
    densityPerHa: number | null;
}

/**
 * Computes a rough estimated tree count for a farm based on its crop type
 * and measured area. Returns null values when the crop type has no known
 * tree density (e.g. Cassava, Vegetables, Other) or when area is missing.
 */
export function estimateTreeCount(
    cropType: string | null | undefined,
    totalAreaHa: number | null | undefined
): TreeCountEstimateResult {
    if (!cropType || !totalAreaHa || totalAreaHa <= 0) {
        return { estimatedCount: null, densityPerHa: null };
    }
    const density = TREE_DENSITY_PER_HA[cropType];
    if (!density) {
        return { estimatedCount: null, densityPerHa: null };
    }
    return {
        estimatedCount: Math.round(totalAreaHa * density),
        densityPerHa: density,
    };
}

/** Formats a number with thousands separators, e.g. 12345 -> "12,345". */
export function formatTreeCount(count: number): string {
    return count.toLocaleString('en-US');
}

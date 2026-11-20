/**
 * Map Registry — local performance & selection check.
 *
 * ⚠️  LOCAL ONLY. This is a synthetic, offline benchmark run in the sandbox.
 *     It does NOT touch staging, live, the real database, or the network.
 *     Absolute timings here are indicative of client-side work only and must
 *     not be quoted as production or staging figures.
 *
 * WHAT IT PROVES
 * --------------
 * src/pages/MapView.tsx renders a national map with two deliberate caps:
 *
 *     const FEATURE_CAP = 750;   // map markers/polygons rendered at once
 *     const LIST_PAGE   = 150;   // sidebar rows rendered at once
 *
 * The question a reviewer asks is: "with more farms than the cap, can staff
 * still FIND and SELECT a specific farm?" This script answers that by
 * replicating MapView's real pipeline over a dataset larger than the cap:
 *
 *   1. getFarmGeo()            — per-farm geometry prep (turf centroid)
 *   2. passesFilters()         — risk / county / district / assessment filters
 *   3. filteredFarmerGroups    — sidebar grouping + search (UNCAPPED)
 *   4. visibleFarmerGroups     — LIST_PAGE slice + "Show more" paging
 *   5. visibleGeos             — FEATURE_CAP slice (pre-bounds) or viewport
 *                                filter with force-include of the selection
 *
 * The replica is written against the same rules as the component, including
 * effectiveRiskLevel() semantics (a never-assessed farm has NO level even
 * though the DB column defaults to 'Low').
 *
 * Run:  node scripts/map-registry-bench.mjs
 */

import { centroid } from "@turf/turf";

const FEATURE_CAP = 750;
const LIST_PAGE = 150;

// ───────────────────────────────────────────────────────────────────────────
// 1. Synthetic but representative dataset
// ───────────────────────────────────────────────────────────────────────────
// Liberia's real extent, so coordinates are plausible rather than arbitrary.
const LIBERIA = { minLng: -11.5, maxLng: -7.4, minLat: 4.3, maxLat: 8.55 };
const COUNTIES = ["Montserrado", "Bong", "Nimba", "Lofa", "Sinoe", "Grand Bassa", "Margibi", "Bomi"];
const DISTRICTS = ["District 1", "District 2", "District 3", "District 4"];
const CROP_TYPES = ["Cocoa", "Coffee", "Palm", "Rubber", "Cassava"];
const GEOMETRY_KINDS = ["polygon", "polygon", "polygon", "multipolygon", "point", "none"];

// Deterministic PRNG so runs are comparable between invocations.
let seed = 42;
const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const randLng = () => LIBERIA.minLng + rand() * (LIBERIA.maxLng - LIBERIA.minLng);
const randLat = () => LIBERIA.minLat + rand() * (LIBERIA.maxLat - LIBERIA.minLat);

/** A ~1 ha-ish irregular field, close to a realistic hand-walked boundary. */
function makePolygon(lng, lat) {
    const d = 0.0012 + rand() * 0.002;
    const j = () => (rand() - 0.5) * 0.0004;
    const ring = [
        [lng + j(), lat + j()],
        [lng + d + j(), lat + j()],
        [lng + d + j(), lat + d + j()],
        [lng + j(), lat + d + j()],
        [lng + j(), lat + j()],
    ];
    return { type: "Polygon", coordinates: [ring] };
}

function makeMultiPolygon(lng, lat) {
    const a = makePolygon(lng, lat);
    const b = makePolygon(lng + 0.01, lat + 0.01);
    return { type: "MultiPolygon", coordinates: [a.coordinates, b.coordinates] };
}

function makeDataset({ farms = 1200, farmersPerFarm = 3 } = {}) {
    const farmerCount = Math.ceil(farms / farmersPerFarm);
    const farmers = Array.from({ length: farmerCount }, (_, i) => ({
        id: `farmer-${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        region: pick(COUNTIES),
        district: pick(DISTRICTS),
    }));

    const out = [];
    for (let i = 0; i < farms; i++) {
        const farmer = farmers[i % farmerCount];
        const kind = pick(GEOMETRY_KINDS);
        const lng = randLng();
        const lat = randLat();

        let location = null;
        if (kind === "polygon") location = makePolygon(lng, lat);
        else if (kind === "multipolygon") location = makeMultiPolygon(lng, lat);
        else if (kind === "point") location = { type: "Point", coordinates: [lng, lat] };

        // Assessment state: ~55% assessed, ~10% stale (>180d), ~35% never.
        const roll = rand();
        let riskLevel = "Low"; // the DB default, exactly as Postgres would store it
        let lastRiskAssessmentDate = null;
        if (roll < 0.55) {
            riskLevel = pick(["Low", "Low", "Medium", "High"]);
            lastRiskAssessmentDate = new Date(Date.now() - Math.floor(rand() * 120) * 864e5).toISOString();
        } else if (roll < 0.65) {
            riskLevel = pick(["Low", "Medium", "High"]);
            lastRiskAssessmentDate = new Date(Date.now() - (200 + Math.floor(rand() * 200)) * 864e5).toISOString();
        }

        out.push({
            id: `farm-${String(i).padStart(5, "0")}`,
            name: `Farm ${String(i).padStart(5, "0")} ${CROP_TYPES[i % CROP_TYPES.length]}`,
            location,
            riskLevel,
            lastRiskAssessmentDate,
            farmer,
        });
    }
    return out;
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Faithful replica of MapView's pipeline
// ───────────────────────────────────────────────────────────────────────────
const isAssessed = (farm) => Boolean(farm?.lastRiskAssessmentDate);
const effectiveRiskLevel = (farm) => {
    if (!isAssessed(farm)) return null;
    const l = farm?.riskLevel;
    return l === "High" || l === "Medium" || l === "Low" ? l : null;
};
const STALE_AFTER_DAYS = 180;
const isStaleAssessment = (farm) => {
    if (!isAssessed(farm)) return false;
    const age = (Date.now() - new Date(farm.lastRiskAssessmentDate).getTime()) / 864e5;
    return age > STALE_AFTER_DAYS;
};

/** MapView getFarmGeo — real turf centroid, same branch structure. */
function getFarmGeo(farm) {
    const loc = farm.location;
    if (!loc || !loc.coordinates) return null;
    try {
        if (loc.type === "Polygon") {
            const ring = loc.coordinates[0].map(([lng, lat]) => [lat, lng]);
            const c = centroid(loc);
            return { farm, center: [c.geometry.coordinates[1], c.geometry.coordinates[0]], rings: [ring] };
        }
        if (loc.type === "MultiPolygon") {
            const rings = (loc.coordinates || []).map((p) => p[0].map(([lng, lat]) => [lat, lng])).filter((r) => r.length);
            if (!rings.length) return null;
            const c = centroid(loc);
            return { farm, center: [c.geometry.coordinates[1], c.geometry.coordinates[0]], rings };
        }
        if (loc.type === "Point") {
            return { farm, center: [loc.coordinates[1], loc.coordinates[0]], rings: [] };
        }
    } catch {
        return null;
    }
    return null;
}

const makeFilters = (o = {}) => ({
    riskFilter: o.riskFilter ?? "All",
    countyFilter: o.countyFilter ?? "All",
    districtFilter: o.districtFilter ?? "All",
    assessmentFilter: o.assessmentFilter ?? "All",
});

const passesFilters = (farm, f) => {
    const level = effectiveRiskLevel(farm);
    const matchesRisk =
        f.riskFilter === "All" || (f.riskFilter === "Not Assessed" ? !isAssessed(farm) : level === f.riskFilter);
    const matchesCounty = f.countyFilter === "All" || (farm.farmer?.region || "") === f.countyFilter;
    const matchesDistrict = f.districtFilter === "All" || (farm.farmer?.district || "") === f.districtFilter;
    const matchesAssessment =
        f.assessmentFilter === "All" ||
        (f.assessmentFilter === "Assessed" && isAssessed(farm)) ||
        (f.assessmentFilter === "Not Assessed" && !isAssessed(farm)) ||
        (f.assessmentFilter === "Stale" && isStaleAssessment(farm));
    return matchesRisk && matchesCounty && matchesDistrict && matchesAssessment;
};

function farmerGroupsOf(farms) {
    const m = new Map();
    for (const f of farms) {
        const e = m.get(f.farmer.id);
        if (e) e.farms.push(f);
        else m.set(f.farmer.id, { farmer: f.farmer, farms: [f] });
    }
    return [...m.values()];
}

function filteredGroups(groups, term, filters) {
    const t = term.trim().toLowerCase();
    return groups
        .map((g) => ({ ...g, farms: g.farms.filter((f) => passesFilters(f, filters)) }))
        .filter((g) => {
            if (g.farms.length === 0) return false;
            if (!t) return true;
            const farmerName = `${g.farmer.firstName} ${g.farmer.lastName}`.toLowerCase();
            const farmNameMatch = g.farms.some((f) => f.name.toLowerCase().includes(t));
            return farmerName.includes(t) || farmNameMatch;
        });
}

/** MapView visibleGeos: FEATURE_CAP pre-bounds, viewport filter + force-include after. */
function visibleGeosOf(geos, filters, bounds, selectedFarmId) {
    const passed = geos.filter((g) => passesFilters(g.farm, filters));
    if (!bounds) {
        // Mirrors the shipped MapView fix: force-include the selection in the
        // capped (pre-bounds) branch too, not only once bounds are known.
        const capped = passed.slice(0, FEATURE_CAP);
        if (!selectedFarmId) return capped;
        const sel = passed.find((g) => g.farm.id === selectedFarmId);
        if (sel && !capped.includes(sel)) return [sel, ...capped.slice(0, FEATURE_CAP - 1)];
        return capped;
    }
    const inBounds = passed.filter((g) => bounds.contains(g.center));
    if (selectedFarmId) {
        const sel = passed.find((g) => g.farm.id === selectedFarmId);
        if (sel && !inBounds.includes(sel)) inBounds.unshift(sel);
    }
    return inBounds;
}

const now = () => performance.now();
function timeIt(fn, iterations = 5) {
    const runs = [];
    for (let i = 0; i < iterations; i++) {
        const t0 = now();
        fn();
        runs.push(now() - t0);
    }
    runs.sort((a, b) => a - b);
    return { median: runs[Math.floor(runs.length / 2)], min: runs[0], max: runs[runs.length - 1] };
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Run
// ───────────────────────────────────────────────────────────────────────────
const farms = makeDataset({ farms: 1200, farmersPerFarm: 3 });
const filters = makeFilters();

console.log("=".repeat(78));
console.log("MAP REGISTRY — LOCAL BENCHMARK  (synthetic data, offline, NOT staging)");
console.log("=".repeat(78));
console.log(`dataset            : ${farms.length} farms, ${new Set(farms.map((f) => f.farmer.id)).size} farmers`);
console.log(`assessed           : ${farms.filter(isAssessed).length}`);
console.log(`never assessed     : ${farms.filter((f) => !isAssessed(f)).length}  (all carry riskLevel='Low' from the DB default)`);
console.log(`feature cap        : ${FEATURE_CAP}`);
console.log(`list page          : ${LIST_PAGE}`);
console.log("");

// --- Load: geometry prep for the whole dataset (per-render client work) -----
const geos = [];
const loadT = timeIt(() => {
    geos.length = 0;
    for (const f of farms) {
        const g = getFarmGeo(f);
        if (g) geos.push(g);
    }
});
console.log(`[load] getFarmGeo for ${farms.length} farms -> ${geos.length} mappable`);
console.log(`        median ${loadT.median.toFixed(1)} ms   (min ${loadT.min.toFixed(1)}, max ${loadT.max.toFixed(1)})`);
console.log("");

// --- Load: grouping + first sidebar slice ----------------------------------
const groups = farmerGroupsOf(farms);
const groupT = timeIt(() => farmerGroupsOf(farms));
console.log(`[load] group ${farms.length} farms into ${groups.length} farmers`);
console.log(`        median ${groupT.median.toFixed(1)} ms`);

const initialFilterT = timeIt(() => {
    const fg = filteredGroups(groups, "", filters);
    return fg.slice(0, LIST_PAGE);
});
console.log(`[load] initial sidebar (filter + slice to ${LIST_PAGE} rows)`);
console.log(`        median ${initialFilterT.median.toFixed(1)} ms`);
console.log("");

// --- Selection beyond the cap ----------------------------------------------
// The cap applies to the MAPPABLE array (geos), not to the farm list, so the
// target must be picked by its position in `geos`. Picking by farm index alone
// is misleading: unmappable farms shift the indices and the "target" can land
// inside the first 750 rendered polygons, making the cap look handled when it
// was never exercised.
const targetGeoIndex = geos.findIndex((g, i) => i >= FEATURE_CAP && isAssessed(g.farm));
const target = geos[targetGeoIndex].farm;

console.log("-".repeat(78));
console.log("SELECTION BEYOND THE 750-FEATURE CAP");
console.log("-".repeat(78));
const targetIndex = farms.findIndex((f) => f.id === target.id);
console.log(`target             : ${target.name}  (farm #${targetIndex}, mappable #${targetGeoIndex})`);
console.log(`target farmer      : ${target.farmer.firstName} ${target.farmer.lastName} (${target.farmer.region})`);
console.log(`target mapped      : true`);
console.log(`beyond cap         : ${targetGeoIndex >= FEATURE_CAP} (mappable index ${targetGeoIndex} >= ${FEATURE_CAP})`);
console.log("");

// Step 1: is it findable by search? (search runs over the UNCAPPED list)
const searchTerm = target.name.slice(0, 12); // e.g. "Farm 00912 C"
const searchT = timeIt(() => {
    const fg = filteredGroups(groups, searchTerm, filters);
    return fg.slice(0, LIST_PAGE);
});
const searchHits = filteredGroups(groups, searchTerm, filters);
const foundBySearch = searchHits.some((g) => g.farms.some((f) => f.id === target.id));
console.log(`1. SEARCH "${searchTerm}"`);
console.log(`   matched farmer groups : ${searchHits.length}  (of ${groups.length})`);
console.log(`   target found          : ${foundBySearch ? "YES" : "NO"}`);
console.log(`   search+trade time     : median ${searchT.median.toFixed(2)} ms`);
const inFirstPage = searchHits.slice(0, LIST_PAGE).some((g) => g.farms.some((f) => f.id === target.id));
console.log(`   visible in first ${LIST_PAGE} rows : ${inFirstPage ? "YES" : "NO (use 'Show more')"}`);
console.log("");

// Step 2: sidebar paging reaches it without a search term
let pages = 0;
let reachable = false;
{
    const fg = filteredGroups(groups, "", filters);
    let limit = LIST_PAGE;
    while (limit <= fg.length + LIST_PAGE) {
        pages++;
        const slice = fg.slice(0, limit);
        if (slice.some((g) => g.farms.some((f) => f.id === target.id))) { reachable = true; break; }
        if (limit >= fg.length) break;
        limit += LIST_PAGE;
    }
}
console.log(`2. SIDEBAR PAGING (no search)`);
console.log(`   clickable per-farm button : the button is disabled only when a farm has NO geometry (not because of the cap)`);
console.log(`   reached after ${pages} x "Show ${LIST_PAGE} more" : ${reachable ? "YES" : "NO"}`);
console.log("");

// Step 3: map render — pre-bounds (cap applies) vs post-bounds (viewport)
const preBounds = visibleGeosOf(geos, filters, null, target.id);
const preBoundsHasTarget = preBounds.some((g) => g.farm.id === target.id);console.log(`3. MAP RENDER, BEFORE THE VIEWPORT IS KNOWN (FEATURE_CAP slice applies)`);
console.log(`   polygons/pins rendered : ${preBounds.length}`);
console.log(`   target present         : ${preBoundsHasTarget ? "YES" : "NO  <-- capped out: selection is NOT force-included in this state"}`);
console.log(`   (MapView only force-includes the selection once \`bounds\` is known; until then`);
console.log(`    a farm past the ${FEATURE_CAP}th mappable element is not drawn. The UI does show a`);
console.log(`    truncation notice, and MapController flies to the selection so bounds arrive`);
console.log(`    immediately after mount - see the finding noted in the report.)`);

// A viewport centred on the target, as Leaflet reports after the map mounts.
const c = geos.find((g) => g.farm.id === target.id).center;
const bounds = {
    contains: (pt) => Math.abs(pt[0] - c[0]) < 0.5 && Math.abs(pt[1] - c[1]) < 0.5,
};
const postBoundsT = timeIt(() => visibleGeosOf(geos, filters, bounds, target.id));
const postBounds = visibleGeosOf(geos, filters, bounds, target.id);
console.log(`\n4. MAP RENDER, AFTER THE VIEWPORT IS KNOWN (viewport filter + force-include)`);
console.log(`   polygons/pins rendered : ${postBounds.length}`);
console.log(`   target present         : ${postBounds.some((g) => g.farm.id === target.id) ? "YES" : "NO"}`);
console.log(`   filter+slice time      : median ${postBoundsT.median.toFixed(2)} ms`);

// Force-include must survive even if the viewport is somewhere else entirely.
const farBounds = { contains: (pt) => Math.abs(pt[0] - c[0]) > 0.5 && Math.abs(pt[1] - c[1]) > 0.5 };
const far = visibleGeosOf(geos, filters, farBounds, target.id);
console.log(`   force-included while viewing elsewhere : ${far.some((g) => g.farm.id === target.id) ? "YES" : "NO"} (${far.length} rendered)`);
console.log("");

// --- Filter interaction timings -------------------------------------------
console.log("-".repeat(78));
console.log("FILTER INTERACTION");
console.log("-".repeat(78));
for (const [label, f] of [
    ["risk = High", makeFilters({ riskFilter: "High" })],
    ["assessment = Not Assessed", makeFilters({ assessmentFilter: "Not Assessed" })],
    ["county = Nimba", makeFilters({ countyFilter: "Nimba" })],
    ["county = Nimba + Stale", makeFilters({ countyFilter: "Nimba", assessmentFilter: "Stale" })],
]) {
    const t = timeIt(() => {
        const fg = filteredGroups(groups, "", f);
        fg.slice(0, LIST_PAGE);
        visibleGeosOf(geos, f, null, null);
    });
    const matched = filteredGroups(groups, "", f).reduce((n, g) => n + g.farms.length, 0);
    console.log(`  ${label.padEnd(28)} ${String(matched).padStart(5)} farms   median ${t.median.toFixed(2)} ms`);
}

console.log("");
console.log("=".repeat(78));
console.log("VERDICT (local, synthetic)");
console.log("=".repeat(78));
console.log(`Find beyond cap by search : ${foundBySearch ? "PASS" : "FAIL"}`);
console.log(`Reach by sidebar paging   : ${reachable ? "PASS" : "FAIL"}`);
console.log(`Select + force-include (viewport known) : ${far.some((g) => g.farm.id === target.id) ? "PASS" : "FAIL"}`);
console.log(`Rendered before viewport known : ${preBoundsHasTarget ? "PASS" : "LIMITED - transient gap, see report"}`);

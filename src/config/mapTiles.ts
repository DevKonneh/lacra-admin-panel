// Shared satellite/street tile configuration for every Leaflet map in the
// admin panel (FarmMap, PolygonMapSelector, MapView, SatelliteAnalysis).
//
// WHY THIS FILE EXISTS:
// The free Esri "World_Imagery" satellite source has NO real imagery for
// most of rural Liberia beyond zoom ~18 - tiles above that are a blank
// gray "no data" placeholder (confirmed by direct testing against real
// farm coordinates). Zooming in on Esri just upscales/blurs the same
// zoom-18 pixels; it can never show more real detail, no matter what
// zoom/maxZoom settings are used.
//
// Mapbox Satellite has genuinely higher-resolution coverage for this
// region (real detail through zoom ~20-22, plus @2x retina tiles), and is
// a properly licensed source (unlike scraping Google's internal tile
// endpoint, which isn't appropriate for a government compliance product).
//
// This module auto-detects whether a Mapbox token has been configured:
//   - If VITE_MAPBOX_TOKEN is set        -> use Mapbox Satellite (high-res)
//   - If it is NOT set (default today)   -> fall back to Esri (unchanged
//                                            behavior, so nothing breaks
//                                            for anyone who hasn't added
//                                            a token yet)
//
// To enable high-res satellite imagery: get a free public token at
// https://mapbox.com (Account -> Tokens -> default public token, starts
// with "pk.") and set VITE_MAPBOX_TOKEN in .env (local) / the hosting
// platform's environment variables (production).

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export const HAS_HIGH_RES_SATELLITE = Boolean(MAPBOX_TOKEN);

// Mapbox Satellite (no street labels baked in - we overlay our own labels
// layer below, same pattern as the existing Esri + Esri-labels combo).
// @2x requests genuine retina-density tiles (real extra pixels from
// Mapbox's servers, not client-side upscaling) on devices/browsers that
// support it; Leaflet's default `detectRetina` handles this automatically
// when we pass the {r} placeholder.
const MAPBOX_SATELLITE_TILE = MAPBOX_TOKEN
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}{r}?access_token=${MAPBOX_TOKEN}`
    : '';

// Mapbox's own place-name/boundary labels overlay, styled to sit on top of
// satellite imagery (equivalent role to Esri's "Reference/World_Boundaries"
// labels layer used in the fallback path).
const MAPBOX_LABELS_TILE = MAPBOX_TOKEN
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}{r}?access_token=${MAPBOX_TOKEN}`
    : '';

// IMPORTANT: Mapbox raster tiles are natively 512x512px, while Leaflet (and
// Esri) default to 256x256px tiles. Per Mapbox's own integration docs, a
// Leaflet TileLayer consuming Mapbox tiles MUST set tileSize={512} AND
// zoomOffset={-1} together, or the imagery renders at the wrong scale and
// zoom levels are off by one (tiles appear zoomed-in/cropped incorrectly).
// Esri/street layers use the standard 256px tile grid, so these stay at
// the Leaflet defaults (tileSize 256, zoomOffset 0) for that fallback path.
export const SATELLITE_TILE_SIZE = HAS_HIGH_RES_SATELLITE ? 512 : 256;
export const SATELLITE_ZOOM_OFFSET = HAS_HIGH_RES_SATELLITE ? -1 : 0;

export const STREET_TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const STREET_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const ESRI_SATELLITE_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_SATELLITE_LABELS_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

// Primary satellite imagery tile URL + attribution, resolved once here so
// every map component stays in sync automatically.
export const SATELLITE_TILE = HAS_HIGH_RES_SATELLITE ? MAPBOX_SATELLITE_TILE : ESRI_SATELLITE_TILE;
export const SATELLITE_LABELS_TILE = HAS_HIGH_RES_SATELLITE ? MAPBOX_LABELS_TILE : ESRI_SATELLITE_LABELS_TILE;
export const SATELLITE_ATTRIBUTION = HAS_HIGH_RES_SATELLITE
    ? '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.maxar.com/">Maxar</a>'
    : 'Tiles &copy; Esri';

// Real usable zoom before tiles run out of native detail.
// - Esri: confirmed (by direct tile testing) to return a flat blank/gray
//   "no data" placeholder above zoom 18 for this region - genuinely
//   unusable past that point.
// - Mapbox: confirmed (by testing + edge-sharpness measurement) to return
//   real, correctly-rendered imagery through at least zoom 19 for both
//   coastal and rural Liberia coordinates - a large practical improvement
//   over Esri's blank tiles. Detail does get progressively softer beyond
//   ~19 (consistent with graceful server-side upsampling for this region's
//   underlying imagery, not literally more true pixels), so 19 is set as
//   the "native" ceiling and the map is allowed to zoom a bit further
//   (smoothly upsampled, same as any map provider does past its native
//   resolution) rather than hitting a hard blank wall like Esri did.
export const SATELLITE_MAX_NATIVE_ZOOM = HAS_HIGH_RES_SATELLITE ? 19 : 18;
// Absolute zoom the map UI allows the user to reach (Leaflet upscales the
// last native tile past this point, which is why we don't want it too far
// above SATELLITE_MAX_NATIVE_ZOOM for the Esri fallback).
export const SATELLITE_MAX_ZOOM = HAS_HIGH_RES_SATELLITE ? 21 : 20;
// Used when auto-fitting a map to a farm boundary/point - keeps the
// initial view on real imagery instead of immediately punching in past
// where genuine detail runs out.
export const SATELLITE_MAX_AUTO_FIT_ZOOM = SATELLITE_MAX_NATIVE_ZOOM;

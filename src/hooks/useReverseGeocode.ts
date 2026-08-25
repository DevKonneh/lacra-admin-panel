import { useEffect, useRef, useState } from 'react';

/**
 * Reverse geocoding via OpenStreetMap Nominatim (free, no API key required, CORS-enabled
 * for direct browser fetch - verified working). Used to turn raw hover coordinates on the
 * farm maps into a real, human-readable place name (e.g. "Bakun, Grand Bassa County, Liberia")
 * instead of just showing lat/lng numbers.
 *
 * Nominatim's usage policy caps free requests at ~1/second, so this hook:
 *  - debounces lookups (waits until the cursor pauses before firing a request)
 *  - caches results by rounded lat/lng so re-hovering the same spot doesn't re-fetch
 *  - cancels any in-flight/pending lookup when the coordinate changes again
 */

export interface ReverseGeocodeResult {
    label: string; // short, human readable (e.g. "Bakun, Grand Bassa County")
    displayName: string; // full Nominatim display_name
    raw: any;
}

// Module-level cache shared across all map instances/components on the page.
const geocodeCache = new Map<string, ReverseGeocodeResult | null>();

const DEBOUNCE_MS = 700;
// ~4 decimal places is already sub-11m precision - plenty for a "nearest place" lookup,
// and keeps the cache key stable enough to get real cache hits while hovering around.
const cacheKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

function buildLabel(address: Record<string, any> | undefined, displayName: string): string {
    if (!address) return displayName;
    const place = address.village || address.town || address.city || address.hamlet || address.suburb || address.county;
    const region = address.state || address.region;
    const country = address.country;
    const parts = [place, region, country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : displayName;
}

/**
 * @param latlng current hover coordinate ([lat, lng]) or null when the cursor has left the map
 * @returns { result, loading } - result is null while nothing has resolved yet
 */
export function useReverseGeocode(latlng: [number, number] | null) {
    const [result, setResult] = useState<ReverseGeocodeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();

        if (!latlng) {
            setLoading(false);
            return;
        }

        const [lat, lng] = latlng;
        const key = cacheKey(lat, lng);

        if (geocodeCache.has(key)) {
            setResult(geocodeCache.get(key) || null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const myRequestId = ++requestIdRef.current;

        debounceRef.current = setTimeout(async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
                const resp = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
                if (!resp.ok) throw new Error(`Nominatim ${resp.status}`);
                const data = await resp.json();
                const parsed: ReverseGeocodeResult | null = data && data.display_name
                    ? { label: buildLabel(data.address, data.display_name), displayName: data.display_name, raw: data }
                    : null;
                geocodeCache.set(key, parsed);
                // Only apply if this is still the latest request for the latest hover position
                if (myRequestId === requestIdRef.current) {
                    setResult(parsed);
                    setLoading(false);
                }
            } catch (err: any) {
                if (err?.name !== 'AbortError') {
                    geocodeCache.set(key, null);
                    if (myRequestId === requestIdRef.current) {
                        setResult(null);
                        setLoading(false);
                    }
                }
            }
        }, DEBOUNCE_MS);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [latlng ? latlng[0].toFixed(4) : null, latlng ? latlng[1].toFixed(4) : null]);

    return { result, loading };
}

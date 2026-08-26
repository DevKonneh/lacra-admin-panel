// The backend API base URL, e.g. "https://lacra-eudr-backend.onrender.com/api"
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://lacra-eudr-backend.onrender.com/api';

// Derive the backend origin (no trailing "/api") so we can prefix relative
// file paths like "/uploads/xyz.jpg" that the backend returns.
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

/**
 * Resolves a photo/file path returned by the backend into a fully-qualified
 * URL that can be used directly in an <img src="..."> tag.
 *
 * The backend stores uploaded files on disk and returns relative paths such
 * as "/uploads/farmerPhoto-123.jpg". Since the admin panel is deployed on a
 * different origin (lacra-admin.onrender.com) than the backend
 * (lacra-eudr-backend.onrender.com), these relative paths must be prefixed
 * with the backend's origin, otherwise the browser tries to load them from
 * the admin panel's own domain and gets a 404.
 *
 * Already-absolute URLs (http/https) and data URIs are returned unchanged.
 */
export function resolveFileUrl(path: string | null | undefined): string | undefined {
    if (!path) return undefined;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
    }
    // Ensure exactly one slash between origin and path
    return `${BACKEND_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

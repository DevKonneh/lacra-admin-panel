// Shared validation helpers used across every step of the LACRA
// registration wizard, so format rules (email, phone, dates, numbers)
// stay consistent regardless of which category's step component calls
// them.

export function isValidEmail(value: string): boolean {
    if (!value) return true; // emptiness is handled separately by "required" checks
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Phone numbers are always entered via the PhoneInput component, which
// permanently prefixes the value with Liberia's country code (+231) and
// caps the local portion at 9 digits, so a valid number here is always
// exactly "+231" followed by 8-9 digits - anything else (too short, too
// long, or missing/altered prefix) is rejected.
export function isValidPhone(value: string): boolean {
    if (!value) return true;
    const cleaned = value.replace(/[\s-()]/g, '');
    return /^\+231\d{8,9}$/.test(cleaned);
}

export function isValidDate(value: string): boolean {
    if (!value) return true;
    const d = new Date(value);
    return !Number.isNaN(d.getTime());
}

export function isPositiveNumber(value: string): boolean {
    if (!value) return true;
    const n = Number(value);
    return !Number.isNaN(n) && n >= 0;
}

// Liberian National ID / Passport - accepts common alphanumeric ID
// formats of reasonable length rather than a single rigid pattern, since
// national ID and passport numbering schemes both need to be supported.
export function isValidIdNumber(value: string): boolean {
    if (!value) return true;
    return /^[A-Za-z0-9-]{4,20}$/.test(value.trim());
}

export function isNonEmpty(value: string | undefined | null): boolean {
    return !!value && value.trim() !== '';
}

export type FieldErrors = Record<string, string>;

export function hasErrors(errors: FieldErrors): boolean {
    return Object.keys(errors).length > 0;
}

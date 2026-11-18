/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Core green kept unchanged — it already passes WCAG AA against
                // white (5.46:1) and is a close match to the green used in the
                // official LACRA seal, so it remains the primary action color.
                'brand-green': '#0b7a33',
                'brand-green-hover': '#16a34a',
                // New: a deep forest variant of the primary green, derived by
                // lowering lightness on the same hue (not a different green).
                // Used for dark hero/gradient backgrounds and strong accents
                // where brand-green itself would feel too "flat corporate".
                'brand-green-deep': '#07491f',
                'brand-bg': '#f6fbf7',
                'brand-card': '#ffffff',
                'brand-text': '#0f172a',
                'brand-muted': '#475569',
                'brand-border': '#dbe7dd',

                // --- Official LACRA seal palette (brown / gold) ---
                // Extracted directly from the LACRA seal artwork via dominant-
                // color analysis, then verified for WCAG contrast before use.
                // Brown (seal base #512d0d) has excellent contrast (12.13:1)
                // and is used as the secondary brand ink color — headings,
                // the Login hero treatment, footer/ink text, strong accents.
                'brand-brown': '#512d0d',
                // Lighter brown for icon strokes / mid-tone accents. NOTE:
                // contrast vs white is only ~3.9:1 — fine for large text,
                // icons and borders, but not for small body copy.
                'brand-brown-light': '#b0621c',
                // Very light brown tint for section/card backgrounds.
                'brand-brown-soft': '#f1e5da',

                // Gold (seal base #e3b100) FAILS WCAG contrast even when
                // deepened (max ~3.07:1) — by design this is DECORATIVE ONLY:
                // borders, icon fills, dividers, badges/chips. Never use for
                // body text or on its own as a button background with text.
                'brand-gold': '#e3b100',
                'brand-gold-soft': '#faf6e5',
            },
            boxShadow: {
                // Lightened from the previous heavy '0 10px 30px rgba(15,23,42,.08)'
                // per the design-system pass: cards should read as flat/bordered,
                // not floating. Kept as a token (not removed) so existing
                // `shadow-card` usages still resolve, just much more subtly.
                'card': '0 1px 2px rgba(15, 23, 42, .06)',
                // New: slightly more present hover depth for interactive cards
                // (StatCards, list rows) — still restrained, not a return to
                // the old heavy floating-card look.
                'card-hover': '0 6px 16px rgba(15, 23, 42, .10)',
            },
            borderRadius: {
                // Scaled back from 16px/14px (larger than Tailwind defaults) to
                // values close to Tailwind's own lg/xl so containers read as
                // "neatly squared" rather than pill-like/excessively rounded.
                'xl': '12px',
                'lg': '10px',
            },
            fontFamily: {
                'sans': ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
            }
        },
    },
    plugins: [],
}

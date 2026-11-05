/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand-green': '#0b7a33',
                'brand-green-hover': '#16a34a',
                'brand-bg': '#f6fbf7',
                'brand-card': '#ffffff',
                'brand-text': '#0f172a',
                'brand-muted': '#475569',
                'brand-border': '#dbe7dd',
            },
            boxShadow: {
                // Lightened from the previous heavy '0 10px 30px rgba(15,23,42,.08)'
                // per the design-system pass: cards should read as flat/bordered,
                // not floating. Kept as a token (not removed) so existing
                // `shadow-card` usages still resolve, just much more subtly.
                'card': '0 1px 2px rgba(15, 23, 42, .06)',
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

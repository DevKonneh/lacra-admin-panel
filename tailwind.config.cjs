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
                'card': '0 10px 30px rgba(15, 23, 42, .08)',
            },
            borderRadius: {
                'xl': '16px',
                'lg': '14px',
            },
            fontFamily: {
                'sans': ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
            }
        },
    },
    plugins: [],
}

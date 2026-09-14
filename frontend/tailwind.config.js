/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "375px",
      },
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surfaceBorder: "rgb(var(--surface-border) / <alpha-value>)",
        surfaceElevated: "rgb(var(--surface-elevated) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        cardBg: "rgb(var(--card-bg) / <alpha-value>)",
        inputBg: "rgb(var(--input-bg) / <alpha-value>)",
        inputBorder: "rgb(var(--input-border) / <alpha-value>)",
        badgeBg: "rgb(var(--badge-bg) / <alpha-value>)",
        badgeText: "rgb(var(--badge-text) / <alpha-value>)",
        brand: {
          50:  "#EEF2FF",
          100: "#E0E7FF",
          400: "#818CF8",
          500: "#6366F1", // Indigo — modern fintech (Upstox/Dhan/Zerodha-inspired)
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
        },
        redwood: {
          50:  "var(--redwood-50)",
          100: "var(--redwood-100)",
          200: "var(--redwood-200)",
          500: "var(--redwood-500)",
          600: "var(--redwood-600)",
          700: "var(--redwood-700)",
          bg:     "var(--redwood-bg)",
          border: "var(--redwood-border)",
          text:   "var(--redwood-text)",
        },
        tierConfirmed:  "#10B981",
        tierUnexplained: "#F59E0B",
        tierUncertain:  "#991B1B",
      },
    },
  },
  plugins: [],
};

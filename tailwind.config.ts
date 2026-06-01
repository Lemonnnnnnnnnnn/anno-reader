import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#f6f6f6", dark: "#1a1a1a" },
        surface: { DEFAULT: "#ffffff", dark: "#242424" },
        text: { DEFAULT: "#0f0f0f", dark: "#e5e5e5" },
        "text-secondary": { DEFAULT: "#6b7280", dark: "#a3a3a3" },
        "text-muted": { DEFAULT: "#9ca3af", dark: "#737373" },
        border: { DEFAULT: "#e5e5e5", dark: "#404040" },
        accent: { DEFAULT: "#374151", dark: "#60a5fa" },
        "accent-hover": { DEFAULT: "#1f2937", dark: "#93c5fd" },
        error: { DEFAULT: "#dc2626", dark: "#ef4444" },
        "error-bg": { DEFAULT: "#fef2f2", dark: "#451a1a" },
      },
      fontFamily: {
        serif: [
          "Literata",
          "Georgia",
          "Iowan Old Style",
          "Palatino Linotype",
          "Noto Serif",
          "serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;

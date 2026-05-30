import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f6f6f6",
        surface: "#ffffff",
        text: "#0f0f0f",
        "text-secondary": "#6b7280",
        "text-muted": "#9ca3af",
        border: "#e5e5e5",
        accent: "#374151",
        "accent-hover": "#1f2937",
        error: "#dc2626",
        "error-bg": "#fef2f2",
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

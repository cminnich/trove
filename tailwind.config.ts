import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Zen Meditative Palette
        zen: {
          void: "var(--zen-void)",
          "void-subtle": "var(--zen-void-subtle)",
          "glow-primary": "var(--zen-glow-primary)",
          "glow-secondary": "var(--zen-glow-secondary)",
          "glow-tertiary": "var(--zen-glow-tertiary)",
          "nebula-warm": "var(--zen-nebula-warm)",
          "nebula-cool": "var(--zen-nebula-cool)",
          "nebula-rose": "var(--zen-nebula-rose)",
          "text-reflective": "var(--zen-text-reflective)",
          "text-data": "var(--zen-text-data)",
          "text-muted": "var(--zen-text-muted)",
        },
      },
      fontFamily: {
        // Elegant serif for reflective moments
        reflective: ["Cormorant Garamond", "Georgia", "Times New Roman", "serif"],
        // Precise monospace for AI/data moments
        data: ["JetBrains Mono", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      animation: {
        breathe: "breathe 4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        drift: "drift 20s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

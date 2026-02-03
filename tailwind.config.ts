import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
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
        void: "var(--color-void)",
        "slate-deep": "var(--color-slate-deep)",
        "open-green": "var(--color-open-green)",
      },
      fontFamily: {
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        hard: "2px 2px 0 rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
} satisfies Config;

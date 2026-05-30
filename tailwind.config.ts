import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        card: "hsl(var(--card))",
        accent: "hsl(var(--accent))",
        destructive: "hsl(var(--destructive))",
        gilt: "hsl(var(--gilt))",
        ink: {
          muted: "hsl(var(--ink-muted))",
        },
        paper: "hsl(var(--paper))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        ring: "hsl(var(--ring))",
      },
      boxShadow: {
        book: "0 12px 28px hsl(28 28% 22% / 0.18)",
        page: "0 24px 70px hsl(28 28% 22% / 0.14)",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
        "serif-body": ["Iowan Old Style", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

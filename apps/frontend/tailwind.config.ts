import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--background)",
        panel: "var(--panel)",
        elevated: "var(--elevated)",
        line: "var(--line)",
        foreground: "var(--foreground)",
        muted: "var(--muted)"
      },
      boxShadow: {
        glow: "0 20px 70px rgba(16, 185, 129, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;

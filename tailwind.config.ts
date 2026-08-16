import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design language adapted from docs/Drape Styling App.html.
        ink: "#201e1d",
        paper: "#e4e2e0",
        panel: "#f2f1ef",
        accent: "#ec3013",
        muted: "#605d5d",
        line: "#201e1d",
      },
      fontFamily: {
        display: ["var(--font-archivo)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

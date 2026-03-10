import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-lora)", "Georgia", "serif"],
      },
      colors: {
        ink: { DEFAULT: "#1a1a2e", light: "#16213e" },
        accent: { DEFAULT: "#e94560", light: "#ff6b6b" },
        paper: "#f8f5f0",
        mint: "#a8e6cf",
      },
    },
  },
  plugins: [],
};
export default config;

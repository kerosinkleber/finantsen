import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: { brand: { DEFAULT: "#0f766e", dark: "#115e59", light: "#ccfbf1" } },
    },
  },
  plugins: [],
} satisfies Config;

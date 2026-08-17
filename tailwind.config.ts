import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink900: "#181a1b",
          ink500: "#6b7280",
          ink100: "#f4f4f5",
          black: "#000000",
          white: "#ffffff",
          orange: "#ff3e00",
          orangePress: "#d63500",
          hairline: "#e4e4e7",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xs: "2px",
        sm: "8px",
      },
    },
  },
  plugins: [],
};

export default config;

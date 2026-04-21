import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        panel: "#ffffff",
        canvas: "#f6f8f7",
        line: "#dfe7e2",
        action: "#0f8b6f",
        actionDark: "#0a614e",
        warn: "#b7791f",
        danger: "#c2413b"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(23, 33, 28, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;


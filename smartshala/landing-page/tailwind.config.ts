import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"]
      },
      colors: {
        ink: "#101828",
        muted: "#667085",
        canvas: "#F6F8FB",
        line: "#E4E7EC",
        brand: {
          blue: "#2456E6",
          navy: "#0F2557",
          mint: "#11B981",
          amber: "#F59E0B"
        }
      },
      boxShadow: {
        soft: "0 18px 60px -30px rgba(15, 37, 87, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter"',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Apple palette
        apple: {
          bg: "#f5f5f7",
          bgDark: "#000000",
          text: "#1d1d1f",
          textSecondary: "#6e6e73",
          textTertiary: "#86868b",
          blue: "#0071e3",
          blueHover: "#0077ed",
          green: "#34c759",
          orange: "#ff9500",
          red: "#ff3b30",
          purple: "#af52de",
          gray: {
            50: "#fbfbfd",
            100: "#f5f5f7",
            200: "#e8e8ed",
            300: "#d2d2d7",
            400: "#b0b0b5",
            500: "#86868b",
            600: "#6e6e73",
            700: "#424245",
            800: "#333336",
            900: "#1d1d1f",
          },
          card: "rgba(255, 255, 255, 0.72)",
          cardBorder: "rgba(0, 0, 0, 0.04)",
        },
        // Keep old colors for backward compat
        ink: "#1d1d1f",
        panel: "#ffffff",
        canvas: "#f5f5f7",
        line: "#e8e8ed",
        action: "#0071e3",
        actionDark: "#0077ed",
        warn: "#ff9500",
        danger: "#ff3b30",
      },
      borderRadius: {
        "apple": "12px",
        "apple-lg": "16px",
        "apple-xl": "20px",
        "apple-2xl": "24px",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04)",
        "apple-sm": "0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.03)",
        "apple": "0 2px 8px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06)",
        "apple-lg": "0 4px 12px rgba(0, 0, 0, 0.05), 0 12px 32px rgba(0, 0, 0, 0.08)",
        "apple-hover": "0 4px 16px rgba(0, 0, 0, 0.06), 0 16px 40px rgba(0, 0, 0, 0.1)",
      },
      backdropBlur: {
        "apple": "20px",
        "apple-lg": "40px",
        "apple-xl": "72px",
      },
      transitionTimingFunction: {
        "apple": "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "slide-up": "slideUp 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

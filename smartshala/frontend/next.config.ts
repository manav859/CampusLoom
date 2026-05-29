import type { NextConfig } from "next";

function cspSourceFromUrl(value?: string) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, "");
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const apiSources = [
      cspSourceFromUrl(process.env.NEXT_PUBLIC_API_URL),
      cspSourceFromUrl(process.env.NEXT_PUBLIC_API_BASE_URL)
    ].filter((source): source is string => Boolean(source));
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      `connect-src ${["'self'", ...apiSources].join(" ")}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }
        ]
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  }
};

export default nextConfig;

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
    // Razorpay Checkout loads its script from checkout.razorpay.com, renders the
    // payment window in an api.razorpay.com iframe, and calls its own hosts for
    // bank logos and telemetry. Miss any one of these and the popup never opens.
    const razorpay = "https://*.razorpay.com";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${razorpay}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      `img-src 'self' data: blob: ${razorpay}`,
      `connect-src ${["'self'", ...apiSources, razorpay].join(" ")}`,
      `frame-src 'self' ${razorpay}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      `form-action 'self' ${razorpay}`
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
  async redirects() {
    // "Subscription" became "Billing"; keep old bookmarks and the tenant-prefixed
    // form working. These run before the tenant middleware rewrite.
    return [
      { source: "/subscription", destination: "/billing", permanent: false },
      { source: "/:schoolId([A-Z0-9]{8})/subscription", destination: "/:schoolId/billing", permanent: false }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com", // if using Cloudflare R2
        pathname: "/**"
      }
    ]
  }
};

export default nextConfig;

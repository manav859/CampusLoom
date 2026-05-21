import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartShala",
  description: "School ERP for attendance, fees, analytics, and WhatsApp reporting"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-[var(--surface-50)] font-sans text-[var(--ink-900)] antialiased">
        {children}
      </body>
    </html>
  );
}

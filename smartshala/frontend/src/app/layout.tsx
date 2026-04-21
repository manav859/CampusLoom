import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartShala",
  description: "School ERP for attendance, fees, analytics, and WhatsApp reporting"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


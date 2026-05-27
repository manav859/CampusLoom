import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartShala | School ERP Platform",
  description: "SmartShala helps schools manage academics, attendance, fees, communication, and reporting from one modern workspace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

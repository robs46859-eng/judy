import type { Metadata } from "next";
import "./globals.css";

// NOTE: the Outfit font is loaded via the CSS @import in globals.css at
// runtime (with a system-font fallback), instead of next/font/google —
// which required outbound internet access *at build time* and broke
// builds on restricted hosts.

export const metadata: Metadata = {
  title: "Judy App — Be Gay While Away",
  description: "Your ultimate LGBTQ+ travel companion. Plan trips, manage budgets, get AI-powered suggestions, and let Travel Daddy guide your journey.",
  keywords: "travel, LGBTQ, trip planner, itinerary, budget, travel companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

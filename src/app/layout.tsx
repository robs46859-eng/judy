import type { Metadata } from "next";
import "./globals.css";

// NOTE: the Outfit font is loaded via the CSS @import in globals.css at
// runtime (with a system-font fallback), instead of next/font/google —
// which required outbound internet access *at build time* and broke
// builds on restricted hosts.

export const metadata: Metadata = {
  title: "Judy App — Be Gay While Away",
  description:
    "The LGBTQ+ travel companion for gay travelers. Plan trips, auto-budget, discover queer-friendly experiences, translate on the go, and let Judy Pierre — your purple rhino AI travel guide — plan your journey.",
  keywords:
    "gay travel, LGBTQ travel, queer travel planner, gay friendly destinations, gay travel guide, AI travel avatar, travel translation, gay itinerary planner, gay travel budget, LGBTQ trip planner",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Global 35mm film-emulation overlays (see globals.css) */}
        <div className="film-grade" aria-hidden />
        <div className="film-vignette" aria-hidden />
        <div className="film-grain" aria-hidden />
      </body>
    </html>
  );
}

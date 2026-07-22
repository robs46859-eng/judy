import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}

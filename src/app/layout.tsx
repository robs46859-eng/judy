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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var saved=localStorage.getItem('judy-theme');var theme=saved==='light'||saved==='dark'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',theme)}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

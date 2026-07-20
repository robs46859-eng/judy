import React from "react";
import Link from "next/link";
import { ArrowLeft, PlaneTakeoff, Shield, Dog, Baby, Car, Banknote } from "lucide-react";

export const metadata = {
  title: "Judy - Travel Affiliate Links",
  description: "Helpful links and services recommended by Judy.",
};

const affiliates = [
  { name: "Flight Info", url: "https://www.flightaware.com/", icon: <PlaneTakeoff size={24} /> },
  { name: "Travel Insurance", url: "https://www.travelers.com/", icon: <Shield size={24} /> },
  { name: "Pet Sitter", url: "https://www.rover.com", icon: <Dog size={24} /> },
  { name: "Child Sitter", url: "https://www.care.com", icon: <Baby size={24} /> },
  { name: "Transportation", url: "https://www.uber.com", icon: <Car size={24} /> },
  { name: "Currency Exchange", url: "https://www.westernunion.com", icon: <Banknote size={24} /> },
];

export default function AffiliatesPage() {
  return (
    <div className="judy-immersive-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '2rem' }}>
      <div className="bg-skyline" />
      <div className="bg-gradient-overlay" />
      
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <header style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
          <Link href="/dashboard" className="icon-button" style={{ textDecoration: 'none', background: 'var(--panel-bg)', padding: '0.75rem', borderRadius: '50%' }}>
            <ArrowLeft size={24} />
          </Link>
          <h1 style={{ fontSize: '2rem', margin: 0, color: 'var(--text-primary)' }}>Recommended Services</h1>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {affiliates.map((aff, i) => (
            <a
              key={i}
              href={aff.url}
              target="_blank"
              rel="noreferrer"
              className="widget"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}
            >
              <div style={{ color: 'var(--accent-color)' }}>
                {aff.icon}
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {aff.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

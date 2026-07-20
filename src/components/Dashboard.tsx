"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Sun,
  Moon,
  Settings,
  Map,
  Calendar,
  CreditCard,
  Compass,
  Cloud,
  ThermometerSun,
  PlaneTakeoff,
  Shield,
  Dog,
  Baby,
  Car,
  Banknote,
  ChevronDown,
  Timer,
  Eye,
  Mail,
  User,
  Droplets,
  Wind,
  LogOut,
  Upload,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import JudyDock from "./JudyDock";
import ItineraryBuilder from "./ItineraryBuilder";
import BudgetAutoAllocate from "./BudgetAutoAllocate";
import UserProfileModal from "./UserProfileModal";
import ContactFormModal from "./ContactFormModal";
import VoiceSettings from "./VoiceSettings";
import { selectTrip } from "@/lib/dashboard/selectTrip";
import { computeCountdown } from "@/lib/dashboard/countdown";

interface AffiliateLink {
  name: string;
  url: string;
  icon: React.ReactNode;
}

const affiliates: AffiliateLink[] = [
  {
    name: "Flight Info",
    url: "https://www.flightaware.com/",
    icon: <PlaneTakeoff size={16} />,
  },
  {
    name: "Travel Insurance",
    url: "https://www.travelers.com/",
    icon: <Shield size={16} />,
  },
  { name: "Pet Sitter", url: "https://www.rover.com", icon: <Dog size={16} /> },
  {
    name: "Child Sitter",
    url: "https://www.care.com",
    icon: <Baby size={16} />,
  },
  {
    name: "Transportation",
    url: "https://www.uber.com",
    icon: <Car size={16} />,
  },
  {
    name: "Currency Exchange",
    url: "https://www.westernunion.com",
    icon: <Banknote size={16} />,
  },
];

// Weather condition to icon mapping
function getWeatherIcon(condition?: string) {
  if (!condition) return <Cloud size={32} />;
  const c = condition.toLowerCase();
  if (c.includes("rain") || c.includes("drizzle"))
    return <Droplets size={32} />;
  if (c.includes("wind")) return <Wind size={32} />;
  if (c.includes("sun") || c.includes("clear")) return <Sun size={32} />;
  if (c.includes("cloud") || c.includes("overcast")) return <Cloud size={32} />;
  if (c.includes("snow")) return <Cloud size={32} />;
  return <ThermometerSun size={32} />;
}

interface WeatherData {
  temperature?: number;
  condition?: string;
  humidity?: number;
  windSpeed?: number;
  isHistorical: boolean;
  historicalNote?: string;
  daysUntilDeparture?: number | null;
  /** Set when the weather fetch failed — takes precedence in rendering. */
  error?: string;
}

interface DashboardProps {
  userName: string;
  userEmail: string;
  avatarModelUrl?: string;
  avatarAdmin?: boolean;
}

export default function Dashboard({
  userName,
  userEmail,
  avatarModelUrl,
  avatarAdmin = false,
}: DashboardProps) {
  const [theme, setTheme] = useState("light");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [trip, setTrip] = useState<any>(null);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    mins: number;
  } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Modal states
  const [profileOpen, setProfileOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  // Load trip from API
  const loadTrip = useCallback(async () => {
    try {
      const res = await fetch("/api/trips");
      const trips = await res.json();
      setTrip(selectTrip(Array.isArray(trips) ? trips : []));
    } catch {
      /* no trip yet */
    }
  }, []);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  // Fetch real weather data when trip is loaded
  useEffect(() => {
    if (!trip?.destinationLat || !trip?.destinationLng) {
      setWeather(null);
      return;
    }

    const fetchWeather = async () => {
      setWeatherLoading(true);
      try {
        const params = new URLSearchParams({
          lat: trip.destinationLat.toString(),
          lng: trip.destinationLng.toString(),
        });
        if (trip.departureDate) {
          params.set("departureDate", trip.departureDate);
        }

        const res = await fetch(`/api/weather?${params}`);
        const data = await res.json();

        if (!res.ok || data?.error) {
          setWeather({
            isHistorical: false,
            error: data?.error || "Weather is temporarily unavailable.",
          });
          return;
        }

        // Parse the Google Weather API response
        const current = data.current;
        let temperature: number | undefined;
        let condition: string | undefined;
        let humidity: number | undefined;
        let windSpeed: number | undefined;

        if (current) {
          // Google Weather API response structure
          temperature = current.temperature?.degrees;
          condition = current.condition?.description || current.condition?.type;
          humidity = current.humidity?.percent;
          windSpeed = current.wind?.speed?.value;
        }

        setWeather({
          temperature,
          condition,
          humidity,
          windSpeed,
          isHistorical: !!data.historicalNote,
          historicalNote: data.historicalNote,
          daysUntilDeparture: data.daysUntilDeparture,
        });
      } catch {
        setWeather({
          isHistorical: false,
          error:
            "Weather is temporarily unavailable. Showing the last known layout — try again shortly.",
        });
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [trip?.destinationLat, trip?.destinationLng, trip?.departureDate]);

  // Countdown ticker
  useEffect(() => {
    if (!trip?.departureDate) {
      setCountdown(null);
      return;
    }
    setCountdown(computeCountdown(trip.departureDate));
    const interval = setInterval(() => {
      setCountdown(computeCountdown(trip.departureDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [trip?.departureDate]);

  const handleTripCreated = (newTrip: any) => {
    setTrip(newTrip);
    setActiveTab("dashboard");
    loadTrip();
  };

  const navItems = [
    { key: "dashboard", icon: <Map size={24} />, label: "Dashboard" },
    { key: "itinerary", icon: <Calendar size={24} />, label: "Itinerary" },
    { key: "viewer", icon: <Eye size={24} />, label: "Trip Viewer" },
    { key: "budget", icon: <CreditCard size={24} />, label: "Budget" },
    { key: "contact", icon: <Mail size={24} />, label: "Contact" },
    { key: "settings", icon: <Settings size={24} />, label: "Settings" },
  ];

  return (
    <div className="judy-immersive-layout">
      <div className="bg-skyline" />
      <div className="bg-gradient-overlay" />

      {/* Floating Top Nav Header */}
      <header className="immersive-top-header">
        <div className="logo-section">
          <Image
            src="/brand/judy-logo.png"
            alt="Judy"
            width={78}
            height={52}
            className="judy-logo"
            priority
          />
        </div>

        <nav className="immersive-nav-bar">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-item ${activeTab === item.key ? "active" : ""}`}
              aria-current={activeTab === item.key ? "page" : undefined}
              onClick={() => {
                if (item.key === "contact") {
                  setContactOpen(true);
                } else {
                  setActiveTab(item.key);
                }
              }}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="top-actions">
          {avatarAdmin && (
            <a
              className="icon-button"
              href="/admin/avatar"
              title="Avatar Manager"
              aria-label="Open Avatar Manager"
            >
              <Upload size={20} aria-hidden="true" />
            </a>
          )}
          <button
            className="icon-button"
            onClick={() => setProfileOpen(true)}
            title="Profile"
          >
            <User size={20} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            onClick={toggleTheme}
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            className="icon-button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Hero Avatar Stage */}
      <section className="immersive-avatar-stage">
        <JudyDock
          tripContext={trip}
          userName={userName}
          userEmail={userEmail}
          avatarModelUrl={avatarModelUrl}
        />
      </section>

      {/* Scrollable Content Pane */}
      {activeTab !== "dashboard" && (
        <section className="immersive-dashboard-content">
          <main className="content-area">

          {activeTab === "itinerary" && (
            <div className="full-width-content">
              <ItineraryBuilder onTripCreated={handleTripCreated} />
            </div>
          )}

          {activeTab === "viewer" && (
            <div className="full-width-content">
              {trip ? (
                <div className="viewer-placeholder">
                  <div
                    className="widget"
                    style={{ maxWidth: 800, margin: "0 auto" }}
                  >
                    <div className="widget-header">
                      <Eye size={20} /> Trip Viewer —{" "}
                      {trip.name || trip.destinationName}
                    </div>
                    <div className="widget-content">
                      <div className="stat-row">
                        <span>Destination</span>
                        <span className="stat-value">
                          {trip.destinationName}
                        </span>
                      </div>
                      <div className="stat-row">
                        <span>Departure</span>
                        <span className="stat-value">
                          {new Date(trip.departureDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="stat-row">
                        <span>Return</span>
                        <span className="stat-value">
                          {new Date(trip.returnDate).toLocaleDateString()}
                        </span>
                      </div>
                      {trip.notes && (
                        <div className="stat-row">
                          <span>Notes</span>
                          <span className="stat-value">{trip.notes}</span>
                        </div>
                      )}
                    </div>
                    {trip.itineraryItems?.length > 0 && (
                      <div style={{ marginTop: "1rem" }}>
                        <div
                          className="widget-header"
                          style={{ marginBottom: "0.75rem" }}
                        >
                          <Calendar size={18} /> Itinerary (
                          {trip.itineraryItems.length} items)
                        </div>
                        {trip.itineraryItems.map((item: any, idx: number) => (
                          <div key={item.id || idx} className="stat-row">
                            <span>
                              <span className="item-time">
                                {item.time || "—"}
                              </span>{" "}
                              {item.title}
                            </span>
                            <span className="stat-value">
                              {item.cost ? `$${item.cost}` : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="widget"
                  style={{
                    maxWidth: 600,
                    margin: "2rem auto",
                    textAlign: "center",
                  }}
                >
                  <div className="widget-header">
                    <Eye size={20} /> Trip Viewer
                  </div>
                  <div className="widget-content">
                    <p>Create a trip first to view it here.</p>
                    <button
                      className="widget-action-btn"
                      onClick={() => setActiveTab("itinerary")}
                    >
                      Build Itinerary
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "budget" && trip && (
            <div className="full-width-content">
              <div className="budget-page">
                <h2>
                  <CreditCard size={24} /> Budget Breakdown
                </h2>
                <div className="budget-summary-grid">
                  <div className="budget-card total">
                    <span>Total Budget</span>
                    <strong>${trip.totalBudget?.toFixed(2)}</strong>
                  </div>
                  <div className="budget-card">
                    <span>Airfare</span>
                    <strong>${trip.airfareCost?.toFixed(2)}</strong>
                  </div>
                  <div className="budget-card">
                    <span>Hotel</span>
                    <strong>${trip.hotelCost?.toFixed(2)}</strong>
                  </div>
                  <div className="budget-card accent">
                    <span>Spending Budget</span>
                    <strong>${trip.spendingBudget?.toFixed(2)}</strong>
                  </div>
                </div>

                <BudgetAutoAllocate tripId={trip.id} onApplied={loadTrip} />

                {trip.budgetItems?.length > 0 && (
                  <div className="budget-allocations">
                    <h3>Allocations</h3>
                    {trip.budgetItems.map((bi: any) => (
                      <div key={bi.id} className="allocation-row">
                        <span className="alloc-label">{bi.label}</span>
                        <div className="alloc-bar-container">
                          <div
                            className="alloc-bar"
                            style={{
                              width: `${(bi.amount / trip.spendingBudget) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="alloc-amount">
                          ${bi.amount?.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "budget" && !trip && (
            <div className="full-width-content">
              <div
                className="widget"
                style={{
                  maxWidth: 600,
                  margin: "2rem auto",
                  textAlign: "center",
                }}
              >
                <div className="widget-header">
                  <CreditCard size={20} /> Budget
                </div>
                <div className="widget-content">
                  <p>Create a trip first to see your budget breakdown.</p>
                  <button
                    className="widget-action-btn"
                    onClick={() => setActiveTab("itinerary")}
                  >
                    Build Itinerary
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="full-width-content">
              <div className="settings-page">
                <h2>
                  <Settings size={24} /> Settings
                </h2>
                <div className="settings-group">
                  <label>Theme</label>
                  <button className="theme-toggle-btn" onClick={toggleTheme}>
                    {theme === "dark" ? (
                      <>
                        <Sun size={16} /> Switch to Light Mode
                      </>
                    ) : (
                      <>
                        <Moon size={16} /> Switch to Dark Mode
                      </>
                    )}
                  </button>
                </div>
                <VoiceSettings />
              </div>
            </div>
          )}
        </main>
        </section>
      )}

      {/* Bottom Global Shell */}
      <div className="bottom-global-shell">
        <div className="bottom-shell-icons">
          {trip && countdown && (
            <div className="bottom-shell-icon" title="Countdown to departure">
              <Timer size={20} />
              <span>{countdown.days}d {countdown.hours}h</span>
            </div>
          )}
          {trip && weather && !weatherLoading && !weather.error && (
            <div className="bottom-shell-icon" title={weather.condition || "Weather"}>
              {getWeatherIcon(weather.condition)}
              {weather.temperature !== undefined && (
                <span>{Math.round(weather.temperature)}°F</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <UserProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        userName={userName}
        userEmail={userEmail}
      />
      <ContactFormModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </div>
  );
}

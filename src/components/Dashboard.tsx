"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Sun, Moon, Globe, Settings, Map, Calendar,
  CreditCard, Compass, Cloud, ThermometerSun,
  PlaneTakeoff, Shield, Dog, Baby, Car, Banknote,
  ChevronDown, Timer, Utensils, Music, Mountain, Sparkles,
  Home as HomeIcon, Eye, Camera, Mail, User, Droplets, Wind
} from "lucide-react";
import TravelDaddy from "./TravelDaddy";
import ItineraryBuilder from "./ItineraryBuilder";
import PhotoAlbumEditor from "./PhotoAlbumEditor";
import UserProfileModal from "./UserProfileModal";
import ContactFormModal from "./ContactFormModal";

interface AffiliateLink {
  name: string;
  url: string;
  icon: React.ReactNode;
}

const affiliates: AffiliateLink[] = [
  { name: "Flight Info", url: "https://www.flightaware.com/", icon: <PlaneTakeoff size={16} /> },
  { name: "Travel Insurance", url: "https://www.travelers.com/", icon: <Shield size={16} /> },
  { name: "Pet Sitter", url: "https://www.rover.com", icon: <Dog size={16} /> },
  { name: "Child Sitter", url: "https://www.care.com", icon: <Baby size={16} /> },
  { name: "Transportation", url: "https://www.uber.com", icon: <Car size={16} /> },
  { name: "Currency Exchange", url: "https://www.westernunion.com", icon: <Banknote size={16} /> },
];

const languages = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

// Weather condition to icon mapping
function getWeatherIcon(condition?: string) {
  if (!condition) return <Cloud size={32} />;
  const c = condition.toLowerCase();
  if (c.includes("rain") || c.includes("drizzle")) return <Droplets size={32} />;
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
}

export default function Dashboard() {
  const [theme, setTheme] = useState("dark");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [language, setLanguage] = useState("en");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [trip, setTrip] = useState<any>(null);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; mins: number } | null>(null);
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
      if (trips.length > 0) {
        setTrip(trips[0]); // Load the most recent trip
      }
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
        // Fallback: show that we couldn't fetch
        setWeather({
          isHistorical: false,
          historicalNote: "Unable to fetch weather data",
        });
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [trip?.destinationLat, trip?.destinationLng, trip?.departureDate]);

  // Countdown ticker
  useEffect(() => {
    if (!trip?.departureDate) return;
    const interval = setInterval(() => {
      const dep = new Date(trip.departureDate).getTime();
      const now = Date.now();
      const diff = dep - now;
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, mins: 0 });
      } else {
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        });
      }
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
    { key: "photos", icon: <Camera size={24} />, label: "Photo Album" },
    { key: "budget", icon: <CreditCard size={24} />, label: "Budget" },
    { key: "contact", icon: <Mail size={24} />, label: "Contact" },
    { key: "settings", icon: <Settings size={24} />, label: "Settings" },
  ];

  return (
    <div className="dashboard-container">
      <div className="bg-skyline" />
      <div className="bg-gradient-overlay" />

      {/* Top Panel */}
      <header className="top-panel">
        <div className="logo-section">
          <h1>Judy</h1>
        </div>

        <div className="greeting">
          Hello, Judy &mdash; be gay while away
        </div>

        <div className="top-actions">
          {/* User Profile */}
          <button
            className="icon-button"
            onClick={() => setProfileOpen(true)}
            title="Profile"
          >
            <User size={20} />
          </button>

          {/* Language Selector */}
          <div className="dropdown-container">
            <button
              className="icon-button"
              onClick={() => {
                setLangDropdownOpen(!langDropdownOpen);
                setDropdownOpen(false);
              }}
              title="Language"
            >
              <Globe size={20} />
              <span className="btn-label">{language.toUpperCase()}</span>
            </button>
            {langDropdownOpen && (
              <div className="dropdown-menu">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    className={`dropdown-item ${language === lang.code ? "active" : ""}`}
                    onClick={() => {
                      setLanguage(lang.code);
                      setLangDropdownOpen(false);
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button className="icon-button" onClick={toggleTheme} title="Toggle Theme">
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Affiliate Links */}
          <div className="dropdown-container">
            <button
              className="affiliate-btn"
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setLangDropdownOpen(false);
              }}
            >
              <Compass size={18} /> Affiliate Links <ChevronDown size={14} />
            </button>
            {dropdownOpen && (
              <div className="dropdown-menu affiliate-menu">
                {affiliates.map((aff, i) => (
                  <a key={i} href={aff.url} className="dropdown-item" target="_blank" rel="noreferrer">
                    {aff.icon}
                    <span>{aff.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="main-body">
        {/* Left Panel */}
        <aside className="left-panel">
          {navItems.map((item) => (
            <div
              key={item.key}
              className={`nav-item ${activeTab === item.key ? "active" : ""}`}
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
            </div>
          ))}
        </aside>

        {/* Content Area */}
        <main className="content-area">
          {activeTab === "dashboard" && (
            <>
              {/* Avatar */}
              <div className="avatar-container">
                <TravelDaddy tripContext={trip} />
              </div>

              {/* Right Widgets */}
              <div className="widgets-container">
                {/* Countdown */}
                {countdown && (
                  <div className="widget countdown-widget">
                    <div className="countdown-label">
                      <Timer size={16} /> Trip Countdown
                    </div>
                    <div className="countdown-display">
                      <div className="countdown-unit">
                        <span className="countdown-number">{countdown.days}</span>
                        <span className="countdown-unit-label">Days</span>
                      </div>
                      <span className="countdown-sep">:</span>
                      <div className="countdown-unit">
                        <span className="countdown-number">{countdown.hours}</span>
                        <span className="countdown-unit-label">Hrs</span>
                      </div>
                      <span className="countdown-sep">:</span>
                      <div className="countdown-unit">
                        <span className="countdown-number">{countdown.mins}</span>
                        <span className="countdown-unit-label">Min</span>
                      </div>
                    </div>
                    {trip && <div className="countdown-dest">{trip.destinationName}</div>}
                  </div>
                )}

                {!trip && (
                  <div className="widget">
                    <div className="widget-header">
                      <Sparkles size={20} /> Get Started
                    </div>
                    <div className="widget-content">
                      <p>Create your first trip to see your dashboard come alive!</p>
                      <button className="widget-action-btn" onClick={() => setActiveTab("itinerary")}>
                        Build Itinerary
                      </button>
                    </div>
                  </div>
                )}

                {/* Weather — Live Data */}
                <div className="widget">
                  <div className="widget-header">
                    <ThermometerSun size={20} /> Weather
                    {trip && <span className="widget-badge">{trip.destinationName}</span>}
                  </div>
                  <div className="widget-content">
                    {trip ? (
                      weatherLoading ? (
                        <div className="weather-display">
                          <Cloud size={32} />
                          <div>
                            <div className="weather-temp">Loading weather...</div>
                            <div className="weather-note">Fetching real-time data</div>
                          </div>
                        </div>
                      ) : weather ? (
                        <>
                          <div className="weather-display">
                            {getWeatherIcon(weather.condition)}
                            <div>
                              <div className="weather-temp">
                                {weather.temperature !== undefined
                                  ? `${Math.round(weather.temperature)}°F`
                                  : weather.isHistorical
                                    ? "Historical Avg"
                                    : "—"}
                                {weather.condition ? `, ${weather.condition}` : ""}
                              </div>
                              <div className="weather-note">
                                {weather.isHistorical
                                  ? weather.historicalNote || "Showing historical averages"
                                  : weather.daysUntilDeparture !== null && weather.daysUntilDeparture !== undefined
                                    ? `Real-time forecast • ${weather.daysUntilDeparture} days until departure`
                                    : "Real-time forecast"}
                              </div>
                            </div>
                          </div>
                          {weather.humidity !== undefined && (
                            <div className="weather-details">
                              <span className="weather-detail">
                                <Droplets size={14} /> {weather.humidity}% humidity
                              </span>
                              {weather.windSpeed !== undefined && (
                                <span className="weather-detail">
                                  <Wind size={14} /> {weather.windSpeed} mph
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="weather-display">
                          <Cloud size={32} />
                          <div>
                            <div className="weather-temp">Weather unavailable</div>
                            <div className="weather-note">Add coordinates to see weather</div>
                          </div>
                        </div>
                      )
                    ) : (
                      <p>Add a trip to see weather for your destination.</p>
                    )}
                  </div>
                </div>

                {/* Next Itinerary Item */}
                {trip?.itineraryItems?.length > 0 && (
                  <div className="widget">
                    <div className="widget-header">
                      <Calendar size={20} /> Next Up
                    </div>
                    <div className="widget-content">
                      <strong>{trip.itineraryItems[0].title}</strong>
                      {trip.itineraryItems[0].time && (
                        <span className="item-time"> at {trip.itineraryItems[0].time}</span>
                      )}
                      {trip.itineraryItems[0].description && <p>{trip.itineraryItems[0].description}</p>}
                    </div>
                  </div>
                )}

                {/* Budget Overview */}
                {trip && (
                  <div className="widget">
                    <div className="widget-header">
                      <CreditCard size={20} /> Budget Overview
                    </div>
                    <div className="widget-content">
                      <div className="stat-row">
                        <span>Total Budget</span>
                        <span className="stat-value">${trip.totalBudget?.toFixed(2)}</span>
                      </div>
                      <div className="stat-row">
                        <span>Airfare</span>
                        <span className="stat-value">-${trip.airfareCost?.toFixed(2)}</span>
                      </div>
                      <div className="stat-row">
                        <span>Hotel</span>
                        <span className="stat-value">-${trip.hotelCost?.toFixed(2)}</span>
                      </div>
                      <div className="stat-row highlight">
                        <span>Spending Budget</span>
                        <span className="stat-value accent">${trip.spendingBudget?.toFixed(2)}</span>
                      </div>
                      {trip.budgetItems?.map((bi: any) => (
                        <div className="stat-row sub" key={bi.id}>
                          <span>{bi.label}</span>
                          <span>${bi.amount?.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Entertainment Preferences */}
                <div className="widget">
                  <div className="widget-header">
                    <Music size={20} /> Entertainment
                  </div>
                  <div className="widget-content">
                    <div className="pref-tags">
                      <span className="pref-tag">
                        <Mountain size={12} /> Outdoor Activities
                      </span>
                      <span className="pref-tag">
                        <Utensils size={12} /> Local Cuisine
                      </span>
                      <span className="pref-tag">
                        <Music size={12} /> Live Music
                      </span>
                      <span className="pref-tag">
                        <HomeIcon size={12} /> Private Rentals
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "itinerary" && (
            <div className="full-width-content">
              <ItineraryBuilder onTripCreated={handleTripCreated} />
            </div>
          )}

          {activeTab === "viewer" && (
            <div className="full-width-content">
              {trip ? (
                <div className="viewer-placeholder">
                  <div className="widget" style={{ maxWidth: 800, margin: "0 auto" }}>
                    <div className="widget-header">
                      <Eye size={20} /> Trip Viewer — {trip.name || trip.destinationName}
                    </div>
                    <div className="widget-content">
                      <div className="stat-row">
                        <span>Destination</span>
                        <span className="stat-value">{trip.destinationName}</span>
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
                        <div className="widget-header" style={{ marginBottom: "0.75rem" }}>
                          <Calendar size={18} /> Itinerary ({trip.itineraryItems.length} items)
                        </div>
                        {trip.itineraryItems.map((item: any, idx: number) => (
                          <div key={item.id || idx} className="stat-row">
                            <span>
                              <span className="item-time">{item.time || "—"}</span> {item.title}
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
                <div className="widget" style={{ maxWidth: 600, margin: "2rem auto", textAlign: "center" }}>
                  <div className="widget-header">
                    <Eye size={20} /> Trip Viewer
                  </div>
                  <div className="widget-content">
                    <p>Create a trip first to view it here.</p>
                    <button className="widget-action-btn" onClick={() => setActiveTab("itinerary")}>
                      Build Itinerary
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "photos" && (
            <div className="full-width-content">
              <PhotoAlbumEditor />
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
                {trip.budgetItems?.length > 0 && (
                  <div className="budget-allocations">
                    <h3>Allocations</h3>
                    {trip.budgetItems.map((bi: any) => (
                      <div key={bi.id} className="allocation-row">
                        <span className="alloc-label">{bi.label}</span>
                        <div className="alloc-bar-container">
                          <div
                            className="alloc-bar"
                            style={{ width: `${(bi.amount / trip.spendingBudget) * 100}%` }}
                          />
                        </div>
                        <span className="alloc-amount">${bi.amount?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "budget" && !trip && (
            <div className="full-width-content">
              <div className="widget" style={{ maxWidth: 600, margin: "2rem auto", textAlign: "center" }}>
                <div className="widget-header">
                  <CreditCard size={20} /> Budget
                </div>
                <div className="widget-content">
                  <p>Create a trip first to see your budget breakdown.</p>
                  <button className="widget-action-btn" onClick={() => setActiveTab("itinerary")}>
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
                  <label>Display Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
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
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <UserProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        userEmail="judy@example.com"
      />
      <ContactFormModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </div>
  );
}

"use client";
import React, { useState } from 'react';
import { 
  Sun, Moon, Globe, Settings, Map, Calendar, 
  CreditCard, Compass, Cloud, ThermometerSun
} from 'lucide-react';
import TravelDaddy from './TravelDaddy';

const affiliates = [
  { name: 'Weather API', url: '#' },
  { name: 'Flight Info', url: '#' },
  { name: 'Travelers Insurance', url: '#' },
  { name: 'Pet Sitter', url: '#' },
  { name: 'Baby Sitter', url: '#' },
  { name: 'Transportation', url: '#' },
  { name: 'Currency Exchange', url: '#' }
];

export default function Dashboard() {
  const [theme, setTheme] = useState('dark');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <div className="dashboard-container">
      <div className="bg-skyline" />
      <div className="bg-gradient-overlay" />

      {/* Top Panel */}
      <header className="top-panel">
        <div className="logo-section">
          <h1>Judy App</h1>
        </div>
        
        <div className="greeting">
          Hello, Judy &mdash; be gay while away
        </div>

        <div className="top-actions">
          <button className="icon-button" title="Language">
            <Globe size={20} />
          </button>
          
          <button className="icon-button" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <div className="dropdown-container">
            <button className="icon-button" onClick={() => setDropdownOpen(!dropdownOpen)} title="Affiliates">
              <Compass size={20} />
            </button>
            {dropdownOpen && (
              <div className="dropdown-menu">
                {affiliates.map((aff, i) => (
                  <a key={i} href={aff.url} className="dropdown-item" target="_blank" rel="noreferrer">
                    {aff.name}
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
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <Map size={24} />
            <span className="nav-label">Dashboard</span>
          </div>
          <div className={`nav-item ${activeTab === 'itinerary' ? 'active' : ''}`} onClick={() => setActiveTab('itinerary')}>
            <Calendar size={24} />
            <span className="nav-label">Itinerary</span>
          </div>
          <div className={`nav-item ${activeTab === 'budget' ? 'active' : ''}`} onClick={() => setActiveTab('budget')}>
            <CreditCard size={24} />
            <span className="nav-label">Budget</span>
          </div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={24} />
            <span className="nav-label">Settings</span>
          </div>
        </aside>

        {/* Content Area */}
        <main className="content-area">
          {/* Avatar takes up the center space */}
          <div className="avatar-container">
             <TravelDaddy />
          </div>

          {/* Right Widgets */}
          <div className="widgets-container">
            <div className="widget">
              <div className="countdown-label">Trip Countdown</div>
              <div className="countdown-number">14 Days</div>
            </div>

            <div className="widget">
              <div className="widget-header">
                <ThermometerSun size={20} /> Weather (Destination)
              </div>
              <div className="widget-content">
                <div className="stat-row">
                  <span>Current:</span>
                  <span>78°F, Sunny</span>
                </div>
                <div className="stat-row">
                  <span>Forecast (20+ days):</span>
                  <span>Avg 82°F, Humid</span>
                </div>
              </div>
            </div>

            <div className="widget">
              <div className="widget-header">
                <Calendar size={20} /> Next on Itinerary
              </div>
              <div className="widget-content">
                <strong>10:00 AM - Arrival & Check-in</strong><br/>
                Resort Lounge, Main Lobby
              </div>
            </div>

            <div className="widget">
              <div className="widget-header">
                <CreditCard size={20} /> Budget Overview
              </div>
              <div className="widget-content">
                <div className="stat-row">
                  <span>Total Budget:</span>
                  <span>$5,000</span>
                </div>
                <div className="stat-row">
                  <span>Spent:</span>
                  <span>$1,250</span>
                </div>
                <div className="stat-row">
                  <span>Remaining:</span>
                  <span style={{color: 'var(--accent-color)'}}>$3,750</span>
                </div>
              </div>
            </div>
            
            <div className="widget">
              <div className="widget-header">
                <Cloud size={20} /> Entertainment Preferences
              </div>
              <div className="widget-content">
                • Outdoor Activities<br/>
                • Local Cuisine / Food Tours<br/>
                • Live Music
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

"use client";
import React, { useState, useCallback, useRef } from 'react';
import {
  MapPin, Calendar, Clock, DollarSign, Plus, Trash2, Upload, FileText,
  Utensils, Mountain, Music, Moon as MoonIcon, Sparkles, Car, Home, Search, Loader2
} from 'lucide-react';

interface ItineraryItemData {
  id?: string;
  date: string;
  time: string;
  title: string;
  description: string;
  category: string;
  location: string;
  cost: string;
}

interface SuggestionResult {
  name: string;
  description: string;
  costRange?: string;
  location?: string;
}

interface PlacePrediction {
  placePrediction?: {
    placeId: string;
    text: { text: string };
  };
}

interface TripFormData {
  name: string;
  departureDate: string;
  returnDate: string;
  destinationSearch: string;
  destinationName: string;
  destinationZip: string;
  destinationState: string;
  destinationCountry: string;
  destinationLat: string;
  destinationLng: string;
  totalBudget: string;
  airfareCost: string;
  hotelCost: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  food: <Utensils size={16} />,
  activities: <Mountain size={16} />,
  entertainment: <Music size={16} />,
  nightlife: <MoonIcon size={16} />,
  relaxation: <Sparkles size={16} />,
  transport: <Car size={16} />,
  rentals: <Home size={16} />,
};

const suggestionCategories = [
  { key: 'food', label: 'Dining & Food' },
  { key: 'activities', label: 'Activities & Tours' },
  { key: 'entertainment', label: 'Theater & Entertainment' },
  { key: 'nightlife', label: 'Nightlife' },
  { key: 'relaxation', label: 'Relaxation & Spas' },
  { key: 'transport', label: 'Transportation' },
  { key: 'rentals', label: 'Private Rentals' },
];

export default function ItineraryBuilder({
  onTripCreated,
}: {
  onTripCreated?: (trip: any) => void;
}) {
  const [tripForm, setTripForm] = useState<TripFormData>({
    name: '',
    departureDate: '',
    returnDate: '',
    destinationSearch: '',
    destinationName: '',
    destinationZip: '',
    destinationState: '',
    destinationCountry: '',
    destinationLat: '',
    destinationLng: '',
    totalBudget: '',
    airfareCost: '',
    hotelCost: '',
  });

  const [items, setItems] = useState<ItineraryItemData[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<PlacePrediction[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestionCategory, setActiveSuggestionCategory] = useState('');
  const [rentalPlatforms, setRentalPlatforms] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedTrip, setSavedTrip] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const spendingBudget = Math.max(
    0,
    (parseFloat(tripForm.totalBudget) || 0) -
      (parseFloat(tripForm.airfareCost) || 0) -
      (parseFloat(tripForm.hotelCost) || 0)
  );

  const budgetBreakdown = [
    { label: 'Dining & Food', pct: 0.30 },
    { label: 'Activities & Tours', pct: 0.25 },
    { label: 'Local Transport', pct: 0.15 },
    { label: 'Shopping & Souvenirs', pct: 0.10 },
    { label: 'Nightlife', pct: 0.10 },
    { label: 'Miscellaneous', pct: 0.10 },
  ];

  // Location autocomplete
  const handleDestinationSearch = useCallback((value: string) => {
    setTripForm((prev) => ({ ...prev, destinationSearch: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 3) {
      setLocationSuggestions([]);
      setShowLocationDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(value)}`);
        const data = await res.json();
        setLocationSuggestions(data.suggestions || []);
        setShowLocationDropdown(true);
      } catch {
        setLocationSuggestions([]);
      }
    }, 300);
  }, []);

  const selectLocation = useCallback(async (prediction: PlacePrediction) => {
    const placeId = prediction.placePrediction?.placeId;
    const text = prediction.placePrediction?.text?.text || '';
    setShowLocationDropdown(false);
    setTripForm((prev) => ({ ...prev, destinationSearch: text, destinationName: text }));

    if (placeId) {
      try {
        const res = await fetch(`/api/places/details?placeId=${placeId}`);
        const data = await res.json();
        setTripForm((prev) => ({
          ...prev,
          destinationName: data.name || text,
          destinationZip: data.zip || '',
          destinationState: data.state || '',
          destinationCountry: data.country || '',
          destinationLat: data.lat?.toString() || '',
          destinationLng: data.lng?.toString() || '',
        }));
      } catch {
        /* keep the text */
      }
    }
  }, []);

  // Add item manually
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { date: tripForm.departureDate, time: '', title: '', description: '', category: 'activities', location: '', cost: '' },
    ]);
  };

  const updateItem = (index: number, field: string, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  // Get AI suggestions
  const getSuggestions = async (category: string) => {
    if (!tripForm.destinationName) return;
    setActiveSuggestionCategory(category);
    setSuggestionsLoading(true);
    setSuggestions([]);
    setRentalPlatforms([]);

    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: tripForm.destinationName,
          category,
          dates: tripForm.departureDate && tripForm.returnDate
            ? `${tripForm.departureDate} to ${tripForm.returnDate}`
            : undefined,
        }),
      });
      const data = await res.json();

      if (category === 'rentals' && data.suggestions?.platforms) {
        setRentalPlatforms(data.suggestions.platforms);
      } else if (Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
    } catch {
      /* silently fail */
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const addSuggestionToItinerary = (s: SuggestionResult) => {
    setItems((prev) => [
      ...prev,
      {
        date: tripForm.departureDate,
        time: '',
        title: s.name,
        description: s.description,
        category: activeSuggestionCategory,
        location: s.location || '',
        cost: '',
      },
    ]);
  };

  // Save trip
  const saveTrip = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tripForm.name,
          departureDate: tripForm.departureDate,
          returnDate: tripForm.returnDate,
          destinationName: tripForm.destinationName,
          destinationZip: tripForm.destinationZip,
          destinationState: tripForm.destinationState,
          destinationCountry: tripForm.destinationCountry,
          destinationLat: tripForm.destinationLat,
          destinationLng: tripForm.destinationLng,
          totalBudget: parseFloat(tripForm.totalBudget) || 0,
          airfareCost: parseFloat(tripForm.airfareCost) || 0,
          hotelCost: parseFloat(tripForm.hotelCost) || 0,
        }),
      });
      const trip = await res.json();
      setSavedTrip(trip);

      // Save itinerary items
      for (const item of items) {
        if (item.title) {
          await fetch('/api/itinerary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...item, tripId: trip.id }),
          });
        }
      }
      onTripCreated?.(trip);
    } catch (err) {
      console.error('Save trip error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="itinerary-builder">
      <h2 className="builder-title">
        <MapPin size={24} /> Itinerary Builder
      </h2>

      {/* Trip Details */}
      <section className="builder-section">
        <h3>Trip Details</h3>
        <div className="form-grid">
          <div className="form-group span-2">
            <label>Trip Name</label>
            <input
              type="text"
              placeholder="e.g. Summer in Barcelona"
              value={tripForm.name}
              onChange={(e) => setTripForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label><Calendar size={14} /> Departure Date</label>
            <input
              type="date"
              value={tripForm.departureDate}
              onChange={(e) => setTripForm((p) => ({ ...p, departureDate: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label><Calendar size={14} /> Return Date</label>
            <input
              type="date"
              value={tripForm.returnDate}
              onChange={(e) => setTripForm((p) => ({ ...p, returnDate: e.target.value }))}
            />
          </div>
        </div>
      </section>

      {/* Destination */}
      <section className="builder-section">
        <h3><MapPin size={18} /> Destination</h3>
        <div className="form-grid">
          <div className="form-group span-2 autocomplete-container">
            <label>Search Destination</label>
            <div className="search-input-wrap">
              <Search size={16} />
              <input
                type="text"
                placeholder="Type a city, state, or country..."
                value={tripForm.destinationSearch}
                onChange={(e) => handleDestinationSearch(e.target.value)}
                onBlur={() => setTimeout(() => setShowLocationDropdown(false), 200)}
              />
            </div>
            {showLocationDropdown && locationSuggestions.length > 0 && (
              <ul className="autocomplete-dropdown">
                {locationSuggestions.map((s, i) => (
                  <li key={i} onMouseDown={() => selectLocation(s)}>
                    <MapPin size={14} />
                    {s.placePrediction?.text?.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="form-group">
            <label>Zip Code</label>
            <input type="text" value={tripForm.destinationZip} readOnly className="readonly" />
          </div>
          <div className="form-group">
            <label>State / Province</label>
            <input type="text" value={tripForm.destinationState} readOnly className="readonly" />
          </div>
          <div className="form-group">
            <label>Country</label>
            <input type="text" value={tripForm.destinationCountry} readOnly className="readonly" />
          </div>
        </div>
      </section>

      {/* Budget */}
      <section className="builder-section">
        <h3><DollarSign size={18} /> Budget</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Total Budget</label>
            <input
              type="number"
              placeholder="$0.00"
              value={tripForm.totalBudget}
              onChange={(e) => setTripForm((p) => ({ ...p, totalBudget: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Airfare Cost</label>
            <input
              type="number"
              placeholder="$0.00"
              value={tripForm.airfareCost}
              onChange={(e) => setTripForm((p) => ({ ...p, airfareCost: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Hotel Cost</label>
            <input
              type="number"
              placeholder="$0.00"
              value={tripForm.hotelCost}
              onChange={(e) => setTripForm((p) => ({ ...p, hotelCost: e.target.value }))}
            />
          </div>
        </div>

        {spendingBudget > 0 && (
          <div className="budget-breakdown">
            <h4>Spending Budget: <span className="accent">${spendingBudget.toFixed(2)}</span></h4>
            <p className="budget-subtitle">Recommended allocation after airfare & hotel:</p>
            <div className="breakdown-grid">
              {budgetBreakdown.map((b) => (
                <div key={b.label} className="breakdown-item">
                  <span className="breakdown-label">{b.label}</span>
                  <span className="breakdown-amount">${(spendingBudget * b.pct).toFixed(2)}</span>
                  <span className="breakdown-pct">{(b.pct * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Upload Documents */}
      <section className="builder-section">
        <h3><FileText size={18} /> Upload Documents & Images</h3>
        <p className="section-hint">Upload boarding passes, hotel confirmations, PDFs, or photos of your plans.</p>
        <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
          <Upload size={32} />
          <span>Click to upload files</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.doc,.docx"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
        {uploadedFiles.length > 0 && (
          <div className="uploaded-list">
            {uploadedFiles.map((f, i) => (
              <div key={i} className="uploaded-file">
                <FileText size={14} /> {f.name} <span className="file-size">({(f.size / 1024).toFixed(1)} KB)</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Suggestions */}
      {tripForm.destinationName && (
        <section className="builder-section">
          <h3><Sparkles size={18} /> Get Suggestions for {tripForm.destinationName}</h3>
          <div className="suggestion-categories">
            {suggestionCategories.map((cat) => (
              <button
                key={cat.key}
                className={`suggestion-cat-btn ${activeSuggestionCategory === cat.key ? 'active' : ''}`}
                onClick={() => getSuggestions(cat.key)}
              >
                {categoryIcons[cat.key]} {cat.label}
              </button>
            ))}
          </div>

          {suggestionsLoading && (
            <div className="suggestions-loading">
              <Loader2 size={24} className="spinner" /> Asking Judy Pierre for suggestions...
            </div>
          )}

          {activeSuggestionCategory === 'rentals' && rentalPlatforms.length > 0 && (
            <div className="rental-platforms">
              {rentalPlatforms.map((p: any, i: number) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer" className="rental-card">
                  <Home size={20} />
                  <div>
                    <strong>{p.name}</strong>
                    <p>{p.description}</p>
                  </div>
                </a>
              ))}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="suggestions-list">
              {suggestions.map((s, i) => (
                <div key={i} className="suggestion-card">
                  <div className="suggestion-info">
                    <strong>{s.name}</strong>
                    <p>{s.description}</p>
                    {s.costRange && <span className="cost-tag">{s.costRange}</span>}
                    {s.location && <span className="location-tag"><MapPin size={12} /> {s.location}</span>}
                  </div>
                  <button className="add-suggestion-btn" onClick={() => addSuggestionToItinerary(s)}>
                    <Plus size={16} /> Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Manual Itinerary Items */}
      <section className="builder-section">
        <h3><Calendar size={18} /> Itinerary Items</h3>
        {items.map((item, index) => (
          <div key={index} className="itinerary-item-form">
            <div className="item-header">
              <span className="item-number">#{index + 1}</span>
              <button className="remove-btn" onClick={() => removeItem(index)}><Trash2 size={16} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label><Calendar size={12} /> Date</label>
                <input type="date" value={item.date} onChange={(e) => updateItem(index, 'date', e.target.value)} />
              </div>
              <div className="form-group">
                <label><Clock size={12} /> Time</label>
                <input type="time" value={item.time} onChange={(e) => updateItem(index, 'time', e.target.value)} />
              </div>
              <div className="form-group span-2">
                <label>Title</label>
                <input type="text" placeholder="Activity name" value={item.title} onChange={(e) => updateItem(index, 'title', e.target.value)} />
              </div>
              <div className="form-group span-2">
                <label>Description</label>
                <input type="text" placeholder="Brief description" value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={item.category} onChange={(e) => updateItem(index, 'category', e.target.value)}>
                  <option value="food">Dining</option>
                  <option value="activities">Activities</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="nightlife">Nightlife</option>
                  <option value="relaxation">Relaxation</option>
                  <option value="transport">Transport</option>
                </select>
              </div>
              <div className="form-group">
                <label><DollarSign size={12} /> Est. Cost</label>
                <input type="number" placeholder="$0" value={item.cost} onChange={(e) => updateItem(index, 'cost', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
        <button className="add-item-btn" onClick={addItem}>
          <Plus size={18} /> Add Itinerary Item
        </button>
      </section>

      {/* Save */}
      <div className="builder-actions">
        <button className="save-trip-btn" onClick={saveTrip} disabled={saving || !tripForm.name || !tripForm.departureDate}>
          {saving ? <><Loader2 size={18} className="spinner" /> Saving...</> : 'Save Trip'}
        </button>
        {savedTrip && <span className="saved-msg">✓ Trip saved successfully!</span>}
      </div>
    </div>
  );
}

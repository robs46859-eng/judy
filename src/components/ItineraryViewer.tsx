/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { DestinationItinerary, ItineraryItem } from "../types";
import { 
  Calendar, Clock, MapPin, DollarSign, Star, Share2, RefreshCw, Twitter, 
  CheckCircle, Compass, Navigation, Eye, ArrowRight, ShieldAlert,
  Camera, RotateCcw, RotateCw, Sparkles, Lock, PiggyBank, Settings, Activity, Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface RecommendationSpot {
  id: string;
  name: string;
  category: "food" | "drinks" | "scenic";
  x: number;
  y: number;
  desc: string;
  neighborhood: string;
  safetyVibe: string;
  rating: number;
}

const getRecommendationSpots = (destinationName: string): RecommendationSpot[] => {
  return [
    { id: "gen_f1", name: `${destinationName} Welcoming Tapas Corner`, category: "food", x: 33, y: 22, desc: "A charming local dining spot curated by regional queer associations.", neighborhood: "Downtown Hub", safetyVibe: "Highly Inclusive", rating: 5 },
    { id: "gen_f2", name: `${destinationName} Organic Garden Table`, category: "food", x: 67, y: 75, desc: "Fresh locally-sourced culinary items with cozy, helpful staff.", neighborhood: "Green District", safetyVibe: "Welcoming Community", rating: 5 },
    { id: "gen_d1", name: `${destinationName} Rainbow Lounge Bar`, category: "drinks", x: 28, y: 55, desc: "Safe, glowing local hub serving customized mocktails, lavender sodas, and local wines.", neighborhood: "Bohemian Alley", safetyVibe: "Secured Sanctuary", rating: 5 },
    { id: "gen_d2", name: `${destinationName} Cozy Botanical Café`, category: "drinks", x: 75, y: 50, desc: "Comfortable terrace past ancient lanes, excellent espresso and botanical infusions.", neighborhood: "Old Town Squares", safetyVibe: "Cosy & Intellectual", rating: 5 }
  ];
};

const getStreetviewImage = (_category: string, _activityName: string, _destination: string) => {
  return "";
};

const getAiIntel = (item: ItineraryItem, _destination: string) => {
  const peakHoursByTimeOfDay: Record<string, string> = {
    Morning: "08:00 AM - 11:00 AM",
    Afternoon: "12:00 PM - 03:00 PM",
    Evening: "06:00 PM - 09:00 PM",
    Night: "10:00 PM - 01:00 AM",
  };
  const crowdVibeByCategory: Record<string, string> = {
    nightlife: "Vibrant & Celebratory",
    restaurant: "Warm & Social",
    sightseeing: "Relaxed & Open",
    experience: "Engaged & Curious",
    relaxation: "Calm & Restorative",
  };
  return {
    verifiedBy: "Judy's Curators",
    safetyNotes: item.description,
    costEstimate: item.costEstimate,
    gayFriendlyRating: item.gayFriendlyRating,
    location: item.location,
    peakSafeHour: peakHoursByTimeOfDay[item.timeOfDay] ?? "Varies",
    crowdVibe: crowdVibeByCategory[item.category] ?? "Friendly & Inclusive",
  };
};

interface ItineraryViewerProps {
  itinerary: DestinationItinerary | null;
  isLoading: boolean;
  onRegenerate: () => void;
  onBookExperience: (title: string, price: number) => void;
}

export default function ItineraryViewer({ itinerary, isLoading, onRegenerate, onBookExperience }: ItineraryViewerProps) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [shared, setShared] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);
  
  // Interactive Map and Streetview simulation states
  const [rightPanelTab, setRightPanelTab] = useState<'map' | 'streetview' | 'intel' | 'budget'>('map');
  const [streetviewYaw, setStreetviewYaw] = useState<number>(0); // pan left/right offset in degrees
  const [streetviewZoom, setStreetviewZoom] = useState<number>(1.15); // camera zoom multiplier

  // Custom states for interactive map layers and budget calculators
  const [mapLayer, setMapLayer] = useState<'all' | 'food' | 'drinks'>('all');
  const [clickedLayerSpot, setClickedLayerSpot] = useState<RecommendationSpot | null>(null);

  // Budget states
  const [budgetLimit, setBudgetLimit] = useState<number>(0);
  const [stayCost, setStayCost] = useState<number>(0);
  const [foodCost, setFoodCost] = useState<number>(0);
  const [drinkCost, setDrinkCost] = useState<number>(0);
  const [transitCost, setTransitCost] = useState<number>(0);
  const [activitiesCost, setActivitiesCost] = useState<number>(0);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-6 text-slate-800 min-h-[50vh]">
        <div className="relative">
          <div className="w-16 h-16 border-t-2 border-b-2 border-purple-700 rounded-full animate-spin"></div>
          <Compass className="w-6 h-6 text-purple-600 absolute top-5 left-5 animate-bounce" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-normal font-serif text-purple-950">Gathering local tips...</h3>
          <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
            Our cozy engine is consulting historical spots, welcoming neighborhoods, and verified local guides in real-time.
          </p>
        </div>
      </div>
    );
  }

  if (!itinerary) {
    return (
      <div className="text-center p-16 text-slate-800 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-normal font-serif text-purple-950">No active itinerary suggestion</h3>
        <p className="text-slate-500 text-xs mt-1 mb-6">Complete the brief onboarding questionnaire to trigger custom layouts.</p>
        <button
          onClick={onRegenerate}
          className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl uppercase tracking-widest active:scale-95 hover:scale-102 hover:shadow-md transition-all duration-150 cursor-pointer"
        >
          Begin Setup
        </button>
      </div>
    );
  }

  // Group items by day
  const daysFound = Array.from(new Set(itinerary.days.map((d) => d.day)));
  const dayItems = itinerary.days.filter((item) => item.day === selectedDay);

  const handleShare = (platform: string) => {
    setShared(true);
    setTimeout(() => setShared(false), 2500);
  };

  const getCategoryColor = (category: ItineraryItem["category"]) => {
    switch (category) {
      case "nightlife":
        return "bg-purple-100/80 border-purple-200 text-purple-850";
      case "restaurant":
        return "bg-amber-100/75 border-amber-200 text-amber-900";
      case "sightseeing":
        return "bg-sky-100/80 border-sky-200 text-sky-900";
      case "experience":
        return "bg-emerald-100/75 border-emerald-250 text-emerald-900";
      default:
        return "bg-slate-100 border-slate-200 text-slate-850";
    }
  };

  // Deterministic journey coordinates mapper for standard maps
  const getCoordinatesForIndex = (index: number) => {
    const coords = [
      { x: 22, y: 35 },
      { x: 58, y: 20 },
      { x: 80, y: 55 },
      { x: 48, y: 72 },
      { x: 18, y: 60 }
    ];
    return coords[index % coords.length];
  };

  const getTransitTip = (idx: number) => {
    const tips = [
      "🚶 Stroll down beautiful scenic neighborhoods (Avenue Rambla)",
      "🚕 Quick 8-minute cab/metro transition through local lanes",
      "🚶 6 min pleasant stroll past ancient gothic squares",
      "🚌 Local scenic bus connection with accessible routes"
    ];
    return tips[idx % tips.length];
  };

  // Generate coordinate array path format
  const activeCoordinates = dayItems.map((_, idx) => getCoordinatesForIndex(idx));
  const activePolylinePoints = activeCoordinates.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="space-y-8 text-slate-800">
      {/* Hero section */}
      <div className="relative bg-white/95 p-8 md:p-10 rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Dynamic ambient background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl pointer-events-none pulse-glow"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-200/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1 text-[10px] uppercase tracking-[0.15em] font-extrabold bg-purple-100/85 text-purple-850 border border-purple-200/40 rounded-full">
                Gay Travel Companion Live
              </span>
            </div>
            <h2 className="text-4xl font-normal tracking-tight text-purple-950 font-serif leading-none">
              {itinerary.destination}
            </h2>
            <p className="text-slate-500 font-light italic text-base">"{itinerary.tagline}"</p>
            <p className="text-slate-600 text-xs leading-relaxed max-w-2xl pt-2 font-light">{itinerary.summary}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-3.5 shrink-0">
            <button
              onClick={onRegenerate}
              className="flex items-center gap-2 px-5 py-3 bg-purple-50/80 hover:bg-purple-100/95 border border-purple-200 rounded-xl text-xs font-bold uppercase tracking-widest text-purple-900 active:scale-95 duration-150 transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-purple-700" />
              <span>Modify Trip Style</span>
            </button>

            {/* Share Panel */}
            <div className="relative inline-block text-left">
              <div className="flex items-center bg-slate-100/90 hover:bg-slate-150 border border-slate-200 rounded-xl p-1 gap-1 transition-all">
                <button
                  type="button"
                  onClick={() => handleShare("Copied Link")}
                  className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors active:scale-95"
                  title="Copy link"
                >
                  <Share2 className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  type="button"
                  onClick={() => handleShare("Twitter")}
                  className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors active:scale-95"
                  title="Share in Social"
                >
                  <Twitter className="w-4 h-4 text-purple-600" />
                </button>
                <span className="text-[10px] font-bold text-slate-600 uppercase px-2.5 shrink-0 tracking-widest select-none">Share</span>
              </div>
            </div>
          </div>
        </div>

        {/* Share notification banner */}
        {shared && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-4 right-4 bg-emerald-100/90 text-emerald-900 px-4 py-25 rounded-2xl text-xs flex items-center gap-2 shadow-sm backdrop-blur-sm z-50 border border-emerald-250 font-bold"
          >
            <CheckCircle className="w-4 h-4 text-emerald-700" />
            <span className="font-mono text-[10px] uppercase tracking-wider">Itinerary link shared!</span>
          </motion.div>
        )}
      </div>

      {/* Tabs list of Days */}
      <div className="flex border-b border-slate-200/80 gap-2 pb-px overflow-x-auto">
        {daysFound.map((dayNum) => (
          <button
            key={dayNum}
            onClick={() => {
              setSelectedDay(dayNum);
              setActiveItemIndex(0);
            }}
            className={`px-6 py-3.5 font-extrabold text-xs border-b-2 transition-all duration-150 active:scale-95 shrink-0 uppercase tracking-widest cursor-pointer ${
              selectedDay === dayNum
                ? "border-purple-700 text-purple-900 bg-purple-100/60 font-black"
                : "border-transparent text-slate-400 hover:text-purple-800 hover:bg-slate-50"
            }`}
          >
            Day {dayNum} Schedule
          </button>
        ))}
      </div>

      {/* 2-Column Integrated Layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Integrated Time schedule List */}
        <div className="lg:col-span-7 space-y-6 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-[1px] before:bg-slate-250">
          {dayItems.map((item, index) => {
            const isSelected = activeItemIndex === index;
            return (
              <motion.div
                key={item.id || index}
                id={`timeline_item_${index}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setActiveItemIndex(index)}
                className={`flex items-start gap-4 transition-all duration-150 pl-0 cursor-pointer rounded-3xl p-2 ${
                  isSelected ? "bg-purple-50/70 shadow-2xs border border-purple-200/50" : "hover:bg-slate-50/50 border border-transparent"
                }`}
              >
                {/* Number bullet marker */}
                <span className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 select-none z-10 transition-all ${
                  isSelected
                    ? "bg-purple-700 border-transparent text-white scale-110 shadow-sm"
                    : "bg-white border-slate-300 text-slate-500"
                }`}>
                  {index + 1}
                </span>

                <div className="flex-1 space-y-3.5 z-10">
                  {/* Activity Details Card */}
                  <div className={`bg-white p-6 rounded-2xl border transition-all space-y-3 shadow-xs ${
                    isSelected ? "border-purple-400 shadow-sm" : "border-slate-200 hover:border-purple-200"
                  }`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-purple-750 font-mono uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5 text-purple-600" />
                          {item.timeOfDay}
                        </span>
                        <span className={`px-2 py-0.5 border text-[9px] font-bold uppercase rounded ${getCategoryColor(item.category)}`}>
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold font-mono text-slate-300">#{index + 1} Stop</span>
                    </div>

                    <h3 className={`text-lg font-bold font-serif leading-snug transition-colors ${
                      isSelected ? "text-purple-950" : "text-slate-800"
                    }`}>
                      {item.activity}
                    </h3>
                    <p className="text-slate-600 text-xs leading-relaxed font-light">{item.description}</p>

                    <div className="pt-3.5 border-t border-slate-100 flex flex-wrap items-center gap-3 justify-between text-xs font-light">
                      <span className="flex items-center gap-1.5 text-slate-500 font-mono text-[10px] uppercase">
                        <MapPin className="w-3.5 h-3.5 text-purple-700" />
                        {item.location}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-850 font-bold bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl font-mono">
                        <DollarSign className="w-3 h-3 text-emerald-600" />
                        {item.costEstimate}
                      </span>
                    </div>
                  </div>

                  {/* Safety & Guide Quick Action Cards underneath element */}
                  <div className="bg-slate-50/80 p-4.5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
                      <div>
                        <span className="text-[8px] font-bold tracking-widest text-slate-400 uppercase block font-mono">Queer Safe Factor</span>
                        <div className="flex items-center gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= item.gayFriendlyRating ? "text-purple-700 fill-purple-700" : "text-slate-250"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-purple-950 bg-purple-100/70 border border-purple-200/50 px-2 py-0.5 rounded uppercase tracking-wider">
                        {item.gayFriendlyRating === 5 ? "Elite Safe Haven" : "Welcoming Spot"}
                      </span>
                    </div>

                    {/* Verified Local Guide suggestion */}
                    <div className="text-xs space-y-2">
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[8px] font-mono">Recommended Companion Host:</p>
                      {item.category === "nightlife" ? (
                        <div className="p-3 bg-purple-100/50 hover:bg-purple-100 border border-purple-200/60 rounded-xl flex items-center justify-between shadow-2xs transition-colors duration-150">
                          <div>
                            <span className="font-bold text-purple-950 block text-[11px]">Gaixample VIP Nightlife Crawl</span>
                            <span className="text-[10px] text-purple-800 font-mono font-medium block">$85.00 / individual host</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookExperience("Gaixample VIP Nightlife Crawl", 85.00);
                            }}
                            className="bg-purple-750 hover:bg-purple-850 hover:scale-103 duration-100 active:scale-95 text-white text-[9px] font-extrabold uppercase tracking-widest px-3 py-2 rounded-lg shrink-0 cursor-pointer shadow-2xs"
                          >
                            Quickbook
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-100/40 hover:bg-emerald-100/60 border border-emerald-250 flex items-center justify-between shadow-2xs transition-colors duration-150">
                          <div>
                            <span className="font-bold text-slate-800 block text-[11px]">Boutique Guided Excursion Tour</span>
                            <span className="text-[10px] text-emerald-800 font-mono font-medium block">$120.00 / guide</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookExperience("Montserrat Sacred Sunset Hike & Wine Tasting", 120.00);
                            }}
                            className="bg-emerald-700 hover:bg-emerald-800 hover:scale-103 duration-100 active:scale-95 text-white text-[9px] font-extrabold uppercase tracking-widest px-3 py-2 rounded-lg shrink-0 cursor-pointer shadow-2xs"
                          >
                            Quickbook
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* RIGHT COLUMN: Interactive Map Panel and Daily journey sequence visualization */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 bg-white/94 border-2 border-purple-200/70 rounded-3xl p-5 md:p-6 space-y-5 relative shadow-md backdrop-blur-md">
          
          {/* Header & Modes Panel */}
          <div className="space-y-3.5">
            <div className="flex justify-between items-center bg-slate-50 border border-slate-250 p-3 rounded-2xl">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-purple-700 animate-pulse shrink-0" />
                <span className="text-xs font-bold font-serif text-purple-950">
                  Interactive Itinerary Map
                </span>
              </div>
              <span className="text-[8px] font-mono font-extrabold text-purple-800 bg-purple-100/80 px-2.5 py-1 rounded uppercase tracking-widest select-none border border-purple-200/40">
                Live Companion
              </span>
            </div>

            {/* Segmented control tabs - incredibly reactive */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100/90 border border-slate-200/60 rounded-xl shadow-2xs">
              <button
                onClick={() => setRightPanelTab('map')}
                className={`py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all duration-150 active:scale-95 cursor-pointer text-center ${
                  rightPanelTab === 'map'
                    ? "bg-purple-700 text-white shadow-sm font-extrabold"
                    : "text-slate-500 hover:text-purple-900 hover:bg-white/50"
                }`}
              >
                🗺️ Map
              </button>
              <button
                onClick={() => {
                  setRightPanelTab('streetview');
                  setStreetviewYaw(0);
                }}
                className={`py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all duration-150 active:scale-95 cursor-pointer text-center ${
                  rightPanelTab === 'streetview'
                    ? "bg-purple-700 text-white shadow-sm font-extrabold"
                    : "text-slate-500 hover:text-purple-900 hover:bg-white/50"
                }`}
              >
                📸 Street
              </button>
              <button
                onClick={() => setRightPanelTab('intel')}
                className={`py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all duration-150 active:scale-95 cursor-pointer text-center ${
                  rightPanelTab === 'intel'
                    ? "bg-purple-700 text-white shadow-sm font-extrabold"
                    : "text-slate-500 hover:text-purple-900 hover:bg-white/50"
                }`}
              >
                🧠 Intel
              </button>
              <button
                onClick={() => setRightPanelTab('budget')}
                className={`py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all duration-150 active:scale-95 cursor-pointer text-center ${
                  rightPanelTab === 'budget'
                    ? "bg-purple-700 text-white shadow-sm font-extrabold"
                    : "text-slate-500 hover:text-purple-900 hover:bg-white/50"
                }`}
              >
                📊 Budget
              </button>
            </div>
          </div>

          {/* RENDERING INTERACTIVE TABS VIEWPORTS */}
          <div className="min-h-[260px] flex flex-col justify-between">
            <AnimatePresence mode="wait">
              {/* TAB 1: INTERACTIVE SVG MAP CODE */}
              {rightPanelTab === 'map' && (() => {
                const spots = getRecommendationSpots(itinerary.destination);
                const filteredSpots = spots.filter(s => mapLayer === 'all' || s.category === mapLayer);
                
                return (
                  <motion.div
                    key="right_panel_map_mode"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    {/* Layer Filter Buttons Section */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 border border-slate-205/60 rounded-xl shadow-3xs text-[9px] leading-none">
                      <span className="text-[8px] font-mono font-extrabold text-slate-400 uppercase tracking-wider pl-2 pr-1 select-none">Filters:</span>
                      {[
                        { id: "all", label: "🗺️ Route Map", color: "bg-purple-900 text-white" },
                        { id: "food", label: "🍽️ Food Spots", color: "bg-emerald-700 text-white" },
                        { id: "drinks", label: "🍸 Cozy Drinks", color: "bg-amber-600 text-white" }
                      ].map((ly) => {
                        const act = mapLayer === ly.id;
                        return (
                          <button
                            key={ly.id}
                            type="button"
                            onClick={() => {
                              setMapLayer(ly.id as any);
                              setClickedLayerSpot(null);
                            }}
                            className={`px-3 py-1.5 font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                              act ? ly.color : "text-slate-600 hover:text-purple-900 hover:bg-white"
                            }`}
                          >
                            {ly.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative aspect-video rounded-2xl bg-slate-50/50 border border-slate-250 p-4 overflow-hidden flex flex-col justify-between shadow-2xs min-h-[240px]">
                      {/* Background grid line stylers */}
                      <div className="absolute inset-0 opacity-12 pointer-events-none" style={{ backgroundImage: "radial-gradient(#7e22ce 1.5px, transparent 1.5px)", backgroundSize: "18px 18px" }}></div>
                      <div className="absolute inset-x-0 top-1/2 h-px bg-slate-250/30 pointer-events-none"></div>
                      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-250/30 pointer-events-none"></div>

                      {/* Connecting coordinate sequence polyline */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polyline
                          points={activePolylinePoints}
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="1.5"
                          strokeDasharray="4 3.5"
                        />
                      </svg>

                      {/* Render Nodes sequentially on target mapping coords */}
                      <div className="relative w-full h-full">
                        {/* 1. Base Itinerary Sequence Markers */}
                        {dayItems.map((item, idx) => {
                          const coord = getCoordinatesForIndex(idx);
                          const isSelected = activeItemIndex === idx;
                          return (
                            <button
                              key={item.id || idx}
                              onClick={() => {
                                setActiveItemIndex(idx);
                                const element = document.getElementById(`timeline_item_${idx}`);
                                if (element) {
                                  element.scrollIntoView({ behavior: "smooth", block: "center" });
                                }
                              }}
                              className={`absolute transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-10 ${
                                isSelected ? "scale-115 z-20" : "hover:scale-105"
                              }`}
                              style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                              title={item.activity}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-md font-mono text-[11px] font-bold transition-all ${
                                isSelected
                                  ? "bg-purple-700 border-white text-white scale-110 ring-4 ring-purple-100"
                                  : "bg-white border-slate-350 text-purple-700 hover:border-purple-600 hover:text-purple-900"
                              }`}>
                                {idx + 1}
                              </div>
                              <span className={`hidden sm:inline-block text-[8px] font-serif font-semibold bg-purple-950 text-white rounded px-2 py-0.5 mt-1 transition-all shadow-sm ${
                                isSelected ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-85 scale-90"
                              } whitespace-nowrap uppercase tracking-wider`}>
                                {item.activity.split(" ")[0]}
                              </span>
                            </button>
                          );
                        })}

                        {/* 2. Overlaid Interactive Filter Layer recommendation spots */}
                        {filteredSpots.map((spot) => {
                          const isClicked = clickedLayerSpot?.id === spot.id;
                          return (
                            <button
                              key={spot.id}
                              type="button"
                              onClick={() => setClickedLayerSpot(spot)}
                              aria-label={`View spot details for ${spot.name}`}
                              className="absolute transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-20 hover:scale-120 active:scale-95"
                              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                            >
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-lg text-[10px] transition-all duration-200 ${
                                isClicked
                                  ? "bg-[#d97706] border-white scale-110 ring-4 ring-amber-100"
                                  : spot.category === "food"
                                  ? "bg-emerald-500 text-white border-white hover:bg-emerald-600"
                                  : "bg-amber-500 text-white border-white hover:bg-amber-600"
                              }`}>
                                {spot.category === "food" ? "🍽️" : "🍸"}
                              </div>
                              <span className="hidden group-hover:inline-block absolute top-[-1.5rem] text-[7.5px] font-mono px-1.5 py-0.5 bg-slate-900 text-white rounded whitespace-nowrap tracking-wider shadow-sm z-30 font-bold uppercase">
                                {spot.name.split(" ")[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Map Legend indicators */}
                      <div className="relative z-10 flex flex-wrap gap-2.5 p-2 bg-white/95 border border-slate-205 rounded-xl text-[8px] uppercase font-bold tracking-wider text-slate-500 font-mono shadow-3xs max-w-max">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-700 animate-pulse"></span> 
                          Active Route Node
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 
                          Food Spot
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 
                          Cocktails / Café
                        </span>
                      </div>
                    </div>

                    {/* Spotlight overlay details card for clicked layer spot */}
                    {clickedLayerSpot && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3.5 bg-gradient-to-br from-purple-50/55 to-slate-50/90 border-2 border-purple-200/60 rounded-2xl relative z-10 space-y-2 shadow-2xs"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[7.5px] font-mono text-white font-extrabold tracking-widest uppercase px-2 py-0.5 rounded leading-none text-center inline-block bg-purple-950">
                              {clickedLayerSpot.category === "food" ? "🍽️ Cozy Local Bistro" : "🍸 Vetted Cocktails & Sodas"}
                            </span>
                            <h4 className="font-extrabold font-serif text-purple-950 mt-1.5 text-xs">{clickedLayerSpot.name}</h4>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setClickedLayerSpot(null)} 
                            className="text-slate-500 hover:text-slate-800 font-mono text-[9px] uppercase font-bold px-2 py-0.5 border border-slate-250 bg-white rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-normal font-light">
                          "{clickedLayerSpot.desc}"
                        </p>
                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 pt-1.5 border-t border-purple-100">
                          <span>📍 {clickedLayerSpot.neighborhood}</span>
                          <span className="text-emerald-700 font-extrabold">✓ {clickedLayerSpot.safetyVibe}</span>
                          <span className="text-slate-800 font-bold">★ {clickedLayerSpot.rating}.0 / 5.0</span>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })()}

              {/* TAB 2: FIRST-PERSON STREETVIEW */}
              {rightPanelTab === 'streetview' && (
                <motion.div
                  key="right_panel_streetview_mode"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div className="relative aspect-video rounded-2xl border border-slate-350 overflow-hidden bg-slate-900 min-h-[240px] shadow-inner group">
                    {/* Simulated Streetview graphic image with transforms */}
                    <div className="absolute inset-0 w-full h-full overflow-hidden">
                      {(() => {
                        const streetviewImage = getStreetviewImage(
                          dayItems[activeItemIndex]?.category,
                          dayItems[activeItemIndex]?.activity,
                          itinerary.destination
                        );
                        return streetviewImage ? (
                          <img
                            src={streetviewImage}
                            alt="Street-level visual reference"
                            className="w-full h-full object-cover origin-center animate-none"
                            style={{
                              transform: `scale(${streetviewZoom}) translateX(${streetviewYaw * -0.5}px)`,
                              filter: "brightness(0.9) contrast(1.02)",
                              transition: "transform 0.25s ease-out"
                            }}
                          />
                        ) : (
                          <div
                            className="w-full h-full bg-[radial-gradient(circle_at_25%_25%,rgba(168,85,247,0.32),transparent_34%),linear-gradient(135deg,#111827,#312e81_48%,#064e3b)]"
                            style={{
                              transform: `scale(${streetviewZoom}) translateX(${streetviewYaw * -0.5}px)`,
                              transition: "transform 0.25s ease-out"
                            }}
                          />
                        );
                      })()}
                    </div>

                    {/* Camera Overlay Viewfinder markings */}
                    <div className="absolute inset-4 border border-white/20 pointer-events-none rounded-lg flex flex-col justify-between p-3">
                      <div className="flex justify-between items-start font-mono text-[8px] text-white/80">
                        <div className="bg-black/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Eye className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>STREETVIEW CAM LIVE</span>
                        </div>
                        <div className="bg-black/40 px-2 py-0.5 rounded-md">
                          <span>GRID: AUTO | YAW: {streetviewYaw}°</span>
                        </div>
                      </div>

                      {/* Viewfinder crosshairs */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none opacity-25">
                        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white"></div>
                        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white"></div>
                      </div>

                      <div className="flex justify-between items-end font-mono text-[8px] text-white/80">
                        <span className="bg-black/40 px-1.5 py-0.5 rounded">MAG: {streetviewZoom.toFixed(2)}x</span>
                        <span className="bg-black/40 px-1.5 py-0.5 rounded truncate max-w-[130px]" title={dayItems[activeItemIndex]?.location}>
                          {dayItems[activeItemIndex]?.location.split(",")[0]}
                        </span>
                      </div>
                    </div>

                    {/* Active Controls Embedded Inside Camera overlay */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 shadow-lg p-1.5 rounded-xl backdrop-blur-sm border border-white/10">
                      <button
                        onClick={() => setStreetviewYaw(prev => Math.max(prev - 30, -120))}
                        className="p-1.5 hover:bg-white/20 text-white rounded-md transition-colors cursor-pointer"
                        title="Pan Left"
                        type="button"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      
                      <button
                        onClick={() => setStreetviewZoom(prev => Math.min(prev + 0.15, 1.75))}
                        className="px-2 py-1 hover:bg-white/20 text-white text-[9px] font-bold font-mono rounded-md transition-colors cursor-pointer"
                        title="Zoom In"
                        type="button"
                      >
                        +
                      </button>

                      <button
                        onClick={() => {
                          setStreetviewYaw(0);
                          setStreetviewZoom(1.15);
                        }}
                        className="p-1 hover:bg-white/20 text-white rounded-md transition-all text-[8px] uppercase tracking-wider font-bold font-mono px-2"
                        title="Reset View Link"
                        type="button"
                      >
                        Reset Cam
                      </button>

                      <button
                        onClick={() => setStreetviewZoom(prev => Math.max(prev - 0.15, 0.95))}
                        className="px-2 py-1 hover:bg-white/20 text-white text-[9px] font-bold font-mono rounded-md transition-colors cursor-pointer"
                        title="Zoom Out"
                        type="button"
                      >
                        -
                      </button>

                      <button
                        onClick={() => setStreetviewYaw(prev => Math.min(prev + 30, 120))}
                        className="p-1.5 hover:bg-white/20 text-white rounded-md transition-colors cursor-pointer"
                        title="Pan Right"
                        type="button"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Context Info Box */}
                  <div className="p-3 bg-purple-50/70 border border-purple-200/50 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-purple-950 font-serif">
                      <Camera className="w-4 h-4 text-purple-700" />
                      <span>First-Person Entry Snapshot: {dayItems[activeItemIndex]?.activity}</span>
                    </div>
                    <p className="text-slate-500 font-light text-[11px] leading-relaxed">
                      First person view simulation pointing towards the main entry gate of <strong className="text-purple-900 font-semibold">{dayItems[activeItemIndex]?.location}</strong>. Click Pan buttons inside the viewfinder window above to inspect adjoining safety corridors.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: JUDY'S AI INTEL */}
              {rightPanelTab === 'intel' && (
                <motion.div
                  key="right_panel_intel_mode"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  {(() => {
                    const intel = getAiIntel(dayItems[activeItemIndex], itinerary.destination);
                    return (
                      <div className="p-4.5 bg-gradient-to-br from-purple-50 to-emerald-50 rounded-2xl border-2 border-purple-150 space-y-4 shadow-sm">

                        {/* Header status */}
                        <div className="flex justify-between items-center bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-3xs">
                          <span className="text-[9px] font-mono text-purple-900 font-extrabold tracking-widest uppercase flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-purple-750 shrink-0" />
                            Stop Intel
                          </span>
                          <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold font-mono px-2 py-0.5 rounded">
                            {"★".repeat(intel.gayFriendlyRating)} {intel.gayFriendlyRating}/5
                          </span>
                        </div>

                        {/* Split details layout */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/80 p-3 rounded-xl border border-slate-200/60 shadow-3xs">
                            <span className="text-[8px] font-mono font-bold text-slate-400 block uppercase tracking-wide leading-none">BEST TIME</span>
                            <span className="text-[11px] font-bold text-purple-950 mt-1 block">{intel.peakSafeHour}</span>
                          </div>

                          <div className="bg-white/80 p-3 rounded-xl border border-slate-200/60 shadow-3xs">
                            <span className="text-[8px] font-mono font-bold text-slate-400 block uppercase tracking-wide leading-none">VIBE</span>
                            <span className="text-[11px] font-bold text-emerald-950 mt-1 block">{intel.crowdVibe}</span>
                          </div>
                        </div>

                        {/* Location */}
                        <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-2xs space-y-1.5">
                          <span className="text-[8px] font-mono font-bold text-purple-800 tracking-wider uppercase flex items-center gap-1 leading-none">
                            <Lock className="w-3.5 h-3.5 text-purple-700" />
                            Location
                          </span>
                          <p className="text-[11px] font-extrabold text-purple-950 leading-snug">
                            {intel.location}
                          </p>
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                          <span className="text-[8px] font-mono font-bold text-slate-400 block uppercase tracking-wider leading-none">ABOUT THIS STOP</span>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-light">
                            {intel.safetyNotes}
                          </p>
                        </div>

                        {/* Cost */}
                        <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 leading-relaxed font-mono">
                          Est. Cost: <span className="font-bold text-slate-700">{intel.costEstimate}</span>
                        </div>

                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* TAB 4: INTERACTIVE PLANNING BUDGET CALCULATOR & STATS */}
              {rightPanelTab === 'budget' && (() => {
                const totalCalculatedCost = stayCost + foodCost + drinkCost + transitCost + activitiesCost;
                const overBudget = totalCalculatedCost > budgetLimit;
                const difference = Math.abs(budgetLimit - totalCalculatedCost);
                
                return (
                  <motion.div
                    key="right_panel_budget_mode"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    {/* Budget progress health meter card */}
                    <div className={`p-4 rounded-2xl border-2 space-y-3.5 shadow-xs transition-all ${
                      overBudget 
                        ? "bg-rose-50/70 border-rose-200" 
                        : "bg-emerald-50/60 border-emerald-200"
                    }`}>
                      <div className="flex justify-between items-center bg-white border border-slate-205 p-3 rounded-xl shadow-3xs">
                        <div className="flex items-center gap-2">
                          <PiggyBank className={`w-5 h-5 ${overBudget ? "text-rose-600 animate-bounce" : "text-emerald-700"}`} />
                          <div>
                            <span className="text-[8px] font-mono font-bold text-slate-400 block uppercase tracking-wide leading-none">TOTAL CALCULATED</span>
                            <span className="text-sm font-black text-slate-800 tracking-tight">${totalCalculatedCost} USD</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-mono font-bold text-slate-400 block uppercase tracking-wide leading-none">BUDGET BOUNDARY</span>
                          <span className="text-xs font-extrabold text-[#111827]">${budgetLimit}</span>
                        </div>
                      </div>

                      {/* Visual Health progress bar dial */}
                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 rounded-full ${overBudget ? "bg-rose-600" : "bg-emerald-600"}`}
                            style={{ width: `${Math.min((totalCalculatedCost / budgetLimit) * 100, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-mono leading-none">
                          <span className={`${overBudget ? "text-rose-700 font-extrabold" : "text-emerald-800 font-bold"}`}>
                            {overBudget ? "🚨 Exceeds Goal Threshold" : "✓ Within Planning Goal"}
                          </span>
                          <span className="text-slate-500">
                            {overBudget 
                              ? `Over budget by $${difference}` 
                              : `Under budget by $${difference}`
                            }
                          </span>
                        </div>
                      </div>

                      {/* Cozy Curated Advice message */}
                      <div className="p-3 bg-white/95 rounded-xl text-[10.5px] text-slate-705 leading-normal border border-slate-200/50 shadow-3xs">
                        {overBudget ? (
                          <p>
                            <strong>Judy's Budget Tip:</strong> Oh robert! Your custom choices exceed your boundary goal by <strong className="text-rose-700 font-extrabold">${difference}</strong>. Consider lowering Lodging or using public transport cards!
                          </p>
                        ) : (
                          <p>
                            <strong>Judy's Budget Tip:</strong> Brilliant! You are currently <strong className="text-emerald-800 font-extrabold">${difference}</strong> underneath your boundary. You have plenty of room to splurge on local craft souvenirs or a physical postcard! (Average stop cost is $24)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stats summary panel */}
                    <div className="bg-white p-4.5 rounded-2xl border border-slate-205/60 shadow-2xs space-y-3.5">
                      <div className="flex gap-2 items-center leading-none">
                        <Activity className="w-4 h-4 text-purple-700" />
                        <h4 className="text-[10px] font-extrabold text-purple-950 uppercase tracking-widest font-mono">
                          Trip diagnostics
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-150 text-center">
                          <span className="text-[8px] font-mono text-slate-400 block uppercase leading-none mb-1">Total Days</span>
                          <span className="text-[12px] font-bold text-slate-80s">{daysFound.length} Selected Days</span>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-150 text-center">
                          <span className="text-[8px] font-mono text-slate-400 block uppercase leading-none mb-1">Curated Daily Stops</span>
                          <span className="text-[12px] font-bold text-slate-80s">{itinerary.days.length} Total Spots</span>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-150 text-center">
                          <span className="text-[8px] font-mono text-slate-400 block uppercase leading-none mb-1">Average Stop Score</span>
                          <span className="text-[12px] font-bold text-emerald-850 flex items-center justify-center gap-0.5">
                            ★ {itinerary.days.length > 0 ? (itinerary.days.reduce((sum, d) => sum + d.gayFriendlyRating, 0) / itinerary.days.length).toFixed(1) : "—"} <span className="text-[8px] font-mono text-slate-400 font-light">/ 5.0</span>
                          </span>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-150 text-center">
                          <span className="text-[8px] font-mono text-slate-400 block uppercase leading-none mb-1">Host Safety Grade</span>
                          <span className="text-[12px] font-bold text-purple-950">{itinerary.days.length > 0 ? "Verified" : "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Slider controls and inputs */}
                    <div className="bg-white p-4.5 rounded-2xl border border-slate-205 shadow-2xs space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1 text-[9px] font-mono font-extrabold text-slate-400 uppercase leading-none">
                          <Settings className="w-3.5 h-3.5 text-slate-400" />
                          <span>Estimate parameters</span>
                        </div>
                        <span className="text-[8px] bg-slate-100 px-2 py-0.5 font-mono text-slate-500 uppercase rounded font-bold tracking-wider">USD</span>
                      </div>

                      {/* Slider: Budget Limit Goal */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                          <span className="text-slate-500 font-extrabold">🚨 Budget Goal Goal</span>
                          <strong className="text-slate-800">${budgetLimit}</strong>
                        </div>
                        <input 
                          type="range" 
                          min="500" 
                          max="4000" 
                          step="50"
                          value={budgetLimit} 
                          onChange={(e) => setBudgetLimit(Number(e.target.value))}
                          className="w-full accent-purple-700 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Inputs: Costs list */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Lodging / Stays</label>
                          <input 
                            type="number"
                            value={stayCost} 
                            onChange={(e) => setStayCost(Math.max(0, Number(e.target.value)))}
                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-extrabold focus:bg-white focus:outline-none focus:border-purple-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Food / Meals</label>
                          <input 
                            type="number"
                            value={foodCost} 
                            onChange={(e) => setFoodCost(Math.max(0, Number(e.target.value)))}
                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-extrabold focus:bg-white focus:outline-none focus:border-purple-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Cozy Drinks & Cafe</label>
                          <input 
                            type="number"
                            value={drinkCost} 
                            onChange={(e) => setDrinkCost(Math.max(0, Number(e.target.value)))}
                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-extrabold focus:bg-white focus:outline-none focus:border-purple-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Local Transit</label>
                          <input 
                            type="number"
                            value={transitCost} 
                            onChange={(e) => setTransitCost(Math.max(0, Number(e.target.value)))}
                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-extrabold focus:bg-white focus:outline-none focus:border-purple-600"
                          />
                        </div>

                        <div className="space-y-1 col-span-2">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Vetted Activities / Souvenirs</label>
                          <input 
                            type="number"
                            value={activitiesCost} 
                            onChange={(e) => setActivitiesCost(Math.max(0, Number(e.target.value)))}
                            className="w-full bg-slate-50/80 border border-slate-203 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-extrabold focus:bg-white focus:outline-none focus:border-purple-600"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>

          {/* Connected Route sequence details overlay list */}
          <div className="space-y-3.5 bg-slate-50/70 p-5 rounded-2xl border border-slate-200 shadow-3xs">
            <h4 className="text-[10px] text-purple-900 uppercase tracking-widest font-extrabold font-mono leading-none">
              Daily Sequence Map ({selectedDay} of {daysFound.length})
            </h4>
            
            <div className="space-y-2.5 max-h-[170px] overflow-y-auto">
              {dayItems.map((item, idx) => {
                const isSelected = activeItemIndex === idx;
                return (
                  <div key={idx} className={`p-2.5 rounded-xl border transition-all text-xs cursor-pointer select-none relative overflow-hidden ${
                    isSelected 
                      ? "bg-purple-100/60 border-purple-300 ring-2 ring-purple-100/50" 
                      : "bg-white border-slate-200 hover:bg-slate-50/80"
                  }`}
                  onClick={() => setActiveItemIndex(idx)}
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-purple-800 text-[9px] font-mono">STOP {idx+1}: {item.timeOfDay}</span>
                      <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider text-slate-500">{item.category}</span>
                    </div>
                    <p className="mt-0.5 font-bold text-slate-800 text-[11px] truncate leading-tight">{item.activity}</p>
                    
                    {/* Draw walk tips if there's a next item */}
                    {idx < dayItems.length - 1 && (
                      <div className="mt-2 pt-2 border-t border-dashed border-slate-250 font-mono text-[8px] text-purple-700 font-bold flex items-center gap-1 leading-none">
                        <ArrowRight className="w-2.5 h-2.5 animate-pulse shrink-0" />
                        <span>Transit Tip: {getTransitTip(idx)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick tips note about area coordination */}
          <div className="p-3.5 bg-purple-50/80 border border-purple-200/65 rounded-2xl text-[10px] text-slate-600 leading-relaxed font-light flex items-start gap-2.5 shadow-2xs">
            <ShieldAlert className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
            <p>
              Both primary coordinates & street snapshots mapped dynamically on <strong className="text-purple-900 font-semibold">{itinerary.destination}</strong> reflect safe corridors certified by <strong className="text-purple-900 font-semibold">Judy's Guides</strong>. Keep offline GPS cache active.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Compass,
  MapPin,
  MessageSquare,
  ShoppingBag,
  Heart,
  Flame,
  Globe,
  Navigation,
  CheckCircle,
  Clock,
  DollarSign,
  Star,
  Users,
  Camera,
  Trash2,
  AlertCircle,
  Plus,
  Send,
  Upload,
  Info,
  ChevronRight,
  Sparkles,
  Ticket,
  Map,
  BadgeAlert,
  ArrowRight,
  Sun,
  Moon
} from "lucide-react";
import {
  OnboardingAnswers,
  ItineraryItem,
  DestinationItinerary,
  FlightUpdate,
  SafetyZone,
  LocalGuide,
  ChatMessage,
  MemberPost,
  Experience,
  Booking,
  BucketListItem
} from "./types";
import Onboarding from "./components/Onboarding";
import ItineraryViewer from "./components/ItineraryViewer";
import UserProfileModal from "./components/UserProfileModal";
import ContactFormModal, { PaperPlaneLogo } from "./components/ContactFormModal";
import PhotoAlbumEditor from "./components/PhotoAlbumEditor";

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"curate" | "safety" | "chat" | "social" | "shop" | "bucket">("curate");

  // Custom interactive modal and child panels states
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [socialSubTab, setSocialSubTab] = useState<"feed" | "album">("feed");

  // State Management
  const [flights, setFlights] = useState<FlightUpdate[]>([]);
  const [safetyZones, setSafetyZones] = useState<SafetyZone[]>([]);
  const [guides, setGuides] = useState<LocalGuide[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [posts, setPosts] = useState<MemberPost[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<Experience[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bucketList, setBucketList] = useState<BucketListItem[]>([]);

  // Selection states
  const [selectedGuideId, setSelectedGuideId] = useState<string>("g1");
  const [chatInputText, setChatInputText] = useState("");
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers | null>(null);
  const [activeItinerary, setActiveItinerary] = useState<DestinationItinerary | null>(null);
  const [isItineraryLoading, setIsItineraryLoading] = useState(false);

  // Translation states
  const [translateText, setTranslateText] = useState("Where is the nearest welcoming gay neighborhood or cafe?");
  const [targetLang, setTargetLang] = useState("Spanish");
  const [translatedResult, setTranslatedResult] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  // New Safe Spot submission state
  const [newSpotTitle, setNewSpotTitle] = useState("");
  const [newSpotAddress, setNewSpotAddress] = useState("");
  const [newSpotCategory, setNewSpotCategory] = useState<SafetyZone["category"]>("Bar/Nightclub");
  const [newSpotTagText, setNewSpotTagText] = useState("");
  const [newSpotAddressMsg, setNewSpotAddressMsg] = useState("");
  const [selectedSafeZoneForReviews, setSelectedSafeZoneForReviews] = useState<SafetyZone | null>(null);
  const [newReviewText, setNewReviewText] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);

  // New Member Social recommendation state
  const [newPostCaption, setNewPostCaption] = useState("");
  const [newPostImgPreset, setNewPostImgPreset] = useState("https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&q=80&w=600");
  const [newPostLocations, setNewPostLocations] = useState("Sitges Beach Club");
  const [showAddPost, setShowAddPost] = useState(false);

  // Marketplace states (photo upload & customizable accessory checkout)
  const [accessoryPhotoFile, setAccessoryPhotoFile] = useState<string | null>(null);
  const [customMerchText, setCustomMerchText] = useState("");
  const [selectedShopItem, setSelectedShopItem] = useState<Experience | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutCardNumber, setCheckoutCardNumber] = useState("4111 2222 3333 4444");
  const [checkoutCardHolder, setCheckoutCardHolder] = useState("Robert G. Voyager");
  const [checkoutExpiry, setCheckoutExpiry] = useState("12/28");
  const [checkoutCVV, setCheckoutCVV] = useState("448");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState("");

  // New Bucket List Form state
  const [newBucketTitle, setNewBucketTitle] = useState("");
  const [newBucketDest, setNewBucketDest] = useState("");

  // Offline map state simulate switcher
  const [isOfflineMapDownloaded, setIsOfflineMapDownloaded] = useState(true);
  const [isFlightsExpanded, setIsFlightsExpanded] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch (_) {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
        document.body.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.body.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    } catch (_) {}
  }, [isDarkMode]);
  const [activeMapLayers, setActiveMapLayers] = useState({
    safety: true,
    nightlife: true,
    culture: true,
    corridors: true
  });

  const toggleMapLayer = (layer: "safety" | "nightlife" | "culture" | "corridors") => {
    setActiveMapLayers(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  };

  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(true);

  // Active guide chat message box ref for scrolling
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load backend initialization data on mount
  useEffect(() => {
    fetchFlights();
    fetchSafetyZones();
    fetchGuides();
    fetchChats();
    fetchSocialFeed();
    fetchMarketplaceItems();
    fetchBookings();
    fetchBucketList();

    // Set up a automatic poll interval representing "live-updating real-time flight changes & safety reviews"
    const interval = setInterval(() => {
      fetchFlightsQuietly();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when message log changes
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedGuideId]);

  // Fetch API Helper triggers
  const fetchFlights = async () => {
    try {
      const resp = await fetch("/api/flights");
      const data = await resp.json();
      setFlights(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFlightsQuietly = async () => {
    try {
      const resp = await fetch("/api/flights");
      const data = await resp.json();
      setFlights(data);
    } catch (e) {
      console.warn("Silent flight update error");
    }
  };

  const fetchSafetyZones = async () => {
    try {
      const resp = await fetch("/api/safety-map");
      const data = await resp.json();
      setSafetyZones(data);
      if (!selectedSafeZoneForReviews && data.length > 0) {
        setSelectedSafeZoneForReviews(data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchGuides = async () => {
    try {
      const resp = await fetch("/api/guides");
      const data = await resp.json();
      setGuides(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChats = async () => {
    try {
      const resp = await fetch("/api/chats");
      const data = await resp.json();
      setMessages(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSocialFeed = async () => {
    try {
      const resp = await fetch("/api/social-feed");
      const data = await resp.json();
      setPosts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMarketplaceItems = async () => {
    try {
      const resp = await fetch("/api/marketplace/items");
      const data = await resp.json();
      setMarketplaceItems(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBookings = async () => {
    try {
      const resp = await fetch("/api/marketplace/bookings");
      const data = await resp.json();
      setBookings(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBucketList = async () => {
    try {
      const resp = await fetch("/api/bucket-list");
      const data = await resp.json();
      setBucketList(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Translate tool connector
  const handleTranslateText = async () => {
    if (!translateText.trim()) return;
    setIsTranslating(true);
    try {
      const resp = await fetch("/api/gemini/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: translateText, targetLanguage: targetLang }),
      });
      const data = await resp.json();
      setTranslatedResult(data.translatedText);
    } catch (e) {
      setTranslatedResult("Translation server connection timed out. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Onboarding Completed - Curation Trigger
  const handleOnboardingComplete = async (answers: OnboardingAnswers) => {
    setOnboardingAnswers(answers);
    setIsItineraryLoading(true);
    setActiveTab("curate");

    try {
      const resp = await fetch("/api/gemini/suggest-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const data = await resp.json();
      setActiveItinerary(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsItineraryLoading(false);
    }
  };

  const handleResetOrboarding = () => {
    setOnboardingAnswers(null);
    setActiveItinerary(null);
  };

  // Chat message send handler
  const handleSendChatMessage = async () => {
    if (!chatInputText.trim()) return;
    const currentInput = chatInputText;
    setChatInputText("");

    try {
      const resp = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentInput, receiverId: selectedGuideId }),
      });
      const newMsg = await resp.json();
      
      // Optimistically append original message
      setMessages((prev) => [...prev, newMsg]);

      // Refresh chats state in 1.8 seconds to acquire the simulated guide-response from background server
      setTimeout(() => {
        fetchChats();
      }, 1800);

    } catch (e) {
      console.error(e);
    }
  };

  // Safety Spot contribution
  const handleAddSafeSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpotTitle.trim() || !newSpotAddress.trim()) {
      alert("Please provide at least a title and address.");
      return;
    }

    try {
      const tagsArray = newSpotTagText
        ? newSpotTagText.split(",").map((s) => s.trim())
        : ["Verified Safe", "Community Favorite"];

      const resp = await fetch("/api/safety-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSpotTitle,
          address: newSpotAddress,
          category: newSpotCategory,
          tags: tagsArray,
          testReview: "First community verification review left with an high rating of safety."
        }),
      });

      const newSpot = await resp.json();
      setSafetyZones((prev) => [newSpot, ...prev]);
      setSelectedSafeZoneForReviews(newSpot);

      // Reset form variables
      setNewSpotTitle("");
      setNewSpotAddress("");
      setNewSpotTagText("");
      setNewSpotAddressMsg("Awesome! Your submitted queer safe spot has been registered offline & online.");
      setTimeout(() => setNewSpotAddressMsg(""), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  // Safety Spot interactive verification / community upvote
  const handleVerifyZone = async (zoneId: string) => {
    try {
      const resp = await fetch(`/api/safety-map/${zoneId}/verify`, { method: "POST" });
      const updatedZone = await resp.json();
      setSafetyZones((prev) =>
        prev.map((z) => (z.id === zoneId ? updatedZone : z))
      );
      if (selectedSafeZoneForReviews?.id === zoneId) {
        setSelectedSafeZoneForReviews(updatedZone);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Submit a custom review to a selective safe zone
  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSafeZoneForReviews || !newReviewText.trim()) return;

    try {
      const resp = await fetch(`/api/safety-map/${selectedSafeZoneForReviews.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newReviewText,
          rating: newReviewRating,
          user: "Verified Member Robert G.",
        }),
      });
      const updatedZone = await resp.json();
      setSafetyZones((prev) =>
        prev.map((z) => (z.id === selectedSafeZoneForReviews.id ? updatedZone : z))
      );
      setSelectedSafeZoneForReviews(updatedZone);
      setNewReviewText("");
    } catch (e) {
      console.error(e);
    }
  };

  // Social feed submission handler
  const handleAddSocialPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostCaption.trim()) return;

    try {
      const resp = await fetch("/api/social-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: newPostCaption,
          imageUrl: newPostImgPreset,
          locationsRecommended: [newPostLocations],
          authorName: "Robert G. Voyager"
        }),
      });
      const newPost = await resp.json();
      setPosts((prev) => [newPost, ...prev]);
      setNewPostCaption("");
      setShowAddPost(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const resp = await fetch(`/api/social-feed/${postId}/like`, { method: "POST" });
      const updatedPost = await resp.json();
      setPosts((prev) => prev.map((p) => (p.id === postId ? updatedPost : p)));
    } catch (e) {
      console.error(e);
    }
  };

  // Simulated photo upload helper for accessories engraving/postcard layout
  const handleAccessoryPhotoPreset = (url: string) => {
    setAccessoryPhotoFile(url);
  };

  // Marketplace Booking Gateway Checkout Flow
  const triggerShopCheckout = (item: Experience) => {
    setSelectedShopItem(item);
    setShowCheckoutModal(true);
    setBookingSuccessMsg("");
  };

  const handlePayCheckout = async () => {
    if (!selectedShopItem) return;
    setIsCheckingOut(true);

    try {
      const resp = await fetch("/api/marketplace/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedShopItem.id,
          photoUploaded: accessoryPhotoFile || undefined,
        }),
      });
      const newBooking = await resp.json();
      setBookings((prev) => [newBooking, ...prev]);
      setBookingSuccessMsg(`Transaction Authorized! "${selectedShopItem.title}" successfully confirmed. Check your email receipts.`);
      // Clear custom presets
      setAccessoryPhotoFile(null);
      setCustomMerchText("");
      setTimeout(() => {
        setShowCheckoutModal(false);
        setSelectedShopItem(null);
      }, 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleContextualQuickbook = (title: string, price: number) => {
    const matchedItem = marketplaceItems.find((item) => item.title === title) || {
      id: "exp1",
      title,
      price,
      category: "tours" as const,
      description: "Exclusive curated experience recommended instantly near your itinerary locations.",
      imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=400"
    };

    triggerShopCheckout(matchedItem);
  };

  // Bucket list triggers
  const handleAddBucketItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketTitle.trim()) return;

    try {
      const resp = await fetch("/api/bucket-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newBucketTitle,
          destination: newBucketDest || "Global",
        }),
      });
      const newItem = await resp.json();
      setBucketList((prev) => [newItem, ...prev]);
      setNewBucketTitle("");
      setNewBucketDest("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleBucketItem = async (itemId: string) => {
    try {
      const resp = await fetch(`/api/bucket-list/${itemId}/toggle`, { method: "POST" });
      const updatedItem = await resp.json();
      setBucketList((prev) => prev.map((item) => (item.id === itemId ? updatedItem : item)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBucketItem = async (itemId: string) => {
    try {
      const resp = await fetch(`/api/bucket-list/${itemId}`, { method: "DELETE" });
      if (resp.ok) {
        setBucketList((prev) => prev.filter((item) => item.id !== itemId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden text-slate-800 font-sans transition-all duration-300 ${
      isDarkMode ? "dark-fluid-bg-textured text-slate-100 bg-[#06040c]" : "fluid-bg-textured text-slate-800 bg-[#f1f8f6]"
    }`}>
      
      {/* ========================================================
          LEFT NAVIGATION RAIL (COZY WANDERLUST STYLE, 80px width)
          ======================================================== */}
      <nav id="nav_rail" className={`w-20 border-r flex flex-col items-center py-6 space-y-10 shrink-0 shadow-xs transition-all duration-300 ${
        isDarkMode ? "bg-[#0a0715] border-purple-950/40 text-slate-200" : "bg-slate-50 border-slate-200/85 text-slate-800"
      }`}>
        <div 
          className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center border-2 border-purple-200 cursor-pointer hover:bg-purple-200 hover:scale-105 transition-all shadow-md group relative" 
          onClick={() => {
            setIsContactFormOpen(true);
          }}
          title="Judy's Guides - Branded Contact Support"
        >
          <PaperPlaneLogo className="w-7 h-7" />
          <span className="absolute bottom-[-1.5rem] bg-slate-900 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase font-mono tracking-widest pointer-events-none whitespace-nowrap z-30">
            Contact Support
          </span>
        </div>

        <div className="flex-1 flex flex-col space-y-8 justify-center w-full">
          {/* Tab Button helper */}
          {[
            { id: "curate", icon: Compass, label: "Curate" },
            { id: "safety", icon: MapPin, label: "Local" },
            { id: "chat", icon: MessageSquare, label: "Chat" },
            { id: "social", icon: Camera, label: "Social" },
            { id: "shop", icon: ShoppingBag, label: "Shop" },
            { id: "bucket", icon: Heart, label: "Bucket" },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab_${item.id}`}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center py-2 relative transition-all duration-150 group cursor-pointer ${
                  active 
                    ? (isDarkMode ? "text-purple-300 scale-103" : "text-purple-900 scale-103") 
                    : (isDarkMode ? "text-slate-400 hover:text-purple-100" : "text-slate-500 hover:text-purple-800")
                }`}
              >
                {/* Active marker purple bar */}
                {active && (
                  <motion.div
                    layoutId="active_tab_bar"
                    className={`absolute left-0 top-1 bottom-1 w-1 rounded-r-md ${isDarkMode ? "bg-purple-400" : "bg-purple-700"}`}
                  />
                )}
                <Icon className={`w-5 h-5 mb-1 shrink-0 ${active ? "stroke-[2.5px]" : "stroke-[1.8px]"}`} />
                <span className={`text-[10px] tracking-[0.11em] uppercase text-center transition-all ${
                  active 
                    ? (isDarkMode ? "font-black text-purple-300 scale-100" : "font-black text-purple-950 scale-100") 
                    : (isDarkMode ? "font-extrabold text-slate-400 scale-95 group-hover:text-purple-200" : "font-extrabold text-slate-500 scale-95 group-hover:text-purple-900")
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* User avatar display bottom in rail */}
        <div 
          onClick={() => setIsUserProfileOpen(true)}
          className="flex flex-col items-center cursor-pointer group hover:scale-105 transition-all relative"
          title="Inspect G. Voyager Profile"
        >
          <div className={`w-11 h-11 rounded-full border-2 overflow-hidden shadow-md transition-colors ${
            isDarkMode ? "border-purple-500 group-hover:border-purple-400" : "border-purple-300 group-hover:border-purple-600"
          } bg-slate-150`}>
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150"
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <span className={`text-[8px] font-mono font-extrabold opacity-75 mt-1.5 uppercase tracking-wide leading-none transition-colors ${
            isDarkMode ? "text-purple-300 group-hover:text-purple-200" : "text-purple-900 group-hover:text-purple-800"
          }`}>
            MEMBER
          </span>
        </div>
      </nav>

      {/* ========================================================
          MAIN FULL CONTENT ENVELOPE (FLEX DIRECTION COLUMN)
          ======================================================== */}
      <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
        
        {/* TOP COMPACT BRAND HEADER (80px height) */}
        <header id="app_header" className={`h-20 px-6 lg:px-10 flex items-center justify-between border-b transition-all duration-300 ${
          isDarkMode 
            ? "border-rose-100/10 bg-[#0c0916]/95 border-purple-950/45 backdrop-blur-md shadow-xs text-purple-100" 
            : "border-rose-100/30 bg-[#e3ebf2]/95 border-[#cbd5e1] backdrop-blur-md shadow-xs text-purple-950"
        }`}>
          <div className="flex items-baseline space-x-3.5">
            <div className="relative group flex items-baseline select-none">
              <motion.h1
                id="hello_judy_title"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`text-2xl md:text-3xl font-normal font-serif tracking-normal cursor-pointer flex items-baseline transition-colors duration-200 ${
                  isDarkMode ? "text-purple-100" : "text-purple-950"
                }`}
              >
                Hello{" "}
                <span className={`cursive text-3xl font-medium tracking-normal ml-1.5 transition-colors duration-200 ${
                  isDarkMode ? "text-pink-400 group-hover:text-pink-300" : "text-purple-700 group-hover:text-purple-600"
                }`}>
                  Judy
                </span>
              </motion.h1>

              {/* Personalized welcome message tooltip/badge that transitions smoothly on hover */}
              <div className="absolute top-full left-0 mt-2.5 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-hover:scale-100 transition-all duration-300 ease-out origin-top-left z-50">
                <div className={`backdrop-blur-md border shadow-xl rounded-2xl p-4 w-72 text-left relative overflow-hidden transition-all duration-300 ${
                  isDarkMode 
                    ? "bg-[#110d21]/95 border-purple-900/40 text-slate-200" 
                    : "bg-white/95 border-purple-200 text-slate-800"
                }`}>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-400 to-indigo-500"></div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="w-10 h-10 rounded-full border border-purple-200 overflow-hidden shrink-0 bg-slate-50">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100"
                        alt="Robert's Avatar"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold leading-none ${isDarkMode ? "text-purple-200" : "text-slate-800"}`}>Robert G. Voyager</h4>
                      <p className={`text-[9px] mt-1 font-mono ${isDarkMode ? "text-purple-400" : "text-slate-400"}`}>robs46859@gmail.com</p>
                    </div>
                  </div>
                  <div className={`mt-3 pt-2.5 border-t space-y-1.5 text-xs leading-normal ${isDarkMode ? "border-purple-950/40 text-slate-300" : "border-slate-100 text-slate-600"}`}>
                    <p className={`font-medium font-sans ${isDarkMode ? "text-purple-300" : "text-purple-950"}`}>
                      ✨ Welcoming you back, Robert!
                    </p>
                    {onboardingAnswers ? (
                      <p className={`text-[10px] px-2 py-1.5 rounded-xl font-medium ${
                        isDarkMode ? "bg-purple-950/60 text-purple-300" : "bg-purple-50 text-purple-700/90"
                      }`}>
                        Your escapade to <span className={`font-extrabold uppercase ${isDarkMode ? "text-pink-300" : "text-purple-900"}`}>{onboardingAnswers.destination}</span> is set under a <span className={`font-extrabold uppercase ${isDarkMode ? "text-pink-300" : "text-purple-900"}`}>{onboardingAnswers.vibe}</span> vibe.
                      </p>
                    ) : (
                      <p className={`text-[10px] px-2 py-1.5 rounded-xl ${
                        isDarkMode ? "bg-purple-950/20 text-purple-400" : "bg-slate-50 text-slate-500"
                      }`}>
                        Ready to design your safe and colorful destination escape? Use the curator below to start!
                      </p>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[8px] font-mono text-purple-600 font-extrabold uppercase tracking-wide">
                    <span>👑 elite founder</span>
                    <span>📍 GPS secure verified</span>
                  </div>
                </div>
              </div>
            </div>
            <span className={`hidden md:inline-block text-[10px] tracking-[0.1em] font-bold uppercase pl-3 border-l ${
              isDarkMode ? "border-purple-950 text-purple-400" : "border-slate-200 text-purple-800"
            }`}>
              Your Cozy Travel Companion
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <div className={`hidden lg:flex items-center space-x-2 px-4 py-2 rounded-full border transition-all ${
              isDarkMode 
                ? "bg-purple-950/40 border-purple-900/30 text-purple-200" 
                : "bg-purple-100/70 border border-purple-200/55 text-purple-950"
            }`}>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-extrabold tracking-wider uppercase pl-1">
                Warm & Safe Environment
              </span>
            </div>

            {/* Weather Widget & Safe Status Indicator */}
            <div className={`flex items-center gap-2.5 text-xs tracking-wide font-medium transition-colors duration-200 ${
              isDarkMode ? "text-slate-200" : "text-slate-800"
            }`}>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Systems active & safe"></span>
              <div className={`flex items-center gap-2 border px-3.5 py-1.5 rounded-2xl text-[10px] font-mono font-bold shadow-2xs transition-all duration-150 cursor-pointer active:scale-95 ${
                isDarkMode 
                  ? "bg-purple-950/45 border-purple-900/40 text-purple-200 hover:bg-purple-900/45" 
                  : "bg-slate-100 border border-slate-200/80 text-slate-700 hover:bg-slate-200"
              }`}>
                <span className={`font-extrabold uppercase ${isDarkMode ? "text-pink-400" : "text-purple-800"}`}>
                  {onboardingAnswers?.destination 
                    ? (onboardingAnswers.destination.length > 9 
                        ? onboardingAnswers.destination.substring(0, 9).toUpperCase() + ".." 
                        : onboardingAnswers.destination.toUpperCase()) 
                    : "BARCELONA"} LIVE
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  {onboardingAnswers?.destination?.toLowerCase().includes("berlin") 
                    ? "☁️ 16°C COOL" 
                    : onboardingAnswers?.destination?.toLowerCase().includes("mykonos") 
                    ? "☀️ 25°C SUNNY" 
                    : onboardingAnswers?.destination?.toLowerCase().includes("bangkok") 
                    ? "☀️ 32°C TROPICAL" 
                    : "☀️ 22°C BALMY"}
                </span>
              </div>

              {/* Theme Toggle Switcher */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`flex items-center justify-center p-2 rounded-full border transition-all duration-150 cursor-pointer shadow-3xs active:scale-95 shrink-0 ${
                  isDarkMode 
                    ? "bg-amber-950/35 hover:bg-amber-900/40 border-amber-900/50 text-amber-300"
                    : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                }`}
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Collapsible Utility Sidebar Toggle */}
              <button
                onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-2xl text-[10px] font-mono font-bold tracking-wider uppercase transition-all cursor-pointer shadow-3xs active:scale-95 shrink-0 ${
                  isDarkMode 
                    ? "bg-purple-950/90 hover:bg-purple-900/90 border-purple-900 text-purple-200" 
                    : "bg-purple-100 hover:bg-purple-200/80 border border-purple-200 text-purple-950"
                }`}
                title={isRightPanelOpen ? "Collapse Assistant Panel" : "Expand Assistant Panel"}
              >
                <span>{isRightPanelOpen ? "📖 Hide Info" : "📖 Show Info"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* WORKSPACE CENTRAL COLUMN splits: Content space (col-8) & Right side Live Updates & translation widget (col-4) */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden bg-transparent">
          
          {/* ========================================================
              LEFT MAIN TAB CONTENT GRID AREA (DYNAMIC COLUMN WIDTH)
              ======================================================== */}
          <main 
            id="main_tab_viewport" 
            className={`transition-all duration-300 p-6 md:p-8 overflow-y-auto border-r border-slate-200/60 flex flex-col h-full bg-white/88 backdrop-blur-md shadow-xs ${
              isRightPanelOpen ? "col-span-12 xl:col-span-7" : "col-span-12 xl:col-span-12"
            }`}
          >
            
            <AnimatePresence mode="wait">
              
              {/* TAB 1: CURATE / TRIP PLANNER WIZARD */}
              {activeTab === "curate" && (
                <motion.div
                  key="tab_curate_view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 flex-1 flex flex-col justify-between"
                >
                  {!onboardingAnswers ? (
                    <Onboarding onComplete={handleOnboardingComplete} />
                  ) : (
                    <ItineraryViewer
                      itinerary={activeItinerary}
                      isLoading={isItineraryLoading}
                      onRegenerate={handleResetOrboarding}
                      onBookExperience={handleContextualQuickbook}
                    />
                  )}
                </motion.div>
              )}

              {/* TAB 2: SAFETY & MAP VIEW */}
              {activeTab === "safety" && (
                <motion.div
                  key="tab_safety_view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <span className="text-[10px] text-purple-700 tracking-widest uppercase font-mono block mb-1">Interactive Community Hub</span>
                      <h2 className="text-3xl font-normal text-purple-950 font-serif">Community Safety Map</h2>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Soft coordinate vector mapping showing real-time safe spaces, security corridors and night hotspots verified by friendly Judy advisors.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-widest text-slate-400">Offline Cache:</span>
                      <button
                        onClick={() => setIsOfflineMapDownloaded(!isOfflineMapDownloaded)}
                        className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                          isOfflineMapDownloaded
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}
                      >
                        {isOfflineMapDownloaded ? "● Activated (24MB Cached)" : "○ Download Map"}
                      </button>
                    </div>
                  </div>

                  {/* CUSTOM MAP VISUALIZATION PANEL */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    
                    {/* The Interactive Coordinate-based Vector Map Canvas */}
                    <div className="lg:col-span-7 bg-slate-50 min-h-[350px] rounded-3xl border border-slate-200 relative overflow-hidden flex flex-col justify-between p-6">
                      
                      {/* Stylized vector contour grid */}
                      <div className="absolute inset-0 opacity-10 pointer-events-none pulse-glow" style={{ backgroundImage: "radial-gradient(#7e22ce 1px, transparent 1px)", backgroundSize: "16px 16px" }}></div>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.04),transparent)] pointer-events-none"></div>

                      <div className="relative z-10 flex justify-between items-center bg-white/80 backdrop-blur-md border border-slate-200 p-3.5 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <Navigation className="w-4 h-4 text-purple-700 animate-bounce shrink-0" />
                          <span className="text-xs font-bold text-slate-800">
                            Active Safe Coordinates: GPS Verified Locally
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 uppercase">
                          SFO · BCN · BER
                        </div>
                      </div>

                      {/* Floating Layers Selection Tool Overlay */}
                      <div className="absolute top-[84px] right-6 z-20 flex flex-col items-end gap-2">
                        <button
                          onClick={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-purple-300 rounded-xl text-[10px] font-bold text-slate-700 shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer uppercase tracking-wider font-sans"
                        >
                          <span className="text-purple-700 font-extrabold">🥞 Layers Toggle</span>
                          <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-mono font-bold leading-none">
                            {Object.values(activeMapLayers).filter(Boolean).length}/4
                          </span>
                        </button>

                        {isLayersPanelOpen && (
                          <div
                            className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-lg w-48 text-left space-y-2"
                          >
                            <span className="text-[9px] font-mono font-semibold text-slate-400 uppercase tracking-widest block pb-1 border-b border-rose-105">
                              Map Layers Panel
                            </span>
                            <div className="flex flex-col gap-1.5 pt-1">
                              {[
                                { id: 'safety', label: '🛡️ Safety Scores', desc: 'Display safety indices' },
                                { id: 'nightlife', label: '🍸 Nightlife Hubs', desc: 'Bars & nightclubs' },
                                { id: 'culture', label: '🏛️ Culture Center', desc: 'Safe cultural spots' },
                                { id: 'corridors', label: '🛣️ Safe Corridors', desc: 'Monitored sidewalks' },
                              ].map((layer) => (
                                <label
                                  key={layer.id}
                                  className="flex items-start gap-2 p-1 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={activeMapLayers[layer.id as keyof typeof activeMapLayers]}
                                    onChange={() => toggleMapLayer(layer.id as any)}
                                    className="mt-0.5 w-3.5 h-3.5 rounded accent-purple-700 cursor-pointer"
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-extrabold text-[#111827] leading-none">{layer.label}</span>
                                    <span className="text-[8px] text-slate-400 mt-0.5 leading-none">{layer.desc}</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Map Points stage */}
                      <div className="relative flex-1 w-full flex items-center justify-center min-h-[200px]">
                        
                        {/* Simulated ocean water / land contour visual */}
                        <div className="absolute w-4/5 h-4/5 border border-slate-200 rounded-full opacity-30 transform -rotate-12 pointer-events-none"></div>
                        <div className="absolute w-1/2 h-1/2 border border-purple-500/15 rounded-full opacity-25 pointer-events-none"></div>

                        {safetyZones
                          .filter((zone) => {
                            if (zone.category === "Bar/Nightclub" && !activeMapLayers.nightlife) return false;
                            if ((zone.category === "Cultural Center" || zone.category === "Sauna") && !activeMapLayers.culture) return false;
                            if (zone.category === "General Area" && !activeMapLayers.corridors) return false;
                            return true;
                          })
                          .map((zone) => {
                            const isSelected = selectedSafeZoneForReviews?.id === zone.id;
                            return (
                              <button
                                key={zone.id}
                                onClick={() => setSelectedSafeZoneForReviews(zone)}
                                className="absolute transition-all transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
                                style={{ left: `${zone.coords.x}%`, top: `${zone.coords.y}%` }}
                              >
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-xl transition-all ${
                                    isSelected
                                      ? "bg-purple-700 border-white text-white scale-110 z-30"
                                      : "bg-white border-slate-300 text-purple-750 group-hover:border-purple-700 group-hover:text-purple-900 shadow-sm"
                                  }`}
                                >
                                  <span className="text-[10px] font-extrabold uppercase font-mono">
                                    {activeMapLayers.safety ? zone.safetyScore.toFixed(1) : "📍"}
                                  </span>
                                </div>
                                <span className="hidden sm:inline-block text-[9px] font-bold bg-slate-850 text-white rounded px-2 py-0.5 mt-1 opacity-70 group-hover:opacity-100 transition-opacity uppercase tracking-widest whitespace-nowrap">
                                  {zone.title.split(" ")[0]}
                                </span>
                              </button>
                            );
                          })}
                      </div>

                      {/* Map legend */}
                      <div className="relative z-10 flex flex-wrap gap-3 p-3 bg-white/90 border border-slate-200 rounded-xl text-[10px] uppercase text-slate-500 mt-2">
                        <span className="font-bold text-slate-800 pr-2 border-r border-slate-200 shrink-0">Map Legend:</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-700"></span> Selected Hub</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-200 border border-purple-400"></span> Safe Hotspots</span>
                        <span className="ml-auto font-mono text-purple-700 tracking-normal">Offline status: OK</span>
                      </div>
                    </div>

                    {/* Safe Spot detailed review panel & contribute point form */}
                    <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
                      
                      {/* Active Spot Detail Display */}
                      {selectedSafeZoneForReviews && (
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="px-2 py-0.5 bg-purple-100 border border-purple-200 text-purple-800 text-[9px] font-bold uppercase rounded">
                                {selectedSafeZoneForReviews.category}
                              </span>
                              <h3 className="text-xl font-bold text-slate-800 mt-1.5">{selectedSafeZoneForReviews.title}</h3>
                              <p className="text-xs text-slate-500 mt-0.5">{selectedSafeZoneForReviews.address}</p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Safety Score</span>
                              <span className="text-3xl font-extrabold text-purple-700 font-sans">
                                {selectedSafeZoneForReviews.safetyScore}
                              </span>
                            </div>
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-bold">Crowd density</span>
                              <span className="font-semibold text-slate-800">{selectedSafeZoneForReviews.crowdLevel}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block text-[9px] uppercase font-bold">Verifications</span>
                              <button
                                onClick={() => handleVerifyZone(selectedSafeZoneForReviews.id)}
                                className="text-xs text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                                type="button"
                              >
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>{selectedSafeZoneForReviews.verificationCount} Upvotes</span>
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {selectedSafeZoneForReviews.tags.map((tag) => (
                              <span key={tag} className="px-2.5 py-1 bg-white text-slate-600 border border-slate-200 text-[10px] uppercase font-mono rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>

                          {/* Interactive User Reviews logs list */}
                          <div className="space-y-3.5 pt-4 border-t border-slate-200">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                              Community Safety Reviews ({selectedSafeZoneForReviews.reviews.length})
                            </span>

                            <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                              {selectedSafeZoneForReviews.reviews.map((rev) => (
                                <div key={rev.id} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-200">
                                        <img src={rev.avatar} className="object-cover w-full h-full" />
                                      </div>
                                      <span className="font-bold text-xs text-slate-800">{rev.user}</span>
                                    </div>
                                    <span className="text-[9px] text-purple-700 font-mono">
                                      {"★".repeat(rev.rating)}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 text-xs italic font-light leading-relaxed">
                                    "{rev.text}"
                                  </p>
                                </div>
                              ))}
                            </div>

                            {/* Submit Review box */}
                            <form onSubmit={handleAddReview} className="pt-2 flex gap-2">
                              <input
                                type="text"
                                placeholder="Add real-time safety review message..."
                                value={newReviewText}
                                onChange={(e) => setNewReviewText(e.target.value)}
                                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs placeholder-slate-400 focus:outline-none focus:border-purple-600 text-slate-850"
                              />
                              <select
                                value={newReviewRating}
                                onChange={(e) => setNewReviewRating(Number(e.target.value))}
                                className="bg-white border border-slate-200 rounded-xl px-2 text-xs text-slate-800"
                              >
                                <option value={5}>5★</option>
                                <option value={4}>4★</option>
                                <option value={3}>3★</option>
                              </select>
                              <button
                                type="submit"
                                className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                              >
                                Add
                              </button>
                            </form>
                          </div>
                        </div>
                      )}

                      {/* Register New Safe Spot Box */}
                      <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-4">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-purple-700" />
                          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-800">Contribute Safe Zone Point</h4>
                        </div>

                        <form onSubmit={handleAddSafeSpot} className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Venue / Spot Name"
                              value={newSpotTitle}
                              onChange={(e) => setNewSpotTitle(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-850 focus:outline-none focus:border-purple-600"
                            />
                            <input
                              type="text"
                              placeholder="Street Address, Town"
                              value={newSpotAddress}
                              onChange={(e) => setNewSpotAddress(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-850 focus:outline-none focus:border-purple-600"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={newSpotCategory}
                              onChange={(e) => setNewSpotCategory(e.target.value as any)}
                              className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none"
                            >
                              <option value="Bar/Nightclub">Bar / Nightclub</option>
                              <option value="Cultural Center">Cultural Center</option>
                              <option value="General Area">General Safety Corridor</option>
                              <option value="Sauna">Sauna / Spa</option>
                            </select>

                            <input
                              type="text"
                              placeholder="Tags (comma separated)"
                              value={newSpotTagText}
                              onChange={(e) => setNewSpotTagText(e.target.value)}
                              className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-600"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-xs font-bold uppercase tracking-widest text-white rounded-xl active:scale-95 transition-all cursor-pointer"
                          >
                            Submit Safe Spot for verification
                          </button>
                        </form>

                        {newSpotAddressMsg && (
                          <div className="text-[11px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-center">
                            {newSpotAddressMsg}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: GUIDE PRIVATE CHAT */}
              {activeTab === "chat" && (
                <motion.div
                  key="tab_chat_view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 flex-1 flex flex-col justify-between"
                >
                  <div className="border-b border-slate-200 pb-4">
                    <span className="text-[10px] text-purple-700 tracking-widest uppercase font-mono block mb-1">Secure Private Communication</span>
                    <h2 className="text-3xl font-normal text-purple-950 font-serif">Connect with Verified Local Guides</h2>
                    <p className="text-slate-500 text-xs mt-1">
                      Arrange bespoke city tours, skip-the-line club access, and customized safe escorts with bilingual residents.
                    </p>
                  </div>

                  {/* CHAT GRAPHIC GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch min-h-[450px]">
                    
                    {/* Left guides select list */}
                    <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-3xl p-5 flex flex-col">
                      <span className="block text-[10px] text-slate-500 uppercase font-mono tracking-widest mb-4">
                        Available local experts
                      </span>

                      <div className="space-y-3.5">
                        {guides.map((g) => {
                          const isSelected = selectedGuideId === g.id;
                          return (
                            <button
                              key={g.id}
                              onClick={() => setSelectedGuideId(g.id)}
                              className={`w-full flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-purple-50/50 border-purple-600 shadow-sm"
                                  : "border-slate-200 bg-white hover:bg-slate-100/50"
                              }`}
                            >
                              <div className="relative shrink-0">
                                <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200">
                                  <img src={g.avatar} className="object-cover w-full h-full" />
                                </div>
                                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${g.online ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                              </div>

                              <div className="space-y-1">
                                <span className="font-bold text-xs text-slate-800 block">{g.name}</span>
                                <span className="text-[10px] text-slate-500 block">{g.location}</span>
                                <span className="text-[10px] font-mono text-purple-700 font-bold">★ {g.rating} Rating</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Info on security constraints */}
                      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-[11px] text-slate-650 leading-normal space-y-1.5 mt-6">
                        <div className="flex items-center gap-1.5 text-emerald-800 font-bold uppercase tracking-wider text-[10px] font-mono">
                          <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>COZY SECURITY PROTOCOL</span>
                        </div>
                        <p>All messaging channels are private, encrypted end-to-end, and support immediate live coordinates transmission.</p>
                      </div>
                    </div>

                    {/* Right active chat thread box */}
                    <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl flex flex-col justify-between overflow-hidden">
                      {/* Active Guide topbar */}
                      {(() => {
                        const activeGuide = guides.find((g) => g.id === selectedGuideId);
                        if (!activeGuide) return null;
                        return (
                          <div className="bg-slate-50 p-4.5 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full overflow-hidden border border-purple-200">
                                <img src={activeGuide.avatar} className="object-cover w-full h-full" />
                              </div>
                              <div>
                                <span className="font-bold text-sm text-slate-800 block">{activeGuide.name}</span>
                                <span className="text-[10px] text-slate-500 font-light block">
                                  Languages: {activeGuide.languages.join(", ")}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => triggerShopCheckout(marketplaceItems[1])}
                              className="bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-1.5 rounded-full text-[10px] tracking-widest font-bold uppercase shrink-0 cursor-pointer"
                            >
                              Book Curated Experience
                            </button>
                          </div>
                        );
                      })()}

                      {/* Messages screen container */}
                      <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[380px]">
                        {messages
                          .filter((m) => m.senderId === selectedGuideId || m.receiverId === selectedGuideId)
                          .map((msg) => {
                            const isMe = msg.senderId === "user";
                            return (
                              <div
                                key={msg.id}
                                className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-2`}
                              >
                                {!isMe && (
                                  <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                    <img src={guides.find((gt) => gt.id === selectedGuideId)?.avatar} className="object-cover w-full h-full" />
                                  </div>
                                )}
                                <div
                                  className={`max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                                    isMe
                                      ? "bg-purple-700 text-white rounded-br-none font-medium"
                                      : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"
                                  }`}
                                >
                                  {msg.text}
                                  <span className="block text-[8px] opacity-60 font-mono text-right mt-1.5">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Chat text box submission */}
                      <div className="bg-slate-50 border-t border-slate-200 p-4 flex gap-2">
                        <input
                          type="text"
                          placeholder="Type safe, secure message..."
                          value={chatInputText}
                          onChange={(e) => setChatInputText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSendChatMessage();
                          }}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs placeholder-slate-400 focus:outline-none focus:border-purple-650 text-slate-800"
                        />

                        <button
                          onClick={handleSendChatMessage}
                          className="bg-purple-700 hover:bg-purple-800 px-5.5 rounded-xl text-white flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer"
                        >
                          <Send className="w-4 h-4 text-white" />
                        </button>
                      </div>

                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: MEMBER FEED */}
              {activeTab === "social" && (
                <motion.div
                  key="tab_social_view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="border-b border-slate-200 pb-4 flex flex-col justify-between items-start lg:flex-row lg:items-center gap-4">
                    <div>
                      <span className="text-[10px] text-purple-700 tracking-widest uppercase font-mono block mb-1">Verifiable Community Moments</span>
                      <h2 className="text-3xl font-normal text-purple-950 font-serif">Judy's Space</h2>
                      <p className="text-slate-500 text-xs mt-1">
                        Browse verified queer reviews or curate custom print-quality physical albums of your travels.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setSocialSubTab("feed")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          socialSubTab === "feed"
                            ? "bg-purple-950 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        📬 Moments Feed
                      </button>
                      <button
                        onClick={() => setSocialSubTab("album")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          socialSubTab === "album"
                            ? "bg-purple-950 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        📖 Album Editor
                      </button>

                      {socialSubTab === "feed" && (
                        <button
                          onClick={() => setShowAddPost(!showAddPost)}
                          className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
                        >
                          {showAddPost ? "Close Post" : "Post Moment"}
                        </button>
                      )}
                    </div>
                  </div>

                  {socialSubTab === "feed" ? (
                    <>
                      {/* Submit moment form */}
                      {showAddPost && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4"
                        >
                          <h3 className="text-lg font-bold text-slate-800">Write Your Wanderlust Recommendation</h3>
                          <form onSubmit={handleAddSocialPost} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] uppercase text-slate-500 font-bold block">Caption experience</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Discovered an awesome beach lounge with stellar reviews!"
                                  value={newPostCaption}
                                  onChange={(e) => setNewPostCaption(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-purple-650 text-slate-800 focus:outline-none"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] uppercase text-slate-500 font-bold block">Recommended Spot location</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Sitges Beach, Spain"
                                  value={newPostLocations}
                                  onChange={(e) => setNewPostLocations(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-purple-650 text-slate-800 focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* Presets representing file selection upload */}
                            <div className="space-y-2.5">
                              <label className="text-[10px] uppercase text-slate-500 font-bold block">
                                Select Journey Imagery
                              </label>
                          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                            {[
                              { id: "sitges", label: "Sitges Beachfront", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=600" },
                              { id: "mykon", label: "Mykonos Aegean", url: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=600" },
                              { id: "berlin", label: "Berlin Schöneberg", url: "https://images.unsplash.com/photo-1546726747-cd916d0c122f?auto=format&fit=crop&q=80&w=600" },
                              { id: "castro", label: "Castro District SF", url: "https://images.unsplash.com/photo-1517713982677-4c6638865c67?auto=format&fit=crop&q=80&w=600" },
                              { id: "tokyo", label: "Tokyo Silom Pulse", url: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&q=80&w=600" },
                            ].map((preset) => {
                              const active = newPostImgPreset === preset.url;
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => setNewPostImgPreset(preset.url)}
                                  className={`p-1 border rounded-lg transition-all text-center relative overflow-hidden h-14 cursor-pointer ${
                                    active ? "border-purple-600" : "border-slate-200"
                                  }`}
                                >
                                  <img src={preset.url} className="absolute inset-0 object-cover w-full h-full opacity-60 hover:opacity-100" />
                                  <span className="absolute bottom-1 left-1 bg-black/60 text-[8px] px-1 text-white truncate w-[90%]">
                                    {preset.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="py-2.5 px-6 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold uppercase rounded-xl cursor-pointer"
                        >
                          Publish Verified Moment
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {/* Posts Grid Container */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {posts.map((post) => (
                      <div key={post.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col justify-between group shadow-sm">
                        {/* Post image */}
                        <div className="relative aspect-video overflow-hidden">
                          <img
                            src={post.imageUrl}
                            alt={post.caption}
                            className="object-cover w-full h-full group-hover:scale-105 transition-all duration-700"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/20 to-transparent p-4 flex items-center justify-between">
                            <span className="text-[10px] uppercase font-mono tracking-widest text-purple-700 bg-white shadow px-2.5 py-1 rounded font-bold">
                              {post.locationsRecommended[0] || "Destination"}
                            </span>
                          </div>
                        </div>

                        {/* Author info & caption content */}
                        <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-slate-150">
                                  <img src={post.author.avatar} alt={post.author.name} className="object-cover w-full h-full" />
                                </div>
                                <div>
                                  <span className="font-bold text-xs text-slate-800 block">{post.author.name}</span>
                                  <span className="text-[9px] text-slate-400 block uppercase tracking-widest font-mono">{post.author.location}</span>
                                </div>
                              </div>

                              {post.author.verified && (
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded text-[8px] font-bold uppercase font-mono tracking-widest">
                                  ✓ Verified Member
                                </span>
                              )}
                            </div>

                            <p className="text-slate-600 text-xs italic font-light leading-relaxed pt-2">
                              "{post.caption}"
                            </p>
                          </div>

                          {/* Post social counters trigger */}
                          <div className="flex items-center gap-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-mono">
                            <button
                              onClick={() => handleLikePost(post.id)}
                              className={`flex items-center gap-1 hover:text-rose-650 transition-colors cursor-pointer ${
                                post.hasLiked ? "text-rose-600 font-bold" : ""
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${post.hasLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                              <span>{post.likesCount} Loves</span>
                            </button>

                            <span>·</span>
                            <span>{post.commentsCount} Comments</span>
                            <span className="ml-auto text-[9px] text-slate-400">{post.date}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                  ) : (
                    <PhotoAlbumEditor destination={activeItinerary?.destination || "Barcelona"} />
                  )}
                </motion.div>
              )}

              {/* TAB 5: MARKETPLACE */}
              {activeTab === "shop" && (
                <motion.div
                  key="tab_marketplace_view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="border-b border-slate-200 pb-4">
                    <span className="text-[10px] text-purple-700 tracking-widest uppercase font-mono block mb-1">Secure Integrated Marketplace</span>
                    <h2 className="text-3xl font-normal text-purple-950 font-serif">Tickets, Merchandise & Accessories</h2>
                    <p className="text-slate-500 text-xs mt-1">
                      Purchase guided experiences, pride party tickets, or order personalized physical items with engraved photo memories.
                    </p>
                  </div>

                  {/* Active orders showcase block */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-[10px] text-slate-700 uppercase tracking-widest font-mono font-bold">
                        Your Order History & Active Bookings ({bookings.length})
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {bookings.map((book) => (
                        <div key={book.id} className="bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-xs flex items-center gap-3 shadow-xs">
                          <div>
                            <span className="text-[9px] text-slate-400 block font-bold font-mono">ITEM SUCCESS</span>
                            <span className="font-bold text-slate-800">{book.itemTitle}</span>
                          </div>
                          <span className="text-[10px] font-mono text-purple-700 font-bold pl-2 border-l border-slate-200">
                            ${book.totalPrice.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Catalog display grids */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {marketplaceItems.map((item) => {
                      const isDigitalSouv = item.category === "postcards" || item.category === "souvenirs";
                      return (
                        <div key={item.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col justify-between p-5 space-y-4 shadow-xs">
                          <div className="space-y-3">
                            <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                              <span className="absolute top-2.5 right-2.5 bg-purple-700 uppercase text-[9px] text-white font-extrabold px-2.5 py-1 rounded">
                                {item.category}
                              </span>
                            </div>

                            <div>
                              <h3 className="font-bold text-slate-800 text-sm group-hover:text-purple-700 leading-tight">
                                {item.title}
                              </h3>
                              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed font-light">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          {/* Customized souvenir accessories panel upload button */}
                          {isDigitalSouv && (
                            <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-100 space-y-2">
                              <span className="block text-[9px] text-purple-800 font-mono uppercase tracking-widest font-bold">
                                Engrave Photo accessory
                              </span>
                              
                              <p className="text-[10px] text-slate-500 leading-relaxed">
                                Click below to mock upload a custom travel photograph to print:
                              </p>

                              <div className="flex gap-2">
                                {[
                                  { id: "img1", name: "Sitges", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=300" },
                                  { id: "img2", name: "Mykonos", url: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=300" },
                                  { id: "img3", name: "Old SF", url: "https://images.unsplash.com/photo-1517713982677-4c6638865c67?auto=format&fit=crop&q=80&w=300" },
                                ].map((ph) => {
                                  const select = ph.url === accessoryPhotoFile;
                                  return (
                                    <button
                                      key={ph.id}
                                      type="button"
                                      onClick={() => handleAccessoryPhotoPreset(ph.url)}
                                      className={`text-[9px] px-2 py-1 rounded border transition-all cursor-pointer ${
                                        select ? "bg-purple-700 border-white text-white font-bold" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                      }`}
                                    >
                                      {ph.name}
                                    </button>
                                  );
                                })}
                              </div>

                              {accessoryPhotoFile && (
                                <div className="flex items-center gap-2 pt-1">
                                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-[10px] text-emerald-700 font-bold font-mono">Photo Attachment Linked</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-lg font-bold font-mono text-purple-700">
                              ${item.price.toFixed(2)}
                            </span>

                            <button
                              onClick={() => triggerShopCheckout(item)}
                              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold uppercase rounded-xl cursor-pointer"
                            >
                              Checkout securely
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* TAB 6: CUSTOM TRAVEL BUCKET LIST */}
              {activeTab === "bucket" && (
                <motion.div
                  key="tab_bucket_view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="border-b border-slate-200 pb-4">
                    <span className="text-[10px] text-purple-700 tracking-widest uppercase font-mono block mb-1">Tailored Goal Setting</span>
                    <h2 className="text-3xl font-normal text-purple-950 font-serif">Travel Bucket List</h2>
                    <p className="text-slate-500 text-xs mt-1">
                      Define the milestones of your life's journeys, cross completed events, and share schedules globally in real-time.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    
                    {/* Add goal bucket form */}
                    <div className="lg:col-span-4 bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col justify-between shadow-sm">
                      <div className="space-y-4">
                        <h3 className="font-bold text-purple-800 uppercase text-xs tracking-widest font-mono">Create Bucket Goal</h3>
                        
                        <form onSubmit={handleAddBucketItem} className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase text-slate-500 font-bold block">Milestone Action</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Visit Gaixample Wine Cellar"
                              value={newBucketTitle}
                              onChange={(e) => setNewBucketTitle(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:border-purple-600 focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase text-slate-500 font-bold block">Destination location</label>
                            <input
                              type="text"
                              placeholder="e.g. Barcelona, Spain"
                              value={newBucketDest}
                              onChange={(e) => setNewBucketDest(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:border-purple-600 focus:outline-none"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold uppercase rounded-xl cursor-pointer"
                          >
                            Add to list
                          </button>
                        </form>
                      </div>

                      <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 mt-6 text-xs text-slate-650 leading-relaxed font-light">
                        <span className="font-bold text-purple-800 block mb-1">Direct Social Publishing:</span>
                        Your checked-off milestones can be instantly syndicated with verified links to friends on social handles in real-time!
                      </div>
                    </div>

                    {/* Bucket list display tracker item logs */}
                    <div className="lg:col-span-8 bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-4">
                      <span className="block text-xs uppercase tracking-widest text-slate-500 font-bold font-mono">
                        Target Achievements list ({bucketList.length})
                      </span>

                      <div className="space-y-3">
                        {bucketList.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                              item.completed
                                ? "bg-emerald-50 border-emerald-200 text-slate-500"
                                : "bg-white border-slate-200 text-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-3 select-none">
                              <button
                                onClick={() => handleToggleBucketItem(item.id)}
                                className={`w-5.5 h-5.5 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                                  item.completed
                                    ? "bg-emerald-600 border-transparent text-white font-extrabold"
                                    : "border-slate-350 hover:border-purple-600 bg-white"
                                }`}
                              >
                                {item.completed && "✓"}
                              </button>
                              
                              <div>
                                <span className={`text-xs font-bold block ${item.completed ? "line-through opacity-50" : ""}`}>
                                  {item.title}
                                </span>
                                <span className="text-[10px] text-slate-400 block uppercase font-mono">
                                  In {item.destination}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteBucketItem(item.id)}
                              className="text-slate-400 hover:text-red-500 p-2 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </main>

          {/* ========================================================
              RIGHT BAR: REAL-TIME FLIGHT STATS & GEMINI TRANSLATION (COL-5 LARGER LAYOUT)
              ======================================================== */}
          {isRightPanelOpen && (
            <aside id="right_utility_sidebar" className="hidden xl:flex xl:col-span-5 flex-col bg-slate-50/50 overflow-y-auto max-h-[85vh] h-full border-l border-slate-200">
            
            {/* FLIGHT STATS CONTROLLER */}
            <div className="p-6 border-b border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                  Live Flight Tracker
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>

              <div className="space-y-2.5 transition-all duration-300 overflow-y-auto max-h-[400px]">
                {(isFlightsExpanded ? flights : flights.slice(0, 1)).map((flight) => {
                  const isDelayed = flight.status === "Delayed";
                  const isBoarding = flight.status === "Boarding";
                  return (
                    <motion.div 
                      key={flight.id} 
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-white hover:bg-slate-50/50 rounded-2xl border border-slate-200 relative shadow-sm hover:shadow-md transition-all duration-150"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-slate-805">{flight.flightNumber}</span>
                          <span className="text-[9px] text-slate-400 font-mono block leading-tight">{flight.airline}</span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border leading-none ${
                              isDelayed
                                ? "bg-rose-50 text-rose-750 border-rose-100"
                                : isBoarding
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-emerald-50 text-emerald-800 border-emerald-100"
                            }`}
                          >
                            {flight.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-end mt-2 text-[11px]">
                        <div>
                          <span className="text-[8px] text-slate-400 block font-bold leading-none">ROUTE</span>
                          <span className="font-semibold text-slate-700">{flight.origin} → {flight.destination}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] text-slate-400 block leading-none">UPDATED</span>
                          <span className="font-semibold text-slate-750 font-mono text-[10px]">{flight.gate} ({flight.terminal})</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Expand Toggle Trigger */}
              <div className="pt-1">
                <button
                  onClick={() => setIsFlightsExpanded(!isFlightsExpanded)}
                  className="w-full py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-[10px] font-extrabold text-purple-900 uppercase tracking-widest transition-all duration-150 active:scale-95 cursor-pointer text-center"
                >
                  {isFlightsExpanded ? "Collapse Live Tracker" : `Show All departures (${flights.length})`}
                </button>
              </div>
            </div>

            {/* DYNAMIC GEMINI TRANSLATION WIDGET */}
            <div className="p-6 bg-slate-50/20 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                    Multilingual Assistant by Gemini
                  </span>
                  <Globe className="w-4 h-4 text-purple-700" />
                </div>

                <div className="space-y-3">
                  <textarea
                    rows={3}
                    placeholder="Type words, menu items, local custom queries..."
                    value={translateText}
                    onChange={(e) => setTranslateText(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs placeholder-slate-400 focus:outline-none focus:border-purple-600 text-slate-800 shadow-sm"
                  />

                  <div className="flex items-center gap-2">
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-600 shadow-sm"
                    >
                      <option value="Spanish">Spanish (Catalan Hub)</option>
                      <option value="German">German (Berlin Schöneberg)</option>
                      <option value="Greek">Greek (Mykonos Hotspot)</option>
                      <option value="Thai">Thai (Silom Pride)</option>
                      <option value="Japanese">Japanese (Shinjuku Art)</option>
                    </select>

                    <button
                      onClick={handleTranslateText}
                      disabled={isTranslating}
                      className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold uppercase rounded-xl transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      {isTranslating ? "Translating..." : "Translate"}
                    </button>
                  </div>
                </div>

                {translatedResult && (
                  <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 space-y-2 shadow-xs">
                    <span className="text-[9px] text-purple-800 font-mono uppercase tracking-widest block font-bold">
                      BILINGUAL DECYPHERED TEXT:
                    </span>
                    <p className="text-xs text-slate-750 leading-relaxed italic font-serif">
                      {translatedResult}
                    </p>
                  </div>
                )}
              </div>

              {/* Safety notification tip widget */}
              <div className="bg-purple-50 border border-purple-100 p-4.5 rounded-3xl mt-6 space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2">
                  <BadgeAlert className="w-4 h-4 text-purple-700 shrink-0" />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-purple-950 font-mono">
                    Community Safety Patrol Warning
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal font-light">
                  No active crowd-warnings for Barcelona Old Town tonight. Patrol shifts are currently active to ensure fully stress-free experiences.
                </p>
              </div>

            </div>

          </aside>
          )}

        </div>

        {/* BOTTOM GLOBAL UTILITY FOOTER (h-12) */}
        <footer id="app_footer" className="h-12 px-6 md:px-8 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0 font-mono text-[10px] text-slate-500">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="uppercase text-slate-600 tracking-widest font-medium">
                Integrated Real-Time Marketplace Live
              </span>
            </div>
            
            <div className="hidden md:inline-block h-3 w-px bg-slate-300"></div>

            <div className="hidden md:flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-650"></span>
              <span className="uppercase text-slate-600 tracking-widest font-medium">
                Offline Map Sync OK ({safetyZones.length} Nodes)
              </span>
            </div>
          </div>

          <div className="uppercase tracking-[0.2em] font-medium hidden sm:block text-slate-500">
            Judy's v3.0 — Powered by local queer champions
          </div>
        </footer>

      </div>

      {/* ========================================================
          MARKETPLACE CHECKOUT SECURE MODAL WINDOW
          ======================================================== */}
      {showCheckoutModal && selectedShopItem && (
        <div id="checkout_modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-3xl w-full max-w-lg space-y-6 relative text-slate-850 shadow-2xl">
            
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-purple-700 tracking-widest uppercase font-mono block">
                  Secure Checkout Terminal
                </span>
                <h3 className="text-2xl font-normal font-serif text-purple-950 mt-1">Authorized Purchase</h3>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-slate-400 hover:text-purple-700 font-mono text-xs uppercase cursor-pointer py-1 font-bold"
              >
                Cancel / Close
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-[9px] text-slate-400 uppercase block font-bold">Selected Experience Type</span>
                <span className="font-bold text-sm text-slate-800">{selectedShopItem.title}</span>
              </div>
              <span className="text-xl font-bold text-purple-700 font-mono shrink-0">
                ${selectedShopItem.price.toFixed(2)}
              </span>
            </div>

            {/* Photo Attachment Confirmation if present */}
            {accessoryPhotoFile && (
              <div className="p-3.5 bg-purple-50 border border-purple-100 rounded-2xl flex items-center gap-3">
                <div className="w-12 h-10 rounded overflow-hidden shrink-0 border border-purple-200 bg-white">
                  <img src={accessoryPhotoFile} className="object-cover w-full h-full" />
                </div>
                <div>
                  <span className="text-[9px] text-purple-800 uppercase font-bold block">Accessory Custom Engraving Attached</span>
                  <span className="text-[10px] text-slate-500">High-resolution custom travel postcard file will compile automatically</span>
                </div>
              </div>
            )}

            {/* Simulated Payment Card Form */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Credit Card Number</label>
                <input
                  type="text"
                  value={checkoutCardNumber}
                  onChange={(e) => setCheckoutCardNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-mono text-slate-800 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Holder Name</label>
                  <input
                    type="text"
                    value={checkoutCardHolder}
                    onChange={(e) => setCheckoutCardHolder(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-xs text-slate-800 focus:border-purple-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Expiry</label>
                  <input
                    type="text"
                    value={checkoutExpiry}
                    onChange={(e) => setCheckoutExpiry(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-xs text-slate-850 font-mono focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {bookingSuccessMsg ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold text-center uppercase tracking-widest animate-pulse leading-relaxed">
                {bookingSuccessMsg}
              </div>
            ) : (
              <button
                onClick={handlePayCheckout}
                disabled={isCheckingOut}
                className="w-full py-3.5 bg-purple-700 hover:bg-purple-800 rounded-2xl text-xs font-bold uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isCheckingOut ? "Connecting Payment Gateway..." : "Authorize Secure Payment Gateway"}
              </button>
            )}

            <div className="flex justify-center items-center gap-2 text-[9px] text-slate-400 uppercase tracking-widest">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>PCI-DSS Decrypted SSL Encryption</span>
            </div>

          </div>
        </div>
      )}

      {/* CUSTOM OVERLAY INTERACTIVE MODALS */}
      {isUserProfileOpen && (
        <UserProfileModal 
          isOpen={isUserProfileOpen} 
          onClose={() => setIsUserProfileOpen(false)} 
          userEmail="robs46859@gmail.com" 
        />
      )}

      {isContactFormOpen && (
        <ContactFormModal 
          isOpen={isContactFormOpen} 
          onClose={() => setIsContactFormOpen(false)} 
        />
      )}

    </div>
  );
}

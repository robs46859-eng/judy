import React, { useState } from "react";
import { BookOpen, Sparkles, Image as ImageIcon, ArrowLeft, ArrowRight, Eye, Check, ShoppingCart, Heart, Printer } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Pre-provided stunning travel imagery for the user to compose their album with
const PRESET_PHOTOS = [
  { id: "ph1", title: "Sitges Golden Coast", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400", location: "Sitges, Spain" },
  { id: "ph2", title: "Mykonos Aegean Windmills", url: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=400", location: "Mykonos, Greece" },
  { id: "ph3", title: "Schöneberg Coffee Culture", url: "https://images.unsplash.com/photo-1546726747-cd916d0c122f?auto=format&fit=crop&q=80&w=400", location: "Berlin, Germany" },
  { id: "ph4", title: "Castro District SF Viewpoint", url: "https://images.unsplash.com/photo-1517713982677-4c6638865c67?auto=format&fit=crop&q=80&w=400", location: "San Francisco, USA" },
  { id: "ph5", title: "Silom Sparkling Horizon", url: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&q=80&w=400", location: "Bangkok, Thailand" }
];

const THEMES = [
  { 
    id: "editorial", 
    name: "Warm Editorial", 
    bg: "bg-[#faf6eb]", 
    border: "border-[#d9c49e]", 
    text: "text-amber-950", 
    font: "font-serif", 
    accent: "bg-[#dfba80]",
    description: "Elegant, high-contrast serif typography on premium cream paper feel." 
  },
  { 
    id: "cyber", 
    name: "Cyber Lavender", 
    bg: "bg-[#faf5ff]", 
    border: "border-purple-200", 
    text: "text-purple-950", 
    font: "font-sans", 
    accent: "bg-[#c084fc]",
    description: "Modern minimalist styling with rich neon pastel and crisp tech curves." 
  },
  { 
    id: "retro", 
    name: "Vaporwave Coast", 
    bg: "bg-gradient-to-br from-indigo-50 to-pink-50", 
    border: "border-pink-200", 
    text: "text-indigo-950", 
    font: "font-sans", 
    accent: "bg-pink-400",
    description: "Sun-blanched aesthetic, saturated edges, and dynamic colorful borders." 
  },
  { 
    id: "slate", 
    name: "Cozy Slate", 
    bg: "bg-[#f1f5f9]", 
    border: "border-slate-350", 
    text: "text-slate-900", 
    font: "font-mono", 
    accent: "bg-slate-400",
    description: "No-attitude, structured brutalist slate with clean technical monospacing." 
  }
];

export default function PhotoAlbumEditor() {
  const [albumTitle, setAlbumTitle] = useState("Robert & Friends Wanderlust '26");
  const [albumSubtitle, setAlbumSubtitle] = useState("A cozy, safety-certified escape across Sitges & Gaixample");
  const [creatorName, setCreatorName] = useState("Robert G. Voyager");
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  
  // Custom states matching photo pages
  const [activePageIndex, setActivePageIndex] = useState(0); // 0 corresponds to Cover page, 1 to photo 1, etc.
  
  // Custom writable captions for pages
  const [captions, setCaptions] = useState<Record<string, string>>({
    ph1: "Golden hours at Sitges shoreline. Super comfortable public vibe with absolute zero attitude.",
    ph2: "Enjoying the fresh breeze right above the old windmills with organic local wine.",
    ph3: "Sipping rich cold lattes in Schöneberg's welcoming neighborhood before our evening tours.",
    ph4: "Stellar lookout views of SF from the hills. Dynamic, liberating, and forever cozy.",
    ph5: "Our unforgettable skyline rooftop celebration in Silom. True high-altitude queer hospitality."
  });

  // Ordering modals and loaders
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  
  // Physical shipment detail variables
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingRecipient, setShippingRecipient] = useState("");
  const [isDigitalGenerating, setIsDigitalGenerating] = useState(false);

  const handleUpdateCaption = (id: string, text: string) => {
    setCaptions(prev => ({ ...prev, [id]: text }));
  };

  const handleGenerateDigital = () => {
    setIsDigitalGenerating(true);
    setTimeout(() => {
      setIsDigitalGenerating(false);
      setOrderStatus("Digital Album Generated: Your gorgeous offline interactive album file Robert_Friends_Wanderlust_26.pdf is compiled & ready for offline sharing! Check your profile registry.");
    }, 1500);
  };

  const handleOrderPhysical = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingAddress || !shippingRecipient) {
      alert("Please specify the Recipient Name and Street Address to bind the Physical Book.");
      return;
    }
    setIsOrdering(true);
    setTimeout(() => {
      setIsOrdering(false);
      setOrderStatus(`Order Confirmed! Your luxuriously bound hardcover '${albumTitle}' has been dispatched to production. Delivery scheduled for ${shippingRecipient} at ${shippingAddress}. Total: $34.95 billed.`);
    }, 1800);
  };

  return (
    <div className="bg-white/94 border-2 border-purple-200/60 rounded-3xl p-6 md:p-8 space-y-8 shadow-md">
      {/* Intro Header */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-700" />
            <span className="text-[10px] text-purple-700 tracking-widest uppercase font-mono font-bold block">
              Judy's Creator Suite
            </span>
          </div>
          <h2 className="text-3xl font-normal text-purple-950 font-serif mt-1">Personalized Photo Album Editor</h2>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed">
            Layout, style, and print luxurious digital or high-end physical coffee table photo books of your travel memories. Curate custom captions for every page.
          </p>
        </div>

        <span className="text-[9px] bg-purple-100 text-purple-800 font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-xl">
          ✦ Hardcover Co-Lab
        </span>
      </div>

      {/* Editor Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT 1/2: METADATA, THEME SELECTOR & BUILD PANEL */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-5">
            <h3 className="text-sm font-bold text-slate-800 font-serif">1. Album Metadata & Title</h3>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] uppercase text-slate-500 font-bold block">Album Book Title</label>
                <input
                  type="text"
                  value={albumTitle}
                  onChange={(e) => setAlbumTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-purple-650 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase text-slate-500 font-bold block">Theme Subtitle</label>
                <input
                  type="text"
                  value={albumSubtitle}
                  onChange={(e) => setAlbumSubtitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-purple-650 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase text-slate-500 font-bold block">Travel Curator (Author)</label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:border-purple-650 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Theme selection list */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 font-serif">2. Stylized Layout Theme</h3>
            
            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map((theme) => {
                const isSelected = selectedTheme.id === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme)}
                    className={`text-left p-3 rounded-2xl border transition-all text-xs cursor-pointer ${
                      isSelected 
                        ? "bg-purple-150/40 border-purple-400 ring-2 ring-purple-100/50" 
                        : "bg-white border-slate-200 hover:bg-slate-55/40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-slate-850">
                      <span className={`w-2.5 h-2.5 rounded-full ${theme.accent}`} />
                      <span>{theme.name}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 block leading-tight font-light truncate">
                      {theme.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Page Curations Caption update block */}
          {activePageIndex > 0 && activePageIndex <= PRESET_PHOTOS.length && (
            <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-purple-800 font-mono font-extrabold uppercase tracking-wider block">
                  Curate Page Caption #{activePageIndex}
                </span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase block">
                  {PRESET_PHOTOS[activePageIndex - 1].location}
                </span>
              </div>
              
              <textarea
                value={captions[PRESET_PHOTOS[activePageIndex - 1].id] || ""}
                onChange={(e) => handleUpdateCaption(PRESET_PHOTOS[activePageIndex - 1].id, e.target.value)}
                rows={3}
                placeholder="Write your beautiful memory under this photograph..."
                className="w-full bg-white border border-purple-200 rounded-xl p-3 text-xs text-slate-850 focus:outline-none focus:border-purple-600 resize-none font-sans font-light"
              />
              <p className="text-[9px] text-slate-400 italic">This layout binds automatically below the image in the printed physical release.</p>
            </div>
          )}
        </div>

        {/* RIGHT 1/2: DYNAMIC PREVIEW WORKBOOK */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-serif text-slate-850 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-purple-700" />
              Interactive Album Spreads Preview
            </span>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                disabled={activePageIndex === 0}
                onClick={() => setActivePageIndex(prev => prev - 1)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg disabled:opacity-30 cursor-pointer transition-colors"
                title="Previous Spread Page"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono font-bold px-2.5 text-slate-500">
                {activePageIndex === 0 ? "COVER COVER" : `PAGE ${activePageIndex} of ${PRESET_PHOTOS.length}`}
              </span>
              <button
                disabled={activePageIndex === PRESET_PHOTOS.length}
                onClick={() => setActivePageIndex(prev => prev + 1)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg disabled:opacity-30 cursor-pointer transition-colors"
                title="Next Spread Page"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dynamically Styled Album Cover & Pages Container */}
          <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden shadow-xl border-4 border-slate-900 bg-slate-950 flex flex-col justify-between p-1.5 select-none min-h-[300px]">
            <div className={`w-full h-full rounded-2.5xl p-6 md:p-8 flex flex-col justify-between transition-all duration-300 ${selectedTheme.bg} ${selectedTheme.text} ${selectedTheme.font}`}>
              
              <AnimatePresence mode="wait">
                {activePageIndex === 0 ? (
                  /* COVER SPREAD PAGE */
                  <motion.div
                    key="album_cover_page"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex-1 flex flex-col justify-between text-center items-center py-6"
                  >
                    <div className="space-y-2">
                      <span className="text-[8px] font-mono uppercase tracking-[0.25em] block opacity-40">
                        MEMORIES MEMORIES
                      </span>
                      <h3 className="text-2xl md:text-3.5xl font-extrabold tracking-tight leading-none px-4 max-w-md">
                        {albumTitle || "Untitled Album"}
                      </h3>
                      <div className={`w-12 h-0.5 mx-auto ${selectedTheme.accent} rounded mt-1 opacity-80`} />
                    </div>

                    {/* Cute design illustration block mimicking a cover plate */}
                    <div className={`w-28 h-20 rounded-md overflow-hidden border-2 ${selectedTheme.border} opacity-85 shadow-md flex items-center justify-center bg-white/20`}>
                      <BookOpen className="w-7 h-7 stroke-1" />
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs leading-normal opacity-80 italic max-w-sm">
                        {albumSubtitle || "Personalized travel chronicle"}
                      </p>
                      <p className="text-[9px] font-bold tracking-widest uppercase mt-2 opacity-60">
                        Curated by {creatorName || "Anonymous Voyager"}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  /* CORE PHOTO PAGES SECTION SPREAD */
                  (() => {
                    const activePhoto = PRESET_PHOTOS[activePageIndex - 1];
                    return (
                      <motion.div
                        key={`album_page_${activePhoto.id}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex-1 flex flex-col justify-between space-y-4"
                      >
                        {/* Page header tag */}
                        <div className="flex justify-between items-center text-[8px] opacity-40 uppercase tracking-widest font-mono">
                          <span>{selectedTheme.name} Spread Page #{activePageIndex}</span>
                          <span>{activePhoto.location}</span>
                        </div>

                        {/* Image canvas with stylized custom borders */}
                        <div className={`flex-1 relative rounded-xl overflow-hidden border ${selectedTheme.border} bg-white max-h-[170px]`}>
                          <img 
                            src={activePhoto.url} 
                            alt={activePhoto.title} 
                            className="w-full h-full object-cover" 
                          />
                          <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-mono font-bold leading-none">
                            {activePhoto.title}
                          </span>
                        </div>

                        {/* Custom captions text styling */}
                        <div className="text-center pt-2 border-t border-slate-200/50">
                          <p className="text-xs italic leading-relaxed max-w-md mx-auto inline-block">
                            " {captions[activePhoto.id] || "No caption added. Click build tools in left panel to pen a cozy memory."} "
                          </p>
                        </div>
                      </motion.div>
                    );
                  })()
                )}
              </AnimatePresence>

            </div>
          </div>

          {/* EXCELENT CHECKOUT & ACTIONS SELECTOR */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-250 space-y-4">
            <h4 className="text-xs text-purple-950 font-serif font-bold uppercase tracking-wider">
              3. Publish or Bind Your Album
            </h4>

            {/* Grid for Digital vs Physical publication */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* DIGITAL RELEASE */}
              <div className="bg-white p-4.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[8px] bg-purple-100 text-purple-800 font-bold uppercase px-2 py-0.5 rounded font-mono leading-none">
                    Digital Release
                  </span>
                  <h5 className="font-bold text-slate-800 text-xs mt-1.5">Free Interactive PDF Export</h5>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Generate an offline-sharable high resolution digital PDF ready for sensory frame projection or emailing friends.
                  </p>
                </div>

                <button
                  onClick={handleGenerateDigital}
                  disabled={isDigitalGenerating}
                  className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white text-[10px] uppercase font-bold tracking-widest rounded-lg cursor-pointer transition-all active:scale-95 disabled:opacity-40"
                >
                  {isDigitalGenerating ? "Generating Spread Hash..." : "Compile Digital Album"}
                </button>
              </div>

              {/* PHYSICAL BOUND RELEASE */}
              <form onSubmit={handleOrderPhysical} className="bg-white p-4.5 rounded-xl border border-purple-200 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold uppercase px-2 py-0.5 rounded font-mono leading-none">
                      Physical Binding
                    </span>
                    <span className="text-[11px] font-bold text-sm text-purple-900 font-mono">$34.95</span>
                  </div>
                  <h5 className="font-bold text-slate-800 text-xs leading-none">Fine-Bound Cover Artbook</h5>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Order a heavy-textured linen hardcover book with custom foil lettering and archival safe inks.
                  </p>

                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                    <input
                      required
                      type="text"
                      placeholder="Recipient Full Name"
                      value={shippingRecipient}
                      onChange={(e) => setShippingRecipient(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] text-slate-850 focus:outline-none focus:border-purple-650"
                    />
                    <input
                      required
                      type="text"
                      placeholder="Street Address, Zip & Country"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] text-slate-850 focus:outline-none focus:border-purple-650"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isOrdering}
                  className="w-full py-2 bg-gradient-to-r from-purple-750 to-indigo-750 hover:from-purple-850 hover:to-indigo-850 text-white text-[10px] uppercase font-bold tracking-widest rounded-lg cursor-pointer transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {isOrdering ? "Transmitting Print Data..." : "Order Hardcover Book"}
                </button>
              </form>

            </div>

            {/* Display Ordering status response */}
            {orderStatus && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 border border-emerald-250 rounded-xl space-y-1"
              >
                <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-800 font-extrabold uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping shrink-0" />
                  <span>Operation Fulfilled</span>
                </div>
                <p className="text-[10px] text-emerald-990 leading-relaxed font-light">{orderStatus}</p>
              </motion.div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

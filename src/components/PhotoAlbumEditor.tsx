import React, { useRef, useState } from "react";
import { BookOpen, ArrowLeft, ArrowRight, Eye, Printer, Upload, Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AlbumPhoto {
  id: string;
  title: string;
  url: string;
  location: string;
}

const THEMES = [
  {
    id: "editorial",
    name: "Warm Editorial",
    bg: "bg-[#faf6eb]",
    border: "border-[#d9c49e]",
    text: "text-amber-950",
    font: "font-serif",
    accent: "bg-[#dfba80]",
    description: "Elegant, high-contrast serif typography on a warm paper finish."
  },
  {
    id: "cyber",
    name: "Cyber Lavender",
    bg: "bg-[#faf5ff]",
    border: "border-purple-200",
    text: "text-purple-950",
    font: "font-sans",
    accent: "bg-[#c084fc]",
    description: "Modern minimalist styling with rich neon pastel and crisp edges."
  },
  {
    id: "retro",
    name: "Vaporwave Coast",
    bg: "bg-gradient-to-br from-indigo-50 to-pink-50",
    border: "border-pink-200",
    text: "text-indigo-950",
    font: "font-sans",
    accent: "bg-pink-400",
    description: "Sun-blanched color, saturated accents, and travel-poster energy."
  },
  {
    id: "slate",
    name: "Cozy Slate",
    bg: "bg-[#f1f5f9]",
    border: "border-slate-350",
    text: "text-slate-900",
    font: "font-mono",
    accent: "bg-slate-400",
    description: "Structured editorial grid with clean technical typography."
  }
];

export default function PhotoAlbumEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumSubtitle, setAlbumSubtitle] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingRecipient, setShippingRecipient] = useState("");
  const [isDigitalGenerating, setIsDigitalGenerating] = useState(false);

  const canPublish = albumTitle.trim().length > 0 && photos.length > 0;
  const activePhoto = activePageIndex > 0 ? photos[activePageIndex - 1] : null;

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(event.target.files || []);
    if (!files.length) return;

    const loadedPhotos = await Promise.all(files.map((file) => new Promise<AlbumPhoto>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: `photo_${Date.now()}_${file.name}`,
        title: file.name.replace(/\.[^.]+$/, ""),
        url: String(reader.result),
        location: "",
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));

    setPhotos((prev) => [...prev, ...loadedPhotos]);
    setActivePageIndex((prev) => prev === 0 ? 1 : prev);
    event.target.value = "";
  };

  const updatePhoto = (id: string, patch: Partial<AlbumPhoto>) => {
    setPhotos((prev) => prev.map((photo) => photo.id === id ? { ...photo, ...patch } : photo));
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== id));
    setCaptions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActivePageIndex((prev) => Math.max(0, Math.min(prev, photos.length - 1)));
  };

  const albumPayload = () => ({
    title: albumTitle.trim(),
    subtitle: albumSubtitle.trim(),
    creatorName: creatorName.trim(),
    themeName: selectedTheme.name,
    photos: photos.map((photo) => ({ ...photo, caption: captions[photo.id] || "" })),
  });

  const handleGenerateDigital = async () => {
    if (!canPublish) {
      setOrderStatus("Add an album title and upload at least one photo before compiling.");
      return;
    }

    setIsDigitalGenerating(true);
    setOrderStatus(null);
    try {
      const resp = await fetch("/api/photo-albums/digital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(albumPayload()),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not compile album.");
      setOrderStatus(`Digital album compiled. Export link: ${data.downloadUrl}`);
      window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setOrderStatus(err?.message || "Could not compile album.");
    } finally {
      setIsDigitalGenerating(false);
    }
  };

  const handleOrderPhysical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish || !shippingAddress.trim() || !shippingRecipient.trim()) {
      setOrderStatus("Album title, uploaded photos, recipient, and shipping address are required.");
      return;
    }

    setIsOrdering(true);
    setOrderStatus(null);
    try {
      const resp = await fetch("/api/photo-albums/physical-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...albumPayload(),
          recipient: shippingRecipient.trim(),
          address: shippingAddress.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not submit print order.");
      setOrderStatus(`Print order ${data.order.id} received for ${data.order.photoCount} uploaded photos. Status: ${data.order.status}.`);
    } catch (err: any) {
      setOrderStatus(err?.message || "Could not submit print order.");
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="bg-white/94 border-2 border-purple-200/60 rounded-3xl p-6 md:p-8 space-y-8 shadow-md">
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
            Upload your own travel photos, caption each page, export a printable digital album, or submit the same layout to the hardcover print queue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload Photos
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-5">
            <h3 className="text-sm font-bold text-slate-800 font-serif">1. Album Metadata & Title</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Album book title" value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-purple-650 focus:outline-none" />
              <input type="text" placeholder="Theme subtitle" value={albumSubtitle} onChange={(e) => setAlbumSubtitle(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-purple-650 focus:outline-none" />
              <input type="text" placeholder="Travel curator or author" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-purple-650 focus:outline-none" />
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 font-serif">2. Layout Theme</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map((theme) => {
                const isSelected = selectedTheme.id === theme.id;
                return (
                  <button key={theme.id} onClick={() => setSelectedTheme(theme)} className={`text-left p-3 rounded-2xl border transition-all text-xs cursor-pointer ${isSelected ? "bg-purple-150/40 border-purple-400 ring-2 ring-purple-100/50" : "bg-white border-slate-200 hover:bg-slate-55/40"}`}>
                    <div className="flex items-center gap-1.5 font-bold text-slate-850">
                      <span className={`w-2.5 h-2.5 rounded-full ${theme.accent}`} />
                      <span>{theme.name}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 block leading-tight font-light">{theme.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 font-serif">3. Uploaded Photos</h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase">{photos.length} files</span>
            </div>
            {photos.length === 0 ? (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full min-h-28 border border-dashed border-purple-300 rounded-2xl bg-purple-50/50 text-purple-800 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Photos
              </button>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {photos.map((photo, index) => (
                  <div key={photo.id} className="grid grid-cols-[48px_1fr_auto] gap-2 items-center bg-white border border-slate-200 rounded-xl p-2">
                    <button type="button" onClick={() => setActivePageIndex(index + 1)} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200">
                      <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" />
                    </button>
                    <div className="space-y-1">
                      <input value={photo.title} onChange={(e) => updatePhoto(photo.id, { title: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-800" />
                      <input placeholder="Location" value={photo.location} onChange={(e) => updatePhoto(photo.id, { location: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-800" />
                    </div>
                    <button type="button" onClick={() => removePhoto(photo.id)} className="p-2 text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {activePhoto && (
            <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-purple-800 font-mono font-extrabold uppercase tracking-wider block">Curate Page Caption #{activePageIndex}</span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase block">{activePhoto.location || "No location set"}</span>
              </div>
              <textarea value={captions[activePhoto.id] || ""} onChange={(e) => setCaptions((prev) => ({ ...prev, [activePhoto.id]: e.target.value }))} rows={3} placeholder="Write your memory under this photograph..." className="w-full bg-white border border-purple-200 rounded-xl p-3 text-xs text-slate-850 focus:outline-none focus:border-purple-600 resize-none font-sans font-light" />
            </div>
          )}
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-serif text-slate-850 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-purple-700" />
              Interactive Album Preview
            </span>
            <div className="flex items-center gap-1">
              <button disabled={activePageIndex === 0} onClick={() => setActivePageIndex((prev) => prev - 1)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg disabled:opacity-30 cursor-pointer transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono font-bold px-2.5 text-slate-500">
                {activePageIndex === 0 ? "COVER" : `PAGE ${activePageIndex} of ${photos.length}`}
              </span>
              <button disabled={activePageIndex >= photos.length} onClick={() => setActivePageIndex((prev) => prev + 1)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg disabled:opacity-30 cursor-pointer transition-colors">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden shadow-xl border-4 border-slate-900 bg-slate-950 flex flex-col justify-between p-1.5 select-none min-h-[300px]">
            <div className={`w-full h-full rounded-2.5xl p-6 md:p-8 flex flex-col justify-between transition-all duration-300 ${selectedTheme.bg} ${selectedTheme.text} ${selectedTheme.font}`}>
              <AnimatePresence mode="wait">
                {activePageIndex === 0 ? (
                  <motion.div key="album_cover_page" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="flex-1 flex flex-col justify-between text-center items-center py-6">
                    <div className="space-y-2">
                      <span className="text-[8px] font-mono uppercase tracking-[0.25em] block opacity-40">Travel Album</span>
                      <h3 className="text-2xl md:text-3.5xl font-extrabold tracking-tight leading-none px-4 max-w-md">{albumTitle || "Untitled Album"}</h3>
                      <div className={`w-12 h-0.5 mx-auto ${selectedTheme.accent} rounded mt-1 opacity-80`} />
                    </div>
                    <div className={`w-28 h-20 rounded-md overflow-hidden border-2 ${selectedTheme.border} opacity-85 shadow-md flex items-center justify-center bg-white/20`}>
                      <BookOpen className="w-7 h-7 stroke-1" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs leading-normal opacity-80 italic max-w-sm">{albumSubtitle || "Personalized travel chronicle"}</p>
                      <p className="text-[9px] font-bold tracking-widest uppercase mt-2 opacity-60">Curated by {creatorName || "Anonymous Voyager"}</p>
                    </div>
                  </motion.div>
                ) : activePhoto ? (
                  <motion.div key={`album_page_${activePhoto.id}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col justify-between space-y-4">
                    <div className="flex justify-between items-center text-[8px] opacity-40 uppercase tracking-widest font-mono">
                      <span>{selectedTheme.name} Page #{activePageIndex}</span>
                      <span>{activePhoto.location || "Location unset"}</span>
                    </div>
                    <div className={`flex-1 relative rounded-xl overflow-hidden border ${selectedTheme.border} bg-white max-h-[190px]`}>
                      <img src={activePhoto.url} alt={activePhoto.title} className="w-full h-full object-cover" />
                      <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-mono font-bold leading-none">{activePhoto.title}</span>
                    </div>
                    <div className="text-center pt-2 border-t border-slate-200/50">
                      <p className="text-xs italic leading-relaxed max-w-md mx-auto inline-block">"{captions[activePhoto.id] || "No caption added yet."}"</p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-250 space-y-4">
            <h4 className="text-xs text-purple-950 font-serif font-bold uppercase tracking-wider">4. Publish or Bind Your Album</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[8px] bg-purple-100 text-purple-800 font-bold uppercase px-2 py-0.5 rounded font-mono leading-none">Digital Release</span>
                  <h5 className="font-bold text-slate-800 text-xs mt-1.5">Printable Digital Album Export</h5>
                  <p className="text-[10px] text-slate-500 leading-normal">Compile uploaded photos and captions into a printable browser album.</p>
                </div>
                <button onClick={handleGenerateDigital} disabled={isDigitalGenerating || !canPublish} className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white text-[10px] uppercase font-bold tracking-widest rounded-lg cursor-pointer transition-all active:scale-95 disabled:opacity-40">
                  {isDigitalGenerating ? "Compiling Album..." : "Compile Digital Album"}
                </button>
              </div>

              <form onSubmit={handleOrderPhysical} className="bg-white p-4.5 rounded-xl border border-purple-200 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold uppercase px-2 py-0.5 rounded font-mono leading-none">Physical Binding</span>
                    <span className="text-[11px] font-bold text-purple-900 font-mono">$34.95</span>
                  </div>
                  <h5 className="font-bold text-slate-800 text-xs leading-none">Hardcover Print Queue</h5>
                  <p className="text-[10px] text-slate-500 leading-normal">Submit your uploaded album metadata and shipping details to the app print-order queue.</p>
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                    <input required type="text" placeholder="Recipient full name" value={shippingRecipient} onChange={(e) => setShippingRecipient(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] text-slate-850 focus:outline-none focus:border-purple-650" />
                    <input required type="text" placeholder="Street address, zip, and country" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] text-slate-850 focus:outline-none focus:border-purple-650" />
                  </div>
                </div>
                <button type="submit" disabled={isOrdering || !canPublish} className="w-full py-2 bg-gradient-to-r from-purple-750 to-indigo-750 hover:from-purple-850 hover:to-indigo-850 text-white text-[10px] uppercase font-bold tracking-widest rounded-lg cursor-pointer transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  {isOrdering ? "Submitting Print Order..." : "Order Hardcover Book"}
                </button>
              </form>
            </div>

            {orderStatus && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-emerald-50 border border-emerald-250 rounded-xl space-y-1">
                <p className="text-[10px] text-emerald-990 leading-relaxed font-light">{orderStatus}</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

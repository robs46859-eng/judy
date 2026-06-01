import React, { useState } from "react";
import { X, Shield, Award, MapPin, CheckCircle, Heart, Navigation, Plane, Bell, Circle } from "lucide-react";
import { motion } from "motion/react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export default function UserProfileModal({ isOpen, onClose, userEmail }: UserProfileModalProps) {
  const [safetyTier, setSafetyTier] = useState<"standard" | "enhanced" | "guardian">("enhanced");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [travelVibe, setTravelVibe] = useState("");
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white border-2 border-purple-200/80 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl relative text-slate-800"
      >
        {/* Modal Top header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4.5">
            <div className="w-16 h-16 rounded-full border-2 border-purple-200 overflow-hidden shrink-0 bg-white">
              <img
                src=""
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold font-serif leading-none">Judy's Member</h3>
                <span className="text-[8px] bg-purple-550/60 border border-purple-300 text-purple-100 font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Judy Founder Elite
                </span>
              </div>
              <p className="text-xs text-purple-250/90 mt-1 font-mono">{userEmail || "explorer@judyguides.com"}</p>
              <p className="text-[10px] text-emerald-300 flex items-center gap-1 mt-1 font-bold">
                <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400 animate-pulse" />
                GPS LINKED SECURE CORRIDOR ACCREDITED
              </p>
            </div>
          </div>
        </div>

        {/* Modal Main Contents */}
        <div className="p-6 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Trip stats section */}
          <div>
            <h4 className="text-[10px] text-purple-900 uppercase tracking-widest font-extrabold font-mono mb-3">
              Your Companion Stats & Diagnostics
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-center shadow-3xs">
                <span className="text-2xl font-black text-purple-950 font-mono block">0</span>
                <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Safe Areas Visited</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-center shadow-3xs">
                <span className="text-2xl font-black text-purple-750 font-mono block">—</span>
                <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Safety Rating</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-center shadow-3xs">
                <span className="text-2xl font-black text-emerald-600 font-mono block">$0</span>
                <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Allocated Travel Pot</span>
              </div>
            </div>
          </div>

          {/* Core Settings preference togglers */}
          <div className="space-y-4">
            <h4 className="text-[10px] text-purple-900 uppercase tracking-widest font-extrabold font-mono leading-none">
              Interactive Safety Settings
            </h4>

            {/* Safety Level */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Wanderlust Companion Guard Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "standard", title: "Standard", desc: "Basic safe routing guidelines" },
                  { id: "enhanced", title: "Enhanced", desc: "Includes verified security curations" },
                  { id: "guardian", title: "Guardian", desc: "Live SMS alerts & high safety rating focus" }
                ].map((tier) => {
                  const isActive = safetyTier === tier.id;
                  return (
                    <button
                      key={tier.id}
                      onClick={() => setSafetyTier(tier.id as any)}
                      className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                        isActive 
                          ? "bg-purple-100/50 border-purple-300 ring-2 ring-purple-100" 
                          : "bg-white border-slate-200 hover:bg-slate-55/40"
                      }`}
                    >
                      <span className="font-bold text-xs text-slate-800 block">{tier.title}</span>
                      <span className="text-[8px] text-slate-400 mt-0.5 block leading-tight">{tier.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Preferred Travel Lifestyle Vibe</label>
                <input
                  type="text"
                  value={travelVibe}
                  onChange={(e) => setTravelVibe(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs text-slate-850 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Emergency Liaison Contacts</label>
                <input
                  type="text"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs text-slate-850 focus:border-purple-600 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Secure badge details */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-250 rounded-2xl flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-emerald-950 block">Your Profile is Secured</span>
              <p className="text-slate-500 leading-relaxed font-light mt-0.5 text-[11px]">
                Your personal data and emergency safe corridor pins are secured locally using high-grade end-to-end encryption hashes. No tracking telemetry is permanently stored.
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-purple-700 hover:bg-purple-800 text-white font-mono text-[11px] font-bold uppercase tracking-widest rounded-xl cursor-pointer"
            >
              Apply Updates
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 border border-slate-250 text-slate-500 font-mono text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Close Profile
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

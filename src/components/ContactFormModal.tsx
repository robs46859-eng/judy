import React, { useState } from "react";
import { X, Send, ShieldAlert, Sparkles, AlertCircle, FileText, CheckCircle } from "lucide-react";
import { motion } from "motion/react";

// Masterfully crafted 3D Paper Plane SVG component resembling the attached image
export function PaperPlaneLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 250 250" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="3D Paper Plane Logo"
    >
      <defs>
        <linearGradient id="purpleGrad" x1="50" y1="120" x2="200" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id="peachGrad" x1="100" y1="150" x2="160" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fed7aa" />
        </linearGradient>
        <linearGradient id="darkPurpleGrad" x1="50" y1="150" x2="150" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <filter id="planeShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="4" dy="8" stdDeviation="6" floodColor="#6366f1" floodOpacity="0.15" />
        </filter>
      </defs>
      
      {/* 3D Paper Plane main geometry using absolute coordinates */}
      <g filter="url(#planeShadow)">
        {/* Underbody Shaded Fold */}
        <polygon 
          points="40,95 210,40 100,165" 
          fill="url(#darkPurpleGrad)" 
        />
        
        {/* Left Side lavender fold wing */}
        <polygon 
          points="40,95 125,100 100,165" 
          fill="#a78bfa" 
        />
        
        {/* Right main large canvas wing */}
        <polygon 
          points="100,165 210,40 155,160" 
          fill="url(#purpleGrad)" 
        />
        
        {/* Peach Inner fold left */}
        <polygon 
          points="40,95 125,100 100,135" 
          fill="url(#peachGrad)" 
        />

        {/* Peach Inner fold right */}
        <polygon 
          points="100,165 155,160 135,120" 
          fill="url(#peachGrad)" 
        />
        
        {/* Center elegant keel backbone shadow line */}
        <polyline 
          points="100,165 125,100 210,40" 
          stroke="#ebd5ff" 
          strokeWidth="3.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </g>
    </svg>
  );
}

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactFormModal({ isOpen, onClose }: ContactFormModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("Consult Curators");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsSending(true);
    try {
      const resp = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${resp.status})`);
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setName("");
        setEmail("");
        setMessage("");
        onClose();
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not send. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white border-2 border-purple-200/95 p-6 md:p-8 rounded-3xl w-full max-w-lg space-y-6 relative text-slate-850 shadow-2xl overflow-hidden"
      >
        {/* Decorative background mist */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#cbd5e1]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-purple-150/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex justify-between items-start relative z-10">
          <div className="flex items-center gap-3">
            <PaperPlaneLogo className="w-10 h-10 shrink-0" />
            <div>
              <span className="text-[9px] text-purple-700 tracking-widest uppercase font-mono block">
                Judy's Guides Dispatch
              </span>
              <h3 className="text-2xl font-normal font-serif text-purple-950">Contact Judy</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-purple-700 font-mono text-xs uppercase cursor-pointer py-1 font-bold"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed font-light relative z-10">
          Have an inquiry, wish to become a regional curator, or want to sponsor safer travel corridors in your city? Reach out to <strong className="text-purple-900 font-semibold font-serif">Judy's Guides Core Team</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-400 font-bold block">Your Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-850 focus:border-purple-600 focus:outline-none"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-400 font-bold block">Your Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-850 focus:border-purple-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase text-slate-400 font-bold block">Inquiry Topic</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-850 focus:border-purple-600 focus:outline-none cursor-pointer"
            >
              <option value="Consult Curators">Consult Judy's Curators (Itinerary Audit)</option>
              <option value="Report Corridor">Report Local Safety Corridor Updates</option>
              <option value="Ambassador">Become Local Queer Ambassador</option>
              <option value="Sponsorship">Sponsorship & Creator Co-labs</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase text-slate-400 font-bold block">Message details</label>
            <textarea
              required
              rows={3}
              placeholder="Tell us what's on your mind..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-850 focus:outline-none focus:border-purple-600 resize-none font-light"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold text-center uppercase tracking-widest flex items-center justify-center gap-1.5 leading-none">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {success ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-bold text-center uppercase tracking-widest animate-pulse flex items-center justify-center gap-1.5 leading-none">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>MESSAGE SENT. THANK YOU.</span>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 rounded-2xl text-xs font-bold uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              {isSending ? "Digitizing Dispatch Cable..." : "Send Secure Message"}
            </button>
          )}
        </form>

        <div className="flex justify-center items-center gap-1.5 text-[8px] text-slate-400 uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
          <span>No cookies or unsolicited marketing tracking enabled. Pure secure liaison.</span>
        </div>
      </motion.div>
    </div>
  );
}

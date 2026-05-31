/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Compass, Sparkles, MapPin, Calendar, Flame, Coins, Heart } from "lucide-react";
import { OnboardingAnswers } from "../types";

interface OnboardingProps {
  onComplete: (data: OnboardingAnswers) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [destination, setDestination] = useState("Barcelona, Spain");
  const [travelDates, setTravelDates] = useState("2026-07-15 to 2026-07-22");
  const [vibe, setVibe] = useState<OnboardingAnswers["vibe"]>("culture");
  const [travelStyle, setTravelStyle] = useState<OnboardingAnswers["travelStyle"]>("boutique");
  const [interests, setInterests] = useState<string[]>(["Historic Milestones", "Beaches", "Queer Art Tours"]);

  const mockDestinations = [
    { name: "Barcelona, Spain", country: "Spain", rating: "Gaixample Hub" },
    { name: "Puerto Vallarta, Mexico", country: "Mexico", rating: "PV Zona Romántica" },
    { name: "Berlin, Germany", country: "Germany", rating: "Schöneberg Quarter" },
    { name: "Mykonos, Greece", country: "Greece", rating: "Cyclades Hotspot" },
    { name: "Bangkok, Thailand", country: "Thailand", rating: "Silom Pulse" },
    { name: "San Francisco, USA", country: "USA", rating: "Historic Castro District" },
  ];

  const interestOptions = [
    "Nightlife & Clubs",
    "Historic Milestones",
    "Queer Art Tours",
    "Beaches & Pools",
    "Local Tapas/Fine Dining",
    "LGBTIQ+ Community centers",
    "Saunas & Spas",
    "Independent Boutiques",
    "Nature & Hiking",
  ];

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      onComplete({
        destination,
        travelDates,
        vibe,
        travelStyle,
        interests,
      });
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 text-slate-800">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-8 md:p-12">
        
        {/* Progress header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-purple-700" />
            <span className="font-semibold text-xs tracking-wider uppercase text-slate-500">Judy's Travel Wizard</span>
          </div>
          <span className="text-purple-700 text-sm font-semibold">{step} of 4</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 h-1.5 rounded-full mb-10 overflow-hidden">
          <motion.div 
            className="bg-gradient-to-r from-purple-700 to-emerald-500 h-full"
            initial={{ width: "25%" }}
            animate={{ width: `${step * 25}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-normal tracking-tight text-purple-950 font-serif">
                  Where is your next escape?
                </h2>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                  Choose from legendary queer-friendly global destinations with verified local safety support and cosy tips from local Judy advisors.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                {mockDestinations.map((dest) => (
                  <button
                    key={dest.name}
                    onClick={() => {
                      setDestination(dest.name);
                    }}
                    type="button"
                    className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all relative ${
                      destination === dest.name
                        ? "border-purple-600 bg-purple-50/50 shadow-sm"
                        : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full justify-between">
                      <span className="font-bold text-slate-800">{dest.name}</span>
                      <MapPin className={`w-4 h-4 ${destination === dest.name ? "text-purple-700" : "text-slate-400"}`} />
                    </div>
                    <span className="text-xs text-slate-500 mt-1">{dest.rating}</span>
                    {destination === dest.name && (
                      <span className="absolute bottom-2 right-3 text-[10px] uppercase font-bold tracking-wider text-purple-700">Selected</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-2 mt-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Custom Destination
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Enter any town, island, or resort..."
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-200"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-normal tracking-tight text-purple-950 font-serif">
                  When are you bound?
                </h2>
                <p className="text-slate-500 mt-2 text-sm">
                  Specify approximate travel dates and help us calibrate the perfect events and cozy tips.
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Calendar className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    value={travelDates}
                    onChange={(e) => setTravelDates(e.target.value)}
                    placeholder="e.g. July 15 to July 22, 2026"
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-100 flex items-start gap-4 mt-4">
                  <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Cozy Season Sync:</strong> Our engine will automatically look up major parades, local events, nice cafes, and cultural outings tailored to cozy travelers during your selected timeframe.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-normal tracking-tight text-purple-950 font-serif">
                  Define your trip style & vibe
                </h2>
                <p className="text-slate-500 mt-2 text-sm">
                  Tailor your local safety index, bars, relaxation points, and spend level.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Trip Vibe Focus</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { id: "culture", label: "Culture & Art", desc: "Galleries, history", bg: "bg-purple-50 text-purple-900 border-purple-200" },
                      { id: "nightlife", label: "Nightlife", desc: "Clubs, dance, bars", bg: "bg-purple-50 text-purple-900 border-purple-200" },
                      { id: "chill", label: "Relaxation", desc: "Beaches, spas, cafes", bg: "bg-emerald-50 text-emerald-900 border-emerald-200" },
                      { id: "all", label: "All Vibes", desc: "An ultimate mix", bg: "bg-slate-100 text-slate-900 border-slate-300" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setVibe(item.id as OnboardingAnswers["vibe"])}
                        type="button"
                        className={`p-3 rounded-xl border text-center transition-all ${
                          vibe === item.id
                            ? `${item.bg} border-2 shadow-sm font-semibold`
                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Flame className="w-4 h-4 mx-auto mb-1 text-purple-700 opacity-90" />
                        <span className="block text-xs font-bold leading-tight">{item.label}</span>
                        <span className="block text-[10px] opacity-75 mt-0.5">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Lodging & Spend Class</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "budget", label: "Relaxed Budget", desc: "Trendy hosteling & local bars", icon: Coins },
                      { id: "boutique", label: "Curated Boutique", desc: "Aesthetic hotels & classy drinks", icon: Compass },
                      { id: "luxury", label: "High Luxury", desc: "VIP lounge keys & private resorts", icon: Sparkles },
                    ].map((style) => {
                      const Icon = style.icon;
                      return (
                        <button
                          key={style.id}
                          onClick={() => setTravelStyle(style.id as OnboardingAnswers["travelStyle"])}
                          type="button"
                          className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center ${
                            travelStyle === style.id
                              ? "border-purple-600 bg-purple-50 text-purple-950 font-bold shadow-sm"
                              : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          <Icon className="w-5 h-5 mb-2 text-purple-700" />
                          <span className="text-xs font-bold block">{style.label}</span>
                          <span className="text-[10px] text-slate-500 leading-snug mt-1">{style.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-3xl font-normal tracking-tight text-purple-950 font-serif">
                  Select your specific interests
                </h2>
                <p className="text-slate-500 mt-2 text-sm">
                  We will shape the timeline to include these exclusive experiences & souvenir recommendations.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {interestOptions.map((interest) => {
                  const selected = interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      type="button"
                      className={`p-3.5 rounded-xl border text-center transition-colors font-medium text-xs flex items-center justify-center gap-2 ${
                        selected
                          ? "border-purple-600 bg-purple-50 text-purple-900 font-bold"
                          : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 shrink-0 ${selected ? "text-purple-600 fill-purple-600" : "text-slate-300"}`} />
                      <span>{interest}</span>
                    </button>
                  );
                })}
              </div>

              <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-100 mt-6 flex gap-3 text-xs text-slate-600 leading-relaxed">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <strong>Ready for Curation:</strong> Once you proceed, our companion will consult premium intelligence to bundle cozy, safe, and exciting itineraries with custom metrics, friendly venues, and helpful tips from Judy advisors.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buttons flow */}
        <div className="flex gap-4 mt-10 pt-6 border-t border-slate-200 justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`px-5 py-2.5 font-bold rounded-xl text-sm transition-colors cursor-pointer ${
              step === 1 ? "opacity-0 cursor-default" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 font-bold text-sm bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <span>{step === 4 ? "Complete & Curate" : "Next Step"}</span>
            <Compass className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

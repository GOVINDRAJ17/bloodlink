"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Activity, CheckCircle, AlertTriangle, Clock } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "MATCHED" | "CRITICAL" | "FULFILLED" | "EN_ROUTE";
  text: string;
  timestamp: string;
  color: string;
  badgeBg: string;
}

const ACTIVITIES: ActivityItem[] = [
  {
    id: "1",
    type: "MATCHED",
    text: "Donor matched — O+ · 1.2 km · City General Hospital",
    timestamp: "Just now",
    color: "#0F766E",
    badgeBg: "bg-[#DFF3EE] text-[#085041] dark:bg-[#06332A] dark:text-[#6FD6BC]"
  },
  {
    id: "2",
    type: "CRITICAL",
    text: "Critical request — AB- · 3 units · St. Xavier's Hospital",
    timestamp: "12s ago",
    color: "#D62828",
    badgeBg: "bg-[#FCEBEB] text-[#791F1F] dark:bg-[#4A1313] dark:text-[#F5A3A3]"
  },
  {
    id: "3",
    type: "FULFILLED",
    text: "Request fulfilled — B+ · Sunrise Blood Bank Storage",
    timestamp: "45s ago",
    color: "#0F766E",
    badgeBg: "bg-[#DFF3EE] text-[#085041] dark:bg-[#06332A] dark:text-[#6FD6BC]"
  },
  {
    id: "4",
    type: "EN_ROUTE",
    text: "Donor en route — O- · 6.8 km away",
    timestamp: "1m ago",
    color: "#C97A2B",
    badgeBg: "bg-[#FAEEDA] text-[#633806] dark:bg-[#422703] dark:text-[#F5C77A]"
  }
];

export default function LiveActivityCard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ACTIVITIES.length);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  const current = ACTIVITIES[currentIndex];

  return (
    <div className="card-surface p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] shadow-xl space-y-4 max-w-md w-full bg-white dark:bg-[#182233]">
      
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-[#E2E4E1] dark:border-[#2A3547] pb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-2.5 h-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0F766E] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0F766E]" />
          </div>
          <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#14213D] dark:text-[#F6F7F5]">
            Live Activity Feed
          </span>
        </div>
        <span className="font-mono text-[10px] text-[#5B6472] dark:text-[#9AA5B4]">
          Supabase Realtime Engine
        </span>
      </div>

      {/* Animated Activity Content */}
      <div className="min-h-[140px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="w-full space-y-3 p-4 rounded-xl border border-[#E2E4E1]/80 dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720]"
          >
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-extrabold uppercase ${current.badgeBg}`}>
                {current.type === "CRITICAL" ? "🔴 EMERGENCY" : current.type === "MATCHED" ? "🟢 MATCHED" : current.type === "FULFILLED" ? "🟢 FULFILLED" : "🟡 EN ROUTE"}
              </span>
              <span className="font-mono text-[10px] text-[#5B6472] dark:text-[#9AA5B4]">
                {current.timestamp}
              </span>
            </div>

            <p className="font-heading font-extrabold text-sm text-[#14213D] dark:text-[#F6F7F5] leading-snug">
              {current.text}
            </p>

            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5B6472] dark:text-[#9AA5B4]">
              <Clock className="w-3 h-3" />
              <span>Verified PostGIS spatial match</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination indicators */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        {ACTIVITIES.map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === currentIndex ? "w-6 bg-[#0F766E]" : "w-1.5 bg-[#5B6472]/30"
            }`}
          />
        ))}
      </div>

    </div>
  );
}

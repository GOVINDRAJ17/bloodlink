"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Target, Radar, Zap, BellRing, ClipboardList, TrendingUp } from "lucide-react";

export default function Features() {
  const shouldReduceMotion = useReducedMotion();

  const features = [
    {
      icon: Target,
      title: "Intelligent matching",
      desc: "Compatibility + distance + availability + donor reliability — scored and ranked, not just filtered."
    },
    {
      icon: Radar,
      title: "Hyper-local search",
      desc: "Starts within 5 km and expands outward only when needed. Faster results, fewer unnecessary alerts."
    },
    {
      icon: Zap,
      title: "Real-time updates",
      desc: "Powered by Supabase Realtime. Hospitals see donor responses the moment they happen — no polling, no refresh."
    },
    {
      icon: BellRing,
      title: "Emergency alerts",
      desc: "Critical requests trigger instant in-app, email, and SMS alerts to matched donors — all orchestrated automatically."
    },
    {
      icon: ClipboardList,
      title: "Blood bank inventory",
      desc: "Blood banks update unit counts in real time. Hospitals always see current availability before requesting."
    },
    {
      icon: TrendingUp,
      title: "Shortage prediction",
      desc: "A separate ML model analyses historical demand to forecast shortages before they happen — giving blood banks time to act."
    }
  ];

  return (
    <section className="py-20 bg-[#F6F7F5] dark:bg-[#101720] border-b border-[#E2E4E1] dark:border-[#2A3547]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 space-y-12">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#6FD6BC]">
            Technical Capabilities
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#14213D] dark:text-[#F6F7F5] tracking-tight">
            A platform built for emergencies
          </h2>
        </div>

        {/* 3x2 Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={idx}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: idx * 0.1 }}
                className="card-surface p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-4"
              >
                <div className="p-3 bg-[#14213D] text-white dark:bg-white/10 rounded-xl inline-flex">
                  <Icon className="w-5 h-5 text-white" />
                </div>

                <h3 className="font-heading font-medium text-lg text-[#14213D] dark:text-[#F6F7F5]">
                  {feat.title}
                </h3>

                <p className="font-body text-xs sm:text-sm text-[#5B6472] dark:text-[#9AA5B4] leading-relaxed">
                  {feat.desc}
                </p>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

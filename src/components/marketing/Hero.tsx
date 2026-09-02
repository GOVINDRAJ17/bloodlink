"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import LiveActivityCard from "./LiveActivityCard";

export default function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden py-16 md:py-24 bg-[#F6F7F5] dark:bg-[#101720] border-b border-[#E2E4E1] dark:border-[#2A3547]">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Message */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-7 space-y-6"
          >
            {/* Eyebrow Label */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0F766E]/10 dark:bg-[#06332A] text-[#0F766E] dark:text-[#6FD6BC] border border-[#0F766E]/20 rounded-full font-mono text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#0F766E] dark:bg-[#6FD6BC] animate-pulse" />
              <span>Real-time emergency blood coordination</span>
            </div>

            {/* Headline */}
            <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#14213D] dark:text-[#F6F7F5] leading-[1.1]">
              The right blood, <br className="hidden sm:block" />
              in the right place, <br />
              <span className="text-[#0F766E] dark:text-[#6FD6BC]">right now.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-[#5B6472] dark:text-[#9AA5B4] max-w-xl font-body leading-relaxed">
              BloodLink connects hospitals and patients with compatible nearby donors and blood banks — instantly, intelligently, and reliably.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              {/* Primary CTA (Signal Red Fill - Only place used as fill) */}
              <Link
                href="/dashboard/hospital"
                className="py-3.5 px-6 rounded-xl font-heading font-extrabold text-sm text-white bg-[#D62828] hover:bg-red-700 shadow-md hover:shadow-lg transition-all text-center flex items-center justify-center gap-2"
              >
                <span>🚨 Request blood</span>
                <span className="font-mono text-xs opacity-90">→</span>
              </Link>

              {/* Secondary CTA */}
              <Link
                href="/profile/setup"
                className="py-3.5 px-6 rounded-xl font-heading font-bold text-sm text-[#14213D] dark:text-[#F6F7F5] bg-transparent border-2 border-[#14213D] dark:border-[#F6F7F5] hover:bg-[#14213D] hover:text-white dark:hover:bg-white dark:hover:text-[#14213D] transition-all text-center"
              >
                Register as donor
              </Link>
            </div>

            {/* Real Feature & Capabilities Trust Bar */}
            <div className="pt-6 border-t border-[#E2E4E1] dark:border-[#2A3547] flex flex-wrap items-center gap-6 font-mono text-xs text-[#5B6472] dark:text-[#9AA5B4]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#14213D] dark:text-[#F6F7F5]">🛰️ PostGIS</span>
                <span>Spatial Radius Matching</span>
              </div>
              <span className="hidden sm:inline text-gray-300 dark:text-gray-700">•</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#14213D] dark:text-[#F6F7F5]">🔒 Privacy Shield</span>
                <span>Masked Contact Protection</span>
              </div>
              <span className="hidden sm:inline text-gray-300 dark:text-gray-700">•</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#0F766E] dark:text-[#6FD6BC]">⚡ Instant Dispatch</span>
                <span>SMS & Email Alerts</span>
              </div>
            </div>

          </motion.div>

          {/* Right Column: Live Activity Card */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <LiveActivityCard />
          </div>

        </div>
      </div>
    </section>
  );
}

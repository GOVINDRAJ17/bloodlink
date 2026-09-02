"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Building2, Radar, CheckCircle2, ChevronRight } from "lucide-react";

export default function HowItWorks() {
  const shouldReduceMotion = useReducedMotion();

  const steps = [
    {
      num: "01",
      icon: Building2,
      title: "Hospital creates a request",
      desc: "A hospital raises an emergency blood request, specifying blood group, units needed, and urgency level."
    },
    {
      num: "02",
      icon: Radar,
      title: "BloodLink matches instantly",
      desc: "Our matching engine finds compatible donors within 5 km, expanding outward only if needed — ranked by compatibility, distance, and availability."
    },
    {
      num: "03",
      icon: CheckCircle2,
      title: "Donor responds, hospital is notified",
      desc: "Matched donors receive an alert. When one accepts, the hospital sees it immediately — no page refresh needed."
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-[#F6F7F5] dark:bg-[#101720] border-b border-[#E2E4E1] dark:border-[#2A3547]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 space-y-12">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#6FD6BC]">
            Automated Coordination Workflow
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#14213D] dark:text-[#F6F7F5] tracking-tight">
            From request to donor in minutes
          </h2>
          <p className="text-sm sm:text-base text-[#5B6472] dark:text-[#9AA5B4] font-body">
            BloodLink handles the search, matching, and coordination — so you focus on the patient.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={idx}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.15 }}
                className="card-surface p-8 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm relative flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-[#0F766E]/10 dark:bg-[#06332A] text-[#0F766E] dark:text-[#6FD6BC] rounded-xl inline-flex">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="font-mono font-bold text-sm text-[#5B6472]/60 dark:text-[#9AA5B4]/60">
                      STEP {step.num}
                    </span>
                  </div>

                  <h3 className="font-heading font-bold text-xl text-[#14213D] dark:text-[#F6F7F5]">
                    {step.title}
                  </h3>

                  <p className="font-body text-xs sm:text-sm text-[#5B6472] dark:text-[#9AA5B4] leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                {/* Arrow connector for desktop */}
                {idx < steps.length - 1 && (
                  <div className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#F6F7F5] dark:bg-[#101720] border border-[#E2E4E1] dark:border-[#2A3547] items-center justify-center text-[#5B6472] dark:text-[#9AA5B4]">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Real-time Note */}
        <div className="text-center">
          <p className="font-mono text-xs text-[#5B6472] dark:text-[#9AA5B4] bg-white dark:bg-[#182233] inline-block px-4 py-2 rounded-full border border-[#E2E4E1] dark:border-[#2A3547]">
            ⚡ The entire workflow runs in real time. No phone calls. No WhatsApp groups. No manual searching.
          </p>
        </div>

      </div>
    </section>
  );
}

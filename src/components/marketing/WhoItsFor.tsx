"use client";

import Link from "next/link";
import { Building2, Heart, Check } from "lucide-react";

export default function WhoItsFor() {
  const cards = [
    {
      title: "For hospitals",
      icon: Building2,
      body: "Create emergency blood requests in seconds. Track donor responses in real time. Search inventory by facility. Never waste time making calls.",
      features: [
        "Real-time donor matching",
        "Expanding radius search",
        "Targeted inventory lookup",
        "Fulfillment tracking"
      ],
      ctaText: "Hospital sign up →",
      ctaHref: "/auth/login",
      highlighted: false
    },
    {
      title: "For donors",
      icon: Heart,
      body: "Register once. Set your availability. Get notified when someone nearby needs your blood group — and respond with a single tap.",
      features: [
        "Emergency alerts by location",
        "Donation history tracking",
        "Eligibility reminders",
        "Privacy-first location sharing"
      ],
      ctaText: "Become a donor →",
      ctaHref: "/profile/setup",
      highlighted: true
    }
  ];

  return (
    <section id="who-its-for" className="py-20 bg-[#F6F7F5] dark:bg-[#101720] border-b border-[#E2E4E1] dark:border-[#2A3547]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 space-y-12">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#6FD6BC]">
            Role-Based Platform Architecture
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#14213D] dark:text-[#F6F7F5] tracking-tight">
            Built for hospitals and donors
          </h2>
        </div>

        {/* 2 Focused Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className={`card-surface p-8 rounded-2xl border transition-all flex flex-col justify-between ${
                  card.highlighted
                    ? "border-2 border-[#0F766E] shadow-lg relative bg-white dark:bg-[#182233]"
                    : "border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm"
                }`}
              >
                {card.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0F766E] text-white font-mono text-[10px] font-black uppercase px-3 py-0.5 rounded-full tracking-wider">
                    RECOMMENDED FOR INDIVIDUALS
                  </span>
                )}

                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${
                      card.highlighted
                        ? "bg-[#0F766E] text-white"
                        : "bg-[#14213D]/10 dark:bg-white/10 text-[#14213D] dark:text-white"
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-heading font-extrabold text-2xl text-[#14213D] dark:text-[#F6F7F5]">
                      {card.title}
                    </h3>
                  </div>

                  <p className="font-body text-xs sm:text-sm text-[#5B6472] dark:text-[#9AA5B4] leading-relaxed">
                    {card.body}
                  </p>

                  <ul className="space-y-2.5 pt-2 border-t border-[#E2E4E1] dark:border-[#2A3547]">
                    {card.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2.5 text-xs font-medium text-[#14213D] dark:text-[#F6F7F5]">
                        <Check className="w-4 h-4 text-[#0F766E] dark:text-[#6FD6BC] shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  <Link
                    href={card.ctaHref}
                    className={`w-full py-3 px-4 rounded-xl font-heading font-bold text-xs transition-all text-center block ${
                      card.highlighted
                        ? "bg-[#0F766E] hover:bg-[#0d645e] text-white shadow-md"
                        : "bg-[#14213D] hover:bg-black text-white"
                    }`}
                  >
                    {card.ctaText}
                  </Link>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

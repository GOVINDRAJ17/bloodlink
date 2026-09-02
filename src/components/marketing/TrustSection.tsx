"use client";

import { ShieldCheck, CheckCircle, Zap, Brain } from "lucide-react";

export default function TrustSection() {
  const trustSignals = [
    {
      icon: ShieldCheck,
      title: "Privacy first",
      desc: "Donor locations are never shared publicly. Contact details revealed only on confirmed match."
    },
    {
      icon: CheckCircle,
      title: "Verified only",
      desc: "Hospitals and blood banks go through a verification process before going live on the platform."
    },
    {
      icon: Zap,
      title: "Built for speed",
      desc: "Every technical decision — PostGIS queries, Supabase Realtime, expanding radius search — optimises for response time."
    },
    {
      icon: Brain,
      title: "Intelligent, not just fast",
      desc: "The matching engine considers compatibility, distance, eligibility, and reliability — not just proximity."
    }
  ];

  return (
    <section id="trust" className="py-20 bg-[#F6F7F5] dark:bg-[#101720] border-b border-[#E2E4E1] dark:border-[#2A3547]">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Side: Mission Statement */}
          <div className="lg:col-span-5 space-y-6">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#6FD6BC]">
              Platform Philosophy
            </span>

            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#14213D] dark:text-[#F6F7F5] tracking-tight leading-tight">
              Every 2 seconds, someone in India needs blood. <br />
              <span className="text-[#0F766E] dark:text-[#6FD6BC]">BloodLink exists to make sure they find it.</span>
            </h2>

            <p className="font-body text-sm sm:text-base text-[#5B6472] dark:text-[#9AA5B4] leading-relaxed">
              We built BloodLink because the existing process — phone calls, WhatsApp groups, manual searching — costs lives. Our platform automates the search, removes the friction, and gets the right donor to the right patient faster than any manual process can.
            </p>
          </div>

          {/* Right Side: 4 Trust Signals */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {trustSignals.map((signal, idx) => {
              const Icon = signal.icon;
              return (
                <div
                  key={idx}
                  className="card-surface p-6 rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-3"
                >
                  <div className="p-2.5 bg-[#0F766E]/10 dark:bg-[#06332A] text-[#0F766E] dark:text-[#6FD6BC] rounded-xl inline-flex">
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="font-heading font-bold text-base text-[#14213D] dark:text-[#F6F7F5]">
                    {signal.title}
                  </h3>

                  <p className="font-body text-xs text-[#5B6472] dark:text-[#9AA5B4] leading-relaxed">
                    {signal.desc}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}

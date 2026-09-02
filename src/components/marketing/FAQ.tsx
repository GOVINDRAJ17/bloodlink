"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const faqs = [
    {
      q: "Is BloodLink free to use?",
      a: "Yes. Registering as a donor, creating hospital accounts, and receiving emergency alerts are all free."
    },
    {
      q: "How does BloodLink find donors near me?",
      a: "We use your registered location and PostGIS geospatial queries to find compatible donors within expanding radius rings — starting at 5 km and growing outward only if needed."
    },
    {
      q: "Is my location data private?",
      a: "Yes. Your precise location is never shown publicly. Hospitals and other users only see approximate distance (e.g. \"~2.4 km away\") until a match is confirmed."
    },
    {
      q: "How quickly will I be notified if someone needs my blood group?",
      a: "Immediately. When an emergency request matches your blood group and location, you receive an in-app notification. Critical emergencies also trigger SMS and email alerts."
    },
    {
      q: "Can I register as a donor if I haven't donated before?",
      a: "Yes. New donors are welcome. The onboarding form includes a brief medical screening to confirm basic eligibility."
    },
    {
      q: "What happens after a donor accepts a request?",
      a: "The hospital is notified in real time. Unnecessary alerts to other matched donors are automatically stopped. The donor receives the hospital's contact details and next steps."
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  return (
    <section id="faq" className="py-20 bg-[#F6F7F5] dark:bg-[#101720] border-b border-[#E2E4E1] dark:border-[#2A3547] transition-colors duration-200">
      <div className="mx-auto max-w-4xl px-4 md:px-6 space-y-10">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#6FD6BC]">
            Frequently Asked Questions
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#14213D] dark:text-[#F6F7F5] tracking-tight">
            Common questions
          </h2>
        </div>

        {/* Accordion List */}
        <div className="space-y-4" role="tablist">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            const questionId = `faq-question-${idx}`;
            const answerId = `faq-answer-${idx}`;

            return (
              <div
                key={idx}
                className={`card-surface rounded-2xl border transition-all duration-200 bg-white dark:bg-[#182233] shadow-sm ${
                  isOpen
                    ? "border-[#0F766E] dark:border-[#6FD6BC] ring-1 ring-[#0F766E]/20 dark:ring-[#6FD6BC]/20"
                    : "border-[#E2E4E1] dark:border-[#2A3547] hover:border-[#5B6472]/40"
                }`}
              >
                <button
                  id={questionId}
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  type="button"
                  onClick={() => toggleFAQ(idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-heading font-extrabold text-base sm:text-lg text-[#14213D] dark:text-[#F6F7F5] hover:text-[#0F766E] dark:hover:text-[#6FD6BC] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded-2xl"
                >
                  <span className="leading-snug">{faq.q}</span>
                  <div className={`p-1 rounded-full transition-transform duration-300 shrink-0 ${
                    isOpen ? "bg-[#0F766E]/10 dark:bg-[#06332A] text-[#0F766E] dark:text-[#6FD6BC] rotate-180" : "text-[#5B6472] dark:text-[#9AA5B4]"
                  }`}>
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={answerId}
                      role="region"
                      aria-labelledby={questionId}
                      initial={shouldReduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={shouldReduceMotion ? { opacity: 1, height: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-0 font-body text-xs sm:text-sm text-[#5B6472] dark:text-[#9AA5B4] leading-relaxed border-t border-[#E2E4E1]/60 dark:border-[#2A3547]/60 mt-1 pt-4">
                        <p>{faq.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

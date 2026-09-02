"use client";

import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="py-20 bg-[#14213D] text-white">
      <div className="mx-auto max-w-4xl px-4 md:px-6 text-center space-y-6">
        
        <h2 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Ready to save a life?
        </h2>

        <p className="font-body text-base sm:text-lg text-[#9AA5B4] max-w-xl mx-auto">
          Join thousands of donors and hospitals already on BloodLink.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          {/* Register as donor — Teal Fill */}
          <Link
            href="/profile/setup"
            className="w-full sm:w-auto py-3.5 px-8 rounded-xl font-heading font-extrabold text-sm text-white bg-[#0F766E] hover:bg-[#0d645e] shadow-lg transition-all text-center"
          >
            Register as donor
          </Link>

          {/* Hospital Sign Up — White Outline */}
          <Link
            href="/auth/login"
            className="w-full sm:w-auto py-3.5 px-8 rounded-xl font-heading font-bold text-sm text-white border-2 border-white hover:bg-white hover:text-[#14213D] transition-all text-center"
          >
            Hospital sign up
          </Link>
        </div>

        <p className="font-mono text-xs text-[#5B6472]">
          Free to join. Takes less than 3 minutes.
        </p>

      </div>
    </section>
  );
}

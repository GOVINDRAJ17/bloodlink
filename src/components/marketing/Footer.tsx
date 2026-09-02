"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#14213D] text-white border-t border-white/10 pt-16 pb-12">
      <div className="mx-auto max-w-7xl px-4 md:px-6 space-y-12">
        
        {/* 4 Column Layout */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          
          {/* Column 1: Brand */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 font-heading font-extrabold text-xl tracking-tight text-white">
              <svg className="w-6 h-6 text-[#D62828]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="rgba(214, 40, 40, 0.2)"/>
                <path d="M3.5 12h4l2.5-5 3.5 10 2.5-5h4.5" stroke="#D62828" strokeWidth="2"/>
              </svg>
              <span>BloodLink</span>
            </Link>

            <p className="font-body text-xs text-[#9AA5B4] leading-relaxed">
              Real-time emergency blood coordination platform connecting hospitals with compatible nearby donors.
            </p>
          </div>

          {/* Column 2: Platform */}
          <div className="space-y-3">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white">Platform</h4>
            <ul className="space-y-2 text-xs text-[#9AA5B4]">
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
              <li><a href="#who-its-for" className="hover:text-white transition-colors">For hospitals</a></li>
              <li><a href="#who-its-for" className="hover:text-white transition-colors">For donors</a></li>
              <li><a href="#who-its-for" className="hover:text-white transition-colors">For blood banks</a></li>
              <li><Link href="/map" className="hover:text-white transition-colors">Emergency map</Link></li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="space-y-3">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white">Resources</h4>
            <ul className="space-y-2 text-xs text-[#9AA5B4]">
              <li><a href="#compatibility" className="hover:text-white transition-colors">Blood compatibility guide</a></li>
              <li><a href="#trust" className="hover:text-white transition-colors">Donor eligibility</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              <li><Link href="/api/requests" className="hover:text-white transition-colors">API documentation</Link></li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div className="space-y-3">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white">Legal</h4>
            <ul className="space-y-2 text-xs text-[#9AA5B4]">
              <li><span className="hover:text-white transition-colors cursor-pointer">Privacy policy</span></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">Terms of service</span></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">Data handling</span></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">Contact</span></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[#5B6472]">
          <span>© 2025 BloodLink. Built as a healthcare coordination platform.</span>
          <span className="text-[#9AA5B4]">Made with purpose in India 🇮🇳</span>
        </div>

      </div>
    </footer>
  );
}

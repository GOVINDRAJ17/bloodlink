import Hero from "@/components/marketing/Hero";
import StatsStrip from "@/components/marketing/StatsStrip";
import HowItWorks from "@/components/marketing/HowItWorks";
import WhoItsFor from "@/components/marketing/WhoItsFor";
import Features from "@/components/marketing/Features";
import CompatibilityTable from "@/components/marketing/CompatibilityTable";
import MapPreview from "@/components/marketing/MapPreview";
import TrustSection from "@/components/marketing/TrustSection";
import FAQ from "@/components/marketing/FAQ";
import FinalCTA from "@/components/marketing/FinalCTA";
import Footer from "@/components/marketing/Footer";

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-[#F6F7F5] dark:bg-[#101720] text-[#14213D] dark:text-[#F6F7F5] flex flex-col font-body transition-colors duration-200">
      <main className="flex-1">
        {/* 1. HERO SECTION */}
        <Hero />

        {/* 2. STATS STRIP */}
        <StatsStrip />

        {/* 3. HOW IT WORKS */}
        <HowItWorks />

        {/* 4. WHO IT'S FOR */}
        <WhoItsFor />

        {/* 5. FEATURES DEEP DIVE */}
        <Features />

        {/* 6. BLOOD COMPATIBILITY EXPLAINER */}
        <CompatibilityTable />

        {/* 7. LIVE MAP PREVIEW */}
        <MapPreview />

        {/* 8. TRUST & CREDIBILITY SECTION */}
        <TrustSection />

        {/* 9. FAQ SECTION */}
        <FAQ />

        {/* 10. FINAL CTA SECTION */}
        <FinalCTA />
      </main>

      {/* 11. FOOTER */}
      <Footer />
    </div>
  );
}

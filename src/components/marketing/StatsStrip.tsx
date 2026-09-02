"use client";

export default function StatsStrip() {
  const capabilities = [
    {
      icon: "🛰️",
      title: "PostGIS Spatial Engine",
      subtitle: "Expanding Radius Matching (5km → 25km)"
    },
    {
      icon: "🔒",
      title: "Privacy Shield Protected",
      subtitle: "Zero Unsolicited Contact or Data Selling"
    },
    {
      icon: "⚡",
      title: "Multi-Channel Alerts",
      subtitle: "Instant SMS & Transactional Email Dispatch"
    },
    {
      icon: "🩸",
      title: "8 Blood Components",
      subtitle: "Real-time Rh Compatibility Matrix"
    }
  ];

  return (
    <section className="bg-[#F0F1EF] dark:bg-[#1A2535] py-10 border-y border-[#E2E4E1] dark:border-[#2A3547]">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-0 md:divide-x divide-[#5B6472]/20 dark:divide-white/10">
          {capabilities.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center text-center px-4 space-y-1">
              <span className="text-2xl">{item.icon}</span>
              <span className="font-heading font-extrabold text-sm sm:text-base text-[#14213D] dark:text-[#F6F7F5] tracking-tight">
                {item.title}
              </span>
              <span className="font-mono text-[11px] text-[#5B6472] dark:text-[#9AA5B4]">
                {item.subtitle}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

export default function StatsStrip() {
  const stats = [
    { value: "12,000+", label: "Donors across India" },
    { value: "48", label: "Cities covered" },
    { value: "94%", label: "Emergency fulfillment rate" },
    { value: "< 8 min", label: "Average response time" }
  ];

  return (
    <section className="bg-[#F0F1EF] dark:bg-[#1A2535] py-10">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x divide-[#5B6472]/20 dark:divide-white/10">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex flex-col items-center text-center px-4">
              <span className="font-heading font-semibold text-3xl sm:text-4xl md:text-5xl text-[#14213D] dark:text-[#F6F7F5] tracking-tight">
                {stat.value}
              </span>
              <span className="font-body text-xs sm:text-sm text-[#5B6472] dark:text-[#9AA5B4] mt-1.5 font-medium">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

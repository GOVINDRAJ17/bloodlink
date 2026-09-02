"use client";

export default function CompatibilityTable() {
  const compatibilityData = [
    { recipient: "O-", donors: ["O-"], isUniversalDonor: true },
    { recipient: "O+", donors: ["O-", "O+"] },
    { recipient: "A-", donors: ["O-", "A-"] },
    { recipient: "A+", donors: ["O-", "O+", "A-", "A+"] },
    { recipient: "B-", donors: ["O-", "B-"] },
    { recipient: "B+", donors: ["O-", "O+", "B-", "B+"] },
    { recipient: "AB-", donors: ["O-", "A-", "B-", "AB-"] },
    { recipient: "AB+", donors: ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"], isUniversalRecipient: true }
  ];

  return (
    <section className="py-20 bg-[#F6F7F5] dark:bg-[#101720] border-b border-[#E2E4E1] dark:border-[#2A3547]">
      <div className="mx-auto max-w-4xl px-4 md:px-6 space-y-8">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#6FD6BC]">
            Medical Credibility & Protocols
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#14213D] dark:text-[#F6F7F5] tracking-tight">
            Understanding blood compatibility
          </h2>
          <p className="text-sm sm:text-base text-[#5B6472] dark:text-[#9AA5B4] font-body">
            BloodLink's matching engine uses clinically established ABO/Rh compatibility rules.
          </p>
        </div>

        {/* Compatibility Table Card */}
        <div className="card-surface rounded-2xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#14213D] text-white font-heading uppercase font-semibold tracking-wider text-[11px]">
                <tr>
                  <th className="py-4 px-6">Recipient Group</th>
                  <th className="py-4 px-6">Compatible Donors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E4E1] dark:divide-[#2A3547]">
                {compatibilityData.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      row.isUniversalDonor
                        ? "bg-[#DFF3EE]/60 dark:bg-[#06332A]/50 font-bold"
                        : row.isUniversalRecipient
                        ? "bg-[#FAEEDA]/60 dark:bg-[#422703]/50 font-bold"
                        : "hover:bg-[#F6F7F5] dark:hover:bg-[#101720]"
                    }`}
                  >
                    <td className="py-3.5 px-6 font-mono font-bold text-[#14213D] dark:text-[#F6F7F5]">
                      {row.recipient}
                    </td>
                    <td className="py-3.5 px-6 font-mono">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.isUniversalRecipient ? (
                          <span className="px-2.5 py-0.5 rounded bg-[#FAEEDA] text-[#633806] dark:bg-[#422703] dark:text-[#F5C77A] font-extrabold text-xs">
                            All groups (Universal recipient)
                          </span>
                        ) : (
                          row.donors.map((d, dIdx) => (
                            <span
                              key={dIdx}
                              className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                d === "O-"
                                  ? "bg-[#0F766E] text-white"
                                  : "bg-[#14213D]/10 dark:bg-white/10 text-[#14213D] dark:text-[#F6F7F5]"
                              }`}
                            >
                              {d}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center font-body text-xs text-[#5B6472] dark:text-[#9AA5B4]">
          Disclaimer: BloodLink facilitates coordination only. All clinical transfusion decisions are made by qualified medical professionals.
        </p>

      </div>
    </section>
  );
}

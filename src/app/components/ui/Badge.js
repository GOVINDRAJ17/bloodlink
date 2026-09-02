import React from "react";

export function UrgencyBadge({ level = "MEDIUM", className = "" }) {
  const u = (level || "MEDIUM").toUpperCase();

  if (u === "CRITICAL") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black badge-critical shadow-sm ${className}`}>
        🚨 CRITICAL
      </span>
    );
  }

  if (u === "HIGH" || u === "MEDIUM") {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold badge-medium ${className}`}>
        ⚠️ {u} URGENCY
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#5B6472]/20 text-secondary-var ${className}`}>
      LOW URGENCY
    </span>
  );
}

export function StatusBadge({ status = "PENDING", className = "" }) {
  const s = (status || "PENDING").toUpperCase();

  if (["FULFILLED", "ACCEPTED", "VERIFIED", "AVAILABLE"].includes(s)) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase badge-teal ${className}`}>
        ✓ {s.replace("_", " ")}
      </span>
    );
  }

  if (["SEARCHING", "MATCHED", "IN_PROGRESS"].includes(s)) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase badge-medium ${className}`}>
        ● {s.replace("_", " ")}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-[#5B6472]/20 text-secondary-var ${className}`}>
      {s.replace("_", " ")}
    </span>
  );
}

export function VerifiedBadge({ type = "HOSPITAL", className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold badge-teal border border-current/20 ${className}`}>
      <span className="font-extrabold">✓</span> {type === "HOSPITAL" ? "Verified Hospital" : "Verified Blood Bank"}
    </span>
  );
}

export function MonoData({ children, className = "" }) {
  return (
    <span className={`font-mono text-xs font-semibold tracking-tight text-primary-var ${className}`}>
      {children}
    </span>
  );
}

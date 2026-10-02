/**
 * Component-Aware Blood Compatibility Engine
 * 
 * Immunological transfusion rules depend significantly on the component being transfused:
 * - RBC / Whole Blood: Antibodies in recipient plasma attack donor cell surface antigens.
 *   (O- is universal cellular donor; AB+ is universal cellular recipient).
 * - Fresh Frozen Plasma (FFP): Contains antibodies, NOT red cells.
 *   (AB is universal plasma donor because it lacks Anti-A and Anti-B antibodies; O is universal recipient).
 * - Platelets: Cellular component suspended in plasma. Identical ABO/Rh is primary choice.
 *   In emergencies, O- or ABO compatible platelets can be transfused safely.
 * - Cryoprecipitate: Fibrinogen/Factor VIII concentrate. ABO compatibility is preferred but any group
 *   is clinically acceptable in critical hemorrhagic emergencies.
 * 
 * DISCLAIMER: Informational decision support only. Mandatory laboratory cross-matching
 * must precede clinical transfusion.
 */

export const MEDICAL_DISCLAIMER =
  "Informational emergency coordination layer only. Mandatory laboratory cross-matching must be performed prior to transfusion.";

export type BloodComponentType =
  | "Whole Blood"
  | "Packed Red Blood Cells"
  | "Platelets"
  | "Single Donor Platelet"
  | "Platelet Concentrate"
  | "Fresh Frozen Plasma"
  | "Cryoprecipitate";

export const STANDARDIZED_GROUPS = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+", "Oh-", "Oh+"] as const;

// Normalize standard string formats (e.g. 'O+Ve', 'A-', 'Oh+VE', 15)
export function normalizeBloodGroup(groupInput: string | number | null | undefined): string {
  if (!groupInput) return "O+";
  let s = String(groupInput).trim();
  s = s.replace(/[\s_]/g, "");
  s = s.replace(/\+Ve/i, "+").replace(/-Ve/i, "-");
  s = s.replace(/VE/i, "");
  if (s.toLowerCase().startsWith("oh")) {
    return s.endsWith("-") ? "Oh-" : "Oh+";
  }
  const match = s.match(/^(A|B|AB|O)[+-]$/i);
  if (match) return match[0].toUpperCase();
  return s.toUpperCase();
}

/**
 * Compatibility matrices by component
 */

// 1. RBC & Whole Blood: Recipient -> Compatible Donor Groups
const RBC_COMPATIBILITY: Record<string, string[]> = {
  "O-":  ["O-"],
  "O+":  ["O-", "O+"],
  "A-":  ["O-", "A-"],
  "A+":  ["O-", "O+", "A-", "A+"],
  "B-":  ["O-", "B-"],
  "B+":  ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "Oh-": ["Oh-"],
  "Oh+": ["Oh-", "Oh+"]
};

// 2. Plasma (FFP): Recipient -> Compatible Donor Groups (AB is universal donor, O is universal recipient)
const PLASMA_COMPATIBILITY: Record<string, string[]> = {
  "O-":  ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+":  ["O+", "A+", "B+", "AB+"],
  "A-":  ["A-", "A+", "AB-", "AB+"],
  "A+":  ["A+", "AB+"],
  "B-":  ["B-", "B+", "AB-", "AB+"],
  "B+":  ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
  "Oh-": ["Oh-", "Oh+", "AB-", "AB+"],
  "Oh+": ["Oh+", "AB+"]
};

// 3. Platelets: Identical preferred, then ABO-compatible cellular donors (Rh-negative preferred for O- to prevent alloimmunization)
const PLATELET_COMPATIBILITY: Record<string, string[]> = {
  "O-":  ["O-", "A-", "B-", "AB-"],
  "O+":  ["O+", "O-", "A+", "B+", "AB+"],
  "A-":  ["A-", "O-", "AB-"],
  "A+":  ["A+", "A-", "O+", "O-", "AB+"],
  "B-":  ["B-", "O-", "AB-"],
  "B+":  ["B+", "B-", "O+", "O-", "AB+"],
  "AB-": ["AB-", "A-", "B-", "O-"],
  "AB+": ["AB+", "AB-", "A+", "B+", "O+", "A-", "B-", "O-"],
  "Oh-": ["Oh-"],
  "Oh+": ["Oh+", "Oh-"]
};

// 4. Cryoprecipitate: Universal emergency tolerance
const CRYO_COMPATIBILITY: Record<string, string[]> = {
  "O-":  ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+":  ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "A-":  ["A-", "A+", "O-", "AB-"],
  "A+":  ["A+", "A-", "O+", "AB+"],
  "B-":  ["B-", "B+", "O-", "AB-"],
  "B+":  ["B+", "B-", "O+", "AB+"],
  "AB-": ["AB-", "AB+", "A-", "B-", "O-"],
  "AB+": ["AB+", "AB-", "A+", "B+", "O+"],
  "Oh-": ["Oh-", "Oh+"],
  "Oh+": ["Oh+", "Oh-"]
};

/**
 * Returns list of compatible donor blood groups for a given required group and component type.
 */
export function getCompatibleBloodGroups(
  requiredGroup: string,
  componentType: string = "Packed Red Blood Cells"
): string[] {
  const normReq = normalizeBloodGroup(requiredGroup);
  const comp = (componentType || "").toLowerCase();

  if (comp.includes("plasma") || comp.includes("ffp")) {
    return PLASMA_COMPATIBILITY[normReq] || [normReq];
  }
  if (comp.includes("platelet") || comp.includes("sdp") || comp.includes("rdp")) {
    return PLATELET_COMPATIBILITY[normReq] || [normReq];
  }
  if (comp.includes("cryo")) {
    return CRYO_COMPATIBILITY[normReq] || [normReq];
  }
  // Default to Red Blood Cells / Whole Blood
  return RBC_COMPATIBILITY[normReq] || [normReq];
}

export interface CompatibilityEvaluation {
  isCompatible: boolean;
  tier: "EXACT" | "COMPATIBLE" | "INCOMPATIBLE";
  score: number; // 100 for exact match, 70-85 for compatible secondary, 0 for incompatible
  reason: string;
  component: string;
  disclaimer: string;
}

/**
 * Evaluates compatibility between recipient and candidate donor/inventory.
 */
export function checkBloodCompatibility(
  recipientGroup: string,
  donorGroup: string,
  componentType: string = "Packed Red Blood Cells"
): CompatibilityEvaluation {
  const rec = normalizeBloodGroup(recipientGroup);
  const don = normalizeBloodGroup(donorGroup);

  if (!rec || !don) {
    return {
      isCompatible: false,
      tier: "INCOMPATIBLE",
      score: 0,
      reason: "Missing or invalid blood group specification",
      component: componentType,
      disclaimer: MEDICAL_DISCLAIMER
    };
  }

  // Exact ABO/Rh match
  if (rec === don) {
    return {
      isCompatible: true,
      tier: "EXACT",
      score: 100,
      reason: `Exact ${rec} ABO/Rh match for ${componentType}`,
      component: componentType,
      disclaimer: MEDICAL_DISCLAIMER
    };
  }

  const compatibleList = getCompatibleBloodGroups(rec, componentType);
  const isCompat = compatibleList.includes(don);

  if (isCompat) {
    // Determine secondary compatibility score
    let score = 80;
    // O- universal RBC donor
    if (don === "O-" && !componentType.toLowerCase().includes("plasma")) {
      score = 85;
    }
    // AB universal plasma donor
    if (don.startsWith("AB") && componentType.toLowerCase().includes("plasma")) {
      score = 90;
    }

    return {
      isCompatible: true,
      tier: "COMPATIBLE",
      score,
      reason: `Clinically compatible alternative: ${don} donor for ${rec} patient (${componentType})`,
      component: componentType,
      disclaimer: MEDICAL_DISCLAIMER
    };
  }

  return {
    isCompatible: false,
    tier: "INCOMPATIBLE",
    score: 0,
    reason: `Incompatible group: ${don} cannot be safely transfused to ${rec} recipient for ${componentType}`,
    component: componentType,
    disclaimer: MEDICAL_DISCLAIMER
  };
}

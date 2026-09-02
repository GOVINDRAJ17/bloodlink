/**
 * Medical ABO/Rh Blood Compatibility Engine
 * 
 * DISCLAIMER: This compatibility engine provides algorithmic ranking and 
 * informational matching for emergency coordination. It is NOT a medical decision 
 * layer and does NOT replace mandatory clinical cross-matching conducted by 
 * certified blood bank pathologists prior to transfusion.
 */

export const MEDICAL_DISCLAIMER = 
  "Informational matching only. Mandatory clinical cross-matching must be performed by a certified laboratory before transfusion.";

export const BLOOD_GROUPS = {
  "A+Ve": { code: 11, name: "A+Ve", abo: "A", rh: "+" },
  "A-Ve": { code: 12, name: "A-Ve", abo: "A", rh: "-" },
  "B+Ve": { code: 13, name: "B+Ve", abo: "B", rh: "+" },
  "B-Ve": { code: 14, name: "B-Ve", abo: "B", rh: "-" },
  "O+Ve": { code: 15, name: "O+Ve", abo: "O", rh: "+" },
  "O-Ve": { code: 16, name: "O-Ve", abo: "O", rh: "-" },
  "AB+Ve": { code: 17, name: "AB+Ve", abo: "AB", rh: "+" },
  "AB-Ve": { code: 18, name: "AB-Ve", abo: "AB", rh: "-" },
  "Oh+VE": { code: 22, name: "Oh+VE", abo: "Oh", rh: "+" },
  "Oh-VE": { code: 23, name: "Oh-VE", abo: "Oh", rh: "-" }
};

// Map recipient blood group -> list of compatible donor blood groups
const RBC_COMPATIBILITY = {
  "O-Ve":  ["O-Ve"],
  "O+Ve":  ["O+Ve", "O-Ve"],
  "A-Ve":  ["A-Ve", "O-Ve"],
  "A+Ve":  ["A+Ve", "A-Ve", "O+Ve", "O-Ve"],
  "B-Ve":  ["B-Ve", "O-Ve"],
  "B+Ve":  ["B+Ve", "B-Ve", "O+Ve", "O-Ve"],
  "AB-Ve": ["AB-Ve", "A-Ve", "B-Ve", "O-Ve"],
  "AB+Ve": ["AB+Ve", "AB-Ve", "A+Ve", "A-Ve", "B+Ve", "B-Ve", "O+Ve", "O-Ve"],
  "Oh-VE": ["Oh-VE"],
  "Oh+VE": ["Oh+VE", "Oh-VE"]
};

/**
 * Standardize blood group inputs (handles numeric codes or string names)
 */
export function normalizeBloodGroup(groupInput) {
  if (!groupInput) return null;
  const strInput = String(groupInput).trim();
  
  // Match by code
  for (const [key, value] of Object.entries(BLOOD_GROUPS)) {
    if (String(value.code) === strInput || key.toLowerCase() === strInput.toLowerCase()) {
      return key;
    }
  }
  return strInput;
}

/**
 * Evaluates compatibility between a recipient blood group and a candidate donor blood group.
 * 
 * @param {string|number} recipientGroup - Recipient's blood group
 * @param {string|number} donorGroup - Candidate donor's blood group
 * @returns {object} { isCompatible: boolean, tier: 'EXACT'|'COMPATIBLE'|'INCOMPATIBLE', score: number, disclaimer: string }
 */
export function checkBloodCompatibility(recipientGroup, donorGroup) {
  const recipient = normalizeBloodGroup(recipientGroup);
  const donor = normalizeBloodGroup(donorGroup);

  if (!recipient || !donor) {
    return {
      isCompatible: false,
      tier: "INCOMPATIBLE",
      score: 0,
      reason: "Invalid or unspecified blood group",
      disclaimer: MEDICAL_DISCLAIMER
    };
  }

  // Exact match gets highest priority score
  if (recipient === donor) {
    return {
      isCompatible: true,
      tier: "EXACT",
      score: 100,
      reason: "Exact ABO/Rh match",
      disclaimer: MEDICAL_DISCLAIMER
    };
  }

  // Special Bombay blood group check
  if (recipient.startsWith("Oh") || donor.startsWith("Oh")) {
    const allowed = RBC_COMPATIBILITY[recipient] || [];
    const isCompat = allowed.includes(donor);
    return {
      isCompatible: isCompat,
      tier: isCompat ? "COMPATIBLE" : "INCOMPATIBLE",
      score: isCompat ? 70 : 0,
      reason: isCompat ? "Bombay blood group compatible" : "Bombay blood group mismatch",
      disclaimer: MEDICAL_DISCLAIMER
    };
  }

  const compatibleDonors = RBC_COMPATIBILITY[recipient] || [];
  const isCompat = compatibleDonors.includes(donor);

  return {
    isCompatible: isCompat,
    tier: isCompat ? "COMPATIBLE" : "INCOMPATIBLE",
    score: isCompat ? 70 : 0,
    reason: isCompat ? `Compatible secondary donor (${donor} for ${recipient})` : `Incompatible donor group`,
    disclaimer: MEDICAL_DISCLAIMER
  };
}

/**
 * Get all compatible donor blood groups for a given recipient.
 */
export function getCompatibleDonorGroups(recipientGroup) {
  const recipient = normalizeBloodGroup(recipientGroup);
  if (!recipient) return [];
  return RBC_COMPATIBILITY[recipient] || [];
}

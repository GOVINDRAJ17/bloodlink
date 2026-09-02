/**
 * Centralized ABO/Rh Blood Transfusion Compatibility Engine
 * Deterministic rule-based matrix.
 */

const COMPATIBILITY: Record<string, string[]> = {
  'O-':  ['O-'],
  'O+':  ['O-', 'O+'],
  'A-':  ['O-', 'A-'],
  'A+':  ['O-', 'O+', 'A-', 'A+'],
  'B-':  ['O-', 'B-'],
  'B+':  ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

export function getCompatibleDonorGroups(recipientGroup: string): string[] {
  return COMPATIBILITY[recipientGroup] ?? [];
}

export function isCompatible(donorGroup: string, recipientGroup: string): boolean {
  return COMPATIBILITY[recipientGroup]?.includes(donorGroup) ?? false;
}

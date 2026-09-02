/**
 * Role-Based Authorization & Permissions Matrix
 */

export const ROLES = {
  DONOR: "DONOR",
  HOSPITAL: "HOSPITAL",
  BLOOD_BANK: "BLOOD_BANK",
  ADMIN: "ADMIN"
};

export function canCreateEmergencyRequest(role = "DONOR") {
  return [ROLES.HOSPITAL, ROLES.ADMIN, ROLES.DONOR].includes(role.toUpperCase());
}

export function canManageInventory(role = "DONOR") {
  return [ROLES.BLOOD_BANK, ROLES.ADMIN].includes(role.toUpperCase());
}

export function canApproveVerification(role = "DONOR") {
  return role.toUpperCase() === ROLES.ADMIN;
}

export function canViewAuditLogs(role = "DONOR") {
  return role.toUpperCase() === ROLES.ADMIN;
}

export function assertPermission(allowed, message = "Access denied: Unauthorized role permission") {
  if (!allowed) {
    const err = new Error(message);
    err.statusCode = 403;
    throw err;
  }
}

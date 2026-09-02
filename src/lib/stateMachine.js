/**
 * Emergency Request State Machine Engine
 * 
 * Lifecycle states:
 *   PENDING     - Request created, validating params & initial checks
 *   SEARCHING   - System actively scanning compatible donors & blood bank inventory
 *   MATCHED     - High-ranking candidate donors/banks identified and queued
 *   ACCEPTED    - Candidate (donor/bank) responded and accepted dispatch
 *   IN_PROGRESS - Donor en route or blood transport in transit
 *   FULFILLED   - Blood units successfully delivered to patient/hospital (Terminal)
 *   CANCELLED   - Request manually cancelled by requester/admin (Terminal)
 *   EXPIRED     - Expiry time elapsed without fulfillment (Terminal)
 */

export const REQUEST_STATES = {
  PENDING: "PENDING",
  SEARCHING: "SEARCHING",
  MATCHED: "MATCHED",
  ACCEPTED: "ACCEPTED",
  IN_PROGRESS: "IN_PROGRESS",
  FULFILLED: "FULFILLED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED"
};

const VALID_TRANSITIONS = {
  PENDING: ["SEARCHING", "CANCELLED"],
  SEARCHING: ["MATCHED", "EXPIRED", "CANCELLED"],
  MATCHED: ["ACCEPTED", "SEARCHING", "EXPIRED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "MATCHED", "CANCELLED"],
  IN_PROGRESS: ["FULFILLED", "CANCELLED"],
  FULFILLED: [],
  CANCELLED: [],
  EXPIRED: []
};

/**
 * Checks whether a state transition is valid.
 */
export function isValidStateTransition(currentStatus, nextStatus) {
  if (!currentStatus || !nextStatus) return false;
  if (currentStatus === nextStatus) return true; // idempotent

  const allowedNextStates = VALID_TRANSITIONS[currentStatus] || [];
  return allowedNextStates.includes(nextStatus);
}

/**
 * Applies a state transition to a request document, recording history.
 */
export function applyStateTransition(requestDoc, nextStatus, note = "") {
  const currentStatus = requestDoc.status || REQUEST_STATES.PENDING;

  if (!isValidStateTransition(currentStatus, nextStatus)) {
    throw new Error(
      `Invalid state transition: Cannot transition request from '${currentStatus}' to '${nextStatus}'. Allowed: [${(VALID_TRANSITIONS[currentStatus] || []).join(", ")}]`
    );
  }

  const now = new Date();
  const historyEntry = {
    from: currentStatus,
    to: nextStatus,
    timestamp: now,
    note: note || `Status updated from ${currentStatus} to ${nextStatus}`
  };

  const updatedHistory = [...(requestDoc.statusHistory || []), historyEntry];

  return {
    ...requestDoc,
    status: nextStatus,
    statusHistory: updatedHistory,
    updatedAt: now
  };
}

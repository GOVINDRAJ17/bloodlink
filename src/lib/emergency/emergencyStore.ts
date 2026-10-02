/**
 * Emergency Blood Coordination Store & Persistence Service
 * 
 * Provides unified state management across Supabase and in-memory cache.
 * Ensures the emergency response engine operates seamlessly even if the remote
 * database is temporarily offline or in local demo mode.
 */

import { EmergencyResponsePlan, generateEmergencyResponsePlan, OptimizationRequest } from "./responsePlanService";
import { CandidateResource } from "./scoringEngine";
import { getAllDemoCandidates, CITYCARE_HOSPITAL } from "./demoSeedData";

// Global cache holding active plans, modified candidate availability, and demo requests
declare global {
  // eslint-disable-next-line no-var
  var __BLOODLINK_EMERGENCY_CACHE: {
    plans: Map<string, EmergencyResponsePlan>;
    candidates: Map<string, CandidateResource>;
    requests: Map<string, any>;
  } | undefined;
}

function getCache() {
  if (!globalThis.__BLOODLINK_EMERGENCY_CACHE) {
    globalThis.__BLOODLINK_EMERGENCY_CACHE = {
      plans: new Map(),
      candidates: new Map(),
      requests: new Map(),
    };
    // Initialize candidate pool from demo seed
    resetCandidatePool();
  }
  return globalThis.__BLOODLINK_EMERGENCY_CACHE;
}

export function resetCandidatePool() {
  const cache = globalThis.__BLOODLINK_EMERGENCY_CACHE || {
    plans: new Map(),
    candidates: new Map(),
    requests: new Map(),
  };
  cache.candidates.clear();
  getAllDemoCandidates().forEach((c) => {
    cache.candidates.set(c.id, { ...c });
  });
  globalThis.__BLOODLINK_EMERGENCY_CACHE = cache;
}

export function getActiveCandidates(): CandidateResource[] {
  const cache = getCache();
  if (cache.candidates.size === 0) {
    resetCandidatePool();
  }
  return Array.from(cache.candidates.values());
}

export function updateCandidateStock(candidateId: string, deltaUnits: number): boolean {
  const cache = getCache();
  const cand = cache.candidates.get(candidateId);
  if (!cand) return false;
  cand.availableUnits = Math.max(0, cand.availableUnits + deltaUnits);
  return true;
}

export function setCandidateAvailability(candidateId: string, available: boolean): boolean {
  const cache = getCache();
  const cand = cache.candidates.get(candidateId);
  if (!cand) return false;
  if (cand.sourceType === "BLOOD_BANK") {
    cand.availableUnits = available ? 2 : 0;
  } else {
    cand.isAvailable = available;
  }
  return true;
}

export function storeEmergencyPlan(plan: EmergencyResponsePlan): void {
  const cache = getCache();
  cache.plans.set(plan.requestId, plan);
}

export function getStoredEmergencyPlan(requestId: string): EmergencyResponsePlan | null {
  const cache = getCache();
  return cache.plans.get(requestId) || null;
}

export function storeEmergencyRequest(request: any): void {
  const cache = getCache();
  cache.requests.set(request.id, request);
}

export function getStoredEmergencyRequest(requestId: string): any | null {
  const cache = getCache();
  return cache.requests.get(requestId) || null;
}

/**
 * Executes emergency response planning for a request.
 */
export function buildResponsePlanForRequest(
  optReq: OptimizationRequest,
  excludedSourceIds: string[] = []
): EmergencyResponsePlan {
  const candidates = getActiveCandidates();
  const plan = generateEmergencyResponsePlan(optReq, candidates, excludedSourceIds);
  storeEmergencyPlan(plan);
  return plan;
}

/**
 * Initializes the standard Demo Request (CityCare Hospital, O-, Platelets, 4 units, CRITICAL)
 */
export function getOrCreateDemoScenarioPlan(): {
  request: any;
  plan: EmergencyResponsePlan;
} {
  const demoRequestId = "req-demo-citycare-001";
  const existingPlan = getStoredEmergencyPlan(demoRequestId);
  const existingReq = getStoredEmergencyRequest(demoRequestId);

  if (existingPlan && existingReq) {
    return { request: existingReq, plan: existingPlan };
  }

  const demoReq = {
    id: demoRequestId,
    hospital_name: CITYCARE_HOSPITAL.name,
    hospital_address: CITYCARE_HOSPITAL.address,
    blood_group: "O-",
    component: "Platelets",
    units_required: 4,
    units_fulfilled: 0,
    urgency: "CRITICAL",
    deadline_minutes: 90,
    status: "SEARCHING",
    created_at: new Date().toISOString(),
    location: CITYCARE_HOSPITAL.location,
    additional_message: "Patient in acute trauma surgery with profound thrombocytopenia. Immediate platelets required.",
  };

  storeEmergencyRequest(demoReq);

  const plan = buildResponsePlanForRequest({
    requestId: demoRequestId,
    bloodGroup: "O-",
    component: "Platelets",
    unitsRequired: 4,
    urgency: "CRITICAL",
    hospitalLocation: CITYCARE_HOSPITAL.location,
    hospitalName: CITYCARE_HOSPITAL.name,
    deadlineMinutes: 90,
  });

  return { request: demoReq, plan };
}

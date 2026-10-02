import assert from "node:assert/strict";
import test from "node:test";

import {
  checkBloodCompatibility,
  getCompatibleBloodGroups,
  normalizeBloodGroup,
} from "./src/lib/emergency/compatibility.ts";

import {
  calculateHaversineDistance,
  estimateEmergencyEta,
} from "./src/lib/emergency/etaService.ts";

import { assessInventoryFreshness } from "./src/lib/emergency/confidenceService.ts";

import {
  scoreEmergencyCandidate,
  rankEmergencyResources,
} from "./src/lib/emergency/scoringEngine.ts";

import { executeDynamicRadiusSearch } from "./src/lib/emergency/dynamicRadiusService.ts";

import { generateEmergencyResponsePlan } from "./src/lib/emergency/responsePlanService.ts";

import {
  CITYCARE_HOSPITAL,
  DEMO_BLOOD_BANKS,
  DEMO_DONORS,
  getAllDemoCandidates,
} from "./src/lib/emergency/demoSeedData.ts";

test("Blood Compatibility - Red Blood Cells / Whole Blood", () => {
  assert.equal(normalizeBloodGroup("O-"), "O-");
  assert.equal(normalizeBloodGroup("A+Ve"), "A+");

  // O- is universal RBC donor
  const oNegCompat = checkBloodCompatibility("AB+", "O-", "Packed Red Blood Cells");
  assert.equal(oNegCompat.isCompatible, true);
  assert.equal(oNegCompat.tier, "COMPATIBLE");

  // O- recipient can only receive O- RBC
  const oNegRecip = checkBloodCompatibility("O-", "A+", "Packed Red Blood Cells");
  assert.equal(oNegRecip.isCompatible, false);
  assert.equal(oNegRecip.tier, "INCOMPATIBLE");

  // Exact match
  const exactMatch = checkBloodCompatibility("O-", "O-", "Packed Red Blood Cells");
  assert.equal(exactMatch.isCompatible, true);
  assert.equal(exactMatch.tier, "EXACT");
  assert.equal(exactMatch.score, 100);
});

test("Blood Compatibility - Fresh Frozen Plasma (FFP)", () => {
  // AB is universal plasma donor
  const abPlasma = checkBloodCompatibility("O-", "AB+", "Fresh Frozen Plasma");
  assert.equal(abPlasma.isCompatible, true);

  // O cannot donate plasma to AB
  const oToAbPlasma = checkBloodCompatibility("AB+", "O+", "Fresh Frozen Plasma");
  assert.equal(oToAbPlasma.isCompatible, false);
});

test("Blood Compatibility - Platelets", () => {
  // O- can receive O- platelets (exact)
  const oPlateletExact = checkBloodCompatibility("O-", "O-", "Platelets");
  assert.equal(oPlateletExact.isCompatible, true);
  assert.equal(oPlateletExact.tier, "EXACT");

  // O- receiving A- platelets is clinically compatible in emergencies
  const oPlateletCompat = checkBloodCompatibility("O-", "A-", "Platelets");
  assert.equal(oPlateletCompat.isCompatible, true);
});

test("ETA & Distance Calculation", () => {
  // CityCare to Bandra East (~3.2 km)
  const dist = calculateHaversineDistance(
    CITYCARE_HOSPITAL.location,
    { lat: 19.0620, lng: 72.8610 }
  );
  assert.ok(dist >= 2.0 && dist <= 4.0, `Distance should be ~3.2km, got ${dist}`);

  // ETA under CRITICAL priority
  const etaCritical = estimateEmergencyEta(
    { lat: 19.0620, lng: 72.8610 },
    CITYCARE_HOSPITAL.location,
    "BLOOD_BANK",
    "CRITICAL"
  );
  assert.ok(etaCritical.totalEtaMinutes > 0);
  assert.ok(etaCritical.totalEtaMinutes <= 20);
});

test("Inventory Freshness Decay", () => {
  const fresh = assessInventoryFreshness(new Date(Date.now() - 6 * 60 * 1000));
  assert.ok(fresh.confidence >= 95);
  assert.equal(fresh.isStale, false);

  const stale = assessInventoryFreshness(new Date(Date.now() - 20 * 60 * 60 * 1000));
  assert.ok(stale.confidence <= 50);
  assert.equal(stale.isStale, true);
});

test("Demo Scenario 1: CityCare Hospital, O-, Platelets, 4 units, CRITICAL", () => {
  const allCandidates = getAllDemoCandidates();

  // Dynamic radius expansion verification
  const radiusSearch = executeDynamicRadiusSearch(allCandidates, {
    bloodGroup: "O-",
    component: "Platelets",
    unitsRequired: 4,
    urgency: "CRITICAL",
    hospitalLocation: CITYCARE_HOSPITAL.location,
  });

  // At 3km, insufficient
  assert.equal(radiusSearch.steps[0].radiusKm, 3);
  assert.equal(radiusSearch.steps[0].isSufficient, false);

  // Expands outward to meet requirement
  assert.ok(radiusSearch.finalRadiusKm >= 10);
  assert.equal(radiusSearch.isFullySufficient, true);

  // Generate complete Emergency Response Plan
  const plan = generateEmergencyResponsePlan(
    {
      requestId: "test-req-01",
      bloodGroup: "O-",
      component: "Platelets",
      unitsRequired: 4,
      urgency: "CRITICAL",
      hospitalLocation: CITYCARE_HOSPITAL.location,
      hospitalName: CITYCARE_HOSPITAL.name,
      deadlineMinutes: 90,
    },
    allCandidates
  );

  assert.equal(plan.totalUnitsRequired, 4);
  assert.equal(plan.totalUnitsPlanned, 4);
  assert.equal(plan.isFullyFulfilled, true);
  assert.equal(plan.remainingShortage, 0);
  assert.ok(plan.items.length >= 2, "Should combine multiple sources");

  // Check that "Why recommended?" rationale is populated for every item
  plan.items.forEach((item) => {
    assert.ok(item.whyRecommended.length > 0, `Missing whyRecommended for ${item.name}`);
    assert.ok(item.totalScore > 0);
    assert.ok(item.allocatedUnits > 0);
  });

  console.log("Scenario 1 Passed: 4/4 units planned across sources:", plan.items.map(i => `${i.name}: ${i.allocatedUnits} units (${i.recommendedAction})`));
});

test("Demo Scenario 2: Resource Unavailable & Recalculation", () => {
  const allCandidates = getAllDemoCandidates();

  // Mark Blood Bank A (bb-redcross-01) unavailable
  const planAfterOutage = generateEmergencyResponsePlan(
    {
      requestId: "test-req-01",
      bloodGroup: "O-",
      component: "Platelets",
      unitsRequired: 4,
      urgency: "CRITICAL",
      hospitalLocation: CITYCARE_HOSPITAL.location,
      hospitalName: CITYCARE_HOSPITAL.name,
      deadlineMinutes: 90,
    },
    allCandidates,
    ["bb-redcross-01"] // Excluded
  );

  assert.equal(planAfterOutage.totalUnitsPlanned, 4);
  assert.equal(planAfterOutage.isFullyFulfilled, true);

  // Verify Bank A is NOT in the new plan
  const hasBankA = planAfterOutage.items.some((i) => i.sourceId === "bb-redcross-01");
  assert.equal(hasBankA, false, "Bank A should not be included in recalculated plan");

  console.log("Scenario 2 Passed: Alternative plan generated without Bank A:", planAfterOutage.items.map(i => `${i.name}: ${i.allocatedUnits} units`));
});

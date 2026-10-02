/**
 * Static Chronic Care Condition & Transfusion Protocol Dataset
 * ============================================================
 * Provides zero-latency, compile-time verified chronic patient records
 * for Thalassemia Major, Leukemia, Sickle Cell Disease, and Aplastic Anemia.
 */

export interface ChronicPatient {
  id: string;
  fullName: string;
  conditionType: "THALASSEMIA_MAJOR" | "LEUKEMIA" | "SICKLE_CELL" | "APLASTIC_ANEMIA";
  bloodGroup: string;
  requiredComponent: string;
  unitsPerCycle: number;
  cycleFrequencyDays: number;
  nextTransfusionDate: string;
  lastTransfusionDate: string;
  hospitalName: string;
  status: "ACTIVE" | "PAUSED";
  notes?: string;
  reservedUnits: number;
  matchingStatus: "UNASSIGNED" | "MATCHED" | "CONFIRMED";
}

export const INITIAL_CHRONIC_PATIENTS: ChronicPatient[] = [
  {
    id: "pat-thal-101",
    fullName: "Aarav K. Patel (Child / 8y)",
    conditionType: "THALASSEMIA_MAJOR",
    bloodGroup: "O-",
    requiredComponent: "Packed Red Blood Cells (Leukodepleted)",
    unitsPerCycle: 2,
    cycleFrequencyDays: 21,
    nextTransfusionDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split("T")[0],
    lastTransfusionDate: new Date(Date.now() - 19 * 24 * 3600 * 1000).toISOString().split("T")[0],
    hospitalName: "Tata Memorial Pediatric Hematology",
    status: "ACTIVE",
    notes: "Requires regular monthly chelation therapy and CMV-negative PRBC units.",
    reservedUnits: 2,
    matchingStatus: "CONFIRMED",
  },
  {
    id: "pat-leuk-202",
    fullName: "Meera Deshmukh (44y)",
    conditionType: "LEUKEMIA",
    bloodGroup: "A+",
    requiredComponent: "Platelets (Single Donor Apheresis)",
    unitsPerCycle: 1,
    cycleFrequencyDays: 14,
    nextTransfusionDate: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString().split("T")[0],
    lastTransfusionDate: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString().split("T")[0],
    hospitalName: "Lilavati Cancer Institute",
    status: "ACTIVE",
    notes: "Post-chemotherapy nadir; strictly single-donor apheresis platelet concentrate required.",
    reservedUnits: 0,
    matchingStatus: "UNASSIGNED",
  },
  {
    id: "pat-sickle-303",
    fullName: "Kunal V. Gaikwad (19y)",
    conditionType: "SICKLE_CELL",
    bloodGroup: "B+",
    requiredComponent: "Packed Red Blood Cells",
    unitsPerCycle: 2,
    cycleFrequencyDays: 28,
    nextTransfusionDate: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString().split("T")[0],
    lastTransfusionDate: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString().split("T")[0],
    hospitalName: "KEM Hospital Hematology Ward",
    status: "ACTIVE",
    notes: "Prophylactic exchange transfusion protocol for pain crisis prevention.",
    reservedUnits: 2,
    matchingStatus: "MATCHED",
  },
  {
    id: "pat-thal-404",
    fullName: "Ananya Iyer (14y)",
    conditionType: "THALASSEMIA_MAJOR",
    bloodGroup: "AB+",
    requiredComponent: "Packed Red Blood Cells",
    unitsPerCycle: 2,
    cycleFrequencyDays: 21,
    nextTransfusionDate: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString().split("T")[0],
    lastTransfusionDate: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString().split("T")[0],
    hospitalName: "Dr. R.N. Cooper Hospital",
    status: "ACTIVE",
    notes: "Routine recurring regimen; phenotypically matched donors preferred.",
    reservedUnits: 1,
    matchingStatus: "MATCHED",
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __BLOODLINK_CHRONIC_STORE: ChronicPatient[] | undefined;
}

export function getChronicStore(): ChronicPatient[] {
  if (!globalThis.__BLOODLINK_CHRONIC_STORE) {
    globalThis.__BLOODLINK_CHRONIC_STORE = [...INITIAL_CHRONIC_PATIENTS];
  }
  return globalThis.__BLOODLINK_CHRONIC_STORE;
}

export function getChronicCareMetrics(condition?: string | null) {
  const store = getChronicStore();
  let filtered = store;
  if (condition && condition !== "ALL") {
    filtered = store.filter((p) => p.conditionType === condition);
  }

  const now = new Date();
  const next7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  const dueNext7Days = store.filter((p) => {
    const d = new Date(p.nextTransfusionDate);
    return d >= now && d <= next7Days;
  }).length;

  const totalUnitsReserved = store.reduce((acc, p) => acc + (p.reservedUnits || 0), 0);

  return {
    totalPatients: store.length,
    dueNext7Days,
    totalUnitsReserved,
    patients: filtered,
  };
}

export const getChronicMetrics = getChronicCareMetrics;

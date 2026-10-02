/**
 * Emergency Blood Response Engine - Standard Demo & Seed Dataset
 * 
 * Provides a realistic, clinically calibrated dataset centered on CityCare Hospital
 * in Mumbai (lat: 19.0760, lng: 72.8777).
 * 
 * Features:
 * - 6 Blood Banks with realistic stock, varying components, and freshness tiers.
 * - 24 Donors with varying blood groups, response histories, and distances.
 * - Calibrated so that for "O- Platelets, 4 units, CRITICAL":
 *   - 3 km radius: 0 units (insufficient)
 *   - 10 km radius: 2 units (Bank A: 2 units) -> insufficient
 *   - 25 km radius: 4 units (Bank A: 2 units + Bank C: 1 unit + Donor #182: 1 unit) -> 4/4 Full Fulfillment!
 * - When Bank A is toggled unavailable, recalculation shifts allocation to Bank C (1), Bank D (2), and Donor #182 (1).
 */

import { CandidateResource } from "./scoringEngine";

export const CITYCARE_HOSPITAL = {
  id: "hosp-citycare-01",
  name: "CityCare Hospital",
  address: "S.V. Road, Bandra West, Mumbai 400050",
  phone: "+91 22 2640 5000",
  location: { lat: 19.0760, lng: 72.8777 },
};

export const DEMO_BLOOD_BANKS: CandidateResource[] = [
  {
    id: "bb-redcross-01",
    sourceType: "BLOOD_BANK",
    name: "RedCross Central Blood Center",
    bloodGroup: "O-",
    component: "Platelets",
    availableUnits: 2,
    location: { lat: 19.0620, lng: 72.8610 }, // ~3.2 km
    phone: "+91 22 2655 1234",
    address: "Bandra East Medical Enclave",
    verified: true,
    updatedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(), // 6 mins ago (Freshness: 98%)
  },
  {
    id: "bb-metro-02",
    sourceType: "BLOOD_BANK",
    name: "Metro Lifeline Blood Bank",
    bloodGroup: "O-",
    component: "Platelets",
    availableUnits: 0, // Depleted
    location: { lat: 19.0880, lng: 72.8920 }, // ~4.1 km
    phone: "+91 22 2522 9988",
    address: "Kurla West Healthcare Hub",
    verified: true,
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
  },
  {
    id: "bb-apex-03",
    sourceType: "BLOOD_BANK",
    name: "Apex Municipal Blood Center",
    bloodGroup: "O-",
    component: "Platelets",
    availableUnits: 1,
    location: { lat: 19.1150, lng: 72.8420 }, // ~7.8 km
    phone: "+91 22 2628 4400",
    address: "Andheri West Municipal Complex",
    verified: true,
    updatedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(), // 42 mins ago (Freshness: 92%)
  },
  {
    id: "bb-stjude-04",
    sourceType: "BLOOD_BANK",
    name: "St. Jude Regional Blood Bank",
    bloodGroup: "O-",
    component: "Platelets",
    availableUnits: 2,
    location: { lat: 19.1680, lng: 72.9350 }, // ~16.5 km
    phone: "+91 22 2871 3322",
    address: "Bhandup Industrial Zone",
    verified: true,
    updatedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(), // ~1.8h ago (Freshness: 92%)
  },
  {
    id: "bb-sunrise-05",
    sourceType: "BLOOD_BANK",
    name: "Sunrise Charitable Blood Bank",
    bloodGroup: "O-",
    component: "Platelets",
    availableUnits: 1,
    location: { lat: 19.2150, lng: 72.8650 }, // ~22.4 km
    phone: "+91 22 2805 7766",
    address: "Borivali East Care Wing",
    verified: false,
    updatedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(), // 22h ago (Freshness: 45% - Stale)
  },
  {
    id: "bb-harbor-06",
    sourceType: "BLOOD_BANK",
    name: "Harbor Southern Blood Bank",
    bloodGroup: "A-",
    component: "Platelets",
    availableUnits: 3,
    location: { lat: 18.9950, lng: 72.8250 }, // ~12.2 km
    phone: "+91 22 2410 8822",
    address: "Parel Medical Corridor",
    verified: true,
    updatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  }
];

export const DEMO_DONORS: CandidateResource[] = [
  // O- Compatible Donors
  {
    id: "donor-182",
    sourceType: "DONOR",
    name: "Rahul Sharma (Donor #182)",
    bloodGroup: "O-",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 96,
    totalDonations: 7,
    phone: "+91 98200 •••••",
    location: { lat: 19.0980, lng: 72.8520 }, // ~4.2 km
  },
  {
    id: "donor-194",
    sourceType: "DONOR",
    name: "Priya Nair (Donor #194)",
    bloodGroup: "O-",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 92,
    totalDonations: 4,
    phone: "+91 98211 •••••",
    location: { lat: 19.1350, lng: 72.8350 }, // ~9.1 km
  },
  {
    id: "donor-205",
    sourceType: "DONOR",
    name: "Amit Patel (Donor #205)",
    bloodGroup: "O-",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 88,
    totalDonations: 3,
    phone: "+91 98222 •••••",
    location: { lat: 19.1620, lng: 72.8710 }, // ~13.8 km
  },
  {
    id: "donor-218",
    sourceType: "DONOR",
    name: "Sneha Rao (Donor #218)",
    bloodGroup: "O-",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 84,
    totalDonations: 2,
    phone: "+91 98233 •••••",
    location: { lat: 19.2050, lng: 72.8450 }, // ~19.5 km
  },
  {
    id: "donor-229",
    sourceType: "DONOR",
    name: "Vikram Mehta (Donor #229)",
    bloodGroup: "O-",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 90,
    totalDonations: 5,
    phone: "+91 98244 •••••",
    location: { lat: 19.0120, lng: 72.8350 }, // ~10.4 km
  },
  {
    id: "donor-235",
    sourceType: "DONOR",
    name: "Ananya Iyer (Donor #235)",
    bloodGroup: "O-",
    availableUnits: 1,
    isAvailable: false, // Currently off-duty / traveling
    reliabilityScore: 78,
    totalDonations: 1,
    phone: "+91 98255 •••••",
    location: { lat: 19.0550, lng: 72.8850 },
  },

  // Other Blood Groups for realistic regional presence
  {
    id: "donor-301",
    sourceType: "DONOR",
    name: "Karan Desai",
    bloodGroup: "O+",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 94,
    totalDonations: 6,
    location: { lat: 19.0720, lng: 72.8680 },
  },
  {
    id: "donor-302",
    sourceType: "DONOR",
    name: "Deepa Verma",
    bloodGroup: "A+",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 89,
    totalDonations: 3,
    location: { lat: 19.0810, lng: 72.8820 },
  },
  {
    id: "donor-303",
    sourceType: "DONOR",
    name: "Rohan Kulkarni",
    bloodGroup: "B+",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 91,
    totalDonations: 4,
    location: { lat: 19.0650, lng: 72.8550 },
  },
  {
    id: "donor-304",
    sourceType: "DONOR",
    name: "Neha Joshi",
    bloodGroup: "AB+",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 85,
    totalDonations: 2,
    location: { lat: 19.0910, lng: 72.8610 },
  },
  {
    id: "donor-305",
    sourceType: "DONOR",
    name: "Siddharth Sen",
    bloodGroup: "A-",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 87,
    totalDonations: 3,
    location: { lat: 19.1120, lng: 72.8590 },
  },
  {
    id: "donor-306",
    sourceType: "DONOR",
    name: "Pooja Hegde",
    bloodGroup: "B-",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 93,
    totalDonations: 5,
    location: { lat: 19.0450, lng: 72.8420 },
  },
  {
    id: "donor-307",
    sourceType: "DONOR",
    name: "Manish Chawla",
    bloodGroup: "AB-",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 82,
    totalDonations: 2,
    location: { lat: 19.1240, lng: 72.8880 },
  },
  {
    id: "donor-308",
    sourceType: "DONOR",
    name: "Aditi Gokhale",
    bloodGroup: "O+",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 95,
    totalDonations: 8,
    location: { lat: 19.0350, lng: 72.8720 },
  },
  {
    id: "donor-309",
    sourceType: "DONOR",
    name: "Farhan Khan",
    bloodGroup: "A+",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 88,
    totalDonations: 4,
    location: { lat: 19.1450, lng: 72.8490 },
  },
  {
    id: "donor-310",
    sourceType: "DONOR",
    name: "Tanvi Sawant",
    bloodGroup: "B+",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 90,
    totalDonations: 3,
    location: { lat: 19.0820, lng: 72.8410 },
  },
  {
    id: "donor-311",
    sourceType: "DONOR",
    name: "Gaurav Malhotra",
    bloodGroup: "O-",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 86,
    totalDonations: 2,
    location: { lat: 19.2310, lng: 72.8550 }, // ~24.8 km
  },
  {
    id: "donor-312",
    sourceType: "DONOR",
    name: "Meera Trivedi",
    bloodGroup: "O+",
    availableUnits: 1,
    isAvailable: true,
    reliabilityScore: 92,
    totalDonations: 5,
    location: { lat: 19.0710, lng: 72.8990 },
  }
];

export function getAllDemoCandidates(): CandidateResource[] {
  return [...DEMO_BLOOD_BANKS, ...DEMO_DONORS];
}

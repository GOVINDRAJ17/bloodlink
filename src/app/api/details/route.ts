import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Fallback in-memory registry for local environments
declare global {
  // eslint-disable-next-line no-var
  var __BLOODLINK_REGISTERED_PROFILES: Map<string, any> | undefined;
}

function getLocalProfileStore() {
  if (!globalThis.__BLOODLINK_REGISTERED_PROFILES) {
    globalThis.__BLOODLINK_REGISTERED_PROFILES = new Map();
  }
  return globalThis.__BLOODLINK_REGISTERED_PROFILES;
}

const BLOOD_GROUP_MAP: Record<string, string> = {
  "11": "A+",
  "12": "A-",
  "13": "B+",
  "14": "B-",
  "15": "O+",
  "16": "O-",
  "17": "AB+",
  "18": "AB-",
  "22": "O+",
  "23": "O-",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = body.payload || body;
    const { email, details } = payload;

    if (!details) {
      return NextResponse.json({ error: "Missing registration details payload" }, { status: 400 });
    }

    const {
      fullName,
      dob,
      gender,
      phone,
      stateCode,
      districtCode,
      emergencyContact,
      isDonor,
      bloodGroupId,
      donorDetails,
    } = details;

    const bloodGroup = BLOOD_GROUP_MAP[String(bloodGroupId)] || "O+";

    // ─── Evaluate Clinical Eligibility Rules ───
    const ineligibilityReasons: string[] = [];

    if (isDonor && donorDetails) {
      if (donorDetails.recentTattoo) {
        ineligibilityReasons.push("Recent tattoo or body piercing within the last 6 months.");
      }
      if (donorDetails.pregnant) {
        ineligibilityReasons.push("Currently pregnant or breastfeeding.");
      }
      if (donorDetails.underweight) {
        ineligibilityReasons.push("Body weight below minimum threshold (45 kg).");
      }
      if (donorDetails.hasDisease) {
        ineligibilityReasons.push("Active chronic medical condition or blood-transmissible illness.");
      }
      if (donorDetails.hasRecentSurgery) {
        ineligibilityReasons.push("Major surgery within the last 12 months.");
      }
      if (donorDetails.hasGeneticDisorder) {
        ineligibilityReasons.push("Diagnosed genetic blood disorder (e.g., Sickle Cell, Hemophilia).");
      }
    }

    const isEligible = isDonor ? ineligibilityReasons.length === 0 : false;

    const registrationRecord = {
      userId: `user-${Date.now()}`,
      email: email || "donor@bloodlink.org",
      fullName,
      dob,
      gender,
      phone,
      stateCode,
      districtCode,
      emergencyContact,
      role: isDonor ? "DONOR" : "RECIPIENT",
      bloodGroup,
      isEligible,
      ineligibilityReasons,
      screening: isDonor ? {
        lastDonationDate: donorDetails?.lastDonationDate || null,
        donationCamp: donorDetails?.donationCamp || null,
        recentTattoo: Boolean(donorDetails?.recentTattoo),
        pregnant: Boolean(donorDetails?.pregnant),
        underweight: Boolean(donorDetails?.underweight),
        onMedication: Boolean(donorDetails?.onMedication),
        medicationDetails: donorDetails?.medicationDetails || null,
        hasDisease: Boolean(donorDetails?.hasDisease),
        hasRecentSurgery: Boolean(donorDetails?.hasRecentSurgery),
        surgeryDetails: donorDetails?.surgeryDetails || null,
        hasGeneticDisorder: Boolean(donorDetails?.hasGeneticDisorder),
        geneticDisorderDetails: donorDetails?.geneticDisorderDetails || null,
        screeningCompletedAt: new Date().toISOString(),
      } : null,
      registeredAt: new Date().toISOString(),
    };

    // Save to local fallback store
    const store = getLocalProfileStore();
    store.set(registrationRecord.phone || registrationRecord.email, registrationRecord);

    // Best-effort persistence to Supabase
    try {
      const adminClient = createAdminClient();
      
      // Upsert profiles
      await adminClient.from("profiles").upsert({
        full_name: fullName,
        phone,
        role: isDonor ? "DONOR" : "RECIPIENT",
        is_profile_complete: true,
        updated_at: new Date().toISOString(),
      });

      if (isDonor) {
        await adminClient.from("donor_profiles").upsert({
          blood_group: bloodGroup,
          available: isEligible,
          last_donation_date: donorDetails?.lastDonationDate || null,
          is_eligible: isEligible,
          ineligibility_reasons: ineligibilityReasons,
          surgeries: donorDetails?.hasRecentSurgery ? [{ details: donorDetails.surgeryDetails }] : [],
          genetic_diseases: donorDetails?.hasGeneticDisorder ? [{ details: donorDetails.geneticDisorderDetails }] : [],
          medications: donorDetails?.onMedication ? [{ details: donorDetails.medicationDetails }] : [],
          screening_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (sbErr) {
      console.warn("Supabase persistence notice in /api/details:", sbErr);
    }

    return NextResponse.json({
      success: true,
      message: "Profile and medical screening registered successfully",
      isEligible,
      ineligibilityReasons,
      record: registrationRecord,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error in /api/details:", error);
    return NextResponse.json({
      error: error?.message || "Failed to process profile registration"
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const identifier = searchParams.get("phone") || searchParams.get("email");

  const store = getLocalProfileStore();
  if (identifier && store.has(identifier)) {
    return NextResponse.json({ success: true, profile: store.get(identifier) });
  }

  return NextResponse.json({
    success: true,
    profilesCount: store.size,
    profiles: Array.from(store.values()),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export interface DonationCamp {
  id: string;
  title: string;
  locationName: string;
  address: string;
  startDate: string;
  endDate: string;
  targetUnits: number;
  collectedUnits: number;
  registeredDonorsCount: number;
  status: "UPCOMING" | "ACTIVE" | "CONCLUDED" | "CANCELLED";
  organizerHospital: string;
}

const INITIAL_CAMPS: DonationCamp[] = [
  {
    id: "camp-101",
    title: "Metro Corporate Blood Donation Drive 2026",
    locationName: "Bandra Kurla Complex (BKC) Ground",
    address: "G Block BKC, Bandra East, Mumbai",
    startDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split("T")[0],
    endDate: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString().split("T")[0],
    targetUnits: 250,
    collectedUnits: 0,
    registeredDonorsCount: 142,
    status: "UPCOMING",
    organizerHospital: "Lilavati Hospital & Research Centre",
  },
  {
    id: "camp-102",
    title: "University Youth Blood Life Camp",
    locationName: "Mumbai University Kalina Campus",
    address: "Vidyanagari, Kalina, Santacruz East, Mumbai",
    startDate: new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString().split("T")[0],
    endDate: new Date(Date.now() + 9 * 24 * 3600 * 1000).toISOString().split("T")[0],
    targetUnits: 180,
    collectedUnits: 0,
    registeredDonorsCount: 96,
    status: "UPCOMING",
    organizerHospital: "Dr. R.N. Cooper Municipal Hospital",
  },
  {
    id: "camp-103",
    title: "Rotary Club Community Emergency Drive",
    locationName: "Community Hall, Vile Parle West",
    address: "Station Road, Vile Parle West, Mumbai",
    startDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    targetUnits: 100,
    collectedUnits: 114,
    registeredDonorsCount: 120,
    status: "ACTIVE",
    organizerHospital: "City General Hospital",
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __BLOODLINK_CAMPS_STORE: DonationCamp[] | undefined;
}

function getCampsStore(): DonationCamp[] {
  if (!globalThis.__BLOODLINK_CAMPS_STORE) {
    globalThis.__BLOODLINK_CAMPS_STORE = [...INITIAL_CAMPS];
  }
  return globalThis.__BLOODLINK_CAMPS_STORE;
}

export async function GET() {
  const camps = getCampsStore();
  return NextResponse.json({ success: true, camps });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      locationName,
      address,
      startDate,
      endDate,
      targetUnits = 100,
      organizerHospital = "City General Hospital",
    } = body;

    if (!title || !locationName || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required camp fields" }, { status: 400 });
    }

    const newCamp: DonationCamp = {
      id: `camp-${Date.now()}`,
      title,
      locationName,
      address: address || locationName,
      startDate,
      endDate,
      targetUnits: Number(targetUnits) || 100,
      collectedUnits: 0,
      registeredDonorsCount: 0,
      status: "UPCOMING",
      organizerHospital,
    };

    const store = getCampsStore();
    store.unshift(newCamp);

    // Best-effort Supabase insert
    try {
      const adminClient = createAdminClient();
      await adminClient.from("donation_camps").insert({
        id: newCamp.id,
        title,
        location_name: locationName,
        address: address || locationName,
        start_date: startDate,
        end_date: endDate,
        target_units: targetUnits,
        status: "UPCOMING",
      });
    } catch {
      // Local fallback active
    }

    return NextResponse.json({ success: true, camp: newCamp }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create camp" }, { status: 500 });
  }
}

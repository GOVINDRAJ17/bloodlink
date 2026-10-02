import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export interface DonorAppointment {
  id: string;
  donorName: string;
  donorPhone: string;
  bloodGroup: string;
  appointmentDate: string;
  timeSlot: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  hospitalName: string;
  notes?: string;
}

const INITIAL_APPOINTMENTS: DonorAppointment[] = [
  {
    id: "apt-101",
    donorName: "Vikram Rathore",
    donorPhone: "+91 98201 44556",
    bloodGroup: "O+",
    appointmentDate: new Date().toISOString().split("T")[0],
    timeSlot: "10:30 AM - 11:00 AM",
    status: "CONFIRMED",
    hospitalName: "City General Hospital",
    notes: "Platelet apheresis donor; passed phone pre-screening.",
  },
  {
    id: "apt-102",
    donorName: "Priya S. Nambiar",
    donorPhone: "+91 98199 77881",
    bloodGroup: "B-",
    appointmentDate: new Date().toISOString().split("T")[0],
    timeSlot: "11:30 AM - 12:00 PM",
    status: "PENDING",
    hospitalName: "City General Hospital",
    notes: "Whole blood donation; first-time donor.",
  },
  {
    id: "apt-103",
    donorName: "Farhan Qureshi",
    donorPhone: "+91 98334 11229",
    bloodGroup: "A+",
    appointmentDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split("T")[0],
    timeSlot: "02:00 PM - 02:30 PM",
    status: "CONFIRMED",
    hospitalName: "City General Hospital",
    notes: "Repeat voluntary donor; reliability score 98%.",
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __BLOODLINK_APPOINTMENTS_STORE: DonorAppointment[] | undefined;
}

function getAppointmentsStore(): DonorAppointment[] {
  if (!globalThis.__BLOODLINK_APPOINTMENTS_STORE) {
    globalThis.__BLOODLINK_APPOINTMENTS_STORE = [...INITIAL_APPOINTMENTS];
  }
  return globalThis.__BLOODLINK_APPOINTMENTS_STORE;
}

export async function GET() {
  const appointments = getAppointmentsStore();
  return NextResponse.json({ success: true, appointments });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      donorName,
      donorPhone,
      bloodGroup = "O+",
      appointmentDate,
      timeSlot = "10:00 AM",
      hospitalName = "City General Hospital",
      notes = "",
    } = body;

    if (!donorName || !donorPhone || !appointmentDate) {
      return NextResponse.json({ error: "Missing required appointment fields" }, { status: 400 });
    }

    const newApt: DonorAppointment = {
      id: `apt-${Date.now()}`,
      donorName,
      donorPhone,
      bloodGroup,
      appointmentDate,
      timeSlot,
      status: "CONFIRMED",
      hospitalName,
      notes,
    };

    const store = getAppointmentsStore();
    store.unshift(newApt);

    // Best-effort Supabase insert
    try {
      const adminClient = createAdminClient();
      await adminClient.from("donor_appointments").insert({
        id: newApt.id,
        appointment_date: appointmentDate,
        time_slot: timeSlot,
        blood_group: bloodGroup,
        status: "CONFIRMED",
      });
    } catch {
      // Local fallback active
    }

    return NextResponse.json({ success: true, appointment: newApt }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create appointment" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { appointmentId, status } = body;

    const store = getAppointmentsStore();
    const apt = store.find((a) => a.id === appointmentId);
    if (!apt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    apt.status = status;
    return NextResponse.json({ success: true, appointment: apt });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update appointment" }, { status: 500 });
  }
}

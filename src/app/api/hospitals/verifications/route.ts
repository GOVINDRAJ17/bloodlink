import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export interface DonorVerification {
  id: string;
  donorName: string;
  donorPhone: string;
  bloodGroup: string;
  documentType: "GOVT_ID" | "BLOOD_GROUP_CERT" | "MEDICAL_FITNESS" | "DONATION_RECORD";
  documentNumber: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  submittedDate: string;
  verifiedDate?: string;
  notes?: string;
}

const INITIAL_VERIFICATIONS: DonorVerification[] = [
  {
    id: "ver-101",
    donorName: "Anand R. Shinde",
    donorPhone: "+91 98210 55678",
    bloodGroup: "O-",
    documentType: "BLOOD_GROUP_CERT",
    documentNumber: "CERT-MH-2025-9921",
    status: "PENDING",
    submittedDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split("T")[0],
    notes: "Official laboratory serology report confirming universal donor status.",
  },
  {
    id: "ver-102",
    donorName: "Sunita D. Rao",
    donorPhone: "+91 98450 12345",
    bloodGroup: "A+",
    documentType: "MEDICAL_FITNESS",
    documentNumber: "FIT-HOSP-44312",
    status: "PENDING",
    submittedDate: new Date(Date.now() - 48 * 3600 * 1000).toISOString().split("T")[0],
    notes: "Pre-donation fitness certificate by licensed physician.",
  },
  {
    id: "ver-103",
    donorName: "Deepak Verma",
    donorPhone: "+91 98200 99887",
    bloodGroup: "B+",
    documentType: "GOVT_ID",
    documentNumber: "AADHAAR-XXXX-4421",
    status: "VERIFIED",
    submittedDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().split("T")[0],
    verifiedDate: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString().split("T")[0],
    notes: "Identity verified against national demographic register.",
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __BLOODLINK_VERIFICATIONS_STORE: DonorVerification[] | undefined;
}

function getVerificationsStore(): DonorVerification[] {
  if (!globalThis.__BLOODLINK_VERIFICATIONS_STORE) {
    globalThis.__BLOODLINK_VERIFICATIONS_STORE = [...INITIAL_VERIFICATIONS];
  }
  return globalThis.__BLOODLINK_VERIFICATIONS_STORE;
}

export async function GET() {
  const verifications = getVerificationsStore();
  return NextResponse.json({ success: true, verifications });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { verificationId, status, rejectionReason } = body;

    const store = getVerificationsStore();
    const ver = store.find((v) => v.id === verificationId);
    if (!ver) {
      return NextResponse.json({ error: "Verification record not found" }, { status: 404 });
    }

    ver.status = status;
    if (status === "VERIFIED") {
      ver.verifiedDate = new Date().toISOString().split("T")[0];
    } else if (status === "REJECTED") {
      ver.notes = rejectionReason || "Document verification rejected.";
    }

    return NextResponse.json({ success: true, verification: ver });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update verification" }, { status: 500 });
  }
}

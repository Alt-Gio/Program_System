import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// POST /api/dtc-logbook/log
//
// Public REST wrapper around api.dtcLogs.create. The /dtc-logbook
// page posts here so the service worker can intercept, queue
// offline, and replay via Background Sync. Deduplicated by the
// `clientId` carried in every request.
// ============================================================

type Payload = {
  clientId?: string;
  fullName?: string;
  agency?: string;
  purpose?: string;
  equipmentUsed?: string[];
  pcId?: string;
  photoDataUrl?: string;
  plannedDurationHours?: number;
  serviceType?: string;
  contactEmail?: string;
  contactPhone?: string;
  submittedOffline?: boolean;
  clientTimeIn?: string;
};

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const fullName = body.fullName?.trim();
  const agency = body.agency?.trim();
  const purpose = body.purpose?.trim();
  const serviceType = body.serviceType?.trim() || "SELF_SERVICE";
  const equipmentUsed = Array.isArray(body.equipmentUsed) ? body.equipmentUsed : [];
  const plannedDurationHours = Number(body.plannedDurationHours);

  if (!fullName || !agency || !purpose || equipmentUsed.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(plannedDurationHours) || plannedDurationHours <= 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid duration" },
      { status: 400 }
    );
  }
  if (body.clientId && body.clientId.length > 128) {
    return NextResponse.json(
      { ok: false, error: "Invalid clientId" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchMutation(api.dtcLogs.create, {
      clientId: body.clientId?.trim() || undefined,
      fullName,
      agency,
      purpose,
      equipmentUsed,
      pcId: body.pcId ? (body.pcId as Id<"dtcPcs">) : undefined,
      photoDataUrl: body.photoDataUrl || undefined,
      plannedDurationHours,
      serviceType,
      contactEmail: body.contactEmail?.trim() || undefined,
      contactPhone: body.contactPhone?.trim() || undefined,
      submittedOffline: body.submittedOffline === true,
      clientTimeIn: body.clientTimeIn || undefined,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err: any) {
    const msg = String(err?.message ?? "Failed to create log");
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

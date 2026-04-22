import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SESSION_COOKIE } from "@/lib/session";

// ============================================================
// Admin-gated upload/remove of the packaged CV Station .exe
//
// POST   /api/cv-station/upload  (multipart form, field "file")
// DELETE /api/cv-station/upload
//
// The admin builds the .exe on a Windows machine using cv-station/build.bat,
// then uploads the resulting binary through this endpoint so /dtc-admin
// can hand it out via /api/cv-station/download.
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXE_FILENAME = "DICT-FaceCheckin.exe";
const DOWNLOADS_DIR = path.join(process.cwd(), "downloads");
const EXE_PATH = path.join(DOWNLOADS_DIR, EXE_FILENAME);
// Refuse absurdly large payloads — 200MB is plenty for a packaged PyInstaller build.
const MAX_SIZE = 200 * 1024 * 1024;

async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — admin sign-in required" },
      { status: 401 }
    );
  }
  try {
    const user = await fetchQuery(api.auth.getCurrentUser, { token });
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Admin role required" },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired session" },
      { status: 401 }
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { ok: false, error: "Missing 'file' field" },
      { status: 400 }
    );
  }

  const name = (file as File).name ?? EXE_FILENAME;
  if (!/\.exe$/i.test(name)) {
    return NextResponse.json(
      { ok: false, error: "Only .exe uploads are accepted" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { ok: false, error: `File too large (max ${Math.round(MAX_SIZE / 1024 / 1024)} MB)` },
      { status: 413 }
    );
  }

  if (!existsSync(DOWNLOADS_DIR)) {
    await mkdir(DOWNLOADS_DIR, { recursive: true });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(EXE_PATH, buf);

  return NextResponse.json({
    ok: true,
    filename: EXE_FILENAME,
    sizeBytes: buf.length,
    sizeMB: Math.round((buf.length / (1024 * 1024)) * 10) / 10,
  });
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  if (!existsSync(EXE_PATH)) {
    return NextResponse.json({ ok: true, removed: false });
  }

  try {
    await unlink(EXE_PATH);
    return NextResponse.json({ ok: true, removed: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to remove build" },
      { status: 500 }
    );
  }
}

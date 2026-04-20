import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// ============================================================
// Admin-gated download of the packaged CV Station .exe
//
// GET /api/cv-station/download
// - Requires `auth_token` cookie (set when admin signs in)
// - Streams `downloads/DICT-FaceCheckin.exe` from project root
// - Returns a JSON explanation + 503 if the file hasn't been built
//
// The .exe is built by `cv-station/build.bat` (PyInstaller) and
// copied here. It is NOT checked into git.
//
// GET /api/cv-station/download?meta=1
// Returns { ok, available, sizeBytes, lastModified, version } so the
// admin UI can show availability + file size without downloading.
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXE_FILENAME = "DICT-FaceCheckin.exe";
const EXE_PATH = path.join(process.cwd(), "downloads", EXE_FILENAME);
const VERSION = "1.0.0";

function requireAdmin(req: NextRequest): NextResponse | null {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — admin sign-in required" },
      { status: 401 }
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const meta = req.nextUrl.searchParams.get("meta");

  // Metadata probe
  if (meta === "1") {
    if (!existsSync(EXE_PATH)) {
      return NextResponse.json({
        ok: false,
        available: false,
        version: VERSION,
        filename: EXE_FILENAME,
        hint: "Build it with cv-station/build.bat — outputs to ./downloads/",
      });
    }
    const s = await stat(EXE_PATH);
    return NextResponse.json({
      ok: true,
      available: true,
      version: VERSION,
      filename: EXE_FILENAME,
      sizeBytes: s.size,
      sizeMB: Math.round((s.size / (1024 * 1024)) * 10) / 10,
      lastModified: s.mtime.toISOString(),
    });
  }

  // Actual download
  if (!existsSync(EXE_PATH)) {
    return NextResponse.json(
      {
        ok: false,
        error: "CV Station build not found on server",
        hint: "Run cv-station/build.bat to produce downloads/DICT-FaceCheckin.exe",
      },
      { status: 503 }
    );
  }

  const buf = await readFile(EXE_PATH);
  // Cast to Uint8Array view to satisfy BodyInit typing
  const body = new Uint8Array(buf);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.microsoft.portable-executable",
      "Content-Disposition": `attachment; filename="${EXE_FILENAME}"`,
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
      "X-CV-Station-Version": VERSION,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";

// ============================================================
// GET /api/sheets-tabs?sheetId=xxx
// Returns list of tab names in a Google Sheet
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated. Please connect your Google account in Settings." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sheetId = searchParams.get("sheetId");

    if (!sheetId) {
      return NextResponse.json({ error: "sheetId parameter is required" }, { status: 400 });
    }

    // Set up Google Sheets client
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });

    // Get spreadsheet metadata to list all sheets/tabs
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    const tabs = response.data.sheets?.map((sheet) => sheet.properties?.title ?? "Untitled") ?? [];

    return NextResponse.json({ tabs });
  } catch (err: any) {
    console.error("[sheets-tabs]", err);
    const msg = err?.message ?? String(err);
    
    if (msg.includes("PERMISSION_DENIED") || msg.includes("403")) {
      return NextResponse.json(
        { error: "Permission denied. Make sure the sheet is shared with your Google account." },
        { status: 403 }
      );
    }
    
    if (msg.includes("404") || msg.includes("not found")) {
      return NextResponse.json(
        { error: "Spreadsheet not found. Check the URL and make sure you have access." },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: `Failed to fetch tabs: ${msg}` }, { status: 500 });
  }
}

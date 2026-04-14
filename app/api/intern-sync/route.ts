import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.INTERN_WEBHOOK_SECRET || 'UsGoSemX8JAtXdgzat05cInmZOYXbEv3';

/**
 * Webhook receiver for Google Apps Script
 * Receives DTR and activity data from Google Sheets
 * 
 * Expected payload formats:
 * 
 * DTR sync:
 * {
 *   type: "dtr",
 *   internId: "string (Sheets ID)",
 *   internName: "string",
 *   internEmail: "string (optional)",
 *   date: "YYYY-MM-DD",
 *   timeIn: "HH:MM" (optional),
 *   timeOut: "HH:MM" (optional),
 *   hours: number (optional),
 *   lateMin: number (optional),
 *   utMin: number (optional),
 *   remarks: "string (optional)",
 *   timestamp: number
 * }
 * 
 * Activity sync:
 * {
 *   type: "activity",
 *   internId: "string (Sheets ID)",
 *   internName: "string",
 *   internEmail: "string (optional)",
 *   date: "YYYY-MM-DD",
 *   task: "string",
 *   program: "string (optional)",
 *   hours: number (optional),
 *   output: "string (optional)",
 *   status: "string (optional)",
 *   rating: number (optional, 1-5),
 *   remarks: "string (optional)",
 *   timestamp: number
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret
    const secret = req.headers.get('X-Webhook-Secret');
    if (secret !== WEBHOOK_SECRET) {
      console.warn('⚠️ Unauthorized webhook attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, internId, internName, internEmail, timestamp } = body;

    console.log('📥 Received sync from Google Sheets:', { 
      type, 
      internId, 
      internName,
      timestamp: new Date(timestamp).toISOString() 
    });

    // Validate required fields
    if (!type || !internId || !internName) {
      return NextResponse.json(
        { error: 'Missing required fields: type, internId, internName' },
        { status: 400 }
      );
    }

    // Ensure mapping exists (will create if intern exists by email)
    const convexInternId = await fetchMutation(api.interns.getOrCreateMapping, {
      sheetsInternId: internId,
      email: internEmail || undefined,
      fullName: internName,
    });

    if (!convexInternId) {
      console.warn(`⚠️ No mapping found for intern: ${internName} (${internId})`);
      return NextResponse.json(
        { 
          error: 'Intern not found in system. Please register first.',
          internId,
          internName,
        },
        { status: 404 }
      );
    }

    if (type === 'dtr') {
      // DTR (Daily Time Record) sync
      const { date, timeIn, timeOut, hours, lateMin, utMin, remarks } = body;
      
      if (!date) {
        return NextResponse.json(
          { error: 'Missing required field: date' },
          { status: 400 }
        );
      }

      await fetchMutation(api.interns.syncAttendanceFromSheets, {
        sheetsInternId: internId,
        date,
        timeIn: timeIn || undefined,
        timeOut: timeOut || undefined,
        hours: hours || undefined,
        lateMinutes: lateMin || undefined,
        undertimeMinutes: utMin || undefined,
        remarks: remarks || undefined,
      });

      console.log(`✅ DTR synced for ${internName} on ${date}`);
      return NextResponse.json({ 
        success: true, 
        message: 'DTR synced successfully',
        internName,
        date,
      });
    }

    if (type === 'activity') {
      // Activity log sync
      const { date, task, program, hours: actHours, output, status, rating, remarks } = body;
      
      if (!date || !task) {
        return NextResponse.json(
          { error: 'Missing required fields: date, task' },
          { status: 400 }
        );
      }

      await fetchMutation(api.interns.syncActivityFromSheets, {
        sheetsInternId: internId,
        date,
        task,
        program: program || undefined,
        hours: actHours || undefined,
        output: output || undefined,
        status: status || undefined,
        rating: rating || undefined,
        remarks: remarks || undefined,
      });

      console.log(`✅ Activity synced for ${internName}: ${task}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Activity synced successfully',
        internName,
        task,
      });
    }

    return NextResponse.json(
      { error: `Unknown sync type: ${type}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Sync failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for webhook health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'intern-sync-webhook',
    timestamp: new Date().toISOString(),
  });
}

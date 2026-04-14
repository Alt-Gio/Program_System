import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';
import { Id } from '@/convex/_generated/dataModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/interns/[id]/attendance - Add attendance record */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    
    if (!body.date || !body.status) {
      return NextResponse.json(
        { error: 'Missing required fields: date, status' },
        { status: 400 }
      );
    }
    
    const attendanceId = await fetchMutation(api.interns.addAttendance, {
      internId: params.id as Id<'interns'>,
      date: body.date,
      timeIn: body.timeIn || undefined,
      timeOut: body.timeOut || undefined,
      status: body.status,
      notes: body.notes || undefined,
    });
    
    return NextResponse.json({ id: attendanceId, success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding attendance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add attendance' },
      { status: 500 }
    );
  }
}

/** DELETE /api/interns/[id]/attendance - Delete attendance record */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const recordId = searchParams.get('recordId');
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing recordId parameter' },
        { status: 400 }
      );
    }
    
    await fetchMutation(api.interns.deleteAttendance, {
      internId: params.id as Id<'interns'>,
      recordId: recordId as Id<'internAttendance'>,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting attendance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete attendance' },
      { status: 500 }
    );
  }
}

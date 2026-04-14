import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchQuery, fetchMutation } from 'convex/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/interns - List all interns */
export async function GET() {
  try {
    const interns = await fetchQuery(api.interns.list, {});
    return NextResponse.json(interns);
  } catch (error: any) {
    console.error('Error fetching interns:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch interns' },
      { status: 500 }
    );
  }
}

/** POST /api/interns - Create new intern */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.fullName || !body.school || !body.course || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: fullName, school, course, startDate, endDate' },
        { status: 400 }
      );
    }
    
    const internId = await fetchMutation(api.interns.create, {
      fullName: body.fullName,
      school: body.school,
      course: body.course,
      department: body.department || undefined,
      supervisor: body.supervisor || undefined,
      startDate: body.startDate,
      endDate: body.endDate,
      requiredHours: parseInt(body.requiredHours) || 486,
      email: body.email || undefined,
      phone: body.phone || undefined,
      photoUrl: body.photoUrl || undefined,
      notes: body.notes || undefined,
    });
    
    return NextResponse.json({ id: internId, success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating intern:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create intern' },
      { status: 500 }
    );
  }
}

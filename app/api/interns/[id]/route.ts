import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { Id } from '@/convex/_generated/dataModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/interns/[id] - Get single intern */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const intern = await fetchQuery(api.interns.getById, {
      internId: params.id as Id<'interns'>,
    });
    
    if (!intern) {
      return NextResponse.json({ error: 'Intern not found' }, { status: 404 });
    }
    
    return NextResponse.json(intern);
  } catch (error: any) {
    console.error('Error fetching intern:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch intern' },
      { status: 500 }
    );
  }
}

/** PATCH /api/interns/[id] - Update intern */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    
    await fetchMutation(api.interns.update, {
      internId: params.id as Id<'interns'>,
      fullName: body.fullName,
      school: body.school,
      course: body.course,
      department: body.department || undefined,
      supervisor: body.supervisor || undefined,
      startDate: body.startDate,
      endDate: body.endDate,
      requiredHours: body.requiredHours ? parseInt(body.requiredHours) : undefined,
      status: body.status,
      email: body.email || undefined,
      phone: body.phone || undefined,
      photoUrl: body.photoUrl || undefined,
      notes: body.notes || undefined,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating intern:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update intern' },
      { status: 500 }
    );
  }
}

/** DELETE /api/interns/[id] - Delete intern */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await fetchMutation(api.interns.remove, {
      internId: params.id as Id<'interns'>,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting intern:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete intern' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchQuery } from 'convex/nextjs';
import { Id } from '@/convex/_generated/dataModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/supervisor/intern/[id] - Get intern detail for supervisor view */
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
    
    // Transform to match supervisor page expectations
    const response = {
      id: intern.id,
      fullName: intern.fullName,
      school: intern.school,
      course: intern.course,
      department: intern.department,
      photoUrl: intern.photoUrl,
      totalHoursLogged: intern.totalHours,
      requiredHours: intern.requiredHours,
      status: intern.status,
      completedTasks: intern.completedTasks,
      account: intern.account,
      tasks: intern.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        difficulty: t.priority, // Map priority to difficulty for now
        xpReward: t.priority === 'URGENT' ? 100 : t.priority === 'HIGH' ? 50 : t.priority === 'MEDIUM' ? 25 : 10,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
      })),
      recentSessions: intern.recentSessions || [],
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching intern for supervisor:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch intern' },
      { status: 500 }
    );
  }
}

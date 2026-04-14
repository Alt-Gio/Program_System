import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';
import { Id } from '@/convex/_generated/dataModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/interns/[id]/tasks - Add task */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    
    if (!body.title) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 }
      );
    }
    
    const taskId = await fetchMutation(api.interns.addTask, {
      internId: params.id as Id<'interns'>,
      title: body.title,
      description: body.description || undefined,
      priority: body.priority || 'MEDIUM',
      dueDate: body.dueDate || undefined,
    });
    
    return NextResponse.json({ id: taskId, success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding task:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add task' },
      { status: 500 }
    );
  }
}

/** PATCH /api/interns/[id]/tasks - Update task status */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    
    if (!body.taskId || !body.status) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, status' },
        { status: 400 }
      );
    }
    
    await fetchMutation(api.interns.updateTaskStatus, {
      taskId: body.taskId as Id<'internTasks'>,
      status: body.status,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update task' },
      { status: 500 }
    );
  }
}

/** DELETE /api/interns/[id]/tasks - Delete task */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId parameter' },
        { status: 400 }
      );
    }
    
    await fetchMutation(api.interns.deleteTask, {
      taskId: taskId as Id<'internTasks'>,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete task' },
      { status: 500 }
    );
  }
}

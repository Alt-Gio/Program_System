import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';
import { Id } from '@/convex/_generated/dataModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/supervisor/award-xp - Award bonus XP to an intern */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.accountId || !body.xp || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId, xp, reason' },
        { status: 400 }
      );
    }
    
    const result = await fetchMutation(api.gamification.awardXp, {
      accountId: body.accountId as Id<'internAccounts'>,
      xp: parseInt(body.xp),
      reason: body.reason,
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error awarding XP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to award XP' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000'
  );
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('dict-session')?.value;

    if (!token) {
      return NextResponse.json(null);
    }

    const { payload } = await jwtVerify(token, getSecret());

    return NextResponse.json({
      user: {
        id: payload.id as string,
        username: payload.username as string,
        name: payload.name as string,
        role: payload.role as string,
      },
    });
  } catch (error) {
    return NextResponse.json(null);
  }
}

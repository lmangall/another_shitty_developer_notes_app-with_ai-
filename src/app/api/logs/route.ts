import { NextRequest, NextResponse } from 'next/server';
import { db, emailLogs } from '@/db';
import { eq, desc, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  const whereClause = eq(emailLogs.userId, session.user.id);

  const [logs, countResult] = await Promise.all([
    db
      .select()
      .from(emailLogs)
      .where(whereClause)
      .orderBy(desc(emailLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(emailLogs)
      .where(whereClause),
  ]);

  return NextResponse.json({
    logs,
    total: Number(countResult[0].count),
    page,
    limit,
    totalPages: Math.ceil(Number(countResult[0].count) / limit),
  });
}

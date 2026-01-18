import { NextRequest, NextResponse } from 'next/server';
import { db, reminders } from '@/db';
import { eq, desc, and, sql, gte } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

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
  const status = searchParams.get('status');
  const upcoming = searchParams.get('upcoming') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  let whereClause = eq(reminders.userId, session.user.id);

  if (status) {
    whereClause = and(whereClause, eq(reminders.status, status))!;
  }

  if (upcoming) {
    whereClause = and(
      whereClause,
      eq(reminders.status, 'pending'),
      gte(reminders.remindAt, new Date())
    )!;
  }

  const [userReminders, countResult] = await Promise.all([
    db
      .select()
      .from(reminders)
      .where(whereClause)
      .orderBy(desc(reminders.remindAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(reminders)
      .where(whereClause),
  ]);

  return NextResponse.json({
    reminders: userReminders,
    total: Number(countResult[0].count),
    page,
    limit,
    totalPages: Math.ceil(Number(countResult[0].count) / limit),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { message, remindAt } = body;

  if (!message) {
    return NextResponse.json(
      { error: 'Message is required' },
      { status: 400 }
    );
  }

  const [reminder] = await db
    .insert(reminders)
    .values({
      userId,
      message,
      remindAt: remindAt ? new Date(remindAt) : null,
      status: 'pending',
    })
    .returning();

  logger.info('Reminder created', { userId, reminderId: reminder.id });

  return NextResponse.json(reminder, { status: 201 });
}

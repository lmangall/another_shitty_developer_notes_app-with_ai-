import { NextRequest, NextResponse } from 'next/server';
import { db, reminders } from '@/db';
import { eq, desc, asc, and, sql, gte } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';
import { NOTIFY_VIA_OPTIONS, type NotifyVia, type ReminderSortOption } from '@/lib/constants';

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
  const notifyVia = searchParams.get('notifyVia');
  const upcoming = searchParams.get('upcoming') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;
  const sortBy = (searchParams.get('sortBy') || 'remindAt') as ReminderSortOption;
  const sortOrder = searchParams.get('sortOrder') || 'asc';

  let whereClause = eq(reminders.userId, session.user.id);

  if (status) {
    whereClause = and(whereClause, eq(reminders.status, status))!;
  }

  if (notifyVia) {
    whereClause = and(whereClause, eq(reminders.notifyVia, notifyVia as NotifyVia))!;
  }

  if (upcoming) {
    whereClause = and(
      whereClause,
      eq(reminders.status, 'pending'),
      gte(reminders.remindAt, new Date())
    )!;
  }

  // Build order by clause
  const sortColumn = {
    remindAt: reminders.remindAt,
    createdAt: reminders.createdAt,
    status: reminders.status,
    message: reminders.message,
  }[sortBy] || reminders.remindAt;

  const orderFn = sortOrder === 'desc' ? desc : asc;

  const [userReminders, countResult] = await Promise.all([
    db
      .select()
      .from(reminders)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
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
  const { message, remindAt, notifyVia } = body;

  if (!message) {
    return NextResponse.json(
      { error: 'Message is required' },
      { status: 400 }
    );
  }

  // Validate notifyVia if provided
  const validNotifyVia = NOTIFY_VIA_OPTIONS.map((o) => o.value);
  const finalNotifyVia: NotifyVia =
    notifyVia && validNotifyVia.includes(notifyVia) ? notifyVia : 'email';

  const [reminder] = await db
    .insert(reminders)
    .values({
      userId,
      message,
      remindAt: remindAt ? new Date(remindAt) : null,
      notifyVia: finalNotifyVia,
      status: 'pending',
    })
    .returning();

  logger.info('Reminder created', { userId, reminderId: reminder.id, notifyVia: finalNotifyVia });

  return NextResponse.json(reminder, { status: 201 });
}

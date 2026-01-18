import { NextResponse } from 'next/server';
import { db, notes, reminders, emailLogs } from '@/db';
import { eq, desc, sql, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const [
      notesCount,
      pendingRemindersCount,
      totalRemindersCount,
      logsCount,
      failedLogsCount,
      recentNotes,
      upcomingReminders,
      recentLogs,
    ] = await Promise.all([
      // Total notes count
      db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(eq(notes.userId, userId)),

      // Pending reminders count
      db
        .select({ count: sql<number>`count(*)` })
        .from(reminders)
        .where(and(eq(reminders.userId, userId), eq(reminders.status, 'pending'))),

      // Total reminders count
      db
        .select({ count: sql<number>`count(*)` })
        .from(reminders)
        .where(eq(reminders.userId, userId)),

      // Total email logs count
      db
        .select({ count: sql<number>`count(*)` })
        .from(emailLogs)
        .where(eq(emailLogs.userId, userId)),

      // Failed email logs count
      db
        .select({ count: sql<number>`count(*)` })
        .from(emailLogs)
        .where(and(eq(emailLogs.userId, userId), eq(emailLogs.status, 'failed'))),

      // Recent notes (last 5)
      db
        .select({
          id: notes.id,
          title: notes.title,
          content: notes.content,
          updatedAt: notes.updatedAt,
        })
        .from(notes)
        .where(eq(notes.userId, userId))
        .orderBy(desc(notes.updatedAt))
        .limit(5),

      // Upcoming/pending reminders (next 5)
      db
        .select({
          id: reminders.id,
          message: reminders.message,
          remindAt: reminders.remindAt,
          status: reminders.status,
        })
        .from(reminders)
        .where(and(eq(reminders.userId, userId), eq(reminders.status, 'pending')))
        .orderBy(desc(reminders.remindAt))
        .limit(5),

      // Recent email logs (last 5)
      db
        .select({
          id: emailLogs.id,
          fromEmail: emailLogs.fromEmail,
          subject: emailLogs.subject,
          actionType: emailLogs.actionType,
          status: emailLogs.status,
          createdAt: emailLogs.createdAt,
        })
        .from(emailLogs)
        .where(eq(emailLogs.userId, userId))
        .orderBy(desc(emailLogs.createdAt))
        .limit(5),
    ]);

    logger.debug('Dashboard data fetched', { userId });

    return NextResponse.json({
      stats: {
        totalNotes: Number(notesCount[0].count),
        pendingReminders: Number(pendingRemindersCount[0].count),
        totalReminders: Number(totalRemindersCount[0].count),
        totalLogs: Number(logsCount[0].count),
        failedLogs: Number(failedLogsCount[0].count),
      },
      recentNotes,
      upcomingReminders,
      recentLogs,
    });
  } catch (error) {
    logger.error('Failed to fetch dashboard data', error as Error, { userId });
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}

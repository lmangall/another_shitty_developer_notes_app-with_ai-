'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { notes, reminders, emailLogs } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { ActionResult, success, error } from './types';

// ============ Types ============

export interface DashboardStats {
  totalNotes: number;
  pendingReminders: number;
  totalReminders: number;
  totalLogs: number;
  failedLogs: number;
}

export interface RecentNote {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
}

export interface UpcomingReminder {
  id: string;
  message: string;
  remindAt: Date | null;
  status: string;
}

export interface RecentLog {
  id: string;
  fromEmail: string;
  subject: string | null;
  actionType: string | null;
  status: string;
  createdAt: Date;
}

export interface DashboardData {
  stats: DashboardStats;
  recentNotes: RecentNote[];
  upcomingReminders: UpcomingReminder[];
  recentLogs: RecentLog[];
}

// ============ Helper ============

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

// ============ Actions ============

export async function getDashboardData(): Promise<ActionResult<DashboardData>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
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

    return success({
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
  } catch (err) {
    logger.error('Failed to fetch dashboard data', err as Error, { userId });
    return error('Failed to fetch dashboard data', 'INTERNAL');
  }
}

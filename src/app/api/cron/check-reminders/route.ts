import { NextRequest, NextResponse } from 'next/server';
import { db, reminders, users } from '@/db';
import { eq, and, lte } from 'drizzle-orm';
import { sendReminderEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Cron unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('Cron job started: check-reminders');

  try {
    // Find all pending reminders that are due
    const dueReminders = await db
      .select({
        reminder: reminders,
        user: users,
      })
      .from(reminders)
      .innerJoin(users, eq(reminders.userId, users.id))
      .where(
        and(
          eq(reminders.status, 'pending'),
          lte(reminders.remindAt, new Date())
        )
      );

    logger.info('Due reminders found', { count: dueReminders.length });

    const results = [];
    let sent = 0;
    let failed = 0;

    for (const { reminder, user } of dueReminders) {
      try {
        // Send reminder email
        await sendReminderEmail(user.email, reminder.message);

        // Update reminder status
        await db
          .update(reminders)
          .set({ status: 'sent', updatedAt: new Date() })
          .where(eq(reminders.id, reminder.id));

        results.push({ id: reminder.id, status: 'sent' });
        sent++;
      } catch (error) {
        logger.error('Failed to send reminder', error, { reminderId: reminder.id, userId: reminder.userId });
        results.push({
          id: reminder.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    logger.info('Cron job completed: check-reminders', { processed: dueReminders.length, sent, failed });

    return NextResponse.json({
      processed: dueReminders.length,
      results,
    });
  } catch (error) {
    logger.error('Cron job failed: check-reminders', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

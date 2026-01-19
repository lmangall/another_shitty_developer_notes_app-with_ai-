import { NextRequest, NextResponse } from 'next/server';
import { db, reminders, users } from '@/db';
import { eq, and, lte } from 'drizzle-orm';
import { sendReminderEmail } from '@/lib/email';
import { sendPushNotification } from '@/lib/push';
import { logger } from '@/lib/logger';
import { calculateNextOccurrence } from '@/lib/reminder-utils';

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
        const notifyVia = reminder.notifyVia || 'email';
        const shouldEmail = notifyVia === 'email' || notifyVia === 'both';
        const shouldPush = notifyVia === 'push' || notifyVia === 'both';

        // Build notification promises based on notifyVia setting
        const notifications: Promise<unknown>[] = [];
        if (shouldEmail) {
          notifications.push(sendReminderEmail(user.email, reminder.message));
        }
        if (shouldPush) {
          notifications.push(
            sendPushNotification(reminder.userId, {
              title: '⏰ Reminder',
              body: reminder.message,
              icon: '/icon-192x192.png',
              url: '/reminders',
              tag: `reminder-${reminder.id}`,
            })
          );
        }

        const notificationResults = await Promise.allSettled(notifications);

        // Determine success based on notification type
        let emailSent = false;
        let pushSent = false;
        let resultIndex = 0;

        if (shouldEmail) {
          emailSent = notificationResults[resultIndex]?.status === 'fulfilled';
          if (!emailSent) {
            logger.warn('Email failed for reminder', {
              reminderId: reminder.id,
              error: (notificationResults[resultIndex] as PromiseRejectedResult).reason,
            });
          }
          resultIndex++;
        }

        if (shouldPush) {
          const pushResult = notificationResults[resultIndex];
          pushSent =
            pushResult?.status === 'fulfilled' &&
            (pushResult.value as { success: boolean }).success;
          if (pushSent) {
            logger.info('Push notification sent for reminder', { reminderId: reminder.id });
          }
        }

        // Determine if reminder should be marked as sent
        // For 'email': email must succeed
        // For 'push': push must succeed (or no subscriptions is acceptable)
        // For 'both': at least one must succeed
        const success =
          (notifyVia === 'email' && emailSent) ||
          (notifyVia === 'push' && (pushSent || !shouldPush)) ||
          (notifyVia === 'both' && (emailSent || pushSent));

        if (success) {
          await db
            .update(reminders)
            .set({ status: 'sent', updatedAt: new Date() })
            .where(eq(reminders.id, reminder.id));

          // Create next occurrence for recurring reminders
          if (reminder.recurrence && reminder.remindAt) {
            const nextDate = calculateNextOccurrence(reminder.remindAt, reminder.recurrence);
            // Only create if within recurrence end date (or no end date set)
            if (!reminder.recurrenceEndDate || nextDate <= reminder.recurrenceEndDate) {
              await db.insert(reminders).values({
                userId: reminder.userId,
                message: reminder.message,
                remindAt: nextDate,
                notifyVia: reminder.notifyVia,
                recurrence: reminder.recurrence,
                recurrenceEndDate: reminder.recurrenceEndDate,
                status: 'pending',
              });
              logger.info('Created next recurring reminder', {
                originalReminderId: reminder.id,
                nextDate: nextDate.toISOString(),
                recurrence: reminder.recurrence,
              });
            }
          }

          results.push({
            id: reminder.id,
            status: 'sent',
            notifyVia,
            email: shouldEmail ? emailSent : undefined,
            push: shouldPush ? pushSent : undefined,
          });
          sent++;
        } else {
          throw new Error(`Notification delivery failed (notifyVia: ${notifyVia})`);
        }
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

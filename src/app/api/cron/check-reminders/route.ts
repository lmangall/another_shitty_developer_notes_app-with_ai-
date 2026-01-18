import { NextRequest, NextResponse } from 'next/server';
import { db, reminders, users } from '@/db';
import { eq, and, lte } from 'drizzle-orm';
import { sendReminderEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    const results = [];

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
      } catch (error) {
        console.error(`Failed to send reminder ${reminder.id}:`, error);
        results.push({
          id: reminder.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      processed: dueReminders.length,
      results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

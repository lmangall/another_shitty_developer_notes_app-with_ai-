import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { userIntegrations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger, createLogger } from '@/lib/logger';

// DELETE - Disconnect Google Calendar
export async function DELETE() {
  const log = createLogger({ requestId: crypto.randomUUID() });

  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log.info('Disconnecting Google Calendar', { userId: session.user.id });

    // Mark as revoked instead of deleting (keeps history)
    const result = await db
      .update(userIntegrations)
      .set({
        status: 'revoked',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userIntegrations.userId, session.user.id),
          eq(userIntegrations.provider, 'google-calendar')
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    log.info('Google Calendar disconnected', {
      userId: session.user.id,
      integrationId: result[0].id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to disconnect Google Calendar', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}

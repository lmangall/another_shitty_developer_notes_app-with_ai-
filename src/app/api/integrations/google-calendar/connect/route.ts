import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { initiateGoogleCalendarConnection } from '@/lib/composio';
import { createLogger } from '@/lib/logger';
import { db } from '@/db';
import { userIntegrations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST() {
  const log = createLogger({ requestId: crypto.randomUUID() });

  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log.info('Initiating Google Calendar connection', { userId: session.user.id });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = `${appUrl}/api/integrations/google-calendar/callback`;

    const connection = await initiateGoogleCalendarConnection(session.user.id, redirectUrl);

    // Store pending integration with connectionId so callback can look up userId
    const existing = await db
      .select()
      .from(userIntegrations)
      .where(
        and(
          eq(userIntegrations.userId, session.user.id),
          eq(userIntegrations.provider, 'google-calendar')
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing with new connectionId
      await db
        .update(userIntegrations)
        .set({
          connectedAccountId: connection.connectionId,
          status: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(userIntegrations.id, existing[0].id));
    } else {
      // Create pending integration
      await db.insert(userIntegrations).values({
        userId: session.user.id,
        provider: 'google-calendar',
        connectedAccountId: connection.connectionId,
        status: 'pending',
      });
    }

    log.info('Google Calendar connection initiated and pending record saved', {
      userId: session.user.id,
      connectionId: connection.connectionId,
    });

    return NextResponse.json({
      redirectUrl: connection.redirectUrl,
      connectionId: connection.connectionId,
    });
  } catch (error) {
    log.error('Failed to initiate Google Calendar connection', error);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}

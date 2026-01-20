import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { userIntegrations } from '@/db/schema';
import { getConnectionStatus } from '@/lib/composio';
import { logger, createLogger } from '@/lib/logger';
import { eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
  const log = createLogger({ requestId: crypto.randomUUID() });

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const url = new URL(request.url);
    const connectionId = url.searchParams.get('connected_account_id');

    if (!session?.user) {
      log.warn('Unauthorized callback attempt');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!connectionId) {
      log.warn('Callback missing connection ID', { userId: session.user.id });
      return NextResponse.redirect(
        new URL('/integrations?error=missing_connection_id', request.url)
      );
    }

    log.info('Processing Google Calendar callback', {
      userId: session.user.id,
      connectionId,
    });

    // Verify connection status with Composio
    const status = await getConnectionStatus(connectionId);

    if (status.status !== 'ACTIVE') {
      log.warn('Connection not active', {
        userId: session.user.id,
        connectionId,
        status: status.status,
      });
      return NextResponse.redirect(
        new URL(`/integrations?error=connection_${status.status.toLowerCase()}`, request.url)
      );
    }

    // Check if integration already exists
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
      // Update existing
      await db
        .update(userIntegrations)
        .set({
          connectedAccountId: connectionId,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(userIntegrations.id, existing[0].id));

      log.info('Updated existing Google Calendar integration', {
        userId: session.user.id,
        integrationId: existing[0].id,
      });
    } else {
      // Create new
      await db.insert(userIntegrations).values({
        userId: session.user.id,
        provider: 'google-calendar',
        connectedAccountId: connectionId,
        status: 'active',
      });

      log.info('Created new Google Calendar integration', {
        userId: session.user.id,
        connectionId,
      });
    }

    // Redirect back to integrations page with success
    return NextResponse.redirect(new URL('/integrations?success=connected', request.url));
  } catch (error) {
    log.error('Failed to process Google Calendar callback', error);
    return NextResponse.redirect(
      new URL('/integrations?error=callback_failed', request.url)
    );
  }
}

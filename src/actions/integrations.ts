'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { userIntegrations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { initiateGoogleCalendarConnection } from '@/lib/composio';
import { ActionResult, success, error } from './types';

// Types
export interface Integration {
  id: string;
  provider: string;
  status: string;
  connectedAt: Date;
}

// Get all integrations for user
export async function getIntegrations(): Promise<ActionResult<Integration[]>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  try {
    const integrations = await db
      .select({
        id: userIntegrations.id,
        provider: userIntegrations.provider,
        status: userIntegrations.status,
        connectedAt: userIntegrations.createdAt,
      })
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, session.user.id));

    logger.debug('Fetched user integrations', {
      userId: session.user.id,
      count: integrations.length,
    });

    return success(integrations);
  } catch (err) {
    logger.error('Failed to fetch integrations', err as Error);
    return error('Failed to fetch integrations', 'INTERNAL');
  }
}

// Initiate Google Calendar connection (returns redirect URL for client to navigate to)
export async function connectGoogleCalendar(): Promise<ActionResult<{ redirectUrl: string; connectionId: string }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  try {
    logger.info('Initiating Google Calendar connection', { userId: session.user.id });

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

    logger.info('Google Calendar connection initiated and pending record saved', {
      userId: session.user.id,
      connectionId: connection.connectionId,
    });

    if (!connection.redirectUrl) {
      return error('Failed to get redirect URL', 'INTERNAL');
    }

    return success({
      redirectUrl: connection.redirectUrl,
      connectionId: connection.connectionId,
    });
  } catch (err) {
    logger.error('Failed to initiate Google Calendar connection', err as Error);
    return error('Failed to initiate connection', 'INTERNAL');
  }
}

// Disconnect Google Calendar
export async function disconnectGoogleCalendar(): Promise<ActionResult<void>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  try {
    logger.info('Disconnecting Google Calendar', { userId: session.user.id });

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
      return error('Integration not found', 'NOT_FOUND');
    }

    logger.info('Google Calendar disconnected', {
      userId: session.user.id,
      integrationId: result[0].id,
    });

    return success(undefined);
  } catch (err) {
    logger.error('Failed to disconnect Google Calendar', err as Error);
    return error('Failed to disconnect', 'INTERNAL');
  }
}

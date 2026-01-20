import { NextResponse } from 'next/server';
import { db } from '@/db';
import { userIntegrations } from '@/db/schema';
import { getConnectionDetails, waitForConnection } from '@/lib/composio';
import { createLogger } from '@/lib/logger';
import { eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
  const log = createLogger({ requestId: crypto.randomUUID() });

  try {
    const url = new URL(request.url);
    const connectionId = url.searchParams.get('connected_account_id');
    const status = url.searchParams.get('status');

    if (!connectionId) {
      log.warn('Callback missing connection ID');
      return NextResponse.redirect(
        new URL('/integrations?error=missing_connection_id', request.url)
      );
    }

    // Check for OAuth failure
    if (status === 'failed' || status === 'error') {
      log.warn('OAuth failed', { connectionId, status });
      return NextResponse.redirect(
        new URL('/integrations?error=oauth_failed', request.url)
      );
    }

    log.info('Processing Google Calendar callback', { connectionId });

    // Get connection details from Composio (includes userId/entityId)
    let connectionDetails = await getConnectionDetails(connectionId);

    // If not already active, wait for connection to complete
    if (connectionDetails.status !== 'ACTIVE') {
      log.info('Connection not yet active, waiting...', {
        connectionId,
        currentStatus: connectionDetails.status,
      });

      try {
        await waitForConnection(connectionId, 30000);
        // Refresh connection details after waiting
        connectionDetails = await getConnectionDetails(connectionId);
      } catch {
        // Check final status after timeout
        connectionDetails = await getConnectionDetails(connectionId);
        if (connectionDetails.status !== 'ACTIVE') {
          log.warn('Connection failed to become active', {
            connectionId,
            finalStatus: connectionDetails.status,
          });
          return NextResponse.redirect(
            new URL('/integrations?error=connection_timeout', request.url)
          );
        }
      }
    }

    // Get userId from Composio connection (entityId is our app's userId)
    const userId = connectionDetails.userId;

    if (!userId) {
      log.error('No userId found in connection', { connectionId, connectionDetails });
      return NextResponse.redirect(
        new URL('/integrations?error=missing_user_id', request.url)
      );
    }

    log.info('Connection active, saving to database', {
      connectionId,
      userId,
    });

    // Check if integration already exists
    const existing = await db
      .select()
      .from(userIntegrations)
      .where(
        and(
          eq(userIntegrations.userId, userId),
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
        userId,
        integrationId: existing[0].id,
      });
    } else {
      // Create new
      await db.insert(userIntegrations).values({
        userId,
        provider: 'google-calendar',
        connectedAccountId: connectionId,
        status: 'active',
      });

      log.info('Created new Google Calendar integration', {
        userId,
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

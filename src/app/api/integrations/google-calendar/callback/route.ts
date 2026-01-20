import { NextResponse } from 'next/server';
import { db } from '@/db';
import { userIntegrations } from '@/db/schema';
import { getConnectionDetails, waitForConnection } from '@/lib/composio';
import { createLogger } from '@/lib/logger';
import { eq } from 'drizzle-orm';

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

    // Look up pending integration by connectionId to get userId
    const pendingIntegration = await db
      .select()
      .from(userIntegrations)
      .where(eq(userIntegrations.connectedAccountId, connectionId))
      .limit(1);

    if (pendingIntegration.length === 0) {
      log.error('No pending integration found for connectionId', { connectionId });
      return NextResponse.redirect(
        new URL('/integrations?error=missing_pending_integration', request.url)
      );
    }

    const userId = pendingIntegration[0].userId;
    log.info('Found pending integration', { connectionId, userId });

    // Get connection details from Composio
    let connectionDetails = await getConnectionDetails(connectionId);

    // If not already active, wait for connection to complete
    if (connectionDetails.status !== 'ACTIVE') {
      log.info('Connection not yet active, waiting...', {
        connectionId,
        currentStatus: connectionDetails.status,
      });

      try {
        await waitForConnection(connectionId, 30000);
        connectionDetails = await getConnectionDetails(connectionId);
      } catch {
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

    // Update the integration to active
    await db
      .update(userIntegrations)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(userIntegrations.id, pendingIntegration[0].id));

    log.info('Google Calendar integration activated', {
      userId,
      integrationId: pendingIntegration[0].id,
      connectionId,
    });

    // Redirect back to integrations page with success
    return NextResponse.redirect(new URL('/integrations?success=connected', request.url));
  } catch (error) {
    log.error('Failed to process Google Calendar callback', error);
    return NextResponse.redirect(
      new URL('/integrations?error=callback_failed', request.url)
    );
  }
}

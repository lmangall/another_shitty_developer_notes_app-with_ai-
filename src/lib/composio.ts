import { Composio } from '@composio/core';
import { VercelProvider } from '@composio/vercel';
import { logger } from './logger';

// Initialize Composio client with Vercel AI SDK provider
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new VercelProvider(),
});

// Google Calendar action names (from https://docs.composio.dev/toolkits/googlecalendar)
export const GOOGLE_CALENDAR_ACTIONS = {
  CREATE_EVENT: 'GOOGLECALENDAR_CREATE_EVENT',
  LIST_EVENTS: 'GOOGLECALENDAR_EVENTS_LIST',
  UPDATE_EVENT: 'GOOGLECALENDAR_UPDATE_EVENT',
  DELETE_EVENT: 'GOOGLECALENDAR_DELETE_EVENT',
  GET_EVENT: 'GOOGLECALENDAR_EVENTS_GET',
  FIND_EVENT: 'GOOGLECALENDAR_FIND_EVENT',
} as const;

export type GoogleCalendarAction = (typeof GOOGLE_CALENDAR_ACTIONS)[keyof typeof GOOGLE_CALENDAR_ACTIONS];

/**
 * List available auth configs for a toolkit
 *
 * @param toolkit - Optional toolkit slug to filter configs
 * @returns List of available auth configs
 */
export async function listAuthConfigs(toolkit?: string) {
  return composio.authConfigs.list({
    ...(toolkit && { toolkit }),
  });
}

/**
 * Get Google Calendar tools for a connected user
 * @param entityId - The user's ID (entityId used when creating the connection)
 */
export async function getGoogleCalendarTools(entityId: string) {
  try {
    // Get all Google Calendar tools for this user using ToolListParams
    const tools = await composio.tools.get(
      entityId,
      {
        tools: Object.values(GOOGLE_CALENDAR_ACTIONS) as string[],
      }
    );

    logger.info('Retrieved Google Calendar tools', {
      entityId,
      toolCount: Object.keys(tools).length
    });

    return tools;
  } catch (error) {
    logger.error('Failed to get Google Calendar tools', error, { entityId });
    throw error;
  }
}

/**
 * Initiate OAuth connection for Google Calendar
 */
export async function initiateGoogleCalendarConnection(
  userId: string,
  callbackUrl: string
) {
  try {
    // First get the auth config ID for Google Calendar
    const configs = await composio.authConfigs.list({ toolkit: 'googlecalendar' });

    if (!configs.items?.length) {
      throw new Error('No auth config found for Google Calendar');
    }

    const authConfigId = configs.items[0].id;

    logger.info('Found Google Calendar auth config', {
      userId,
      authConfigId,
    });

    const connectionRequest = await composio.connectedAccounts.link(
      userId,
      authConfigId,
      { callbackUrl }
    );

    logger.info('Initiated Google Calendar connection', {
      userId,
      redirectUrl: connectionRequest.redirectUrl
    });

    return {
      redirectUrl: connectionRequest.redirectUrl,
      connectionId: connectionRequest.id,
    };
  } catch (error) {
    logger.error('Failed to initiate Google Calendar connection', error, { userId });
    throw error;
  }
}

/**
 * Get connection details including the userId (entityId)
 */
export async function getConnectionDetails(connectionId: string) {
  try {
    const account = await composio.connectedAccounts.get(connectionId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountAny = account as any;

    // Debug: log full account structure to find userId field
    logger.info('Composio account raw data', {
      connectionId,
      accountKeys: Object.keys(account),
      entityId: accountAny.entityId,
      memberId: accountAny.member?.id,
      memberEntityId: accountAny.member?.entityId,
      userId: accountAny.userId,
      status: account.status,
    });

    const userId = accountAny.entityId || accountAny.member?.id || accountAny.member?.entityId || accountAny.userId || null;

    return {
      status: account.status,
      toolkitSlug: account.toolkit?.slug,
      createdAt: account.createdAt,
      userId,
    };
  } catch (error) {
    logger.error('Failed to get connection details', error, { connectionId });
    throw error;
  }
}

/**
 * Wait for a connection to complete (become ACTIVE)
 *
 * @param connectedAccountId - The ID of the connected account
 * @param timeout - Maximum time to wait in milliseconds (default: 30000)
 */
export async function waitForConnection(connectedAccountId: string, timeout = 30000) {
  try {
    const account = await composio.connectedAccounts.waitForConnection(connectedAccountId, timeout);

    logger.info('Connection completed', {
      connectedAccountId,
      status: account.status,
      toolkit: account.toolkit?.slug,
    });

    return account;
  } catch (error) {
    logger.error('Failed to wait for connection', error, { connectedAccountId });
    throw error;
  }
}

/**
 * List all connected accounts for a user
 */
export async function listUserConnections(userId: string) {
  try {
    const connections = await composio.connectedAccounts.list({
      userIds: [userId],
    });

    logger.info('Listed user connections', {
      userId,
      count: connections.items?.length || 0
    });

    return connections.items || [];
  } catch (error) {
    logger.error('Failed to list user connections', error, { userId });
    throw error;
  }
}

/**
 * Get active Google Calendar connection for a user
 */
export async function getActiveGoogleCalendarConnection(userId: string) {
  try {
    const connections = await composio.connectedAccounts.list({
      userIds: [userId],
      toolkitSlugs: ['googlecalendar'],
      statuses: ['ACTIVE'],
    });

    const activeConnection = connections.items?.[0];

    if (activeConnection) {
      logger.info('Found active Google Calendar connection', {
        userId,
        connectionId: activeConnection.id
      });
    }

    return activeConnection || null;
  } catch (error) {
    logger.error('Failed to get active Google Calendar connection', error, { userId });
    throw error;
  }
}

/**
 * Check if user has connected Google Calendar
 */
export async function hasGoogleCalendarConnection(userId: string): Promise<boolean> {
  const connection = await getActiveGoogleCalendarConnection(userId);
  return connection !== null;
}

export { composio };

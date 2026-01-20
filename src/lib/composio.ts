import { Composio } from '@composio/core';
import { VercelProvider } from '@composio/vercel';
import { logger } from './logger';

// Initialize Composio client with Vercel AI SDK provider
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
});

const vercelProvider = new VercelProvider();

// Google Calendar action names
export const GOOGLE_CALENDAR_ACTIONS = {
  CREATE_EVENT: 'GOOGLECALENDAR_CREATE_EVENT',
  LIST_EVENTS: 'GOOGLECALENDAR_LIST_EVENTS',
  UPDATE_EVENT: 'GOOGLECALENDAR_UPDATE_EVENT',
  DELETE_EVENT: 'GOOGLECALENDAR_DELETE_EVENT',
  GET_EVENT: 'GOOGLECALENDAR_GET_EVENT',
} as const;

export type GoogleCalendarAction = (typeof GOOGLE_CALENDAR_ACTIONS)[keyof typeof GOOGLE_CALENDAR_ACTIONS];

/**
 * Get Google Calendar tools for a connected user
 */
export async function getGoogleCalendarTools(connectedAccountId: string) {
  try {
    const tools = await composio.tools.get({
      actions: Object.values(GOOGLE_CALENDAR_ACTIONS),
      connectedAccountId,
    });

    logger.info('Retrieved Google Calendar tools', {
      connectedAccountId,
      toolCount: tools.length
    });

    return tools;
  } catch (error) {
    logger.error('Failed to get Google Calendar tools', error, { connectedAccountId });
    throw error;
  }
}

/**
 * Initiate OAuth connection for Google Calendar
 */
export async function initiateGoogleCalendarConnection(
  userId: string,
  redirectUrl: string
) {
  try {
    const connectionRequest = await composio.connectedAccounts.initiate({
      integrationId: 'google-calendar',
      redirectUrl,
      entityId: userId,
    });

    logger.info('Initiated Google Calendar connection', {
      userId,
      redirectUrl: connectionRequest.redirectUrl
    });

    return {
      redirectUrl: connectionRequest.redirectUrl,
      connectionId: connectionRequest.connectedAccountId,
    };
  } catch (error) {
    logger.error('Failed to initiate Google Calendar connection', error, { userId });
    throw error;
  }
}

/**
 * Get connection status for a user
 */
export async function getConnectionStatus(connectionId: string) {
  try {
    const account = await composio.connectedAccounts.get({
      connectedAccountId: connectionId
    });

    return {
      status: account.status,
      integrationId: account.integrationId,
      createdAt: account.createdAt,
    };
  } catch (error) {
    logger.error('Failed to get connection status', error, { connectionId });
    throw error;
  }
}

/**
 * List all connected accounts for a user
 */
export async function listUserConnections(userId: string) {
  try {
    const connections = await composio.connectedAccounts.list({
      entityIds: [userId],
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
      entityIds: [userId],
      integrationIds: ['google-calendar'],
      status: 'ACTIVE',
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

export { composio, vercelProvider };

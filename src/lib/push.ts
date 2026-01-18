import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// VAPID keys - generate these once and store in env vars
// You can generate using: npx web-push generate-vapid-keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();

let vapidConfigured = false;

// Only configure VAPID if keys are present and look valid (non-empty, no padding)
if (vapidPublicKey && vapidPrivateKey && vapidPublicKey.length > 10 && !vapidPublicKey.includes('=')) {
  try {
    webpush.setVapidDetails(
      'mailto:' + (process.env.VAPID_EMAIL || 'noreply@example.com'),
      vapidPublicKey,
      vapidPrivateKey
    );
    vapidConfigured = true;
  } catch {
    // VAPID configuration failed - push notifications will be disabled
  }
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

export async function sendPushNotification(userId: string, payload: PushPayload) {
  if (!vapidConfigured) {
    logger.warn('VAPID keys not configured, skipping push notification');
    return { success: false, error: 'VAPID keys not configured' };
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subscriptions.length === 0) {
    logger.info('No push subscriptions found for user', { userId });
    return { success: false, error: 'No subscriptions found' };
  }

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload)
        );
        return { success: true, endpoint: sub.endpoint };
      } catch (error: unknown) {
        // If subscription is expired or invalid, remove it
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as { statusCode: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.endpoint, sub.endpoint));
            logger.info('Removed expired push subscription', { endpoint: sub.endpoint });
          }
        }
        throw error;
      }
    })
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info('Push notifications sent', { userId, successful, failed });

  return { success: successful > 0, sent: successful, failed };
}

export function getVapidPublicKey() {
  return vapidPublicKey || null;
}

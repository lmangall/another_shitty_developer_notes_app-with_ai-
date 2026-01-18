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

  logger.info('Sending push to subscriptions', { userId, count: subscriptions.length });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const platform = sub.endpoint.includes('fcm.googleapis.com')
        ? 'Chrome/Android'
        : sub.endpoint.includes('push.apple.com')
          ? 'Safari/iOS'
          : 'Other';

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
        logger.info('Push sent successfully', { platform, endpoint: sub.endpoint.slice(0, 50) });
        return { success: true, endpoint: sub.endpoint, platform };
      } catch (error: unknown) {
        const statusCode = error && typeof error === 'object' && 'statusCode' in error
          ? (error as { statusCode: number }).statusCode
          : null;
        const body = error && typeof error === 'object' && 'body' in error
          ? (error as { body: string }).body
          : null;

        logger.error('Push failed', error as Error, {
          platform,
          statusCode,
          body,
          endpoint: sub.endpoint.slice(0, 50),
        });

        // If subscription is expired or invalid, remove it
        if (statusCode === 404 || statusCode === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
          logger.info('Removed expired push subscription', { platform, endpoint: sub.endpoint.slice(0, 50) });
        }
        throw error;
      }
    })
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info('Push notifications completed', { userId, successful, failed });

  return { success: successful > 0, sent: successful, failed };
}

export function getVapidPublicKey() {
  return vapidPublicKey || null;
}

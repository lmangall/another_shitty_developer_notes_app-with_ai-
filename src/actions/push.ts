'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { sendPushNotification } from '@/lib/push';
import { ActionResult, success, error } from './types';

// Subscribe to push notifications
const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
});

export async function subscribePush(
  input: z.infer<typeof subscribeSchema>
): Promise<ActionResult<void>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = subscribeSchema.safeParse(input);
  if (!validation.success) {
    return error('Invalid subscription data', 'VALIDATION');
  }

  const { subscription } = validation.data;

  try {
    // Upsert subscription (update if endpoint exists, insert if not)
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

    if (existing.length > 0) {
      await db
        .update(pushSubscriptions)
        .set({
          userId: session.user.id,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    } else {
      await db.insert(pushSubscriptions).values({
        userId: session.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
    }

    logger.info('Push subscription saved', { userId: session.user.id });

    return success(undefined);
  } catch (err) {
    logger.error('Failed to save push subscription', err as Error);
    return error('Failed to save subscription', 'INTERNAL');
  }
}

// Unsubscribe from push notifications
const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function unsubscribePush(
  input: z.infer<typeof unsubscribeSchema>
): Promise<ActionResult<void>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = unsubscribeSchema.safeParse(input);
  if (!validation.success) {
    return error('Endpoint required', 'VALIDATION');
  }

  try {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, validation.data.endpoint));

    logger.info('Push subscription deleted', { userId: session.user.id });

    return success(undefined);
  } catch (err) {
    logger.error('Failed to delete push subscription', err as Error);
    return error('Failed to delete subscription', 'INTERNAL');
  }
}

// Send test push notification
export async function testPushNotification(): Promise<ActionResult<{ message: string }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  try {
    const result = await sendPushNotification(session.user.id, {
      title: 'Test Notification',
      body: 'Push notifications are working!',
      url: '/dashboard',
      tag: 'test',
    });

    if (!result.success) {
      return error(result.error || 'Failed to send notification', 'INTERNAL');
    }

    logger.info('Test push notification sent', { userId: session.user.id });

    return success({ message: `Notification sent to ${result.sent} device(s)` });
  } catch (err) {
    logger.error('Failed to send test push notification', err as Error);
    return error('Failed to send notification', 'INTERNAL');
  }
}

// Get push subscription count
export async function getPushSubscriptionCount(): Promise<ActionResult<{ count: number }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  try {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, session.user.id));

    return success({ count: subscriptions.length });
  } catch (err) {
    logger.error('Failed to get push subscription count', err as Error);
    return error('Failed to get subscription count', 'INTERNAL');
  }
}

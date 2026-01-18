import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { sendPushNotification } from '@/lib/push';
import { logger } from '@/lib/logger';

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendPushNotification(session.user.id, {
      title: 'Test Notification',
      body: 'Push notifications are working! 🎉',
      url: '/dashboard',
      tag: 'test',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send notification' },
        { status: 400 }
      );
    }

    logger.info('Test push notification sent', { userId: session.user.id });

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${result.sent} device(s)`,
    });
  } catch (error) {
    logger.error('Failed to send test push notification', error as Error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

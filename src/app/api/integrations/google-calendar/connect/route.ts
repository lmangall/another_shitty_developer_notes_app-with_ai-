import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { initiateGoogleCalendarConnection } from '@/lib/composio';
import { logger, createLogger } from '@/lib/logger';

export async function POST() {
  const log = createLogger({ requestId: crypto.randomUUID() });

  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log.info('Initiating Google Calendar connection', { userId: session.user.id });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = `${appUrl}/api/integrations/google-calendar/callback`;

    const connection = await initiateGoogleCalendarConnection(session.user.id, redirectUrl);

    log.info('Google Calendar connection initiated', {
      userId: session.user.id,
      connectionId: connection.connectionId,
    });

    return NextResponse.json({
      redirectUrl: connection.redirectUrl,
      connectionId: connection.connectionId,
    });
  } catch (error) {
    log.error('Failed to initiate Google Calendar connection', error);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}

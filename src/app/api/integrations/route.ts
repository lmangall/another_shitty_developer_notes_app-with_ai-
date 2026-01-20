import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { userIntegrations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    return NextResponse.json({ integrations });
  } catch (error) {
    logger.error('Failed to fetch integrations', error);
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
  }
}

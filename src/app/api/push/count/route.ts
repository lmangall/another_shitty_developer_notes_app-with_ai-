import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, session.user.id));

  return NextResponse.json({ count: subscriptions.length });
}

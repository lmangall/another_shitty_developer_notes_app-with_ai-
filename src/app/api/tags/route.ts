import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { tags } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userTags = await db
      .select()
      .from(tags)
      .where(eq(tags.userId, session.user.id))
      .orderBy(tags.name);

    return NextResponse.json({ tags: userTags });
  } catch (error) {
    logger.error('Failed to fetch tags', error as Error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, color } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    const [newTag] = await db
      .insert(tags)
      .values({
        userId: session.user.id,
        name: name.trim(),
        color: color || '#6b7280',
      })
      .returning();

    logger.info('Tag created', { userId: session.user.id, tagId: newTag.id });

    return NextResponse.json({ tag: newTag });
  } catch (error) {
    logger.error('Failed to create tag', error as Error);
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }
}

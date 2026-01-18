import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { tags } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { logger, createLogger } from '@/lib/logger';
import { DEFAULT_TAGS } from '@/lib/constants';

export async function POST() {
  const log = createLogger({ requestId: crypto.randomUUID() });
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Check which default tags already exist for this user
    const existingTags = await db
      .select({ name: tags.name })
      .from(tags)
      .where(
        and(
          eq(tags.userId, userId),
          inArray(tags.name, DEFAULT_TAGS.map(t => t.name))
        )
      );

    const existingTagNames = new Set(existingTags.map(t => t.name));
    const tagsToCreate = DEFAULT_TAGS.filter(t => !existingTagNames.has(t.name));

    if (tagsToCreate.length === 0) {
      log.info('Default tags already exist', { userId });
      return NextResponse.json({
        message: 'Default tags already exist',
        created: 0
      });
    }

    // Create missing default tags
    const newTags = await db
      .insert(tags)
      .values(
        tagsToCreate.map(tag => ({
          userId,
          name: tag.name,
          color: tag.color,
        }))
      )
      .returning();

    log.info('Default tags created', {
      userId,
      count: newTags.length,
      tagNames: newTags.map(t => t.name)
    });

    return NextResponse.json({
      message: `Created ${newTags.length} default tags`,
      created: newTags.length,
      tags: newTags
    });
  } catch (error) {
    log.error('Failed to seed default tags', error as Error, { userId });
    return NextResponse.json({ error: 'Failed to seed default tags' }, { status: 500 });
  }
}

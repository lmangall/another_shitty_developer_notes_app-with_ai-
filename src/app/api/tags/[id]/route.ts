import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { tags } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await db
      .delete(tags)
      .where(and(eq(tags.id, id), eq(tags.userId, session.user.id)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    logger.info('Tag deleted', { userId: session.user.id, tagId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete tag', error as Error);
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { name, color } = await request.json();

    const updates: { name?: string; color?: string } = {};
    if (name) updates.name = name.trim();
    if (color) updates.color = color;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const [updatedTag] = await db
      .update(tags)
      .set(updates)
      .where(and(eq(tags.id, id), eq(tags.userId, session.user.id)))
      .returning();

    if (!updatedTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    logger.info('Tag updated', { userId: session.user.id, tagId: id });

    return NextResponse.json({ tag: updatedTag });
  } catch (error) {
    logger.error('Failed to update tag', error as Error);
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
  }
}

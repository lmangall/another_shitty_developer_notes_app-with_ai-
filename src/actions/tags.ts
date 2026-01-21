'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { tags, notes, noteTags } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ActionResult, success, error } from './types';
import type { Tag } from '@/db/schema';

// ============ Schemas ============

const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format').optional(),
});

const updateTagSchema = z.object({
  id: z.string().uuid('Invalid tag ID'),
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format').optional(),
});

// ============ Helper ============

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

// ============ Actions ============

export async function getTags(): Promise<ActionResult<Tag[]>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  try {
    const userTags = await db
      .select()
      .from(tags)
      .where(eq(tags.userId, session.user.id))
      .orderBy(tags.name);

    return success(userTags);
  } catch (err) {
    logger.error('Failed to fetch tags', err as Error, { userId: session.user.id });
    return error('Failed to fetch tags', 'INTERNAL');
  }
}

export async function createTag(
  input: z.infer<typeof createTagSchema>
): Promise<ActionResult<Tag>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = createTagSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { name, color } = validation.data;

  try {
    const [newTag] = await db
      .insert(tags)
      .values({
        userId: session.user.id,
        name: name.trim(),
        color: color || '#6b7280',
      })
      .returning();

    logger.info('Tag created', { userId: session.user.id, tagId: newTag.id });
    revalidatePath('/notes');

    return success(newTag);
  } catch (err) {
    logger.error('Failed to create tag', err as Error, { userId: session.user.id });
    return error('Failed to create tag', 'INTERNAL');
  }
}

export async function updateTag(
  input: z.infer<typeof updateTagSchema>
): Promise<ActionResult<Tag>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = updateTagSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { id, name, color } = validation.data;

  if (!name && !color) {
    return error('No updates provided', 'VALIDATION');
  }

  try {
    const updates: { name?: string; color?: string } = {};
    if (name) updates.name = name.trim();
    if (color) updates.color = color;

    const [updatedTag] = await db
      .update(tags)
      .set(updates)
      .where(and(eq(tags.id, id), eq(tags.userId, session.user.id)))
      .returning();

    if (!updatedTag) {
      return error('Tag not found', 'NOT_FOUND');
    }

    logger.info('Tag updated', { userId: session.user.id, tagId: id });
    revalidatePath('/notes');

    return success(updatedTag);
  } catch (err) {
    logger.error('Failed to update tag', err as Error, { userId: session.user.id, tagId: id });
    return error('Failed to update tag', 'INTERNAL');
  }
}

export async function deleteTag(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = z.string().uuid('Invalid tag ID').safeParse(id);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  try {
    const result = await db
      .delete(tags)
      .where(and(eq(tags.id, id), eq(tags.userId, session.user.id)))
      .returning();

    if (result.length === 0) {
      return error('Tag not found', 'NOT_FOUND');
    }

    logger.info('Tag deleted', { userId: session.user.id, tagId: id });
    revalidatePath('/notes');

    return success(undefined);
  } catch (err) {
    logger.error('Failed to delete tag', err as Error, { userId: session.user.id, tagId: id });
    return error('Failed to delete tag', 'INTERNAL');
  }
}

// ============ Note-Tag Association Actions ============

const noteTagSchema = z.object({
  noteId: z.string().uuid('Invalid note ID'),
  tagId: z.string().uuid('Invalid tag ID'),
});

export async function addTagToNote(
  input: z.infer<typeof noteTagSchema>
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = noteTagSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { noteId, tagId } = validation.data;

  try {
    // Verify note belongs to user
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)));

    if (!note) {
      return error('Note not found', 'NOT_FOUND');
    }

    // Verify tag belongs to user
    const [tag] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, session.user.id)));

    if (!tag) {
      return error('Tag not found', 'NOT_FOUND');
    }

    // Add tag to note (ignore if already exists)
    await db
      .insert(noteTags)
      .values({ noteId, tagId })
      .onConflictDoNothing();

    logger.info('Tag added to note', { userId: session.user.id, noteId, tagId });
    revalidatePath('/notes');

    return success(undefined);
  } catch (err) {
    logger.error('Failed to add tag to note', err as Error, { userId: session.user.id, noteId, tagId });
    return error('Failed to add tag', 'INTERNAL');
  }
}

export async function removeTagFromNote(
  input: z.infer<typeof noteTagSchema>
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = noteTagSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { noteId, tagId } = validation.data;

  try {
    // Verify note belongs to user
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)));

    if (!note) {
      return error('Note not found', 'NOT_FOUND');
    }

    // Remove tag from note
    await db
      .delete(noteTags)
      .where(and(eq(noteTags.noteId, noteId), eq(noteTags.tagId, tagId)));

    logger.info('Tag removed from note', { userId: session.user.id, noteId, tagId });
    revalidatePath('/notes');

    return success(undefined);
  } catch (err) {
    logger.error('Failed to remove tag from note', err as Error, { userId: session.user.id, noteId, tagId });
    return error('Failed to remove tag', 'INTERNAL');
  }
}

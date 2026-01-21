'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { notes, tags, noteTags } from '@/db/schema';
import { eq, desc, asc, ilike, or, and, sql, inArray, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ActionResult, PaginatedResult, success, error } from './types';
import type { Note } from '@/db/schema';
import type { NoteSortOption, SortOrder } from '@/lib/constants';

// ============ Types ============

export type NoteWithTags = Note & {
  tags: Array<{ id: string; name: string; color: string }>;
};

// ============ Schemas ============

const getNotesSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  tags: z.array(z.string().uuid()).optional(),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'position']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  content: z.string().min(1, 'Content is required'),
});

const updateNoteSchema = z.object({
  id: z.string().uuid('Invalid note ID'),
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  cardColSpan: z.number().int().min(1).max(2).optional(),
  cardRowSpan: z.number().int().min(1).max(2).optional(),
  isPinned: z.boolean().optional(),
});

const reorderNotesSchema = z.object({
  noteIds: z.array(z.string().uuid()).min(1),
});

// ============ Helper ============

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

async function fetchTagsForNotes(noteIds: string[]): Promise<Record<string, Array<{ id: string; name: string; color: string }>>> {
  if (noteIds.length === 0) return {};

  const noteTagsWithDetails = await db
    .select({
      noteId: noteTags.noteId,
      tagId: tags.id,
      tagName: tags.name,
      tagColor: tags.color,
    })
    .from(noteTags)
    .innerJoin(tags, eq(noteTags.tagId, tags.id))
    .where(inArray(noteTags.noteId, noteIds));

  return noteTagsWithDetails.reduce((acc, nt) => {
    if (!acc[nt.noteId]) acc[nt.noteId] = [];
    acc[nt.noteId].push({ id: nt.tagId, name: nt.tagName, color: nt.tagColor });
    return acc;
  }, {} as Record<string, Array<{ id: string; name: string; color: string }>>);
}

// ============ Actions ============

export async function getNotes(
  input: z.infer<typeof getNotesSchema>
): Promise<ActionResult<PaginatedResult<NoteWithTags>>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = getNotesSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { page, limit, search, tags: tagIds, sortBy, sortOrder, dateFrom, dateTo } = validation.data;
  const offset = (page - 1) * limit;

  try {
    // Build where clause - exclude soft-deleted notes
    let whereClause = and(
      eq(notes.userId, session.user.id),
      isNull(notes.deletedAt)
    )!;

    if (search) {
      whereClause = and(
        whereClause,
        or(
          ilike(notes.title, `%${search}%`),
          ilike(notes.content, `%${search}%`)
        )
      )!;
    }

    // Date range filter
    if (dateFrom) {
      whereClause = and(whereClause, gte(notes.createdAt, new Date(dateFrom)))!;
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      whereClause = and(whereClause, lte(notes.createdAt, endDate))!;
    }

    // Tag filtering
    if (tagIds && tagIds.length > 0) {
      const notesWithTags = await db
        .selectDistinct({ noteId: noteTags.noteId })
        .from(noteTags)
        .where(inArray(noteTags.tagId, tagIds));

      const noteIdsWithTags = notesWithTags.map(n => n.noteId);
      if (noteIdsWithTags.length === 0) {
        return success({ items: [], total: 0, page, limit, totalPages: 0 });
      }
      whereClause = and(whereClause, inArray(notes.id, noteIdsWithTags))!;
    }

    // Build order by clause
    const sortColumn = sortBy === 'title' ? notes.title :
                       sortBy === 'createdAt' ? notes.createdAt :
                       sortBy === 'position' ? notes.position :
                       notes.updatedAt;
    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const [userNotes, countResult] = await Promise.all([
      db
        .select()
        .from(notes)
        .where(whereClause)
        .orderBy(desc(notes.isPinned), orderByClause)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(whereClause),
    ]);

    const noteTagsMap = await fetchTagsForNotes(userNotes.map(n => n.id));

    const notesWithTags = userNotes.map(note => ({
      ...note,
      tags: noteTagsMap[note.id] || [],
    }));

    return success({
      items: notesWithTags,
      total: Number(countResult[0].count),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0].count) / limit),
    });
  } catch (err) {
    logger.error('Failed to fetch notes', err as Error, { userId: session.user.id });
    return error('Failed to fetch notes', 'INTERNAL');
  }
}

export async function getNote(id: string): Promise<ActionResult<Note>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = z.string().uuid('Invalid note ID').safeParse(id);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  try {
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, session.user.id), isNull(notes.deletedAt)));

    if (!note) {
      return error('Note not found', 'NOT_FOUND');
    }

    return success(note);
  } catch (err) {
    logger.error('Failed to fetch note', err as Error, { userId: session.user.id, noteId: id });
    return error('Failed to fetch note', 'INTERNAL');
  }
}

export async function createNote(
  input: z.infer<typeof createNoteSchema>
): Promise<ActionResult<Note>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = createNoteSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { title, content } = validation.data;

  try {
    const [note] = await db
      .insert(notes)
      .values({
        userId: session.user.id,
        title,
        content,
      })
      .returning();

    logger.info('Note created', { userId: session.user.id, noteId: note.id });
    revalidatePath('/notes');

    return success(note);
  } catch (err) {
    logger.error('Failed to create note', err as Error, { userId: session.user.id });
    return error('Failed to create note', 'INTERNAL');
  }
}

export async function updateNote(
  input: z.infer<typeof updateNoteSchema>
): Promise<ActionResult<Note>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = updateNoteSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { id, title, content, cardColSpan, cardRowSpan, isPinned } = validation.data;

  try {
    const [existing] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, session.user.id), isNull(notes.deletedAt)));

    if (!existing) {
      return error('Note not found', 'NOT_FOUND');
    }

    const [updated] = await db
      .update(notes)
      .set({
        ...(title && { title }),
        ...(content && { content }),
        ...(cardColSpan !== undefined && { cardColSpan }),
        ...(cardRowSpan !== undefined && { cardRowSpan }),
        ...(isPinned !== undefined && { isPinned }),
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

    logger.info('Note updated', { userId: session.user.id, noteId: id });
    revalidatePath('/notes');
    revalidatePath(`/notes/${id}`);

    return success(updated);
  } catch (err) {
    logger.error('Failed to update note', err as Error, { userId: session.user.id, noteId: id });
    return error('Failed to update note', 'INTERNAL');
  }
}

export async function deleteNote(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = z.string().uuid('Invalid note ID').safeParse(id);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  try {
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, session.user.id), isNull(notes.deletedAt)));

    if (!note) {
      return error('Note not found', 'NOT_FOUND');
    }

    // Soft delete
    await db.update(notes).set({ deletedAt: new Date() }).where(eq(notes.id, id));

    logger.info('Note soft deleted', { userId: session.user.id, noteId: id });
    revalidatePath('/notes');

    return success(undefined);
  } catch (err) {
    logger.error('Failed to delete note', err as Error, { userId: session.user.id, noteId: id });
    return error('Failed to delete note', 'INTERNAL');
  }
}

export async function reorderNotes(
  input: z.infer<typeof reorderNotesSchema>
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = reorderNotesSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { noteIds } = validation.data;

  try {
    await Promise.all(
      noteIds.map((noteId, index) =>
        db
          .update(notes)
          .set({ position: index })
          .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)))
      )
    );

    logger.info('Notes reordered', { userId: session.user.id, count: noteIds.length });
    revalidatePath('/notes');

    return success(undefined);
  } catch (err) {
    logger.error('Failed to reorder notes', err as Error, { userId: session.user.id });
    return error('Failed to reorder notes', 'INTERNAL');
  }
}

// ============ Trash Actions ============

export async function getTrashedNotes(
  input: { page?: number; limit?: number }
): Promise<ActionResult<PaginatedResult<NoteWithTags>>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const page = input.page || 1;
  const limit = input.limit || 20;
  const offset = (page - 1) * limit;

  try {
    const whereClause = and(
      eq(notes.userId, session.user.id),
      isNotNull(notes.deletedAt)
    );

    const [deletedNotes, countResult] = await Promise.all([
      db
        .select()
        .from(notes)
        .where(whereClause)
        .orderBy(desc(notes.deletedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(whereClause),
    ]);

    const noteTagsMap = await fetchTagsForNotes(deletedNotes.map(n => n.id));

    const notesWithTags = deletedNotes.map(note => ({
      ...note,
      tags: noteTagsMap[note.id] || [],
    }));

    logger.debug('Trash notes fetched', { userId: session.user.id, count: deletedNotes.length });

    return success({
      items: notesWithTags,
      total: Number(countResult[0].count),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0].count) / limit),
    });
  } catch (err) {
    logger.error('Failed to fetch trashed notes', err as Error, { userId: session.user.id });
    return error('Failed to fetch trashed notes', 'INTERNAL');
  }
}

export async function restoreNote(id: string): Promise<ActionResult<Note>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = z.string().uuid('Invalid note ID').safeParse(id);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  try {
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, session.user.id), isNotNull(notes.deletedAt)));

    if (!note) {
      return error('Note not found in trash', 'NOT_FOUND');
    }

    const [restored] = await db
      .update(notes)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning();

    logger.info('Note restored from trash', { userId: session.user.id, noteId: id });
    revalidatePath('/notes');
    revalidatePath('/notes/trash');

    return success(restored);
  } catch (err) {
    logger.error('Failed to restore note', err as Error, { userId: session.user.id, noteId: id });
    return error('Failed to restore note', 'INTERNAL');
  }
}

export async function permanentlyDeleteNote(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = z.string().uuid('Invalid note ID').safeParse(id);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  try {
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, session.user.id), isNotNull(notes.deletedAt)));

    if (!note) {
      return error('Note not found in trash', 'NOT_FOUND');
    }

    // Delete tag associations first
    await db.delete(noteTags).where(eq(noteTags.noteId, id));

    // Permanently delete
    await db.delete(notes).where(eq(notes.id, id));

    logger.info('Note permanently deleted', { userId: session.user.id, noteId: id });
    revalidatePath('/notes/trash');

    return success(undefined);
  } catch (err) {
    logger.error('Failed to permanently delete note', err as Error, { userId: session.user.id, noteId: id });
    return error('Failed to permanently delete note', 'INTERNAL');
  }
}

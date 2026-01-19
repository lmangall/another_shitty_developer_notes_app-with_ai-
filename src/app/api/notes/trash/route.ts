import { NextRequest, NextResponse } from 'next/server';
import { db, notes, tags, noteTags } from '@/db';
import { eq, desc, and, sql, inArray, isNotNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  // Get soft-deleted notes only
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

  // Fetch tags for all notes
  const noteIds = deletedNotes.map(n => n.id);
  let noteTagsMap: Record<string, Array<{ id: string; name: string; color: string }>> = {};

  if (noteIds.length > 0) {
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

    noteTagsMap = noteTagsWithDetails.reduce((acc, nt) => {
      if (!acc[nt.noteId]) acc[nt.noteId] = [];
      acc[nt.noteId].push({ id: nt.tagId, name: nt.tagName, color: nt.tagColor });
      return acc;
    }, {} as Record<string, Array<{ id: string; name: string; color: string }>>);
  }

  const notesWithTags = deletedNotes.map(note => ({
    ...note,
    tags: noteTagsMap[note.id] || [],
  }));

  logger.debug('Trash notes fetched', { userId: session.user.id, count: deletedNotes.length });

  return NextResponse.json({
    notes: notesWithTags,
    total: Number(countResult[0].count),
    page,
    limit,
    totalPages: Math.ceil(Number(countResult[0].count) / limit),
  });
}

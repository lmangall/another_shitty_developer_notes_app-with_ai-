import { NextRequest, NextResponse } from 'next/server';
import { db, notes, tags, noteTags } from '@/db';
import { eq, desc, ilike, or, and, sql, inArray } from 'drizzle-orm';
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
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  let whereClause = eq(notes.userId, session.user.id);
  if (search) {
    whereClause = and(
      whereClause,
      or(
        ilike(notes.title, `%${search}%`),
        ilike(notes.content, `%${search}%`)
      )
    )!;
  }

  const [userNotes, countResult] = await Promise.all([
    db
      .select()
      .from(notes)
      .where(whereClause)
      .orderBy(desc(notes.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(whereClause),
  ]);

  // Fetch tags for all notes
  const noteIds = userNotes.map(n => n.id);
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

  const notesWithTags = userNotes.map(note => ({
    ...note,
    tags: noteTagsMap[note.id] || [],
  }));

  return NextResponse.json({
    notes: notesWithTags,
    total: Number(countResult[0].count),
    page,
    limit,
    totalPages: Math.ceil(Number(countResult[0].count) / limit),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { title, content } = body;

  if (!title || !content) {
    return NextResponse.json(
      { error: 'Title and content are required' },
      { status: 400 }
    );
  }

  const [note] = await db
    .insert(notes)
    .values({
      userId,
      title,
      content,
    })
    .returning();

  logger.info('Note created', { userId, noteId: note.id });

  return NextResponse.json(note, { status: 201 });
}

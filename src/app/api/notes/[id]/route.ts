import { NextRequest, NextResponse } from 'next/server';
import { db, notes } from '@/db';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id), isNull(notes.deletedAt)));

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  return NextResponse.json(note);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, content, cardColSpan, cardRowSpan } = body;

  // Validate spans if provided (1-2 columns, 1-2 rows for preset sizes)
  if (cardColSpan !== undefined && (cardColSpan < 1 || cardColSpan > 2)) {
    return NextResponse.json({ error: 'Invalid column span (must be 1-2)' }, { status: 400 });
  }
  if (cardRowSpan !== undefined && (cardRowSpan < 1 || cardRowSpan > 2)) {
    return NextResponse.json({ error: 'Invalid row span (must be 1-2)' }, { status: 400 });
  }

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id), isNull(notes.deletedAt)));

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(notes)
    .set({
      ...(title && { title }),
      ...(content && { content }),
      ...(cardColSpan !== undefined && { cardColSpan }),
      ...(cardRowSpan !== undefined && { cardRowSpan }),
      updatedAt: new Date(),
    })
    .where(eq(notes.id, id))
    .returning();

  logger.info('Note updated', { userId: session.user.id, noteId: id });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id), isNull(notes.deletedAt)));

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  await db
    .update(notes)
    .set({ deletedAt: new Date() })
    .where(eq(notes.id, id));

  logger.info('Note soft deleted', { userId: session.user.id, noteId: id });

  return NextResponse.json({ success: true });
}

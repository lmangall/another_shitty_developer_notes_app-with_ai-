import { NextRequest, NextResponse } from 'next/server';
import { db, notes } from '@/db';
import { eq, and, isNotNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Find the soft-deleted note
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id), isNotNull(notes.deletedAt)));

  if (!note) {
    return NextResponse.json({ error: 'Note not found in trash' }, { status: 404 });
  }

  // Restore the note by clearing deletedAt
  const [restored] = await db
    .update(notes)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(notes.id, id))
    .returning();

  logger.info('Note restored from trash', { userId: session.user.id, noteId: id });

  return NextResponse.json(restored);
}

import { NextRequest, NextResponse } from 'next/server';
import { db, notes, noteTags } from '@/db';
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Find the soft-deleted note (must be in trash to permanently delete)
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id), isNotNull(notes.deletedAt)));

  if (!note) {
    return NextResponse.json({ error: 'Note not found in trash' }, { status: 404 });
  }

  // Delete tag associations first (cascade should handle this, but being explicit)
  await db.delete(noteTags).where(eq(noteTags.noteId, id));

  // Permanently delete the note
  await db.delete(notes).where(eq(notes.id, id));

  logger.info('Note permanently deleted', { userId: session.user.id, noteId: id });

  return NextResponse.json({ success: true });
}

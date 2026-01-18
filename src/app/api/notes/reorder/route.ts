import { NextRequest, NextResponse } from 'next/server';
import { db, notes } from '@/db';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { noteIds } = body as { noteIds: string[] };

  if (!noteIds || !Array.isArray(noteIds)) {
    return NextResponse.json({ error: 'noteIds array is required' }, { status: 400 });
  }

  // Update positions for each note
  await Promise.all(
    noteIds.map((noteId, index) =>
      db
        .update(notes)
        .set({ position: index })
        .where(and(eq(notes.id, noteId), eq(notes.userId, session.user.id)))
    )
  );

  logger.info('Notes reordered', { userId: session.user.id, count: noteIds.length });

  return NextResponse.json({ success: true });
}

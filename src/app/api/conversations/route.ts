import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, chatConversations, chatMessages } from '@/db';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

// GET - List user's conversations
export async function GET() {
  const log = createLogger({ requestId: crypto.randomUUID() });

  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const conversations = await db
      .select({
        id: chatConversations.id,
        title: chatConversations.title,
        createdAt: chatConversations.createdAt,
        updatedAt: chatConversations.updatedAt,
      })
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.updatedAt))
      .limit(50);

    log.debug('Listed conversations', { userId, count: conversations.length });

    return NextResponse.json({ conversations });
  } catch (error) {
    log.error('Failed to list conversations', error, {});
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}

// DELETE - Delete conversations (supports batch delete)
export async function DELETE(request: Request) {
  const log = createLogger({ requestId: crypto.randomUUID() });

  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Conversation IDs required' }, { status: 400 });
    }

    // Delete conversations (cascade will delete messages)
    await db
      .delete(chatConversations)
      .where(
        and(
          eq(chatConversations.userId, userId),
          inArray(chatConversations.id, ids)
        )
      );

    log.info('Deleted conversations', { userId, count: ids.length });

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    log.error('Failed to delete conversations', error, {});
    return NextResponse.json(
      { error: 'Failed to delete conversations' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, chatConversations, chatMessages } from '@/db';
import { eq, and, asc } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Get a single conversation with its messages
export async function GET(request: Request, context: RouteContext) {
  const log = createLogger({ requestId: crypto.randomUUID() });

  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = await context.params;

    // Get conversation
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(
        and(
          eq(chatConversations.id, id),
          eq(chatConversations.userId, userId)
        )
      )
      .limit(1);

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get messages
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, id))
      .orderBy(asc(chatMessages.createdAt));

    log.debug('Retrieved conversation', { userId, conversationId: id, messageCount: messages.length });

    return NextResponse.json({
      conversation,
      messages,
    });
  } catch (error) {
    log.error('Failed to get conversation', error, {});
    return NextResponse.json(
      { error: 'Failed to get conversation' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a single conversation
export async function DELETE(request: Request, context: RouteContext) {
  const log = createLogger({ requestId: crypto.randomUUID() });

  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = await context.params;

    // Delete conversation (cascade will delete messages)
    const result = await db
      .delete(chatConversations)
      .where(
        and(
          eq(chatConversations.id, id),
          eq(chatConversations.userId, userId)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    log.info('Deleted conversation', { userId, conversationId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to delete conversation', error, {});
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}

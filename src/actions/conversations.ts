'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, chatConversations, chatMessages } from '@/db';
import { eq, desc, and, asc, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ActionResult, success, error } from './types';

// Types
export interface Conversation {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: Date;
}

export interface ConversationWithMessages {
  conversation: Conversation;
  messages: Message[];
}

// Get all conversations
export async function getConversations(): Promise<ActionResult<Conversation[]>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  try {
    const conversations = await db
      .select({
        id: chatConversations.id,
        title: chatConversations.title,
        createdAt: chatConversations.createdAt,
        updatedAt: chatConversations.updatedAt,
      })
      .from(chatConversations)
      .where(eq(chatConversations.userId, session.user.id))
      .orderBy(desc(chatConversations.updatedAt))
      .limit(50);

    logger.debug('Listed conversations', { userId: session.user.id, count: conversations.length });

    return success(conversations);
  } catch (err) {
    logger.error('Failed to list conversations', err as Error);
    return error('Failed to list conversations', 'INTERNAL');
  }
}

// Get single conversation with messages
export async function getConversation(id: string): Promise<ActionResult<ConversationWithMessages>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  try {
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(
        and(
          eq(chatConversations.id, id),
          eq(chatConversations.userId, session.user.id)
        )
      )
      .limit(1);

    if (!conversation) {
      return error('Conversation not found', 'NOT_FOUND');
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, id))
      .orderBy(asc(chatMessages.createdAt));

    logger.debug('Retrieved conversation', {
      userId: session.user.id,
      conversationId: id,
      messageCount: messages.length
    });

    return success({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: messages.map(m => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    logger.error('Failed to get conversation', err as Error);
    return error('Failed to get conversation', 'INTERNAL');
  }
}

// Delete single conversation
export async function deleteConversation(id: string): Promise<ActionResult<void>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  try {
    const result = await db
      .delete(chatConversations)
      .where(
        and(
          eq(chatConversations.id, id),
          eq(chatConversations.userId, session.user.id)
        )
      )
      .returning();

    if (result.length === 0) {
      return error('Conversation not found', 'NOT_FOUND');
    }

    logger.info('Deleted conversation', { userId: session.user.id, conversationId: id });

    return success(undefined);
  } catch (err) {
    logger.error('Failed to delete conversation', err as Error);
    return error('Failed to delete conversation', 'INTERNAL');
  }
}

// Batch delete conversations
const deleteConversationsSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export async function deleteConversations(
  input: z.infer<typeof deleteConversationsSchema>
): Promise<ActionResult<{ deleted: number }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = deleteConversationsSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { ids } = validation.data;

  try {
    await db
      .delete(chatConversations)
      .where(
        and(
          eq(chatConversations.userId, session.user.id),
          inArray(chatConversations.id, ids)
        )
      );

    logger.info('Deleted conversations', { userId: session.user.id, count: ids.length });

    return success({ deleted: ids.length });
  } catch (err) {
    logger.error('Failed to delete conversations', err as Error);
    return error('Failed to delete conversations', 'INTERNAL');
  }
}

import { streamText, stepCountIs } from 'ai';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import {
  model,
  createTools,
  buildSystemPrompt,
  getUserContext,
  type ToolExecutionResult,
} from '@/lib/ai';
import { getGoogleCalendarTools } from '@/lib/composio';
import { db, chatConversations, chatMessages } from '@/db';
import { eq, asc } from 'drizzle-orm';
import { logger, createLogger } from '@/lib/logger';

export const maxDuration = 60;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  const log = createLogger({ requestId: crypto.randomUUID() });

  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { conversationId, message, timezone } = body as {
      conversationId?: string;
      message: string;
      timezone?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    log.info('Chat request received', { userId, conversationId, hasTimezone: !!timezone });

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      // Create new conversation
      const [newConv] = await db
        .insert(chatConversations)
        .values({
          userId,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        })
        .returning();
      convId = newConv.id;
      log.info('Created new conversation', { userId, conversationId: convId });
    }

    // Save user message
    await db.insert(chatMessages).values({
      conversationId: convId,
      role: 'user',
      content: message,
    });

    // Load conversation history
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, convId))
      .orderBy(asc(chatMessages.createdAt));

    // Convert to AI SDK format
    const messages: ChatMessage[] = history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Get user context
    const context = await getUserContext(userId);

    // Build tools
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tools: Record<string, any> = createTools(userId, context.tags);

    // Check for Google Calendar integration
    const hasCalendarIntegration = context.integrations?.some(
      (i) => i.provider === 'google-calendar'
    );
    let hasCalendarTools = false;

    if (hasCalendarIntegration) {
      try {
        const calendarTools = await getGoogleCalendarTools(userId);
        if (calendarTools && Object.keys(calendarTools).length > 0) {
          tools = { ...tools, ...calendarTools };
          hasCalendarTools = true;
          log.debug('Added calendar tools', { userId, count: Object.keys(calendarTools).length });
        }
      } catch (error) {
        logger.error('Failed to load calendar tools', error, { userId });
      }
    }

    const systemPrompt = buildSystemPrompt(context, timezone, hasCalendarTools);

    // Capture convId in closure for onFinish
    const conversationIdForFinish = convId;

    // Stream the response
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(5),
      onFinish: async ({ text, toolResults }) => {
        // Collect tool execution results
        const execResults: ToolExecutionResult[] = [];
        if (toolResults && toolResults.length > 0) {
          for (const tr of toolResults) {
            // The tool result structure in v6
            if (tr && typeof tr === 'object' && 'result' in tr) {
              const result = tr.result as ToolExecutionResult;
              if (result && typeof result === 'object' && 'success' in result) {
                execResults.push(result);
              }
            }
          }
        }

        // Save assistant message
        await db.insert(chatMessages).values({
          conversationId: conversationIdForFinish,
          role: 'assistant',
          content: text || '',
          toolResults: execResults.length > 0 ? execResults : null,
        });

        // Update conversation timestamp
        await db
          .update(chatConversations)
          .set({ updatedAt: new Date() })
          .where(eq(chatConversations.id, conversationIdForFinish));

        log.info('Chat response completed', {
          userId,
          conversationId: conversationIdForFinish,
          toolResultsCount: execResults.length,
        });
      },
    });

    // Return streaming response with conversation ID in headers
    // Use toUIMessageStreamResponse to include tool invocation states
    const response = result.toUIMessageStreamResponse();

    // Add conversation ID to response headers
    response.headers.set('X-Conversation-Id', convId);
    response.headers.set('Access-Control-Expose-Headers', 'X-Conversation-Id');

    return response;
  } catch (error) {
    log.error('Chat error', error, {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat' },
      { status: 500 }
    );
  }
}

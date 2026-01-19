import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { processWithAgent, getUserContext } from '@/lib/ai';
import { createLogger } from '@/lib/logger';
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function POST(request: NextRequest) {
  const log = createLogger({ route: 'ai/process' });

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Rate limiting
  const rateLimit = checkRateLimit(
    `ai:${userId}`,
    RATE_LIMITS.AI_PROCESS.limit,
    RATE_LIMITS.AI_PROCESS.windowMs
  );

  if (!rateLimit.success) {
    log.warn('Rate limit exceeded', { userId });
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimit, RATE_LIMITS.AI_PROCESS.limit),
      }
    );
  }

  log.info('AI process request received', { userId });

  const body = await request.json();
  const { input, timezone } = body;

  if (!input || typeof input !== 'string') {
    log.warn('Invalid input provided', { userId });
    return NextResponse.json(
      { error: 'Input is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch user's existing notes and reminders for context
    const context = await getUserContext(session.user.id);
    log.debug('User context fetched', { userId, notesCount: context.notes.length, remindersCount: context.reminders.length });

    // Process with the AI agent - it will decide what tools to use
    const response = await processWithAgent(
      session.user.id,
      input,
      context,
      timezone
    );

    log.info('AI processing completed', { userId, toolsUsed: response.toolResults?.length ?? 0 });

    return NextResponse.json({
      message: response.message,
      toolResults: response.toolResults,
    });
  } catch (error) {
    log.error('AI processing failed', error, { userId });
    return NextResponse.json(
      { error: 'Failed to process input' },
      { status: 500 }
    );
  }
}

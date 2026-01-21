'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { processWithAgent, getUserContext } from '@/lib/ai';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { ActionResult, success, error } from './types';

// Types
export interface ProcessResult {
  message: string;
  toolResults?: unknown[];
}

// Process input with AI agent
const processSchema = z.object({
  input: z.string().min(1),
  timezone: z.string().optional(),
});

export async function processWithAI(
  input: z.infer<typeof processSchema>
): Promise<ActionResult<ProcessResult>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = processSchema.safeParse(input);
  if (!validation.success) {
    return error('Input is required', 'VALIDATION');
  }

  const userId = session.user.id;

  // Rate limiting
  const rateLimit = checkRateLimit(
    `ai:${userId}`,
    RATE_LIMITS.AI_PROCESS.limit,
    RATE_LIMITS.AI_PROCESS.windowMs
  );

  if (!rateLimit.success) {
    logger.warn('Rate limit exceeded', { userId });
    return error('Too many requests. Please try again later.', 'RATE_LIMIT');
  }

  logger.info('AI process request received', { userId });

  try {
    // Fetch user's existing notes and reminders for context
    const context = await getUserContext(userId);
    logger.debug('User context fetched', {
      userId,
      notesCount: context.notes.length,
      remindersCount: context.reminders.length
    });

    // Process with the AI agent
    const response = await processWithAgent(
      userId,
      validation.data.input,
      context,
      validation.data.timezone
    );

    logger.info('AI processing completed', { userId, toolsUsed: response.toolResults?.length ?? 0 });

    return success({
      message: response.message,
      toolResults: response.toolResults,
    });
  } catch (err) {
    logger.error('AI processing failed', err as Error, { userId });
    return error('Failed to process input', 'INTERNAL');
  }
}

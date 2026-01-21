'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { emailLogs } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ActionResult, PaginatedResult, success, error } from './types';
import { processWithAgent, getUserContext, type ToolExecutionResult } from '@/lib/ai';
import type { EmailLog } from '@/db/schema';

// ============ Schemas ============

const getLogsSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// ============ Helper ============

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

// ============ Actions ============

export async function getLogs(
  input: z.infer<typeof getLogsSchema>
): Promise<ActionResult<PaginatedResult<EmailLog>>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = getLogsSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { page, limit } = validation.data;
  const offset = (page - 1) * limit;

  try {
    const whereClause = eq(emailLogs.userId, session.user.id);

    const [logs, countResult] = await Promise.all([
      db
        .select()
        .from(emailLogs)
        .where(whereClause)
        .orderBy(desc(emailLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(emailLogs)
        .where(whereClause),
    ]);

    return success({
      items: logs,
      total: Number(countResult[0].count),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0].count) / limit),
    });
  } catch (err) {
    logger.error('Failed to fetch logs', err as Error, { userId: session.user.id });
    return error('Failed to fetch logs', 'INTERNAL');
  }
}

export async function getLog(id: string): Promise<ActionResult<EmailLog>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = z.string().uuid('Invalid log ID').safeParse(id);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  try {
    const [log] = await db
      .select()
      .from(emailLogs)
      .where(and(eq(emailLogs.id, id), eq(emailLogs.userId, session.user.id)));

    if (!log) {
      return error('Log not found', 'NOT_FOUND');
    }

    return success(log);
  } catch (err) {
    logger.error('Failed to fetch log', err as Error, { userId: session.user.id, logId: id });
    return error('Failed to fetch log', 'INTERNAL');
  }
}

export async function reprocessLog(id: string): Promise<ActionResult<{
  message: string;
  toolResults: ToolExecutionResult[];
}>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = z.string().uuid('Invalid log ID').safeParse(id);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  try {
    const [log] = await db
      .select()
      .from(emailLogs)
      .where(and(eq(emailLogs.id, id), eq(emailLogs.userId, session.user.id)));

    if (!log) {
      return error('Log not found', 'NOT_FOUND');
    }

    const input = `${log.subject ? log.subject + '\n\n' : ''}${log.body}`;
    const context = await getUserContext(session.user.id);
    const response = await processWithAgent(session.user.id, input, context);

    const firstToolResult = response.toolResults?.[0];
    const successResult = firstToolResult?.success ?? false;

    // Extract data from successful results
    let noteId: string | null = null;
    let reminderId: string | null = null;

    if (firstToolResult?.success && firstToolResult.data) {
      if ('noteId' in firstToolResult.data) {
        noteId = firstToolResult.data.noteId as string;
      }
      if ('reminderId' in firstToolResult.data) {
        reminderId = firstToolResult.data.reminderId as string;
      }
    }

    // Update the log
    await db
      .update(emailLogs)
      .set({
        aiResult: { message: response.message, toolResults: response.toolResults },
        actionType: firstToolResult?.action ?? null,
        status: successResult ? 'processed' : 'failed',
        errorMessage: successResult ? null : (firstToolResult ? (firstToolResult as ToolExecutionResult & { success: false }).error : null),
        relatedNoteId: noteId,
        relatedReminderId: reminderId,
      })
      .where(eq(emailLogs.id, id));

    logger.info('Log reprocessed', { userId: session.user.id, logId: id, success: successResult });
    revalidatePath('/logs');

    return success({
      message: response.message,
      toolResults: response.toolResults,
    });
  } catch (err) {
    logger.error('Failed to reprocess log', err as Error, { userId: session.user.id, logId: id });
    return error(err instanceof Error ? err.message : 'Reprocessing failed', 'INTERNAL');
  }
}

export async function deleteLog(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = z.string().uuid('Invalid log ID').safeParse(id);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  try {
    const [log] = await db
      .select()
      .from(emailLogs)
      .where(and(eq(emailLogs.id, id), eq(emailLogs.userId, session.user.id)));

    if (!log) {
      return error('Log not found', 'NOT_FOUND');
    }

    await db.delete(emailLogs).where(eq(emailLogs.id, id));

    logger.info('Log deleted', { userId: session.user.id, logId: id });
    revalidatePath('/logs');

    return success(undefined);
  } catch (err) {
    logger.error('Failed to delete log', err as Error, { userId: session.user.id, logId: id });
    return error('Failed to delete log', 'INTERNAL');
  }
}

'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { reminders } from '@/db/schema';
import { eq, desc, asc, and, sql, gte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ActionResult, PaginatedResult, success, error } from './types';
import type { Reminder } from '@/db/schema';
import { NOTIFY_VIA_OPTIONS, RECURRENCE_OPTIONS, type NotifyVia, type Recurrence, type ReminderSortOption } from '@/lib/constants';

// ============ Schemas ============

const getRemindersSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  notifyVia: z.string().optional(),
  upcoming: z.boolean().optional(),
  sortBy: z.enum(['remindAt', 'createdAt', 'status', 'message']).default('remindAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

const createReminderSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  remindAt: z.string().datetime().optional().nullable(),
  notifyVia: z.enum(['email', 'push', 'both']).default('email'),
  recurrence: z.enum(['', 'daily', 'weekly', 'monthly']).optional().nullable(),
  recurrenceEndDate: z.string().datetime().optional().nullable(),
});

const updateReminderSchema = z.object({
  id: z.string().uuid('Invalid reminder ID'),
  message: z.string().min(1).optional(),
  remindAt: z.string().datetime().optional().nullable(),
  status: z.enum(['pending', 'sent', 'cancelled', 'completed']).optional(),
  notifyVia: z.enum(['email', 'push', 'both']).optional(),
  recurrence: z.enum(['', 'daily', 'weekly', 'monthly']).optional().nullable(),
  recurrenceEndDate: z.string().datetime().optional().nullable(),
});

// ============ Helper ============

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

// ============ Actions ============

export async function getReminders(
  input: z.infer<typeof getRemindersSchema>
): Promise<ActionResult<PaginatedResult<Reminder>>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = getRemindersSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { page, limit, status, notifyVia, upcoming, sortBy, sortOrder } = validation.data;
  const offset = (page - 1) * limit;

  try {
    let whereClause = eq(reminders.userId, session.user.id);

    if (status) {
      whereClause = and(whereClause, eq(reminders.status, status))!;
    }

    if (notifyVia) {
      whereClause = and(whereClause, eq(reminders.notifyVia, notifyVia as NotifyVia))!;
    }

    if (upcoming) {
      whereClause = and(
        whereClause,
        eq(reminders.status, 'pending'),
        gte(reminders.remindAt, new Date())
      )!;
    }

    // Build order by clause
    const sortColumn = {
      remindAt: reminders.remindAt,
      createdAt: reminders.createdAt,
      status: reminders.status,
      message: reminders.message,
    }[sortBy] || reminders.remindAt;

    const orderFn = sortOrder === 'desc' ? desc : asc;

    const [userReminders, countResult] = await Promise.all([
      db
        .select()
        .from(reminders)
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reminders)
        .where(whereClause),
    ]);

    return success({
      items: userReminders,
      total: Number(countResult[0].count),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult[0].count) / limit),
    });
  } catch (err) {
    logger.error('Failed to fetch reminders', err as Error, { userId: session.user.id });
    return error('Failed to fetch reminders', 'INTERNAL');
  }
}

export async function getReminder(id: string): Promise<ActionResult<Reminder>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = z.string().uuid('Invalid reminder ID').safeParse(id);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  try {
    const [reminder] = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)));

    if (!reminder) {
      return error('Reminder not found', 'NOT_FOUND');
    }

    return success(reminder);
  } catch (err) {
    logger.error('Failed to fetch reminder', err as Error, { userId: session.user.id, reminderId: id });
    return error('Failed to fetch reminder', 'INTERNAL');
  }
}

export async function createReminder(
  input: z.infer<typeof createReminderSchema>
): Promise<ActionResult<Reminder>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = createReminderSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { message, remindAt, notifyVia, recurrence, recurrenceEndDate } = validation.data;

  try {
    // Validate notifyVia
    const validNotifyVia = NOTIFY_VIA_OPTIONS.map((o) => o.value);
    const finalNotifyVia: NotifyVia =
      notifyVia && validNotifyVia.includes(notifyVia) ? notifyVia : 'email';

    // Validate recurrence
    const validRecurrence = RECURRENCE_OPTIONS.map((o) => o.value);
    const finalRecurrence: Recurrence | null =
      recurrence && validRecurrence.includes(recurrence) ? recurrence : null;

    const [reminder] = await db
      .insert(reminders)
      .values({
        userId: session.user.id,
        message,
        remindAt: remindAt ? new Date(remindAt) : null,
        notifyVia: finalNotifyVia,
        recurrence: finalRecurrence || null,
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        status: 'pending',
      })
      .returning();

    logger.info('Reminder created', {
      userId: session.user.id,
      reminderId: reminder.id,
      notifyVia: finalNotifyVia,
      recurrence: finalRecurrence,
    });

    revalidatePath('/reminders');
    revalidatePath('/dashboard');

    return success(reminder);
  } catch (err) {
    logger.error('Failed to create reminder', err as Error, { userId: session.user.id });
    return error('Failed to create reminder', 'INTERNAL');
  }
}

export async function updateReminder(
  input: z.infer<typeof updateReminderSchema>
): Promise<ActionResult<Reminder>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = updateReminderSchema.safeParse(input);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  const { id, message, remindAt, status, notifyVia, recurrence, recurrenceEndDate } = validation.data;

  try {
    const [existing] = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)));

    if (!existing) {
      return error('Reminder not found', 'NOT_FOUND');
    }

    // Validate notifyVia if provided
    const validNotifyVia = NOTIFY_VIA_OPTIONS.map((o) => o.value);
    const finalNotifyVia: NotifyVia | undefined =
      notifyVia && validNotifyVia.includes(notifyVia) ? notifyVia : undefined;

    // Validate recurrence if provided
    const validRecurrence = RECURRENCE_OPTIONS.map((o) => o.value);
    const finalRecurrence: Recurrence | null | undefined =
      recurrence !== undefined
        ? (recurrence && validRecurrence.includes(recurrence) ? recurrence : null)
        : undefined;

    const [updated] = await db
      .update(reminders)
      .set({
        ...(message && { message }),
        ...(remindAt !== undefined && { remindAt: remindAt ? new Date(remindAt) : null }),
        ...(status && { status }),
        ...(finalNotifyVia && { notifyVia: finalNotifyVia }),
        ...(finalRecurrence !== undefined && { recurrence: finalRecurrence || null }),
        ...(recurrenceEndDate !== undefined && { recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null }),
        updatedAt: new Date(),
      })
      .where(eq(reminders.id, id))
      .returning();

    logger.info('Reminder updated', { userId: session.user.id, reminderId: id });
    revalidatePath('/reminders');
    revalidatePath('/dashboard');
    revalidatePath(`/reminders/${id}`);

    return success(updated);
  } catch (err) {
    logger.error('Failed to update reminder', err as Error, { userId: session.user.id, reminderId: id });
    return error('Failed to update reminder', 'INTERNAL');
  }
}

export async function deleteReminder(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session?.user) {
    return error('Unauthorized', 'UNAUTHORIZED');
  }

  const validation = z.string().uuid('Invalid reminder ID').safeParse(id);
  if (!validation.success) {
    return error(validation.error.issues[0].message, 'VALIDATION');
  }

  try {
    const [reminder] = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)));

    if (!reminder) {
      return error('Reminder not found', 'NOT_FOUND');
    }

    await db.delete(reminders).where(eq(reminders.id, id));

    logger.info('Reminder deleted', { userId: session.user.id, reminderId: id });
    revalidatePath('/reminders');
    revalidatePath('/dashboard');

    return success(undefined);
  } catch (err) {
    logger.error('Failed to delete reminder', err as Error, { userId: session.user.id, reminderId: id });
    return error('Failed to delete reminder', 'INTERNAL');
  }
}

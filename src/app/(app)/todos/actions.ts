'use server';

import { db } from '@/db';
import { todos } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { Todo } from '@/db/schema';

export type TodoItem = Todo;

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function getTodos(): Promise<{ pending: TodoItem[]; completed: TodoItem[] }> {
  const session = await getSession();

  const allTodos = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, session.user.id))
    .orderBy(desc(todos.createdAt));

  return {
    pending: allTodos.filter((t) => t.status === 'pending'),
    completed: allTodos.filter((t) => t.status === 'completed'),
  };
}

export async function createTodo(data: {
  title: string;
  description?: string;
  positionX?: number;
  positionY?: number;
  dueDate?: Date | null;
}): Promise<TodoItem> {
  const session = await getSession();

  const [todo] = await db
    .insert(todos)
    .values({
      userId: session.user.id,
      title: data.title,
      description: data.description || null,
      positionX: data.positionX ?? 50,
      positionY: data.positionY ?? 50,
      dueDate: data.dueDate || null,
    })
    .returning();

  revalidatePath('/todos');
  return todo;
}

export async function updateTodo(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    positionX: number;
    positionY: number;
    dueDate: Date | null;
  }>
): Promise<TodoItem | null> {
  const session = await getSession();

  const [todo] = await db
    .update(todos)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)))
    .returning();

  revalidatePath('/todos');
  return todo || null;
}

export async function updateTodoPosition(
  id: string,
  positionX: number,
  positionY: number
): Promise<TodoItem | null> {
  const session = await getSession();

  const [todo] = await db
    .update(todos)
    .set({
      positionX: Math.max(0, Math.min(100, Math.round(positionX))),
      positionY: Math.max(0, Math.min(100, Math.round(positionY))),
      updatedAt: new Date(),
    })
    .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)))
    .returning();

  revalidatePath('/todos');
  return todo || null;
}

export async function deleteTodo(id: string): Promise<boolean> {
  const session = await getSession();

  await db
    .delete(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)));

  revalidatePath('/todos');
  return true;
}

export async function completeTodo(id: string): Promise<TodoItem | null> {
  const session = await getSession();

  const [todo] = await db
    .update(todos)
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)))
    .returning();

  revalidatePath('/todos');
  return todo || null;
}

export async function uncompleteTodo(id: string): Promise<TodoItem | null> {
  const session = await getSession();

  const [todo] = await db
    .update(todos)
    .set({
      status: 'pending',
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)))
    .returning();

  revalidatePath('/todos');
  return todo || null;
}

import { NextRequest, NextResponse } from 'next/server';
import { db, reminders } from '@/db';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [reminder] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)));

  if (!reminder) {
    return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
  }

  return NextResponse.json(reminder);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { message, remindAt, status } = body;

  const [reminder] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)));

  if (!reminder) {
    return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(reminders)
    .set({
      ...(message && { message }),
      ...(remindAt !== undefined && { remindAt: remindAt ? new Date(remindAt) : null }),
      ...(status && { status }),
      updatedAt: new Date(),
    })
    .where(eq(reminders.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [reminder] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)));

  if (!reminder) {
    return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
  }

  await db.delete(reminders).where(eq(reminders.id, id));

  return NextResponse.json({ success: true });
}

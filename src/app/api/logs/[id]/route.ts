import { NextRequest, NextResponse } from 'next/server';
import { db, emailLogs } from '@/db';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { processWithAgent, getUserContext, type ToolExecutionResult } from '@/lib/ai';

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

  const [log] = await db
    .select()
    .from(emailLogs)
    .where(and(eq(emailLogs.id, id), eq(emailLogs.userId, session.user.id)));

  if (!log) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 });
  }

  return NextResponse.json(log);
}

// Reprocess a failed email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [log] = await db
    .select()
    .from(emailLogs)
    .where(and(eq(emailLogs.id, id), eq(emailLogs.userId, session.user.id)));

  if (!log) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 });
  }

  try {
    const input = `${log.subject ? log.subject + '\n\n' : ''}${log.body}`;
    const context = await getUserContext(session.user.id);
    const response = await processWithAgent(session.user.id, input, context);

    const firstToolResult = response.toolResults?.[0];
    const success = firstToolResult?.success ?? false;

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
        status: success ? 'processed' : 'failed',
        errorMessage: success ? null : (firstToolResult ? (firstToolResult as ToolExecutionResult & { success: false }).error : null),
        relatedNoteId: noteId,
        relatedReminderId: reminderId,
      })
      .where(eq(emailLogs.id, id));

    return NextResponse.json({
      success: true,
      message: response.message,
      toolResults: response.toolResults,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reprocessing failed' },
      { status: 500 }
    );
  }
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

  const [log] = await db
    .select()
    .from(emailLogs)
    .where(and(eq(emailLogs.id, id), eq(emailLogs.userId, session.user.id)));

  if (!log) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 });
  }

  await db.delete(emailLogs).where(eq(emailLogs.id, id));

  return NextResponse.json({ success: true });
}

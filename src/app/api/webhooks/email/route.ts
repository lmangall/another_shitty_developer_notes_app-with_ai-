import { NextRequest, NextResponse } from 'next/server';
import { db, users, emailLogs } from '@/db';
import { eq } from 'drizzle-orm';
import { processWithAgent, getUserContext, type AgentResponse, type ToolExecutionResult } from '@/lib/ai';
import type { NewEmailLog } from '@/db/schema';
import crypto from 'crypto';

// Verify Resend webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Log email processing with the new agent response format
async function logEmailProcessing(
  log: NewEmailLog,
  response: AgentResponse | null,
  error?: string
): Promise<void> {
  const firstToolResult = response?.toolResults?.[0];
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

  await db.insert(emailLogs).values({
    ...log,
    aiResult: response ? { message: response.message, toolResults: response.toolResults } : null,
    actionType: firstToolResult?.action ?? null,
    status: success ? 'processed' : 'failed',
    errorMessage: error || (!success && firstToolResult ? (firstToolResult as ToolExecutionResult & { success: false }).error : null),
    relatedNoteId: noteId,
    relatedReminderId: reminderId,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('svix-signature');
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  // Verify webhook signature if secret is configured
  if (webhookSecret && signature) {
    try {
      if (!verifySignature(body, signature, webhookSecret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch {
      // Continue without verification in development
      console.warn('Webhook signature verification failed');
    }
  }

  const payload = JSON.parse(body);
  const { type, data } = payload;

  // Handle email.received event
  if (type !== 'email.received') {
    return NextResponse.json({ message: 'Event type not handled' });
  }

  const { from, to, subject, text, html } = data;

  // Extract user ID from email address (format: {user-id}@domain.com)
  const toAddress = Array.isArray(to) ? to[0] : to;
  const match = toAddress.match(/^([^@]+)@/);

  if (!match) {
    console.error('Invalid email format:', toAddress);
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const userIdOrEmail = match[1];

  // Try to find user by ID or email
  let user = await db
    .select()
    .from(users)
    .where(eq(users.id, userIdOrEmail))
    .then(rows => rows[0]);

  if (!user) {
    // Try to find by email
    const fromEmail = Array.isArray(from) ? from[0] : from;
    user = await db
      .select()
      .from(users)
      .where(eq(users.email, fromEmail))
      .then(rows => rows[0]);
  }

  if (!user) {
    console.error('User not found for email:', from);
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Use plain text or strip HTML
  const emailBody = text || html?.replace(/<[^>]*>/g, '') || '';
  const input = `${subject ? subject + '\n\n' : ''}${emailBody}`;

  const emailLog: NewEmailLog = {
    userId: user.id,
    fromEmail: Array.isArray(from) ? from[0] : from,
    toEmail: toAddress,
    subject: subject || null,
    body: emailBody,
  };

  try {
    // Get user context and process with the AI agent
    const context = await getUserContext(user.id);
    const response = await processWithAgent(user.id, input, context);

    // Log the email processing
    await logEmailProcessing(emailLog, response);

    return NextResponse.json({
      success: true,
      message: response.message,
      toolResults: response.toolResults,
    });
  } catch (error) {
    console.error('Email processing error:', error);

    // Log failed processing
    await logEmailProcessing(
      emailLog,
      null,
      error instanceof Error ? error.message : 'Processing failed'
    );

    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

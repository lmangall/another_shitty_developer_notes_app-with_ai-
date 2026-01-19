import { NextRequest, NextResponse } from 'next/server';
import { db, users, emailLogs } from '@/db';
import { eq } from 'drizzle-orm';
import { processWithAgent, getUserContext, type AgentResponse, type ToolExecutionResult } from '@/lib/ai';
import type { NewEmailLog } from '@/db/schema';
import crypto from 'crypto';
import { isEmailWhitelisted } from '@/lib/constants';
import { createLogger } from '@/lib/logger';

const RESEND_API_BASE_URL = 'https://api.resend.com';

/**
 * Fetch full email content from Resend API.
 * Webhooks do NOT include the email body - only metadata.
 * See: https://resend.com/docs/dashboard/receiving/get-email-content
 */
async function fetchFullEmail(emailId: string): Promise<{ text: string | null; html: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const url = `${RESEND_API_BASE_URL}/emails/receiving/${emailId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch email from Resend API: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    text: data.text || null,
    html: data.html || null,
  };
}

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
  const log = createLogger({ requestId: crypto.randomUUID() });

  log.info('Email webhook received');

  const body = await request.text();
  const signature = request.headers.get('svix-signature');
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  // Verify webhook signature if secret is configured
  if (webhookSecret && signature) {
    try {
      if (!verifySignature(body, signature, webhookSecret)) {
        log.warn('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch {
      log.warn('Webhook signature verification failed, continuing without verification');
    }
  }

  const payload = JSON.parse(body);
  const { type, data } = payload;

  // Handle email.received event
  if (type !== 'email.received') {
    log.info('Ignoring non-email.received event', { eventType: type });
    return NextResponse.json({ message: 'Event type not handled' });
  }

  const { from, to, subject, email_id } = data;
  const fromEmail = Array.isArray(from) ? from[0] : from;
  const toAddress = Array.isArray(to) ? to[0] : to;

  log.info('Processing inbound email', { from: fromEmail, to: toAddress, subject, emailId: email_id });

  // Check if sender email is whitelisted
  if (!isEmailWhitelisted(fromEmail)) {
    log.warn('Email from non-whitelisted address rejected', { fromEmail });
    return NextResponse.json({ error: 'Sender not authorized' }, { status: 403 });
  }

  // Extract user ID from email address (format: {user-id}@domain.com)
  const match = toAddress.match(/^([^@]+)@/);

  if (!match) {
    log.error('Invalid email format', undefined, { toAddress });
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
    user = await db
      .select()
      .from(users)
      .where(eq(users.email, fromEmail))
      .then(rows => rows[0]);
  }

  if (!user) {
    log.error('User not found for email', undefined, { fromEmail });
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  log.info('User identified', { userId: user.id, userEmail: user.email });

  // Fetch full email content from Resend API (webhooks don't include body)
  let text: string | null = null;
  let html: string | null = null;

  try {
    log.info('Fetching full email content from Resend API', { emailId: email_id });
    const fullEmail = await fetchFullEmail(email_id);
    text = fullEmail.text;
    html = fullEmail.html;
    log.info('Fetched email content', {
      emailId: email_id,
      hasText: !!text,
      hasHtml: !!html,
      textLength: text?.length || 0
    });
  } catch (fetchError) {
    log.error('Failed to fetch full email content', fetchError, { emailId: email_id });
    // Continue with empty body - AI will ask for clarification
  }

  // Use plain text or strip HTML
  const emailBody = text || html?.replace(/<[^>]*>/g, '') || '';
  const input = `${subject ? subject + '\n\n' : ''}${emailBody}`;

  const emailLog: NewEmailLog = {
    userId: user.id,
    fromEmail,
    toEmail: toAddress,
    subject: subject || null,
    body: emailBody,
  };

  try {
    // Get user context and process with the AI agent
    log.info('Processing with AI agent', { userId: user.id });
    const context = await getUserContext(user.id);
    const response = await processWithAgent(user.id, input, context);

    // Log the email processing
    await logEmailProcessing(emailLog, response);

    log.info('Email processed successfully', {
      userId: user.id,
      message: response.message,
      toolResults: response.toolResults?.map(r => ({ action: r.action, success: r.success })),
    });

    return NextResponse.json({
      success: true,
      message: response.message,
      toolResults: response.toolResults,
    });
  } catch (error) {
    log.error('Email processing failed', error, { userId: user.id });

    // Log failed processing
    await logEmailProcessing(
      emailLog,
      null,
      error instanceof Error ? error.message : 'Processing failed'
    );

    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

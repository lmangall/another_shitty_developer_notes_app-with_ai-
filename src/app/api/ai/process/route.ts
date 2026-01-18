import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { processWithAgent, getUserContext } from '@/lib/ai';

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { input, timezone } = body;

  if (!input || typeof input !== 'string') {
    return NextResponse.json(
      { error: 'Input is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch user's existing notes and reminders for context
    const context = await getUserContext(session.user.id);

    // Process with the AI agent - it will decide what tools to use
    const response = await processWithAgent(
      session.user.id,
      input,
      context,
      timezone
    );

    return NextResponse.json({
      message: response.message,
      toolResults: response.toolResults,
    });
  } catch (error) {
    console.error('AI processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process input' },
      { status: 500 }
    );
  }
}

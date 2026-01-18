# Notes App

Next.js app with Better Auth authentication, AI-powered note/reminder processing, Neon serverless PostgreSQL, and Resend emails.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** Better Auth (email/password + Google OAuth)
- **Database:** Drizzle ORM + Neon Serverless PostgreSQL
- **AI:** Vercel AI SDK + Anthropic Claude
- **Email:** Resend
- **Styling:** Tailwind CSS v4
- **Validation:** Zod
- **Monitoring:** UptimeRobot (pings `/api/cron/check-reminders`)

**Status Page:** https://stats.uptimerobot.com/KgPXHJZr4i

---

## Server vs Client Components

**Use Server Components (default):**
- Data fetching at component level
- No interactivity needed
- SEO-friendly content
- Direct database access

**Use Client Components (`"use client"`):**
- Interactive UI (forms, buttons with state)
- Browser APIs (localStorage, speech recognition)
- Event handlers (onClick, onChange)

---

## AI SDK Patterns

**Structured Output with `generateObject()`:**
```typescript
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const model = anthropic('claude-sonnet-4-20250514');

const schema = z.object({
  title: z.string(),
  content: z.string(),
});

const { object } = await generateObject({
  model,
  schema,
  prompt: `Extract data from: "${input}"`,
});
```

**Best Practices:**
- Use Zod schemas to constrain model outputs
- Keep API keys server-side (use Server Actions or API routes)
- Use `generateObject()` for predictable structured data
- Use `streamText()` for chat/conversational responses

---

## Better Auth Setup

**Server-side auth check:**
```typescript
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

const session = await auth.api.getSession({
  headers: await headers(),
});

if (!session) {
  redirect('/login');
}
```

**Client-side auth:**
```typescript
import { authClient } from '@/lib/auth-client';

// Sign in
await authClient.signIn.email({ email, password });

// Sign out
await authClient.signOut();

// Get session
const session = await authClient.getSession();
```

---

## Drizzle ORM

**Schema Definition:**
```typescript
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Infer types from schema
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
```

**Queries:**
```typescript
import { db } from '@/db';
import { notes } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Select
const userNotes = await db.select().from(notes).where(eq(notes.userId, userId));

// Insert
await db.insert(notes).values({ userId, title, content });

// Update
await db.update(notes).set({ title }).where(eq(notes.id, id));

// Delete
await db.delete(notes).where(eq(notes.id, id));
```

**Migration Commands:**
```bash
npm run db:generate  # Generate migration
npm run db:migrate   # Run migration
npm run db:push      # Push schema (dev only)
npm run db:studio    # Open Drizzle Studio
```

**NEVER reset database or run destructive commands** without explicit user confirmation.

---

## Direct Database Operations (via Claude)

When the user asks to create, update, or delete notes, reminders, or tags directly via prompt, choose the appropriate method:

### Simple Operations → One-liner tsx
For single queries or simple operations (1-2 steps):
```bash
npx tsx -e "
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { notes } from './src/db/schema';
import 'dotenv/config';
const db = drizzle(neon(process.env.DATABASE_URL!));
console.log(await db.select().from(notes));
"
```

### Complex Operations → Script File
For multi-step operations (lookups, conditionals, multiple inserts):
```typescript
// scripts/task-name.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { users, notes, tags, noteTags, reminders } from '../src/db/schema';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Get user: const [user] = await db.select().from(users).limit(1);
// Then use user.id for userId in inserts
```

Run with: `npx tsx scripts/task-name.ts`

**IMPORTANT: Always delete script files after execution.** Do not leave temporary scripts in the codebase.

### Notes
- **title**: Short descriptive title
- **content**: Always use **markdown** (headers, lists, code blocks, tables, bold, etc.)
- **tags**: Auto-assign relevant tags based on content. Reuse existing tags or create new ones.

### Reminders
- **message**: The reminder text
- **remindAt**: DateTime for when to trigger (can be null)
- **notifyVia**: `email`, `push`, or `both`
- **status**: `pending` (default), `sent`, `cancelled`, `completed`

### Tags
Tags are dynamic and user-specific. When creating:
- Choose descriptive names (Work, Personal, Health, Finance, Learning, Ideas, Project, Urgent, etc.)
- Assign distinct hex colors: `#ef4444` (red), `#3b82f6` (blue), `#f59e0b` (amber), `#10b981` (emerald), `#ec4899` (pink), `#8b5cf6` (violet), `#06b6d4` (cyan), `#dc2626` (red-600)
- Link to notes via `noteTags` junction table (noteId, tagId)

---

## Resend Email

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: `App <noreply@${process.env.EMAIL_DOMAIN}>`,
  to: user.email,
  subject: 'Subject',
  html: '<p>Email body</p>',
});
```

---

## Constants Pattern

Use `as const` arrays for dropdown values (not enums):

```typescript
export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
] as const;

export type StatusValue = (typeof STATUS_OPTIONS)[number]['value'];
```

---

## Form Patterns

Use Zod for validation with react-hook-form:

```typescript
"use client";

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

type FormData = z.infer<typeof formSchema>;

export function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '' },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

---

## API Routes

**Route Handler Pattern:**
```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Handle request
  return NextResponse.json({ data });
}
```

---

## Git Conventions

- **Commit style:** One-line conventional commits
- **Format:** `type: description` (feat, fix, refactor, docs, chore)
- **No Claude mentions** in commit messages

Examples:
```
feat: add user authentication
fix: resolve login redirect issue
refactor: simplify form validation
```

---

## Security

- Never commit `.env.local` or secrets
- Validate all user inputs with Zod
- Always check session before database operations
- Use parameterized queries (Drizzle handles this)
- Be careful with SQL queries (avoid injection)

---

## Server-Side Logging

**Always use the logger for server-side code** (API routes, server actions, cron jobs). Never use bare `console.log()` statements.

```typescript
import { logger, createLogger } from '@/lib/logger';

// Basic usage
logger.info('User created note', { userId, noteId });
logger.warn('Rate limit approaching', { userId, count: 95 });
logger.error('Failed to send email', error, { userId, reminderId });
logger.debug('Query result', { query, resultCount }); // Only logs in development

// Create a logger with pre-bound context (recommended for API routes)
export async function POST(request: Request) {
  const log = createLogger({ requestId: crypto.randomUUID() });

  log.info('Processing request');
  // All subsequent logs include requestId automatically
}
```

**When to log:**
- API route entry/exit with key parameters
- Database operations (especially mutations)
- External service calls (AI, email)
- Errors with full context
- Cron job execution summaries

**Best Practices:**
- Include `userId` in context when available
- Use `createLogger()` with `requestId` for request tracing
- Log errors with the actual Error object for stack traces
- Use `debug` level for verbose development-only logs
- Never log sensitive data (passwords, tokens, full emails)
- **Add logging to new features** - when adding API routes or server actions, include appropriate logs

---

## Slash Commands

Available via `/command`:
- `/commit` - Auto-commit current changes
- `/db` - Database task helper

---

## Project Structure

```
src/
├── app/
│   ├── (app)/           # Authenticated routes
│   ├── (auth)/          # Auth routes (login)
│   └── api/             # API routes
├── components/
│   ├── ui/              # Shadcn components
│   └── layout/          # Layout components
├── db/
│   ├── index.ts         # Database connection
│   └── schema.ts        # Drizzle schema
├── lib/
│   ├── auth.ts          # Better Auth config
│   ├── auth-client.ts   # Client auth
│   ├── ai.ts            # AI processing
│   ├── email.ts         # Resend email
│   └── logger.ts        # Server-side logging
└── types/               # TypeScript types
```

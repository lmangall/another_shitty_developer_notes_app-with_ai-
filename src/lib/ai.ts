import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { db, notes, reminders, tags, noteTags } from '@/db';
import { eq, desc, and, ilike, or } from 'drizzle-orm';

// Use Vercel AI Gateway with claude
const model = gateway('anthropic/claude-sonnet-4.5');

// User context for AI
export interface UserContext {
  notes: { id: string; title: string; preview: string; updatedAt: Date }[];
  reminders: { id: string; message: string; remindAt: Date | null; status: string }[];
  tags: { id: string; name: string; color: string }[];
}

export async function getUserContext(userId: string): Promise<UserContext> {
  const [userNotes, userReminders, userTags] = await Promise.all([
    db
      .select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt))
      .limit(20),
    db
      .select({
        id: reminders.id,
        message: reminders.message,
        remindAt: reminders.remindAt,
        status: reminders.status,
      })
      .from(reminders)
      .where(eq(reminders.userId, userId))
      .orderBy(desc(reminders.createdAt))
      .limit(20),
    db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(tags.name),
  ]);

  return {
    notes: userNotes.map((n) => ({
      id: n.id,
      title: n.title,
      preview: n.content.slice(0, 100),
      updatedAt: n.updatedAt,
    })),
    reminders: userReminders.map((r) => ({
      id: r.id,
      message: r.message,
      remindAt: r.remindAt,
      status: r.status,
    })),
    tags: userTags,
  };
}

function formatContextForPrompt(context: UserContext): string {
  let contextStr = '';

  if (context.notes.length > 0) {
    contextStr += '\n\nYour existing Notes:\n';
    context.notes.forEach((note, i) => {
      contextStr += `${i + 1}. [ID: ${note.id}] "${note.title}" - ${note.preview}...\n`;
    });
  } else {
    contextStr += '\n\nYou have no existing notes.\n';
  }

  if (context.reminders.length > 0) {
    contextStr += '\n\nYour existing Reminders:\n';
    context.reminders.forEach((reminder, i) => {
      const timeStr = reminder.remindAt
        ? ` (scheduled: ${reminder.remindAt.toLocaleString()})`
        : ' (no time set)';
      contextStr += `${i + 1}. [ID: ${reminder.id}] [${reminder.status}] "${reminder.message}"${timeStr}\n`;
    });
  } else {
    contextStr += '\n\nYou have no existing reminders.\n';
  }

  if (context.tags.length > 0) {
    contextStr += '\n\nYour available Tags:\n';
    contextStr += context.tags.map(t => t.name).join(', ');
    contextStr += '\n';
  } else {
    contextStr += '\n\nYou have no tags yet.\n';
  }

  return contextStr;
}

// Tool schemas
const createNoteSchema = z.object({
  title: z.string().describe('A concise, descriptive title for the note'),
  content: z.string().describe('The full content of the note, formatted as clean markdown if appropriate'),
  tags: z.array(z.string()).optional().describe('1-3 relevant tag names from the user\'s available tags to assign to this note'),
});

const editNoteSchema = z.object({
  searchQuery: z.string().describe('Query to find the note to edit - use the exact title or keywords from the note'),
  newTitle: z.string().optional().describe('New title if the user wants to rename the note'),
  newContent: z.string().optional().describe('New content to replace the existing content'),
  appendContent: z.string().optional().describe('Content to add at the end of the existing note'),
});

const deleteNoteSchema = z.object({
  searchQuery: z.string().describe('Query to find the note to delete - use the exact title or keywords from the note'),
});

const createReminderSchema = z.object({
  message: z.string().describe('The reminder message - what the user wants to be reminded about'),
  remindAt: z.string().nullable().describe('ISO datetime string for when to send the reminder, or null if no specific time mentioned'),
});

const cancelReminderSchema = z.object({
  searchQuery: z.string().describe('Query to find the reminder to cancel - use keywords from the reminder message'),
});

// Tool result types
export interface ToolResultSuccess {
  success: true;
  action: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ToolResultError {
  success: false;
  action: string;
  error: string;
}

export type ToolExecutionResult = ToolResultSuccess | ToolResultError;

export interface AgentResponse {
  message: string;
  toolResults: ToolExecutionResult[];
}

// Create tools with execute functions for AI SDK v6
function createTools(userId: string, userTags: { id: string; name: string }[]) {
  return {
    createNote: {
      description: 'Create a new note with a title and content. Use this when the user wants to save information, write something down, or create a new note. When creating a note, suggest 1-3 relevant tags from the user\'s available tags.',
      inputSchema: createNoteSchema,
      execute: async ({ title, content, tags: tagNames }: z.infer<typeof createNoteSchema>): Promise<ToolExecutionResult> => {
        try {
          const [note] = await db
            .insert(notes)
            .values({ userId, title, content })
            .returning();

          // Link suggested tags to the note
          const assignedTags: string[] = [];
          if (tagNames && tagNames.length > 0) {
            // Find matching tags by name (case-insensitive)
            const matchingTags = userTags.filter(t =>
              tagNames.some(name => name.toLowerCase() === t.name.toLowerCase())
            );

            if (matchingTags.length > 0) {
              await db.insert(noteTags).values(
                matchingTags.map(tag => ({
                  noteId: note.id,
                  tagId: tag.id,
                }))
              );
              assignedTags.push(...matchingTags.map(t => t.name));
            }
          }

          let message = `Created note: "${note.title}"`;
          if (assignedTags.length > 0) {
            message += ` with tags: ${assignedTags.join(', ')}`;
          }

          return {
            success: true,
            action: 'createNote',
            message,
            data: { noteId: note.id, title: note.title, tags: assignedTags },
          };
        } catch (error) {
          return {
            success: false,
            action: 'createNote',
            error: error instanceof Error ? error.message : 'Failed to create note',
          };
        }
      },
    },

    editNote: {
      description: 'Edit an existing note. Use this when the user wants to update, modify, or add to an existing note. You can change the title, replace the content, or append to it.',
      inputSchema: editNoteSchema,
      execute: async ({ searchQuery, newTitle, newContent, appendContent }: z.infer<typeof editNoteSchema>): Promise<ToolExecutionResult> => {
        try {
          const existingNotes = await db
            .select()
            .from(notes)
            .where(
              and(
                eq(notes.userId, userId),
                or(
                  ilike(notes.title, `%${searchQuery}%`),
                  ilike(notes.content, `%${searchQuery}%`)
                )
              )
            )
            .orderBy(desc(notes.updatedAt))
            .limit(1);

          if (existingNotes.length === 0) {
            return {
              success: false,
              action: 'editNote',
              error: `No note found matching "${searchQuery}"`,
            };
          }

          const note = existingNotes[0];
          const updates: { title?: string; content?: string; updatedAt: Date } = {
            updatedAt: new Date(),
          };

          if (newTitle) updates.title = newTitle;
          if (newContent) updates.content = newContent;
          if (appendContent) {
            updates.content = note.content + '\n\n' + appendContent;
          }

          const [updated] = await db
            .update(notes)
            .set(updates)
            .where(eq(notes.id, note.id))
            .returning();

          return {
            success: true,
            action: 'editNote',
            message: `Updated note: "${updated.title}"`,
            data: { noteId: updated.id, title: updated.title },
          };
        } catch (error) {
          return {
            success: false,
            action: 'editNote',
            error: error instanceof Error ? error.message : 'Failed to edit note',
          };
        }
      },
    },

    deleteNote: {
      description: 'Delete an existing note. Use this when the user wants to remove or delete a note.',
      inputSchema: deleteNoteSchema,
      execute: async ({ searchQuery }: z.infer<typeof deleteNoteSchema>): Promise<ToolExecutionResult> => {
        try {
          const existingNotes = await db
            .select()
            .from(notes)
            .where(
              and(
                eq(notes.userId, userId),
                or(
                  ilike(notes.title, `%${searchQuery}%`),
                  ilike(notes.content, `%${searchQuery}%`)
                )
              )
            )
            .orderBy(desc(notes.updatedAt))
            .limit(1);

          if (existingNotes.length === 0) {
            return {
              success: false,
              action: 'deleteNote',
              error: `No note found matching "${searchQuery}"`,
            };
          }

          const note = existingNotes[0];
          await db.delete(notes).where(eq(notes.id, note.id));

          return {
            success: true,
            action: 'deleteNote',
            message: `Deleted note: "${note.title}"`,
          };
        } catch (error) {
          return {
            success: false,
            action: 'deleteNote',
            error: error instanceof Error ? error.message : 'Failed to delete note',
          };
        }
      },
    },

    createReminder: {
      description: 'Create a reminder to notify the user at a specific time. Use this when the user wants to be reminded about something.',
      inputSchema: createReminderSchema,
      execute: async ({ message, remindAt }: z.infer<typeof createReminderSchema>): Promise<ToolExecutionResult> => {
        try {
          const remindAtDate = remindAt ? new Date(remindAt) : null;
          const [reminder] = await db
            .insert(reminders)
            .values({
              userId,
              message,
              remindAt: remindAtDate,
              status: 'pending',
              notifyVia: 'both', // Default to both push and email for agent-created reminders
            })
            .returning();

          let resultMessage = `Created reminder: "${reminder.message}"`;
          if (reminder.remindAt) {
            resultMessage += ` for ${reminder.remindAt.toLocaleString()}`;
          }

          return {
            success: true,
            action: 'createReminder',
            message: resultMessage,
            data: {
              reminderId: reminder.id,
              message: reminder.message,
              remindAt: reminder.remindAt?.toISOString() || null,
            },
          };
        } catch (error) {
          return {
            success: false,
            action: 'createReminder',
            error: error instanceof Error ? error.message : 'Failed to create reminder',
          };
        }
      },
    },

    cancelReminder: {
      description: 'Cancel a pending reminder. Use this when the user wants to cancel or remove an existing reminder.',
      inputSchema: cancelReminderSchema,
      execute: async ({ searchQuery }: z.infer<typeof cancelReminderSchema>): Promise<ToolExecutionResult> => {
        try {
          const existingReminders = await db
            .select()
            .from(reminders)
            .where(
              and(
                eq(reminders.userId, userId),
                eq(reminders.status, 'pending'),
                ilike(reminders.message, `%${searchQuery}%`)
              )
            )
            .orderBy(desc(reminders.createdAt))
            .limit(1);

          if (existingReminders.length === 0) {
            return {
              success: false,
              action: 'cancelReminder',
              error: `No pending reminder found matching "${searchQuery}"`,
            };
          }

          const reminder = existingReminders[0];
          await db
            .update(reminders)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(reminders.id, reminder.id));

          return {
            success: true,
            action: 'cancelReminder',
            message: `Cancelled reminder: "${reminder.message}"`,
          };
        } catch (error) {
          return {
            success: false,
            action: 'cancelReminder',
            error: error instanceof Error ? error.message : 'Failed to cancel reminder',
          };
        }
      },
    },
  };
}

export async function processWithAgent(
  userId: string,
  input: string,
  context: UserContext,
  userTimezone?: string
): Promise<AgentResponse> {
  const now = new Date();
  const timezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOffset = now.getTimezoneOffset();
  const offsetHours = Math.abs(Math.floor(timezoneOffset / 60));
  const offsetMinutes = Math.abs(timezoneOffset % 60);
  const offsetSign = timezoneOffset <= 0 ? '+' : '-';
  const offsetString = `UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;

  const localTimeString = now.toLocaleString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const contextStr = formatContextForPrompt(context);
  const tools = createTools(userId, context.tags);

  const systemPrompt = `You are a helpful assistant that manages notes and reminders for the user.
You have access to tools to create, edit, and delete notes, as well as create and cancel reminders.

Current local time: ${localTimeString}
Timezone: ${timezone} (${offsetString})

IMPORTANT for reminders: When the user specifies a time, convert it to an ISO datetime string accounting for their timezone (${timezone}).
For relative times like "in 2 hours" or "tomorrow at 3pm", calculate the actual datetime based on the current time.

IMPORTANT for notes: When creating a note, analyze the content and suggest 1-3 relevant tags from the user's available tags. Only use tags that exist in the user's tag list.

${contextStr}

Based on the user's request, decide which tool(s) to use. If the user's request doesn't match any of your tools (like asking a general question), just respond conversationally without using tools.

Always be helpful and confirm what action you took.`;

  const result = await generateText({
    model,
    tools,
    system: systemPrompt,
    prompt: input,
  });

  // Collect tool results - in AI SDK v6, toolResults contains the execute() return values directly
  const toolResults: ToolExecutionResult[] = [];
  if (result.toolResults && result.toolResults.length > 0) {
    for (const tr of result.toolResults) {
      // The tool result is the direct return value from execute()
      const execResult = tr as unknown as ToolExecutionResult;
      if (execResult && typeof execResult === 'object' && 'success' in execResult) {
        toolResults.push(execResult);
      }
    }
  }

  return {
    message: result.text,
    toolResults,
  };
}

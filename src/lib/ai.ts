import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { db, notes, reminders, tags, noteTags, todos } from '@/db';
import { userIntegrations } from '@/db/schema';
import { eq, desc, and, ilike, or } from 'drizzle-orm';
import { getGoogleCalendarTools } from './composio';
import { logger } from './logger';

// Use Vercel AI Gateway with claude
export const model = gateway('anthropic/claude-sonnet-4.5');

// User context for AI
export interface UserContext {
  notes: { id: string; title: string; preview: string; updatedAt: Date }[];
  reminders: { id: string; message: string; remindAt: Date | null; status: string }[];
  todos: { id: string; title: string; description: string | null; status: string; dueDate: Date | null; positionX: number; positionY: number }[];
  tags: { id: string; name: string; color: string }[];
  integrations?: { provider: string; connectedAccountId: string }[];
}

export async function getUserContext(userId: string): Promise<UserContext> {
  const [userNotes, userReminders, userTodos, userTags, userIntegrationsData] = await Promise.all([
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
        id: todos.id,
        title: todos.title,
        description: todos.description,
        status: todos.status,
        dueDate: todos.dueDate,
        positionX: todos.positionX,
        positionY: todos.positionY,
      })
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.status, 'pending')))
      .orderBy(desc(todos.createdAt))
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
    db
      .select({
        provider: userIntegrations.provider,
        connectedAccountId: userIntegrations.connectedAccountId,
      })
      .from(userIntegrations)
      .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.status, 'active'))),
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
    todos: userTodos,
    tags: userTags,
    integrations: userIntegrationsData,
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

  if (context.todos.length > 0) {
    contextStr += '\n\nYour pending Todos:\n';
    context.todos.forEach((todo, i) => {
      const quadrant = getQuadrantName(todo.positionX, todo.positionY);
      const dueStr = todo.dueDate ? ` (due: ${todo.dueDate.toLocaleDateString()})` : '';
      contextStr += `${i + 1}. [ID: ${todo.id}] "${todo.title}" - ${quadrant}${dueStr}\n`;
    });
  } else {
    contextStr += '\n\nYou have no pending todos.\n';
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

function getQuadrantName(positionX: number, positionY: number): string {
  const isUrgent = positionX < 50;
  const isImportant = positionY < 50;
  if (isUrgent && isImportant) return 'Do First (urgent & important)';
  if (!isUrgent && isImportant) return 'Schedule (important, not urgent)';
  if (isUrgent && !isImportant) return 'Delegate (urgent, not important)';
  return 'Eliminate (not urgent, not important)';
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
  notifyVia: z.enum(['email', 'push', 'both']).optional().describe('How to send the notification: "email" for email only, "push" for push notification only, or "both" for both. Defaults to "both" if not specified.'),
});

const cancelReminderSchema = z.object({
  searchQuery: z.string().describe('Query to find the reminder to cancel - use keywords from the reminder message'),
});

const createTodoSchema = z.object({
  title: z.string().describe('A short, actionable task title'),
  description: z.string().optional().describe('Optional longer description of the task'),
  priority: z.enum(['do_first', 'schedule', 'delegate', 'eliminate']).optional().describe('Priority quadrant: "do_first" (urgent & important), "schedule" (important, not urgent), "delegate" (urgent, not important), "eliminate" (not urgent, not important). Defaults to "do_first" if not specified.'),
  dueDate: z.string().nullable().optional().describe('Optional ISO datetime string for when the task is due'),
});

const updateTodoSchema = z.object({
  searchQuery: z.string().describe('Query to find the todo to update - use keywords from the todo title'),
  newTitle: z.string().optional().describe('New title if the user wants to rename the todo'),
  newDescription: z.string().optional().describe('New description for the todo'),
  priority: z.enum(['do_first', 'schedule', 'delegate', 'eliminate']).optional().describe('New priority quadrant'),
  dueDate: z.string().nullable().optional().describe('New due date as ISO datetime string, or null to remove'),
});

const completeTodoSchema = z.object({
  searchQuery: z.string().describe('Query to find the todo to complete - use keywords from the todo title'),
});

const deleteTodoSchema = z.object({
  searchQuery: z.string().describe('Query to find the todo to delete - use keywords from the todo title'),
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
export function createTools(userId: string, userTags: { id: string; name: string }[]) {
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
      description: 'Create a reminder to notify the user at a specific time. Use this when the user wants to be reminded about something. Pay attention to how the user wants to be notified - if they mention "push notification", "push", or "notification on my phone/device", use notifyVia: "push". If they mention "email", use notifyVia: "email". If not specified, default to "both".',
      inputSchema: createReminderSchema,
      execute: async ({ message, remindAt, notifyVia }: z.infer<typeof createReminderSchema>): Promise<ToolExecutionResult> => {
        try {
          const remindAtDate = remindAt ? new Date(remindAt) : null;
          const notificationMethod = notifyVia || 'both';
          const [reminder] = await db
            .insert(reminders)
            .values({
              userId,
              message,
              remindAt: remindAtDate,
              status: 'pending',
              notifyVia: notificationMethod,
            })
            .returning();

          let resultMessage = `Created reminder: "${reminder.message}"`;
          if (reminder.remindAt) {
            resultMessage += ` for ${reminder.remindAt.toLocaleString()}`;
          }
          resultMessage += ` (via ${notificationMethod})`;

          return {
            success: true,
            action: 'createReminder',
            message: resultMessage,
            data: {
              reminderId: reminder.id,
              message: reminder.message,
              remindAt: reminder.remindAt?.toISOString() || null,
              notifyVia: notificationMethod,
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

    createTodo: {
      description: 'Create a new todo/task. Use this when the user wants to add a task, todo item, or something to their to-do list. Todos are organized by priority using the Eisenhower Matrix (urgent/important quadrants).',
      inputSchema: createTodoSchema,
      execute: async ({ title, description, priority, dueDate }: z.infer<typeof createTodoSchema>): Promise<ToolExecutionResult> => {
        try {
          // Convert priority to position coordinates
          const positions = priorityToPosition(priority || 'do_first');
          const dueDateValue = dueDate ? new Date(dueDate) : null;

          const [todo] = await db
            .insert(todos)
            .values({
              userId,
              title,
              description: description || null,
              positionX: positions.x,
              positionY: positions.y,
              dueDate: dueDateValue,
            })
            .returning();

          let message = `Created todo: "${todo.title}" in ${priority || 'do_first'} quadrant`;
          if (dueDateValue) {
            message += ` (due: ${dueDateValue.toLocaleDateString()})`;
          }

          return {
            success: true,
            action: 'createTodo',
            message,
            data: { todoId: todo.id, title: todo.title, priority: priority || 'do_first' },
          };
        } catch (error) {
          return {
            success: false,
            action: 'createTodo',
            error: error instanceof Error ? error.message : 'Failed to create todo',
          };
        }
      },
    },

    updateTodo: {
      description: 'Update an existing todo/task. Use this when the user wants to modify a task title, description, priority, or due date.',
      inputSchema: updateTodoSchema,
      execute: async ({ searchQuery, newTitle, newDescription, priority, dueDate }: z.infer<typeof updateTodoSchema>): Promise<ToolExecutionResult> => {
        try {
          const existingTodos = await db
            .select()
            .from(todos)
            .where(
              and(
                eq(todos.userId, userId),
                eq(todos.status, 'pending'),
                or(
                  ilike(todos.title, `%${searchQuery}%`),
                  ilike(todos.description, `%${searchQuery}%`)
                )
              )
            )
            .orderBy(desc(todos.createdAt))
            .limit(1);

          if (existingTodos.length === 0) {
            return {
              success: false,
              action: 'updateTodo',
              error: `No pending todo found matching "${searchQuery}"`,
            };
          }

          const todo = existingTodos[0];
          const updates: { title?: string; description?: string | null; positionX?: number; positionY?: number; dueDate?: Date | null; updatedAt: Date } = {
            updatedAt: new Date(),
          };

          if (newTitle) updates.title = newTitle;
          if (newDescription !== undefined) updates.description = newDescription;
          if (priority) {
            const positions = priorityToPosition(priority);
            updates.positionX = positions.x;
            updates.positionY = positions.y;
          }
          if (dueDate !== undefined) {
            updates.dueDate = dueDate ? new Date(dueDate) : null;
          }

          const [updated] = await db
            .update(todos)
            .set(updates)
            .where(eq(todos.id, todo.id))
            .returning();

          return {
            success: true,
            action: 'updateTodo',
            message: `Updated todo: "${updated.title}"`,
            data: { todoId: updated.id, title: updated.title },
          };
        } catch (error) {
          return {
            success: false,
            action: 'updateTodo',
            error: error instanceof Error ? error.message : 'Failed to update todo',
          };
        }
      },
    },

    completeTodo: {
      description: 'Mark a todo/task as completed. Use this when the user says they finished, completed, or done with a task.',
      inputSchema: completeTodoSchema,
      execute: async ({ searchQuery }: z.infer<typeof completeTodoSchema>): Promise<ToolExecutionResult> => {
        try {
          const existingTodos = await db
            .select()
            .from(todos)
            .where(
              and(
                eq(todos.userId, userId),
                eq(todos.status, 'pending'),
                or(
                  ilike(todos.title, `%${searchQuery}%`),
                  ilike(todos.description, `%${searchQuery}%`)
                )
              )
            )
            .orderBy(desc(todos.createdAt))
            .limit(1);

          if (existingTodos.length === 0) {
            return {
              success: false,
              action: 'completeTodo',
              error: `No pending todo found matching "${searchQuery}"`,
            };
          }

          const todo = existingTodos[0];
          await db
            .update(todos)
            .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
            .where(eq(todos.id, todo.id));

          return {
            success: true,
            action: 'completeTodo',
            message: `Completed todo: "${todo.title}"`,
          };
        } catch (error) {
          return {
            success: false,
            action: 'completeTodo',
            error: error instanceof Error ? error.message : 'Failed to complete todo',
          };
        }
      },
    },

    deleteTodo: {
      description: 'Delete a todo/task. Use this when the user wants to remove or delete a task from their list.',
      inputSchema: deleteTodoSchema,
      execute: async ({ searchQuery }: z.infer<typeof deleteTodoSchema>): Promise<ToolExecutionResult> => {
        try {
          const existingTodos = await db
            .select()
            .from(todos)
            .where(
              and(
                eq(todos.userId, userId),
                or(
                  ilike(todos.title, `%${searchQuery}%`),
                  ilike(todos.description, `%${searchQuery}%`)
                )
              )
            )
            .orderBy(desc(todos.createdAt))
            .limit(1);

          if (existingTodos.length === 0) {
            return {
              success: false,
              action: 'deleteTodo',
              error: `No todo found matching "${searchQuery}"`,
            };
          }

          const todo = existingTodos[0];
          await db.delete(todos).where(eq(todos.id, todo.id));

          return {
            success: true,
            action: 'deleteTodo',
            message: `Deleted todo: "${todo.title}"`,
          };
        } catch (error) {
          return {
            success: false,
            action: 'deleteTodo',
            error: error instanceof Error ? error.message : 'Failed to delete todo',
          };
        }
      },
    },
  };
}

function priorityToPosition(priority: string): { x: number; y: number } {
  switch (priority) {
    case 'do_first':
      return { x: 15, y: 15 }; // Urgent & Important (top-left)
    case 'schedule':
      return { x: 85, y: 15 }; // Not Urgent & Important (top-right)
    case 'delegate':
      return { x: 15, y: 85 }; // Urgent & Not Important (bottom-left)
    case 'eliminate':
      return { x: 85, y: 85 }; // Not Urgent & Not Important (bottom-right)
    default:
      return { x: 15, y: 15 }; // Default to Do First
  }
}

export function buildSystemPrompt(
  context: UserContext,
  userTimezone?: string,
  hasCalendarTools: boolean = false
): string {
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

  let systemPrompt = `You are a helpful assistant that manages notes, reminders, todos, and calendar events for the user.

Current local time: ${localTimeString}
Timezone: ${timezone} (${offsetString})

TOOL SELECTION GUIDE - Use the RIGHT tool for each request:

1. CALENDAR EVENTS (time-bound activities with others or scheduled commitments):
   Keywords: "appointment", "meeting", "schedule", "calendar", "event", "book", "reserve"
   Examples: "Add appointment with Robin", "Schedule a meeting", "Put X on my calendar"
   → Use GOOGLECALENDAR_CREATE_EVENT${hasCalendarTools ? '' : ' (NOT AVAILABLE - user needs to connect Google Calendar)'}

2. REMINDERS (notifications to remember something):
   Keywords: "remind me", "reminder", "don't forget", "alert me", "notify me"
   Examples: "Remind me to call mom", "Set a reminder for the meeting"
   → Use createReminder

3. TODOS (tasks to complete, action items):
   Keywords: "todo", "task", "to-do", "add to my list", "I need to", "action item"
   Examples: "Add a todo to buy groceries", "Create a task for...", "I need to finish the report"
   → Use createTodo (with priority: do_first, schedule, delegate, or eliminate)
   Priority quadrants (Eisenhower Matrix):
   - do_first: Urgent AND Important (deadlines, crises)
   - schedule: Important but NOT Urgent (planning, learning)
   - delegate: Urgent but NOT Important (interruptions, some emails)
   - eliminate: NOT Urgent and NOT Important (time wasters)

4. NOTES (information to save/reference later):
   Keywords: "note", "write down", "save", "jot down", "remember this info"
   Examples: "Make a note about...", "Save this recipe", "Write down these ideas"
   → Use createNote

CRITICAL: Choose the right tool:
- Calendar event = scheduled activity with a specific time (goes on calendar)
- Todo = task to complete, action item (goes on todo list)
- Note = saved information (for reference)
- Reminder = future notification (alerts the user)

A single request may need MULTIPLE tools. For example:
"Add appointment Sunday 7pm and remind me 24h before" → Calendar event + Reminder(s)`;

  if (hasCalendarTools) {
    systemPrompt += `

GOOGLE CALENDAR TOOLS:
- GOOGLECALENDAR_CREATE_EVENT: Create events. Required: summary (title), start datetime, end datetime (default 1 hour after start if not specified). Optional: description, location, attendees.
- GOOGLECALENDAR_EVENTS_LIST: List events in a date range.
- GOOGLECALENDAR_UPDATE_EVENT: Modify an existing event by ID.
- GOOGLECALENDAR_DELETE_EVENT: Delete an event by ID.
- GOOGLECALENDAR_FIND_EVENT: Search events by text.`;
  } else {
    systemPrompt += `

NOTE: Google Calendar is not connected. If the user asks to add calendar events/appointments, tell them to connect Google Calendar in the Integrations page first.`;
  }

  systemPrompt += `

DATETIME HANDLING:
- Convert all times to ISO format with timezone: ${timezone}
- For relative times ("tomorrow", "next Sunday", "in 2 hours"), calculate from current time.
- For calendar events, always set both start AND end time (default to 1 hour duration).

NOTES: When creating notes, suggest 1-3 relevant tags from the user's available tags.

${contextStr}

Always confirm what actions you took and be specific about dates/times used.`;

  return systemPrompt;
}

export async function processWithAgent(
  userId: string,
  input: string,
  context: UserContext,
  userTimezone?: string
): Promise<AgentResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tools: Record<string, any> = createTools(userId, context.tags);

  // Check for Google Calendar integration and add calendar tools
  const hasCalendarIntegration = context.integrations?.some((i) => i.provider === 'google-calendar');
  let hasCalendarTools = false;

  if (hasCalendarIntegration) {
    try {
      logger.debug('Fetching Google Calendar tools', { userId });
      const calendarTools = await getGoogleCalendarTools(userId);
      if (calendarTools && Object.keys(calendarTools).length > 0) {
        tools = { ...tools, ...calendarTools };
        hasCalendarTools = true;
        logger.info('Added Google Calendar tools to agent', {
          userId,
          toolCount: Object.keys(calendarTools).length,
        });
      }
    } catch (error) {
      logger.error('Failed to load Google Calendar tools', error, { userId });
    }
  }

  const systemPrompt = buildSystemPrompt(context, userTimezone, hasCalendarTools);

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

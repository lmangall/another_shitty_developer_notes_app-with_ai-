import { pgTable, text, timestamp, uuid, boolean, jsonb, integer, index } from 'drizzle-orm/pg-core';

// Users table (Better Auth compatible)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sessions table (Better Auth)
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Accounts table (Better Auth)
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Verifications table (Better Auth - for magic links)
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Notes table
export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  cardColSpan: integer('card_col_span').notNull().default(1),
  cardRowSpan: integer('card_row_span').notNull().default(1),
  position: integer('position').notNull().default(0),
  isPinned: boolean('is_pinned').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => [
  index('idx_notes_user_deleted').on(table.userId, table.deletedAt),
]);

// Tags table
export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6b7280'), // gray-500 default
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Note-Tags junction table
export const noteTags = pgTable('note_tags', {
  noteId: uuid('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});

// Reminders table
export const reminders = pgTable('reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  remindAt: timestamp('remind_at'),
  notifyVia: text('notify_via').notNull().default('email'), // email, push, both
  status: text('status').notNull().default('pending'), // pending, sent, cancelled, completed
  recurrence: text('recurrence'), // daily, weekly, monthly, null (one-time)
  recurrenceEndDate: timestamp('recurrence_end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_reminders_status_remind').on(table.status, table.remindAt),
  index('idx_reminders_user_status').on(table.userId, table.status),
]);

// Push subscriptions for web push notifications
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User integrations (Composio connections)
export const userIntegrations = pgTable('user_integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'google-calendar', 'gmail', etc.
  connectedAccountId: text('connected_account_id').notNull(), // Composio connection ID
  status: text('status').notNull().default('active'), // active, expired, revoked
  metadata: jsonb('metadata'), // Additional provider-specific data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_user_integrations_user_provider').on(table.userId, table.provider),
]);

// Chat conversations
export const chatConversations = pgTable('chat_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New conversation'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_chat_conversations_user').on(table.userId),
]);

// Chat messages
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  toolResults: jsonb('tool_results'), // ToolExecutionResult[]
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_chat_messages_conversation').on(table.conversationId),
]);

// Email audit log
export const emailLogs = pgTable('email_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  fromEmail: text('from_email').notNull(),
  toEmail: text('to_email').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  aiResult: jsonb('ai_result'),
  actionType: text('action_type'), // create_note, create_reminder, edit_note, delete_note, etc.
  relatedNoteId: uuid('related_note_id').references(() => notes.id, { onDelete: 'set null' }),
  relatedReminderId: uuid('related_reminder_id').references(() => reminders.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'), // pending, processed, failed
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_email_logs_user_status').on(table.userId, table.status),
]);

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type EmailLog = typeof emailLogs.$inferSelect;
export type NewEmailLog = typeof emailLogs.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type NoteTag = typeof noteTags.$inferSelect;
export type NewNoteTag = typeof noteTags.$inferInsert;
export type UserIntegration = typeof userIntegrations.$inferSelect;
export type NewUserIntegration = typeof userIntegrations.$inferInsert;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type NewChatConversation = typeof chatConversations.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

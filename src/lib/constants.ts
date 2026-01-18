/**
 * Notification methods for reminders.
 */
export const NOTIFY_VIA_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'push', label: 'Push Notification' },
  { value: 'both', label: 'Both' },
] as const;

export type NotifyVia = (typeof NOTIFY_VIA_OPTIONS)[number]['value'];

/**
 * Email addresses allowed to send to the webhook for creating notes/reminders.
 * Only emails from these addresses will be processed.
 */
export const WHITELISTED_EMAILS = [
  'l.mangallon@gmail.com',
  'leonard@42lab.co',
] as const;

export type WhitelistedEmail = (typeof WHITELISTED_EMAILS)[number];

/**
 * Check if an email address is whitelisted.
 * Comparison is case-insensitive.
 */
export function isEmailWhitelisted(email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  return WHITELISTED_EMAILS.some(
    (whitelisted) => whitelisted.toLowerCase() === normalizedEmail
  );
}

/**
 * Default tags created for new users.
 */
export const DEFAULT_TAGS = [
  { name: 'Work', color: '#3b82f6' },      // blue
  { name: 'Personal', color: '#22c55e' },  // green
  { name: 'Ideas', color: '#eab308' },     // yellow
  { name: 'Learning', color: '#8b5cf6' },  // violet
  { name: 'Health', color: '#14b8a6' },    // teal
  { name: 'Finance', color: '#f97316' },   // orange
  { name: 'Urgent', color: '#ef4444' },    // red
  { name: 'Project', color: '#ec4899' },   // pink
  { name: 'Other', color: '#6b7280' },     // gray
] as const;

export type DefaultTagName = (typeof DEFAULT_TAGS)[number]['name'];

/**
 * View options for notes display.
 */
export const VIEW_OPTIONS = [
  { value: 'grid', label: 'Grid' },
  { value: 'table', label: 'Table' },
] as const;

export type ViewOption = (typeof VIEW_OPTIONS)[number]['value'];

/**
 * Sort options for notes.
 */
export const NOTE_SORT_OPTIONS = [
  { value: 'position', label: 'Custom Order' },
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'createdAt', label: 'Created Date' },
  { value: 'title', label: 'Title' },
] as const;

export type NoteSortOption = (typeof NOTE_SORT_OPTIONS)[number]['value'];

/**
 * Sort order options.
 */
export const SORT_ORDER_OPTIONS = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
] as const;

export type SortOrder = (typeof SORT_ORDER_OPTIONS)[number]['value'];

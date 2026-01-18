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

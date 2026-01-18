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

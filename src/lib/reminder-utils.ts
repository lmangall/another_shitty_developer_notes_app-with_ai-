import { addDays, addWeeks, addMonths } from 'date-fns';

/**
 * Calculate the next occurrence date based on recurrence pattern.
 */
export function calculateNextOccurrence(currentDate: Date, recurrence: string): Date {
  switch (recurrence) {
    case 'daily':
      return addDays(currentDate, 1);
    case 'weekly':
      return addWeeks(currentDate, 1);
    case 'monthly':
      return addMonths(currentDate, 1);
    default:
      return currentDate;
  }
}

/**
 * Check if a reminder should create a next occurrence.
 */
export function shouldCreateNextOccurrence(
  recurrence: string | null,
  remindAt: Date | null,
  recurrenceEndDate: Date | null
): boolean {
  if (!recurrence || !remindAt) return false;

  const nextDate = calculateNextOccurrence(remindAt, recurrence);
  return !recurrenceEndDate || nextDate <= recurrenceEndDate;
}

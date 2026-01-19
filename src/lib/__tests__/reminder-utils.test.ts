import { describe, it, expect } from 'vitest';
import { calculateNextOccurrence, shouldCreateNextOccurrence } from '../reminder-utils';

describe('reminder-utils', () => {
  describe('calculateNextOccurrence', () => {
    const baseDate = new Date('2024-01-15T10:00:00Z');

    it('should add 1 day for daily recurrence', () => {
      const result = calculateNextOccurrence(baseDate, 'daily');
      expect(result.toISOString()).toBe('2024-01-16T10:00:00.000Z');
    });

    it('should add 1 week for weekly recurrence', () => {
      const result = calculateNextOccurrence(baseDate, 'weekly');
      expect(result.toISOString()).toBe('2024-01-22T10:00:00.000Z');
    });

    it('should add 1 month for monthly recurrence', () => {
      const result = calculateNextOccurrence(baseDate, 'monthly');
      expect(result.toISOString()).toBe('2024-02-15T10:00:00.000Z');
    });

    it('should return same date for unknown recurrence', () => {
      const result = calculateNextOccurrence(baseDate, 'unknown');
      expect(result.toISOString()).toBe(baseDate.toISOString());
    });

    it('should return same date for empty recurrence', () => {
      const result = calculateNextOccurrence(baseDate, '');
      expect(result.toISOString()).toBe(baseDate.toISOString());
    });

    it('should handle month-end edge cases', () => {
      const jan31 = new Date('2024-01-31T10:00:00Z');
      const result = calculateNextOccurrence(jan31, 'monthly');
      // Feb 31 doesn't exist, so date-fns adjusts to Feb 29 (leap year)
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBeLessThanOrEqual(29);
    });
  });

  describe('shouldCreateNextOccurrence', () => {
    const baseDate = new Date('2024-01-15T10:00:00Z');

    it('should return false if no recurrence', () => {
      expect(shouldCreateNextOccurrence(null, baseDate, null)).toBe(false);
      expect(shouldCreateNextOccurrence('', baseDate, null)).toBe(false);
    });

    it('should return false if no remindAt date', () => {
      expect(shouldCreateNextOccurrence('daily', null, null)).toBe(false);
    });

    it('should return true for recurring reminder without end date', () => {
      expect(shouldCreateNextOccurrence('daily', baseDate, null)).toBe(true);
      expect(shouldCreateNextOccurrence('weekly', baseDate, null)).toBe(true);
      expect(shouldCreateNextOccurrence('monthly', baseDate, null)).toBe(true);
    });

    it('should return true if next occurrence is before end date', () => {
      const endDate = new Date('2024-02-01T10:00:00Z');
      expect(shouldCreateNextOccurrence('daily', baseDate, endDate)).toBe(true);
    });

    it('should return false if next occurrence is after end date', () => {
      const endDate = new Date('2024-01-15T10:00:00Z'); // Same as baseDate
      expect(shouldCreateNextOccurrence('daily', baseDate, endDate)).toBe(false);
    });

    it('should return true if next occurrence equals end date', () => {
      const endDate = new Date('2024-01-16T10:00:00Z'); // Exactly one day after
      expect(shouldCreateNextOccurrence('daily', baseDate, endDate)).toBe(true);
    });
  });
});

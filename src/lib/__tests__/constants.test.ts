import { describe, it, expect } from 'vitest';
import {
  NOTIFY_VIA_OPTIONS,
  RECURRENCE_OPTIONS,
  REMINDER_STATUS_OPTIONS,
  isEmailWhitelisted,
} from '../constants';

describe('constants', () => {
  describe('NOTIFY_VIA_OPTIONS', () => {
    it('should have email, push, and both options', () => {
      const values = NOTIFY_VIA_OPTIONS.map((o) => o.value);
      expect(values).toContain('email');
      expect(values).toContain('push');
      expect(values).toContain('both');
    });
  });

  describe('RECURRENCE_OPTIONS', () => {
    it('should have one-time, daily, weekly, and monthly options', () => {
      const values = RECURRENCE_OPTIONS.map((o) => o.value);
      expect(values).toContain('');
      expect(values).toContain('daily');
      expect(values).toContain('weekly');
      expect(values).toContain('monthly');
    });
  });

  describe('REMINDER_STATUS_OPTIONS', () => {
    it('should have pending, sent, completed, and cancelled statuses', () => {
      const values = REMINDER_STATUS_OPTIONS.map((o) => o.value);
      expect(values).toContain('pending');
      expect(values).toContain('sent');
      expect(values).toContain('completed');
      expect(values).toContain('cancelled');
    });
  });

  describe('isEmailWhitelisted', () => {
    it('should return true for whitelisted emails', () => {
      expect(isEmailWhitelisted('l.mangallon@gmail.com')).toBe(true);
      expect(isEmailWhitelisted('leonard@42lab.co')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isEmailWhitelisted('L.MANGALLON@GMAIL.COM')).toBe(true);
      expect(isEmailWhitelisted('Leonard@42Lab.co')).toBe(true);
    });

    it('should return false for non-whitelisted emails', () => {
      expect(isEmailWhitelisted('random@example.com')).toBe(false);
      expect(isEmailWhitelisted('attacker@evil.com')).toBe(false);
    });

    it('should trim whitespace', () => {
      expect(isEmailWhitelisted('  l.mangallon@gmail.com  ')).toBe(true);
    });
  });
});

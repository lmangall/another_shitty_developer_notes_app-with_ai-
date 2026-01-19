import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from '../rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    // Reset the rate limit store by waiting for time to pass
    vi.useFakeTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-user-1', 5, 60000);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should count requests correctly', () => {
      const key = 'test-user-2';

      const r1 = checkRateLimit(key, 3, 60000);
      expect(r1.success).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = checkRateLimit(key, 3, 60000);
      expect(r2.success).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = checkRateLimit(key, 3, 60000);
      expect(r3.success).toBe(true);
      expect(r3.remaining).toBe(0);

      // Fourth request should be rate limited
      const r4 = checkRateLimit(key, 3, 60000);
      expect(r4.success).toBe(false);
      expect(r4.remaining).toBe(0);
    });

    it('should reset after window expires', () => {
      const key = 'test-user-3';

      // Make 3 requests (limit)
      checkRateLimit(key, 3, 1000);
      checkRateLimit(key, 3, 1000);
      checkRateLimit(key, 3, 1000);

      // Should be rate limited
      const limited = checkRateLimit(key, 3, 1000);
      expect(limited.success).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(1001);

      // Should work again
      const afterReset = checkRateLimit(key, 3, 1000);
      expect(afterReset.success).toBe(true);
      expect(afterReset.remaining).toBe(2);
    });

    it('should track different keys separately', () => {
      // Exhaust limit for user A
      checkRateLimit('user-a', 2, 60000);
      checkRateLimit('user-a', 2, 60000);
      const userALimited = checkRateLimit('user-a', 2, 60000);
      expect(userALimited.success).toBe(false);

      // User B should still have their full quota
      const userB = checkRateLimit('user-b', 2, 60000);
      expect(userB.success).toBe(true);
      expect(userB.remaining).toBe(1);
    });
  });

  describe('rateLimitHeaders', () => {
    it('should create correct headers', () => {
      const result = {
        success: true,
        remaining: 5,
        reset: Date.now() + 60000,
      };

      const headers = rateLimitHeaders(result, 10);

      expect(headers.get('X-RateLimit-Limit')).toBe('10');
      expect(headers.get('X-RateLimit-Remaining')).toBe('5');
      expect(headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('RATE_LIMITS presets', () => {
    it('should have AI_PROCESS preset', () => {
      expect(RATE_LIMITS.AI_PROCESS.limit).toBe(10);
      expect(RATE_LIMITS.AI_PROCESS.windowMs).toBe(60000);
    });

    it('should have API_GENERAL preset', () => {
      expect(RATE_LIMITS.API_GENERAL.limit).toBe(100);
      expect(RATE_LIMITS.API_GENERAL.windowMs).toBe(60000);
    });

    it('should have AUTH preset', () => {
      expect(RATE_LIMITS.AUTH.limit).toBe(5);
      expect(RATE_LIMITS.AUTH.windowMs).toBe(60000);
    });
  });
});

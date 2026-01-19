/**
 * Simple in-memory rate limiter.
 * Note: This is per-instance and won't work with multiple serverless instances.
 * For production, consider using Redis or Upstash.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

/**
 * Check if a request should be rate limited.
 * @param key Unique identifier (e.g., userId, IP address)
 * @param limit Maximum number of requests allowed
 * @param windowMs Time window in milliseconds
 * @returns RateLimitResult with success status and metadata
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // First request or window expired
  if (!record || record.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      remaining: limit - 1,
      reset: now + windowMs,
    };
  }

  // Within window but under limit
  if (record.count < limit) {
    record.count++;
    return {
      success: true,
      remaining: limit - record.count,
      reset: record.resetAt,
    };
  }

  // Rate limited
  return {
    success: false,
    remaining: 0,
    reset: record.resetAt,
  };
}

/**
 * Create rate limit headers for API responses.
 */
export function rateLimitHeaders(result: RateLimitResult, limit: number): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', Math.ceil(result.reset / 1000).toString());
  return headers;
}

// Common rate limit presets
export const RATE_LIMITS = {
  // AI processing: 10 requests per minute
  AI_PROCESS: { limit: 10, windowMs: 60 * 1000 },
  // API general: 100 requests per minute
  API_GENERAL: { limit: 100, windowMs: 60 * 1000 },
  // Auth attempts: 5 per minute
  AUTH: { limit: 5, windowMs: 60 * 1000 },
} as const;

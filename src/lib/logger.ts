/**
 * Server-side logging utility
 *
 * Use this for all server-side logging (API routes, server actions, server components).
 * Logs are structured JSON for easy parsing in Vercel/production environments.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  if (error) {
    entry.error = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return entry;
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      const entry = createLogEntry('debug', message, context);
      console.debug(formatLog(entry));
    }
  },

  info(message: string, context?: LogContext) {
    const entry = createLogEntry('info', message, context);
    console.info(formatLog(entry));
  },

  warn(message: string, context?: LogContext) {
    const entry = createLogEntry('warn', message, context);
    console.warn(formatLog(entry));
  },

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const err = error instanceof Error ? error : undefined;
    const entry = createLogEntry('error', message, context, err);

    // If error is not an Error instance, add it to context
    if (error && !(error instanceof Error)) {
      entry.context = { ...entry.context, errorData: error };
    }

    console.error(formatLog(entry));
  },
};

/**
 * Create a logger with pre-bound context (e.g., requestId, userId)
 */
export function createLogger(baseContext: LogContext) {
  return {
    debug(message: string, context?: LogContext) {
      logger.debug(message, { ...baseContext, ...context });
    },
    info(message: string, context?: LogContext) {
      logger.info(message, { ...baseContext, ...context });
    },
    warn(message: string, context?: LogContext) {
      logger.warn(message, { ...baseContext, ...context });
    },
    error(message: string, error?: Error | unknown, context?: LogContext) {
      logger.error(message, error, { ...baseContext, ...context });
    },
  };
}

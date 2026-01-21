// Standard action result types
export type ActionSuccess<T = void> = {
  success: true;
  data: T;
};

export type ActionError = {
  success: false;
  error: string;
  code?: 'UNAUTHORIZED' | 'NOT_FOUND' | 'VALIDATION' | 'RATE_LIMIT' | 'INTERNAL';
};

export type ActionResult<T = void> = ActionSuccess<T> | ActionError;

// Paginated response type
export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// Helper functions
export function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

export function error(message: string, code?: ActionError['code']): ActionError {
  return { success: false, error: message, code };
}

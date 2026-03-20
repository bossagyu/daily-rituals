/**
 * Shared utility functions for hook operations.
 */

const RLS_VIOLATION_CODE = '42501';

/**
 * Extracts an error message from an unknown error value.
 */
export function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Checks whether an error is a Supabase RLS (Row Level Security) policy violation.
 * RLS violations occur when auth.uid() is null due to an expired session.
 */
export function isRlsError(err: unknown): boolean {
  if (err === null || err === undefined || typeof err !== 'object') {
    return false;
  }
  const code = (err as Record<string, unknown>).code;
  return code === RLS_VIOLATION_CODE;
}

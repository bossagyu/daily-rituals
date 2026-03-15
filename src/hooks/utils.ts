/**
 * Shared utility functions for hook operations.
 */

/**
 * Extracts an error message from an unknown error value.
 */
export function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

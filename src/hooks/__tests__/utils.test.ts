import { extractErrorMessage, isRlsError } from '../utils';

describe('isRlsError', () => {
  it('returns true for error with RLS violation code 42501', () => {
    const error = new Error('new row violates row-level security policy');
    (error as unknown as Record<string, unknown>).code = '42501';
    expect(isRlsError(error)).toBe(true);
  });

  it('returns true for error message containing code 42501 as string property', () => {
    const error = { message: 'RLS policy violation', code: '42501' };
    expect(isRlsError(error)).toBe(true);
  });

  it('returns false for other error codes', () => {
    const error = new Error('unique violation');
    (error as unknown as Record<string, unknown>).code = '23505';
    expect(isRlsError(error)).toBe(false);
  });

  it('returns false for errors without code property', () => {
    const error = new Error('generic error');
    expect(isRlsError(error)).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isRlsError('string error')).toBe(false);
    expect(isRlsError(42)).toBe(false);
    expect(isRlsError(null)).toBe(false);
    expect(isRlsError(undefined)).toBe(false);
  });
});

describe('extractErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(extractErrorMessage(new Error('test error'))).toBe('test error');
  });

  it('converts string to string', () => {
    expect(extractErrorMessage('string error')).toBe('string error');
  });

  it('converts number to string', () => {
    expect(extractErrorMessage(42)).toBe('42');
  });

  it('converts null to string', () => {
    expect(extractErrorMessage(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(extractErrorMessage(undefined)).toBe('undefined');
  });
});

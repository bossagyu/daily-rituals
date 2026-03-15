import { extractErrorMessage } from '../utils';

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

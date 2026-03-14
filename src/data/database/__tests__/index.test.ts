import {
  initializeDatabase,
  getSchemaVersion,
  MIGRATIONS,
  HABITS_TABLE_SQL,
  COMPLETIONS_TABLE_SQL,
  COMPLETIONS_UNIQUE_INDEX_SQL,
  SCHEMA_VERSION_TABLE_SQL,
} from '../index';

describe('data/database index', () => {
  it('should export initializeDatabase function', () => {
    expect(typeof initializeDatabase).toBe('function');
  });

  it('should export getSchemaVersion function', () => {
    expect(typeof getSchemaVersion).toBe('function');
  });

  it('should export MIGRATIONS array', () => {
    expect(Array.isArray(MIGRATIONS)).toBe(true);
  });

  it('should export SQL constants', () => {
    expect(typeof HABITS_TABLE_SQL).toBe('string');
    expect(typeof COMPLETIONS_TABLE_SQL).toBe('string');
    expect(typeof COMPLETIONS_UNIQUE_INDEX_SQL).toBe('string');
    expect(typeof SCHEMA_VERSION_TABLE_SQL).toBe('string');
  });
});

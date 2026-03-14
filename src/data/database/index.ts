export { initializeDatabase, getSchemaVersion } from './database';
export {
  MIGRATIONS,
  HABITS_TABLE_SQL,
  COMPLETIONS_TABLE_SQL,
  COMPLETIONS_UNIQUE_INDEX_SQL,
  SCHEMA_VERSION_TABLE_SQL,
} from './schema';
export type { Migration } from './schema';

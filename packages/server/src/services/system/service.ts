import { runMigrations, testConnection } from '@probe/db';

export function createSystemService() {
  return {
    runMigrations,
    testConnection,
  };
}

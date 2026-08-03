import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "./schema";

export type Schema = typeof schema;

const connectionString =
  process.env.DATABASE_URL ||
  // Preserve the legacy local database identity so existing data remains accessible.
  "postgres://signal:signal_password@localhost:11001/signal_db";

// Client for migrations
const migrationClient = postgres(connectionString, { max: 1 });

// Client for queries
const queryClient = postgres(connectionString);

// Database instance
export const db = drizzle(queryClient, { schema });

// Run migrations
export async function runMigrations() {
  console.log("Running database migrations...");
  const migrationsFolder =
    process.env.DATABASE_MIGRATIONS_PATH || __dirname + "/migrations";
  console.log(migrationsFolder);
  await migrate(drizzle(migrationClient), {
    migrationsFolder,
  });
  console.log("Migrations completed successfully");
  await migrationClient.end();
}

// Test database connection
export async function testConnection() {
  try {
    await queryClient`SELECT 1`;
    console.log("Database connection successful");
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

export { schema };
export * from "./schema";

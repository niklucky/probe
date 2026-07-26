import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      // Preserve the legacy local database identity so existing data remains accessible.
      "postgres://signal:signal_password@localhost:11001/signal_db",
  },
});

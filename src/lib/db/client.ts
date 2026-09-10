import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// A single pooled connection reused across the whole server process.
// `globalThis` caching avoids exhausting Postgres connections from Next.js
// hot-reloading in development (each reload would otherwise open a new pool).
declare global {
  // eslint-disable-next-line no-var
  var __tobiasPgClient: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

const client =
  globalThis.__tobiasPgClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__tobiasPgClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;

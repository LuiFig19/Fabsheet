import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDrizzle = globalThis as unknown as { drizzlePool?: Pool };

export function getDrizzleDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool =
    globalForDrizzle.drizzlePool ??
    new Pool({
      connectionString,
      max: Number(process.env.DRIZZLE_POOL_MAX ?? 5),
    });

  if (process.env.NODE_ENV !== "production") globalForDrizzle.drizzlePool = pool;

  return drizzle(pool, { schema });
}

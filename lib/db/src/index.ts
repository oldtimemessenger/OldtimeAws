import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const usesAwsConnection =
  !databaseUrl &&
  ["PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"].every((key) => Boolean(process.env[key]));

if (!databaseUrl && !usesAwsConnection) {
  throw new Error(
    "Set DATABASE_URL or all of PGHOST, PGDATABASE, PGUSER, and PGPASSWORD.",
  );
}

export const pool = new Pool(
  databaseUrl
    ? { connectionString: databaseUrl }
    : {
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
      },
);
export const db = drizzle(pool, { schema });

export * from "./schema";

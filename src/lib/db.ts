import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/tickets",
  max: 20,
  connectionTimeoutMillis: 3000,
});

// Counts every query, so the load tests can report database load.
export const stats: Record<string, number> = { queries: 0 };

export function q(text: string, params: unknown[] = []) {
  stats.queries++;
  return pool.query(text, params);
}

// Run fn inside BEGIN ... COMMIT on one connection.
export async function tx<T>(fn: (q: (text: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>) {
  const client = await pool.connect();
  const cq = (text: string, params: unknown[] = []) => { stats.queries++; return client.query(text, params); };
  try {
    await client.query("BEGIN");
    const out = await fn(cq);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

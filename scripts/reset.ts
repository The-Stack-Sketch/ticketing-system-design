import fs from "node:fs";
import { pool } from "../src/lib/db.js";
import { redis } from "../src/lib/redis.js";

// Fresh database and Redis for a step: npm run reset -- 4
const step = process.argv[2] ?? process.env.STEP ?? "3";
const n = parseInt(step, 10);

await pool.query(fs.readFileSync("db/schema.sql", "utf8"));
if (n >= 4) await pool.query(fs.readFileSync("db/step4-unique.sql", "utf8"));
if (n >= 8) await pool.query(fs.readFileSync("db/step8-payments.sql", "utf8"));
await redis.flushdb();

console.log(`Reset for step ${step}: 5,000 seats for event 42, Redis empty`);
await pool.end();
redis.disconnect();

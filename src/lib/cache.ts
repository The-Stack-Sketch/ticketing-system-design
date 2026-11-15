import { redis } from "./redis.js";
import { stats } from "./db.js";

// Cache-aside with a stampede lock.
// fresh copy: short expiry. stale copy: kept longer, served while one request rebuilds.
// Returns the cached JSON text, so a hit costs no database work and no re-serialising.
export async function cached(key: string, ttlSeconds: number, load: () => Promise<unknown>): Promise<string> {
  const hit = await redis.get(key);
  if (hit) return hit;

  // Only one request gets the lock and rebuilds. SET NX again.
  const gotLock = await redis.set(`${key}:lock`, "1", "EX", 5, "NX");
  if (gotLock) {
    try {
      stats.rebuilds = (stats.rebuilds ?? 0) + 1;
      const json = JSON.stringify(await load());
      await redis.multi().set(key, json, "EX", ttlSeconds).set(`${key}:stale`, json, "EX", ttlSeconds * 30).exec();
      return json;
    } finally {
      await redis.del(`${key}:lock`);
    }
  }

  // Everyone else: serve the old copy for a moment.
  const stale = await redis.get(`${key}:stale`);
  if (stale) return stale;

  // No old copy yet (very first load): wait briefly and try again.
  await new Promise((r) => setTimeout(r, 50));
  return cached(key, ttlSeconds, load);
}

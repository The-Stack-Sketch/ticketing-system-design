import type { Request, Response, NextFunction } from "express";
import { redis } from "./redis.js";

// Token bucket per account: up to CAPACITY requests at once, refilled at RATE per second.
const CAPACITY = 10;
const RATE = 2;

const TAKE_TOKEN = `
local b = redis.call("HMGET", KEYS[1], "tokens", "ts")
local cap, rate, now = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local tokens = tonumber(b[1]) or cap
local ts = tonumber(b[2]) or now
tokens = math.min(cap, tokens + (now - ts) * rate)
local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end
redis.call("HSET", KEYS[1], "tokens", tokens, "ts", now)
redis.call("EXPIRE", KEYS[1], 60)
return allowed`;

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  const account = req.body?.fanId ?? req.ip;
  const allowed = await redis.eval(TAKE_TOKEN, 1, `rate:${account}`, CAPACITY, RATE, Date.now() / 1000);
  if (allowed !== 1) {
    res.setHeader("Retry-After", "1");
    return res.status(429).json({ error: "Too many requests" });
  }
  next();
}

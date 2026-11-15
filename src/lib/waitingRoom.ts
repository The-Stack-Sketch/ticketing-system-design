import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { redis } from "./redis.js";

// A virtual waiting room: every fan gets a number, and we let a few in at a time.
const SECRET = process.env.PASS_SECRET ?? "dev-only-secret-change-me";
const ADMIT_PER_SECOND = Number(process.env.ADMIT_PER_SECOND ?? 100);
const PASS_SECONDS = 600;

const sign = (data: string) => crypto.createHmac("sha256", SECRET).update(data).digest("base64url");

function makeToken(kind: string, eventId: string, value: number, expiresAt: number) {
  const data = `${kind}.${eventId}.${value}.${expiresAt}`;
  return `${data}.${sign(data)}`;
}

function readToken(token: string, kind: string, eventId: string) {
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [k, e, value, expiresAt, sig] = parts;
  const expected = sign(`${k}.${e}.${value}.${expiresAt}`);
  const valid = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!valid || k !== kind || e !== eventId || Number(expiresAt) < Date.now() / 1000) return null;
  return Number(value);
}

// Step 1: each fan gets a number. INCR hands them out in order.
export async function joinLine(eventId: string) {
  const position = await redis.incr(`line:${eventId}`);
  const lineToken = makeToken("line", eventId, position, Math.floor(Date.now() / 1000) + 3600);
  return { position, lineToken };
}

// Step 2: one worker raises "admitted up to" a few hundred times per second.
export function startAdmitting(eventId: string) {
  setInterval(async () => {
    const inLine = Number((await redis.get(`line:${eventId}`)) ?? 0);
    const admitted = Number((await redis.get(`admitted:${eventId}`)) ?? 0);
    if (admitted < inLine) await redis.set(`admitted:${eventId}`, Math.min(inLine, admitted + ADMIT_PER_SECOND));
  }, 1000);
}

// Step 3: once your number is admitted, you get a short-lived signed pass.
export async function lineStatus(eventId: string, lineToken: string) {
  const position = readToken(lineToken, "line", eventId);
  if (position === null) return { error: "Invalid line token" };
  const admitted = Number((await redis.get(`admitted:${eventId}`)) ?? 0);
  if (position > admitted) return { waiting: true, ahead: position - admitted };
  return { pass: makeToken("pass", eventId, position, Math.floor(Date.now() / 1000) + PASS_SECONDS) };
}

// Buy routes only accept requests that carry a valid pass.
export function requirePass(req: Request, res: Response, next: NextFunction) {
  const pass = req.header("x-pass");
  if (!pass || readToken(pass, "pass", String(req.params.eventId)) === null) {
    return res.status(403).json({ error: "Join the line first" });
  }
  next();
}

// The two routes every fan uses before buying.
export function lineRoutes(app: import("express").Express, eventId = "42") {
  startAdmitting(eventId);
  app.post("/events/:eventId/line", async (req, res) => res.json(await joinLine(req.params.eventId)));
  app.get("/events/:eventId/line/status", async (req, res) =>
    res.json(await lineStatus(req.params.eventId, String(req.query.token ?? ""))));
}

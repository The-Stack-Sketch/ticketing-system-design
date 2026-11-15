import crypto from "node:crypto";
import type { Express } from "express";
import { q, stats } from "../lib/db.js";
import { redis } from "../lib/redis.js";
import { sellSeat } from "../lib/seats.js";
import { holdOwner, releaseHold } from "../lib/holds.js";
import { requirePass } from "../lib/waitingRoom.js";
import { rateLimit } from "../lib/rateLimit.js";
import { register as step7 } from "./step7.js";

// Step 8: payments. Authorize, confirm the seat, then capture.
// An idempotency key makes a double click harmless. Webhooks are verified and de-duplicated.
const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:4000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "whsec_dev_only";
const PRICE_CENTS = 7900; // money as integer cents, never a float

type Result = { status: number; body: unknown };

export function register(app: Express) {
  step7(app);

  app.post("/events/:eventId/seats/:seatId/checkout", requirePass, rateLimit, async (req, res) => {
    const { eventId, seatId } = req.params as Record<string, string>;
    const { fanId } = req.body;
    const key = req.header("Idempotency-Key");
    if (!key) return res.status(400).json({ error: "Idempotency-Key header required" });

    const hash = crypto.createHash("sha256").update(JSON.stringify({ eventId, seatId, fanId, PRICE_CENTS })).digest("hex");

    // Claim the key. A primary key means only one request can insert it.
    const claimed = await q(
      "INSERT INTO idempotency_keys (key, request_hash, status) VALUES ($1, $2, 'in_progress') ON CONFLICT DO NOTHING",
      [key, hash],
    );
    if (claimed.rowCount === 0) {
      const { rows: [row] } = await q("SELECT request_hash, status, response FROM idempotency_keys WHERE key = $1", [key]);
      if (row.request_hash !== hash) return res.status(422).json({ error: "Key reused with a different request" });
      if (row.status === "in_progress") return res.status(409).json({ error: "Checkout already in progress" });
      return res.status(row.response.status).json(row.response.body); // the saved result, no second charge
    }

    let result: Result;
    try {
      result = await checkout(eventId, seatId, fanId, key);
    } catch (e) {
      await q("DELETE FROM idempotency_keys WHERE key = $1", [key]); // let a retry try again
      throw e;
    }
    await q("UPDATE idempotency_keys SET status = 'done', response = $2 WHERE key = $1", [key, result]);
    res.status(result.status).json(result.body);
  });

  app.post("/webhooks/gateway", async (req, res) => {
    // 1. Verify the signature against the raw bytes.
    const raw: Buffer = (req as any).rawBody;
    const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
    const got = req.header("x-signature") ?? "";
    if (got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
      return res.status(400).json({ error: "Bad signature" });
    }
    stats.webhooksReceived = (stats.webhooksReceived ?? 0) + 1;

    // 2. Skip events we've already seen. Gateways resend.
    const event = req.body;
    const fresh = await q("INSERT INTO webhook_events (id) VALUES ($1) ON CONFLICT DO NOTHING", [event.id]);
    if (fresh.rowCount === 0) return res.sendStatus(200);
    stats.webhooksProcessed = (stats.webhooksProcessed ?? 0) + 1;

    // 3. Keep it fast: record what happened, reply 200.
    if (event.type === "authorization.captured") {
      await q("UPDATE payments SET status = 'captured' WHERE authorization_id = $1", [event.data.id]);
    }
    res.sendStatus(200);
  });
}

async function checkout(eventId: string, seatId: string, fanId: string, key: string): Promise<Result> {
  if ((await holdOwner(eventId, seatId)) !== fanId) return { status: 409, body: { error: "Your hold expired" } };

  // 1. Authorize: the bank reserves the money. Nothing moves yet.
  const auth = await gateway("/v1/authorizations", { amount: PRICE_CENTS, currency: "usd", source: "tok_test" }, key);
  if (auth.status !== "authorized") return { status: 402, body: { error: "Card declined" } };
  await q("INSERT INTO payments (order_key, authorization_id, amount, status) VALUES ($1, $2, $3, 'authorized')",
    [key, auth.id, PRICE_CENTS]);

  // 2. Confirm the seat, with the atomic update from step 4.
  if (!(await sellSeat(eventId, seatId, fanId))) {
    await gateway(`/v1/authorizations/${auth.id}/void`, {}, `${key}:void`);
    await q("UPDATE payments SET status = 'voided' WHERE authorization_id = $1", [auth.id]);
    return { status: 409, body: { error: "Seat no longer available. You were not charged." } };
  }

  // 3. Capture: now the money moves.
  await gateway(`/v1/authorizations/${auth.id}/capture`, {}, `${key}:capture`);
  await releaseHold(eventId, seatId, fanId);

  // Slow work (email, PDF ticket) goes on a queue, never inside checkout.
  await redis.lpush("jobs", JSON.stringify({ type: "send-ticket", eventId, seatId, fanId }));
  return { status: 200, body: { ok: true, seat: seatId } };
}

async function gateway(path: string, body: object, idempotencyKey: string) {
  const r = await fetch(GATEWAY + path, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Gateway ${path} failed: ${r.status}`);
  return r.json();
}

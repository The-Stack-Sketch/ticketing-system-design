import type { Express } from "express";
import { redis } from "../lib/redis.js";
import { sellSeat, loadSeatMap } from "../lib/seats.js";

// Step 5: seat holds. A fan's claim on a seat that expires on its own.
const HOLD_SECONDS = Number(process.env.HOLD_SECONDS ?? 600); // 10 minutes
const holdKey = (eventId: string, seatId: string) => `hold:${eventId}:${seatId}`;

export function register(app: Express) {
  app.get("/events/:eventId/seats", async (req, res) => {
    res.json(await loadSeatMap(req.params.eventId));
  });

  app.post("/events/:eventId/seats/:seatId/hold", async (req, res) => {
    const { eventId, seatId } = req.params;
    const { fanId } = req.body;

    // NX: only if nobody holds it. EX: expire automatically.
    const ok = await redis.set(holdKey(eventId, seatId), fanId, "EX", HOLD_SECONDS, "NX");
    if (!ok) return res.status(409).json({ error: "Seat held" });
    res.json({ held: true, expiresIn: HOLD_SECONDS });
  });

  app.post("/events/:eventId/seats/:seatId/buy", async (req, res) => {
    const { eventId, seatId } = req.params;
    const { fanId } = req.body;

    const owner = await redis.get(holdKey(eventId, seatId));
    if (owner !== fanId) return res.status(409).json({ error: "You don't hold this seat" });

    const sold = await sellSeat(eventId, seatId, fanId);
    if (!sold) return res.status(409).json({ error: "Seat taken" });

    await releaseHold(eventId, seatId, fanId);
    res.json({ ok: true });
  });

  // The fan changed their mind.
  app.post("/events/:eventId/seats/:seatId/release", async (req, res) => {
    const { eventId, seatId } = req.params;
    await releaseHold(eventId, seatId, req.body.fanId);
    res.json({ released: true });
  });
}

// Remove the hold once the seat is sold, or the fan walks away.
async function releaseHold(eventId: string, seatId: string, fanId: string) {
  await redis.del(holdKey(eventId, seatId));
}

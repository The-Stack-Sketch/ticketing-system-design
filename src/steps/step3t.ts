import type { Express } from "express";
import { tx } from "../lib/db.js";

// Step 3, first instinct: wrap it in a transaction.
// Still broken: at Postgres' default isolation (READ COMMITTED),
// both buyers can still read "available" before either one writes.
export function register(app: Express) {
  app.post("/events/:eventId/seats/:seatId/buy", async (req, res) => {
    const { eventId, seatId } = req.params;
    const { fanId } = req.body;

    const ok = await tx(async (q) => {
      const { rows } = await q("SELECT status FROM seats WHERE event_id = $1 AND id = $2", [eventId, seatId]);
      if (rows[0]?.status !== "available") return false;

      await q("UPDATE seats SET status = 'sold' WHERE event_id = $1 AND id = $2", [eventId, seatId]);
      await q("INSERT INTO tickets (event_id, seat_id, fan_id) VALUES ($1, $2, $3)", [eventId, seatId, fanId]);
      return true;
    });

    if (!ok) return res.status(409).json({ error: "Seat taken" });
    res.json({ ok: true });
  });
}

import type { Express } from "express";
import { q } from "../lib/db.js";

// Step 3: the naive version. Read the seat, then write.
// Works when you click it once. Breaks under load.
export function register(app: Express) {
  app.post("/events/:eventId/seats/:seatId/buy", async (req, res) => {
    const { eventId, seatId } = req.params;
    const { fanId } = req.body;

    const { rows } = await q("SELECT status FROM seats WHERE event_id = $1 AND id = $2", [eventId, seatId]);
    if (rows[0]?.status !== "available") return res.status(409).json({ error: "Seat taken" });

    await q("UPDATE seats SET status = 'sold' WHERE event_id = $1 AND id = $2", [eventId, seatId]);
    await q("INSERT INTO tickets (event_id, seat_id, fan_id) VALUES ($1, $2, $3)", [eventId, seatId, fanId]);
    res.json({ ok: true });
  });
}

import type { Express } from "express";
import { tx } from "../lib/db.js";

// Step 4: don't read, then write. Write with a condition.
// The database checks and changes the row in one atomic step.
export function register(app: Express) {
  app.post("/events/:eventId/seats/:seatId/buy", async (req, res) => {
    const { eventId, seatId } = req.params;
    const { fanId } = req.body;

    const sold = await tx(async (q) => {
      const r = await q(
        "UPDATE seats SET status = 'sold' WHERE event_id = $1 AND id = $2 AND status = 'available'",
        [eventId, seatId],
      );
      if (r.rowCount === 0) return false; // zero rows changed: someone else got it

      await q("INSERT INTO tickets (event_id, seat_id, fan_id) VALUES ($1, $2, $3)", [eventId, seatId, fanId]);
      return true;
    });

    if (!sold) return res.status(409).json({ error: "Seat taken" });
    res.json({ ok: true });
  });
}

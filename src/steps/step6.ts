import type { Express } from "express";
import { sellSeat, loadSeatMap } from "../lib/seats.js";
import { placeHold, holdOwner, releaseHold } from "../lib/holds.js";
import { lineRoutes, requirePass } from "../lib/waitingRoom.js";
import { rateLimit } from "../lib/rateLimit.js";

// Step 6: survive the crowd.
// The database only sees fans let in through the waiting room,
// and each account is rate limited. Holds now release safely (only the owner's).
export function register(app: Express) {
  lineRoutes(app);

  app.get("/events/:eventId/seats", requirePass, async (req, res) => {
    res.json(await loadSeatMap(String(req.params.eventId)));
  });

  app.post("/events/:eventId/seats/:seatId/hold", requirePass, rateLimit, async (req, res) => {
    const { eventId, seatId } = req.params as Record<string, string>;
    if (!(await placeHold(eventId, seatId, req.body.fanId))) return res.status(409).json({ error: "Seat held" });
    res.json({ held: true });
  });

  app.post("/events/:eventId/seats/:seatId/buy", requirePass, rateLimit, async (req, res) => {
    const { eventId, seatId } = req.params as Record<string, string>;
    const { fanId } = req.body;
    if ((await holdOwner(eventId, seatId)) !== fanId) return res.status(409).json({ error: "You don't hold this seat" });
    if (!(await sellSeat(eventId, seatId, fanId))) return res.status(409).json({ error: "Seat taken" });
    await releaseHold(eventId, seatId, fanId);
    res.json({ ok: true });
  });

  app.post("/events/:eventId/seats/:seatId/release", requirePass, async (req, res) => {
    const { eventId, seatId } = req.params as Record<string, string>;
    res.json({ released: await releaseHold(eventId, seatId, req.body.fanId) });
  });
}

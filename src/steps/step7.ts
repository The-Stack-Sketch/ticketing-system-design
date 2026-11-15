import type { Express } from "express";
import { register as step6 } from "./step6.js";
import { loadSeatMap } from "../lib/seats.js";
import { cached } from "../lib/cache.js";
import { requirePass } from "../lib/waitingRoom.js";

// Step 7: the read path. The seat map comes from Redis,
// rebuilt at most once every 2 seconds, with a lock against stampedes.
export function register(app: Express) {
  // Registered first, so it answers before step 6's uncached version.
  app.get("/events/:eventId/seats", requirePass, async (req, res) => {
    const eventId = String(req.params.eventId);
    res.type("json").send(await cached(`seatmap:${eventId}`, 2, () => loadSeatMap(eventId)));
  });
  step6(app);
}

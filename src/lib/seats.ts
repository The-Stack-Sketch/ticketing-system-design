import { q, tx } from "./db.js";

// The atomic conditional update from step 4, reused by later steps.
export function sellSeat(eventId: string, seatId: string, fanId: string) {
  return tx(async (q) => {
    const r = await q(
      "UPDATE seats SET status = 'sold' WHERE event_id = $1 AND id = $2 AND status = 'available'",
      [eventId, seatId],
    );
    if (r.rowCount === 0) return false;
    await q("INSERT INTO tickets (event_id, seat_id, fan_id) VALUES ($1, $2, $3)", [eventId, seatId, fanId]);
    return true;
  });
}

// The seat map, straight from the database. Step 7 puts a cache in front of it.
export async function loadSeatMap(eventId: string) {
  const { rows } = await q("SELECT id, status FROM seats WHERE event_id = $1 ORDER BY id", [eventId]);
  return rows;
}

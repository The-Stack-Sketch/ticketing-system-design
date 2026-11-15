import { redis } from "./redis.js";

const HOLD_SECONDS = Number(process.env.HOLD_SECONDS ?? 600);
const holdKey = (eventId: string, seatId: string) => `hold:${eventId}:${seatId}`;

export async function placeHold(eventId: string, seatId: string, fanId: string) {
  return (await redis.set(holdKey(eventId, seatId), fanId, "EX", HOLD_SECONDS, "NX")) === "OK";
}

export function holdOwner(eventId: string, seatId: string) {
  return redis.get(holdKey(eventId, seatId));
}

// Delete the hold only if it still belongs to this fan.
// Check and delete run as one Lua script, so nothing can slip in between.
const RELEASE_IF_OWNER = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0`;

export async function releaseHold(eventId: string, seatId: string, fanId: string) {
  return (await redis.eval(RELEASE_IF_OWNER, 1, holdKey(eventId, seatId), fanId)) === 1;
}

export { HOLD_SECONDS };

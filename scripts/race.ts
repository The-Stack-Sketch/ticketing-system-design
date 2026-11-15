import { pool } from "../src/lib/db.js";
import { arg, post } from "./util.js";

// 100 buyers, one seat, the same moment.  npm run race -- --buyers 100 --seat A12
const buyers = Number(arg("--buyers", "100"));
const seat = arg("--seat", "A12");

const statuses = await Promise.all(
  Array.from({ length: buyers }, (_, i) =>
    post(`/events/42/seats/${seat}/buy`, { fanId: `fan_${i + 1}` }).then((r) => r.status, () => 0)),
);

const count = (s: number) => statuses.filter((x) => x === s).length;
const { rows } = await pool.query("SELECT count(*)::int AS n FROM tickets WHERE event_id = 42 AND seat_id = $1", [seat]);

console.log(`${buyers} buyers, one seat (${seat}), all at the same moment`);
console.log(`  200 OK:           ${count(200)}`);
console.log(`  409 Seat taken:   ${count(409)}`);
if (count(500) + count(0)) console.log(`  errors:           ${count(500) + count(0)}`);
console.log(`Tickets issued for ${seat}: ${rows[0].n}`);
await pool.end();

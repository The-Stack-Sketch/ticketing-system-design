import { pool } from "../src/lib/db.js";
import { post, sleep, getPass, BASE } from "./util.js";

// Double-submit checkout, like a double click on a slow phone.
// Needs: STEP=8 npm start, npm run gateway, npm run worker
const pass = await getPass();
const headers = { "x-pass": pass };
await post("/events/42/seats/A12/hold", { fanId: "fan_priya" }, headers);

const key = `chk_${crypto.randomUUID().slice(0, 8)}`;
const pay = () => post("/events/42/seats/A12/checkout", { fanId: "fan_priya" }, { ...headers, "Idempotency-Key": key })
  .then(async (r) => `${r.status} ${JSON.stringify(await r.json())}`);

const [a, b] = await Promise.all([pay(), pay()]);
await sleep(1000); // let the webhooks arrive
const retry = await pay();

const gw = await (await fetch("http://localhost:4000/stats")).json();
const app = await (await fetch(`${BASE}/stats`)).json();
const { rows } = await pool.query("SELECT count(*)::int AS n FROM tickets WHERE seat_id = 'A12'");

console.log(`Two checkouts at the same moment, same Idempotency-Key (${key})`);
console.log(`  Request 1:  ${a}`);
console.log(`  Request 2:  ${b}`);
console.log(`  Retry later: ${retry}`);
console.log(`Gateway: ${gw.authorizations} authorization, ${gw.captures} charge`);
console.log(`Tickets for A12: ${rows[0].n}`);
console.log(`Webhooks received: ${app.webhooksReceived}, processed: ${app.webhooksProcessed}`);
await pool.end();

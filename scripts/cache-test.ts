import autocannon from "autocannon";
import { BASE, getPass } from "./util.js";

// Hammer the seat map for 10 seconds.
//   No cache:   STEP=6 npm start,  npm run cache-test
//   Cache:      STEP=7 npm start,  npm run cache-test
const pass = await getPass();
const before = await (await fetch(`${BASE}/stats`)).json();

const r = await autocannon({ url: `${BASE}/events/42/seats`, connections: 50, duration: 10, headers: { "x-pass": pass } });

const after = await (await fetch(`${BASE}/stats`)).json();
console.log(`Seat map under load (50 connections, 10 s)`);
console.log(`  Requests per second:        ${Math.round(r.requests.average)}`);
console.log(`  Median response time:       ${r.latency.p50} ms`);
console.log(`  p99 response time:          ${r.latency.p99} ms`);
console.log(`  Database queries per second: ${Math.round((after.queries - before.queries) / 10)}`);
if (after.rebuilds !== undefined) console.log(`  Cache rebuilds:             ${after.rebuilds - (before.rebuilds ?? 0)}`);

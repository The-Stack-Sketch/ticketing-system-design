import { Agent, setGlobalDispatcher } from "undici";
import { BASE, arg, post, sleep, percentile, getPass } from "./util.js";

// A burst of fans arriving at once.
//   Without a waiting room:  STEP=5 npm start,  npm run burst -- --fans 2000
//   With a waiting room:     STEP=6 npm start,  npm run burst -- --fans 2000 --line
setGlobalDispatcher(new Agent({ connections: 4096 }));
const fans = Number(arg("--fans", "2000"));
const useLine = process.argv.includes("--line");

const latencies: number[] = [];
let errors = 0, sold = 0;
const perSecond: number[] = [];
let lastQueries = (await (await fetch(`${BASE}/stats`)).json()).queries;
let running = true;

// Sample the server's database query counter every second.
const sampler = (async () => {
  while (running) {
    await sleep(1000);
    const q = (await (await fetch(`${BASE}/stats`)).json()).queries;
    perSecond.push(q - lastQueries);
    lastQueries = q;
  }
})();

async function fan(i: number) {
  const fanId = `fan_${i}`;
  try {
    const headers: Record<string, string> = useLine ? { "x-pass": await getPass() } : {};
    const t0 = performance.now();
    const r = await fetch(`${BASE}/events/42/seats`, { headers });
    if (r.status >= 500) { errors++; return; }
    const seats: { id: string; status: string }[] = await r.json();
    latencies.push(performance.now() - t0);

    const free = seats.filter((s) => s.status === "available");
    const seat = free[Math.floor(Math.random() * free.length)];
    if (!seat) return;
    const h = await post(`/events/42/seats/${seat.id}/hold`, { fanId }, headers);
    if (h.status !== 200) return;
    const b = await post(`/events/42/seats/${seat.id}/buy`, { fanId }, headers);
    if (b.status === 200) sold++;
    else if (b.status >= 500) errors++;
  } catch {
    errors++;
  }
}

const start = performance.now();
await Promise.all(Array.from({ length: fans }, (_, i) => fan(i + 1)));
running = false;
await sampler;

console.log(`${fans} fans at once, ${useLine ? "WITH" : "without"} a waiting room`);
console.log(`  Peak database queries per second: ${Math.max(...perSecond)}`);
console.log(`  Seat map p95 response time:       ${Math.round(percentile(latencies, 95))} ms`);
console.log(`  Errors:                           ${errors}`);
console.log(`  Tickets sold:                     ${sold}`);
console.log(`  Took:                             ${((performance.now() - start) / 1000).toFixed(1)} s`);

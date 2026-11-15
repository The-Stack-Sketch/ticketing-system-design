import { post, sleep } from "./util.js";

// Run the server with a short hold:  HOLD_SECONDS=5 STEP=5 npm start
const seconds = Number(process.env.HOLD_SECONDS ?? 5);
const hold = (fanId: string) => post("/events/42/seats/A12/hold", { fanId }).then(async (r) => `${r.status} ${JSON.stringify(await r.json())}`);

console.log("Priya holds A12:          ", await hold("fan_priya"));
console.log("Fan B tries to hold A12:  ", await hold("fan_b"));
console.log(`...waiting ${seconds + 1} seconds for the hold to expire`);
await sleep((seconds + 1) * 1000);
console.log("Fan B tries again:        ", await hold("fan_b"));

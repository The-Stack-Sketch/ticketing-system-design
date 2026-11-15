import { redis } from "./lib/redis.js";

// Picks slow jobs off the queue, so checkout never waits for them.
console.log("Worker waiting for jobs...");
while (true) {
  const item = await redis.brpop("jobs", 5);
  if (!item) continue;
  const job = JSON.parse(item[1]);
  if (job.type === "send-ticket") {
    console.log(`Emailing ticket for seat ${job.seatId} to ${job.fanId}, with the PDF attached`);
  }
}

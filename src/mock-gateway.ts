import crypto from "node:crypto";
import express from "express";

// A pretend card gateway for the demo. No real cards, no real money.
// It supports authorize, capture and void, honours idempotency keys,
// and sends signed webhooks (twice, like real gateways sometimes do).
const APP_WEBHOOK_URL = process.env.APP_WEBHOOK_URL ?? "http://localhost:3000/webhooks/gateway";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "whsec_dev_only";

type Auth = { id: string; amount: number; status: "authorized" | "captured" | "voided" };
const auths = new Map<string, Auth>();
const seenKeys = new Map<string, unknown>();
const stats = { authorizations: 0, captures: 0, voids: 0 };
let n = 0;

const app = express();
app.use(express.json());

// Same Idempotency-Key, same answer. Work is done once.
function once(handler: (req: express.Request) => unknown) {
  return (req: express.Request, res: express.Response) => {
    const key = req.header("Idempotency-Key");
    if (key && seenKeys.has(key)) return res.json(seenKeys.get(key));
    const out = handler(req);
    if (key) seenKeys.set(key, out);
    res.json(out);
  };
}

app.post("/v1/authorizations", once((req) => {
  const auth: Auth = { id: `auth_${++n}`, amount: req.body.amount, status: "authorized" };
  auths.set(auth.id, auth);
  stats.authorizations++;
  return auth;
}));

app.post("/v1/authorizations/:id/capture", once((req) => {
  const auth = auths.get(String(req.params.id))!;
  if (auth.status === "authorized") {
    auth.status = "captured";
    stats.captures++;
    const event = { id: `evt_${auth.id}_captured`, type: "authorization.captured", data: { id: auth.id, amount: auth.amount } };
    setTimeout(() => sendWebhook(event), 100);
    setTimeout(() => sendWebhook(event), 300); // a duplicate delivery
  }
  return auth;
}));

app.post("/v1/authorizations/:id/void", once((req) => {
  const auth = auths.get(String(req.params.id))!;
  if (auth.status === "authorized") { auth.status = "voided"; stats.voids++; }
  return auth;
}));

app.get("/stats", (_req, res) => res.json(stats));

async function sendWebhook(event: object) {
  const body = JSON.stringify(event);
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  await fetch(APP_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json", "x-signature": signature }, body })
    .catch(() => {});
}

app.listen(4000, () => console.log("Mock gateway on http://localhost:4000 (no real money)"));

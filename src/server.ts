import express from "express";
import { stats } from "./lib/db.js";

// Which chapter's code to run: 3, 3t, 4, 5, 6, 7 or 8.
const step = process.env.STEP ?? "3";

const app = express();
// Keep the raw body too: webhook signatures are checked against the exact bytes.
app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));

const { register } = await import(`./steps/step${step}.js`);
register(app);

// Used by the load tests to measure database load.
app.get("/stats", (_req, res) => res.json(stats));

app.listen(3000, () => console.log(`Step ${step} listening on http://localhost:3000`));

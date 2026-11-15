# ticketing-system-design

Companion code for **The Stack Sketch** video *How to Design a Ticketing System for 100,000 Fans* (YouTube: @TheStackSketch).

We build one ticketing API step by step, and every fix is proven with a test you can run yourself.
Written fresh for the channel. The payment gateway is a mock: no real cards, no real money.

## Run it

You need Node.js 22 and Docker.

```bash
docker compose up -d          # PostgreSQL 16 + Redis 7
npm install
```

Each chapter of the video is a step. Reset the data, start that step's server, then run its test in a second terminal.

| Step | Chapter | Start the server | Run the test |
|---|---|---|---|
| 3 | The naive version | `npm run reset -- 3` then `STEP=3 npm start` | `npm run race` |
| 3t | "Just add a transaction" | `npm run reset -- 3` then `STEP=3t npm start` | `npm run race` |
| 4 | Atomic conditional update | `npm run reset -- 4` then `STEP=4 npm start` | `npm run race` |
| 5 | Seat holds | `npm run reset -- 5` then `HOLD_SECONDS=5 STEP=5 npm start` | `npm run holds` |
| 5 → 6 | Surviving the crowd | `STEP=5 npm start`, then `STEP=6 npm start` (reset before each) | `npm run burst` (step 5), `npm run burst -- --line` (step 6) |
| 6 → 7 | Caching the seat map | `STEP=6 npm start`, then `STEP=7 npm start` (reset before each) | `npm run cache-test` |
| 8 | Payments | `npm run reset -- 8`, `npm run gateway`, `npm run worker`, `STEP=8 npm start` | `npm run pay` |

Results depend on your machine. Tune `ADMIT_PER_SECOND` (default 100) to what your setup can handle.

## The bug challenge

Step 5 has one deliberate bug left in it. Find it, and say what goes wrong in the comments of the video.
Step 6 contains the fix, so you can check your answer.

## Where things live

- `src/steps/` one file per step, so you can diff them
- `src/lib/` holds, waiting room, rate limit, cache, seats
- `src/mock-gateway.ts` pretend card gateway: authorize, capture, void, signed webhooks
- `src/worker.ts` picks emails and PDF tickets off the queue
- `scripts/` the tests

## Using MySQL instead

The ideas are identical. The SQL differs in small ways:

| Here (PostgreSQL) | MySQL |
|---|---|
| `$1, $2` placeholders | `?` placeholders (mysql2 driver) |
| `UPDATE ... WHERE status = 'available'`, then check `rowCount` | the same, check `affectedRows` |
| `INSERT ... ON CONFLICT DO NOTHING` | `INSERT IGNORE` |
| `serial`, `jsonb` | `INT AUTO_INCREMENT`, `JSON` |

Note that MySQL's default isolation level is REPEATABLE READ, not READ COMMITTED, but the read-then-write race in step 3 happens there too.

## License

MIT

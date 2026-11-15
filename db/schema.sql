DROP TABLE IF EXISTS tickets, seats, idempotency_keys, payments, webhook_events CASCADE;

CREATE TABLE seats (
  event_id int  NOT NULL,
  id       text NOT NULL,
  status   text NOT NULL DEFAULT 'available',
  PRIMARY KEY (event_id, id)
);

CREATE TABLE tickets (
  id         serial PRIMARY KEY,
  event_id   int  NOT NULL,
  seat_id    text NOT NULL,
  fan_id     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event 42: 5,000 seats, rows A..Y, seats 1..200 (A1 ... Y200)
INSERT INTO seats (event_id, id)
SELECT 42, chr(64 + r) || s
FROM generate_series(1, 25) r, generate_series(1, 200) s;

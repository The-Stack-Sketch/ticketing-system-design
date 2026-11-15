-- Step 8: idempotency keys, payments and webhook de-duplication.
CREATE TABLE idempotency_keys (
  key          text PRIMARY KEY,
  request_hash text NOT NULL,
  status       text NOT NULL,            -- 'in_progress' | 'done'
  response     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id               serial PRIMARY KEY,
  order_key        text UNIQUE NOT NULL,  -- the idempotency key of the checkout
  authorization_id text NOT NULL,
  amount           int  NOT NULL,         -- cents, never a float
  status           text NOT NULL          -- 'authorized' | 'captured' | 'voided'
);

CREATE TABLE webhook_events (
  id          text PRIMARY KEY,           -- the gateway's event id
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Step 4: the safety net. Two tickets for one seat can no longer exist.
ALTER TABLE tickets ADD UNIQUE (event_id, seat_id);

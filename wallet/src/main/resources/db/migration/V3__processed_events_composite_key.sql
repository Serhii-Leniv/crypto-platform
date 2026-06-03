-- Fix idempotency dedupe: before this migration, processed_events had a unique constraint
-- on event_id alone, which meant ORDER_PLACED and ORDER_CANCELLED (sharing the same orderId)
-- couldn't both be recorded. The cancel side was silently skipped → wallet funds never unlocked.
-- Switch to composite uniqueness on (event_id, event_type) so each event-type per id is dedup'd
-- independently.

ALTER TABLE processed_events DROP CONSTRAINT IF EXISTS processed_events_event_id_key;
DROP INDEX IF EXISTS idx_event_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_id_type ON processed_events (event_id, event_type);

-- Convert all wall-clock TIMESTAMP columns to TIMESTAMP WITH TIME ZONE so the wire format
-- can round-trip a real instant (with the 'Z' suffix) instead of the timezone-less ISO that
-- browsers misinterpret as local time. Existing rows were written by a UTC JVM, so we tag
-- them as UTC during the conversion. See ADR-0010.

ALTER TABLE orders
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE trading_pairs
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC';

ALTER TABLE outbox_events
    ALTER COLUMN created_at   TYPE TIMESTAMP WITH TIME ZONE USING created_at   AT TIME ZONE 'UTC',
    ALTER COLUMN published_at TYPE TIMESTAMP WITH TIME ZONE USING published_at AT TIME ZONE 'UTC';

-- Transactional outbox for Kafka events.
-- Writing here in the same DB transaction as the business mutation makes the
-- "publish to Kafka after commit" step durable: if Kafka is down, the row
-- waits in outbox_events; on next poll the OutboxPublisher picks it up.
-- See ADR-0009.

CREATE TABLE IF NOT EXISTS outbox_events (
    id              UUID         PRIMARY KEY,
    event_type      VARCHAR(40)  NOT NULL,
    aggregate_id    UUID         NOT NULL,
    payload         TEXT         NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT now(),
    published_at    TIMESTAMP    NULL,
    attempts        INTEGER      NOT NULL DEFAULT 0,
    last_error      TEXT         NULL
);

-- Poller scans NULL-published rows in insertion order.
-- Partial index keeps the working set tiny once events are flushed.
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
    ON outbox_events (created_at)
    WHERE published_at IS NULL;

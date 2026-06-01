CREATE TABLE IF NOT EXISTS failed_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic       VARCHAR(100) NOT NULL,
    partition   INTEGER      NOT NULL,
    "offset"    BIGINT       NOT NULL,
    key         VARCHAR(255),
    payload     TEXT         NOT NULL,
    error_message TEXT,
    error_class VARCHAR(255),
    failed_at   TIMESTAMP    NOT NULL DEFAULT now(),
    replayed    BOOLEAN      NOT NULL DEFAULT false,
    replayed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_failed_topic    ON failed_events (topic);
CREATE INDEX IF NOT EXISTS idx_failed_replayed ON failed_events (replayed);

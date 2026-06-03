-- Rename failed_events.partition and "offset" to safer names so Hibernate's
-- ddl-auto can stay aligned with Flyway. Postgres treats "offset" as a reserved
-- keyword and the entity's JPA mapping needs to avoid emitting bare `offset`
-- in CREATE statements (e.g. in test profile where Flyway is disabled).

ALTER TABLE failed_events RENAME COLUMN partition  TO kafka_partition;
ALTER TABLE failed_events RENAME COLUMN "offset"   TO kafka_offset;

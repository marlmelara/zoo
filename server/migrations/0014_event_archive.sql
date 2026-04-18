-- ============================================================
-- COOG ZOO — Migration 0014
-- Soft-archive support for events. An archived event is hidden
-- from public/admin listings but its row is preserved so existing
-- tickets and receipts still resolve via their event_id FK.
-- Archives are NOT reversible (mirrors the user's spec: "create
-- a new event if you want to bring it back").
-- ============================================================

USE coog_zoo;

ALTER TABLE events
    ADD COLUMN is_archived  TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN archived_at  DATETIME   NULL;

CREATE INDEX idx_events_archived ON events(is_archived, event_date);

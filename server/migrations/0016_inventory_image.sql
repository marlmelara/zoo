-- ============================================================
-- COOG ZOO — Migration 0016
-- Retail inventory now supports inline image uploads (stored as
-- base64 data URLs). TEXT tops out at 64 KB which isn't enough
-- headroom for a compressed JPEG/PNG + base64 overhead, so bump
-- image_url to MEDIUMTEXT (~16 MB).
-- ============================================================

USE coog_zoo;

ALTER TABLE inventory
    MODIFY COLUMN image_url MEDIUMTEXT;

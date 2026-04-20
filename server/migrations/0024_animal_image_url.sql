-- ============================================================
-- COOG ZOO — Migration 0024
-- Adds an optional image_url column to animals so the public
-- Meet Our Animals gallery can show the real resident photo
-- instead of the hard-coded species stand-ins.
-- ============================================================

USE coog_zoo;

-- Some environments may already have the column from a hand-run ALTER;
-- guard against duplicate-column errors so the migration is idempotent.
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name   = 'animals'
       AND column_name  = 'image_url'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE animals ADD COLUMN image_url TEXT NULL AFTER date_of_birth',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

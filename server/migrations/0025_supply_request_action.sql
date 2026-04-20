-- ============================================================
-- COOG ZOO — Migration 0025
-- Adds an `action` column to supply_requests so employees can
-- propose restock-AND-removal operations through the same pipe.
-- Default is 'restock' so legacy rows keep their existing meaning.
-- ============================================================

USE coog_zoo;

SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name   = 'supply_requests'
       AND column_name  = 'action'
);
SET @sql := IF(@col_exists = 0,
    "ALTER TABLE supply_requests
        ADD COLUMN action ENUM('restock','remove') NOT NULL DEFAULT 'restock'
        AFTER supply_type",
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

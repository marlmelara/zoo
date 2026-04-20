-- ============================================================
-- COOG ZOO — Migration 0027
-- Denormalises the reviewer's first/last name onto supply_requests
-- so the name survives even if the reviewing employee is later
-- removed (is_active = 0) or hard-deleted (FK becomes NULL under
-- ON DELETE SET NULL). The live JOIN still wins when present;
-- the snapshot is a fallback used when the JOIN returns NULL.
-- Also backfills existing approved/denied rows from the current
-- join so historical logs regain their "approved by <name>" text.
-- ============================================================

USE coog_zoo;

-- first_name snapshot
SET @has_first := (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name   = 'supply_requests'
       AND column_name  = 'reviewer_first_name'
);
SET @sql := IF(@has_first = 0,
    "ALTER TABLE supply_requests
        ADD COLUMN reviewer_first_name VARCHAR(100) DEFAULT NULL AFTER reviewed_by",
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- last_name snapshot
SET @has_last := (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name   = 'supply_requests'
       AND column_name  = 'reviewer_last_name'
);
SET @sql := IF(@has_last = 0,
    "ALTER TABLE supply_requests
        ADD COLUMN reviewer_last_name VARCHAR(100) DEFAULT NULL AFTER reviewer_first_name",
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill snapshots for historical reviews. Uses the live employees
-- row if the FK still resolves; safe to re-run (only fills NULLs).
UPDATE supply_requests sr
  LEFT JOIN employees e ON sr.reviewed_by = e.employee_id
   SET sr.reviewer_first_name = e.first_name,
       sr.reviewer_last_name  = e.last_name
 WHERE sr.reviewed_by IS NOT NULL
   AND sr.reviewer_first_name IS NULL
   AND sr.reviewer_last_name  IS NULL;

-- ============================================================
-- COOG ZOO — Migration 0029
-- The care log started as a free-text notes field. To match the
-- medical-record UX it now carries structured context: how long
-- the care took, the animal's observed mood, and a follow-up
-- flag with an optional note. Columns are all nullable so legacy
-- rows keep working — the form just renders blanks for them.
-- Idempotent.
-- ============================================================

USE coog_zoo;

-- duration_minutes
SET @has_dur := (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name   = 'animal_care_log'
       AND column_name  = 'duration_minutes'
);
SET @sql := IF(@has_dur = 0,
    "ALTER TABLE animal_care_log
       ADD COLUMN duration_minutes INT DEFAULT NULL AFTER log_type",
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- mood (enum-ish varchar so we can evolve without a schema change)
SET @has_mood := (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name   = 'animal_care_log'
       AND column_name  = 'mood'
);
SET @sql := IF(@has_mood = 0,
    "ALTER TABLE animal_care_log
       ADD COLUMN mood VARCHAR(30) DEFAULT NULL AFTER duration_minutes",
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- followup_needed + followup_note — mirror medical's next_followup_date.
SET @has_fn := (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name   = 'animal_care_log'
       AND column_name  = 'followup_needed'
);
SET @sql := IF(@has_fn = 0,
    "ALTER TABLE animal_care_log
       ADD COLUMN followup_needed TINYINT(1) NOT NULL DEFAULT 0 AFTER mood",
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fnn := (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name   = 'animal_care_log'
       AND column_name  = 'followup_note'
);
SET @sql := IF(@has_fnn = 0,
    "ALTER TABLE animal_care_log
       ADD COLUMN followup_note VARCHAR(500) DEFAULT NULL AFTER followup_needed",
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

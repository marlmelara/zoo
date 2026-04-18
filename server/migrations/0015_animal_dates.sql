-- ============================================================
-- COOG ZOO — Migration 0015
-- Explicit arrival + departure tracking for animals. Existing
-- `is_active` becomes a derived flag ("currently at the zoo"),
-- and `departed_date` is the authoritative "when". When an
-- animal is restored from Departed the date is cleared.
-- ============================================================

USE coog_zoo;

ALTER TABLE animals
    ADD COLUMN arrived_date  DATE NULL,
    ADD COLUMN departed_date DATE NULL;

-- Backfill: treat every existing animal as having arrived today if
-- no better date is known. Animals already flagged is_active = 0
-- are assumed to have departed today so the UI shows *a* date
-- rather than a blank.
UPDATE animals
   SET arrived_date = COALESCE(arrived_date, CURDATE());

UPDATE animals
   SET departed_date = CURDATE()
 WHERE is_active = 0 AND departed_date IS NULL;

CREATE INDEX idx_animals_departed_date ON animals(departed_date);

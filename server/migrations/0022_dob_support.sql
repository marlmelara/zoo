-- ============================================================
-- COOG ZOO — Migration 0022
-- Add date-of-birth support to employees + animals. Customers
-- already track DOB; this extends the same column to everyone.
--
-- Animal rule: date_of_birth must never be AFTER the first
-- arrived_date. Born-at-zoo animals share the same date; animals
-- we acquired have a DOB strictly before they arrived. Enforced
-- via a CHECK constraint AND validated at the API layer.
--
-- Backfill strategy: both tables have an `age` column already
-- that we can use to approximate a DOB — pick Jan 1 of
-- (today.year - age) for plausible values without inventing days
-- out of thin air. Idempotent via COALESCE.
-- ============================================================

USE coog_zoo;

-- ─── employees ──────────────────────────────────────────────
-- MySQL 8 doesn't support `ADD COLUMN IF NOT EXISTS`; the runner
-- swallows "Duplicate column" errors so this is safely idempotent.
ALTER TABLE employees
    ADD COLUMN date_of_birth DATE NULL;

-- Nothing to backfill by age — employees don't store one. Leave NULL
-- for existing rows; the Create User form now collects this for new hires.

-- ─── animals ────────────────────────────────────────────────
ALTER TABLE animals
    ADD COLUMN date_of_birth DATE NULL;

-- Backfill plausible DOBs for existing animals: Jan 1 of (current
-- year − age). If arrived_date sits before that plausible DOB (e.g.
-- an animal that has been here longer than its age implies), slide
-- the DOB back further so the invariant holds.
UPDATE animals
   SET date_of_birth = LEAST(
           STR_TO_DATE(CONCAT(YEAR(CURDATE()) - COALESCE(age, 0), '-01-01'), '%Y-%m-%d'),
           COALESCE(arrived_date, CURDATE())
       )
 WHERE date_of_birth IS NULL
   AND age IS NOT NULL;

-- Enforce DOB ≤ arrived_date. NULL arrived_date skips the check
-- (legacy rows may not have one).
ALTER TABLE animals
    ADD CONSTRAINT chk_animal_dob_before_arrival
    CHECK (
        date_of_birth IS NULL
     OR arrived_date  IS NULL
     OR date_of_birth <= arrived_date
    );

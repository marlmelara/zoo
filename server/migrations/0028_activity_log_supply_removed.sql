-- ============================================================
-- COOG ZOO — Migration 0028
-- The activity_log_chk_1 CHECK constraint whitelists action_type
-- values. When the "Remove" supply-request flow landed the
-- constraint still predated it, so approving a Remove request
-- failed with:
--   "Check constraint 'activity_log_chk_1' is violated."
-- This migration drops the old constraint and re-adds it with
-- `supply_removed` included so approve-&-remove (and the new
-- manager-driven write-off endpoints) can log properly.
-- Idempotent: only re-adds if missing or if the old one lacks
-- the new value.
-- ============================================================

USE coog_zoo;

-- Drop the existing constraint if present.
SET @has_chk := (
    SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND CONSTRAINT_NAME   = 'activity_log_chk_1'
);
SET @sql := IF(@has_chk > 0,
    'ALTER TABLE activity_log DROP CHECK activity_log_chk_1',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Re-add it with supply_removed included.
ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_chk_1 CHECK (action_type IN (
    'supply_request_created',
    'supply_request_approved',
    'supply_request_denied',
    'supply_restocked',
    'supply_removed',
    'employee_created',
    'employee_updated',
    'employee_deactivated',
    'employee_reactivated',
    'ticket_sold',
    'event_created',
    'event_employee_assigned',
    'donation_received',
    'medical_record_added',
    'animal_added',
    'animal_vet_assigned',
    'animal_caretaker_assigned',
    'animal_departed',
    'animal_arrived',
    'inventory_updated',
    'hours_request_approved',
    'hours_request_denied',
    'customer_created',
    'customer_deactivated',
    'customer_reactivated'
  ));

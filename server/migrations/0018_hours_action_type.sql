-- ============================================================
-- COOG ZOO — Migration 0018
-- Re-classify hours-review activity-log rows that were mistakenly
-- stored with supply_request_* action_types. The route now writes
-- hours_request_approved / hours_request_denied (see hours.js), but
-- earlier approvals still sit in the table under the supply type
-- and leak into the Inventory Activity Log (filtered by the supply
-- whitelist). The existing table has a CHECK constraint that
-- whitelists action_type values, so we drop + recreate it with the
-- new hours_* types included, then backfill the old rows.
-- ============================================================

USE coog_zoo;

-- 1. Replace the CHECK constraint with one that accepts hours_request_*.
ALTER TABLE activity_log DROP CHECK activity_log_chk_1;

ALTER TABLE activity_log ADD CONSTRAINT activity_log_chk_1
    CHECK (action_type IN (
        'supply_request_created', 'supply_request_approved', 'supply_request_denied',
        'supply_restocked',
        'employee_created', 'employee_updated',
        'ticket_sold',
        'event_created', 'event_employee_assigned',
        'donation_received',
        'medical_record_added',
        'animal_added', 'animal_vet_assigned', 'animal_caretaker_assigned',
        'inventory_updated',
        'hours_request_approved', 'hours_request_denied'
    ));

-- 2. Backfill mis-classified rows.
UPDATE activity_log
   SET action_type = 'hours_request_approved'
 WHERE target_type = 'hours_request'
   AND action_type = 'supply_request_approved';

UPDATE activity_log
   SET action_type = 'hours_request_denied'
 WHERE target_type = 'hours_request'
   AND action_type = 'supply_request_denied';

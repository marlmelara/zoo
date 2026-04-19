-- ============================================================
-- COOG ZOO — Migration 0020
-- Extends activity_log.action_type to include customer_created
-- and backfills lifecycle entries for every existing animal,
-- employee, and customer so the new "Log" modal shows a complete
-- history (not just rows touched after migration 0019 landed).
--
-- Idempotent: the INSERTs use NOT EXISTS so running twice is a
-- no-op.
-- ============================================================

USE coog_zoo;

ALTER TABLE activity_log DROP CHECK activity_log_chk_1;

ALTER TABLE activity_log ADD CONSTRAINT activity_log_chk_1
    CHECK (action_type IN (
        'supply_request_created', 'supply_request_approved', 'supply_request_denied',
        'supply_restocked',
        'employee_created', 'employee_updated',
        'employee_deactivated', 'employee_reactivated',
        'ticket_sold',
        'event_created', 'event_employee_assigned',
        'donation_received',
        'medical_record_added',
        'animal_added', 'animal_vet_assigned', 'animal_caretaker_assigned',
        'animal_departed', 'animal_arrived',
        'inventory_updated',
        'hours_request_approved', 'hours_request_denied',
        'customer_created', 'customer_deactivated', 'customer_reactivated'
    ));

-- ─────────────────────────────────────────────────────────────
-- Backfill: employees. Insert one 'employee_created' row per employee
-- that doesn't already have one.
-- ─────────────────────────────────────────────────────────────
INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id, created_at)
SELECT 'employee_created',
       CONCAT('Created ', e.first_name, ' ', e.last_name),
       NULL,
       'employee',
       e.employee_id,
       COALESCE(NOW(), NOW())
  FROM employees e
 WHERE NOT EXISTS (
       SELECT 1 FROM activity_log al
        WHERE al.target_type = 'employee'
          AND al.target_id   = e.employee_id
          AND al.action_type = 'employee_created'
 );

-- For employees flagged is_active = 0 that have never been logged as
-- deactivated, stamp a deactivation row so the lifecycle modal reflects
-- the current state.
INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id, created_at)
SELECT 'employee_deactivated',
       CONCAT('Deactivated ', e.first_name, ' ', e.last_name),
       NULL,
       'employee',
       e.employee_id,
       NOW()
  FROM employees e
 WHERE e.is_active = 0
   AND NOT EXISTS (
       SELECT 1 FROM activity_log al
        WHERE al.target_type = 'employee'
          AND al.target_id   = e.employee_id
          AND al.action_type = 'employee_deactivated'
 );

-- ─────────────────────────────────────────────────────────────
-- Backfill: animals. arrived_date (if present) is the "when"; fall
-- back to CURDATE() for older rows. For departed animals, stamp
-- both an arrival and a departure so the full arc is visible.
-- ─────────────────────────────────────────────────────────────
INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id, created_at)
SELECT 'animal_added',
       CONCAT(a.name, ' added to the zoo'),
       NULL,
       'animal',
       a.animal_id,
       COALESCE(TIMESTAMP(a.arrived_date), NOW())
  FROM animals a
 WHERE NOT EXISTS (
       SELECT 1 FROM activity_log al
        WHERE al.target_type = 'animal'
          AND al.target_id   = a.animal_id
          AND al.action_type IN ('animal_added','animal_arrived')
 );

INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id, created_at)
SELECT 'animal_departed',
       CONCAT(a.name, ' departed the zoo'),
       NULL,
       'animal',
       a.animal_id,
       COALESCE(TIMESTAMP(a.departed_date), NOW())
  FROM animals a
 WHERE a.is_active = 0
   AND NOT EXISTS (
       SELECT 1 FROM activity_log al
        WHERE al.target_type = 'animal'
          AND al.target_id   = a.animal_id
          AND al.action_type = 'animal_departed'
 );

-- ─────────────────────────────────────────────────────────────
-- Backfill: customers. Uses created_at from the customers row as the
-- timestamp so the lifecycle matches when the account actually opened.
-- ─────────────────────────────────────────────────────────────
INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id, created_at)
SELECT 'customer_created',
       CONCAT(c.first_name, ' ', c.last_name, ' signed up'),
       NULL,
       'customer',
       c.customer_id,
       COALESCE(c.created_at, NOW())
  FROM customers c
 WHERE NOT EXISTS (
       SELECT 1 FROM activity_log al
        WHERE al.target_type = 'customer'
          AND al.target_id   = c.customer_id
          AND al.action_type = 'customer_created'
 );

INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id, created_at)
SELECT 'customer_deactivated',
       CONCAT(c.first_name, ' ', c.last_name, ' deactivated their account'),
       NULL,
       'customer',
       c.customer_id,
       NOW()
  FROM customers c
 WHERE c.is_active = 0
   AND NOT EXISTS (
       SELECT 1 FROM activity_log al
        WHERE al.target_type = 'customer'
          AND al.target_id   = c.customer_id
          AND al.action_type = 'customer_deactivated'
 );

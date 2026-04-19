-- ============================================================
-- COOG ZOO — Migration 0017
-- Tighten notification delivery so only the RELEVANT manager +
-- admins get pinged.
--   * Retail low-stock → only the Retail & Operations manager
--     (was notifying every manager across every dept).
--   * Animal sickness → only Vet / Animal Care dept managers
--     (was notifying every assigned vet + caretaker individually;
--      per product rule, non-manager employees don't receive
--      notifications).
--   * Cleanup: delete previously-delivered notifications that
--     don't match the new scope so the inbox reflects reality.
-- ============================================================

USE coog_zoo;

DROP TRIGGER IF EXISTS trg_inventory_low_stock_notify;
DROP TRIGGER IF EXISTS trg_animal_sick_notify;

DELIMITER //

-- ── Rebuilt: retail low-stock ─────────────────────────────────
-- Retail inventory belongs to the Retail & Operations manager —
-- a vet/caretaker/security manager doesn't stock the gift shop,
-- so notifying them was noise. "Retail manager" = any manager
-- whose dept_name contains "retail" (case-insensitive) to tolerate
-- naming variations ("Retail", "Retail & Operations").
CREATE TRIGGER trg_inventory_low_stock_notify
AFTER UPDATE ON inventory
FOR EACH ROW
BEGIN
    IF NEW.stock_count <= NEW.restock_threshold
       AND OLD.stock_count >  OLD.restock_threshold THEN
        -- Retail dept managers only
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        SELECT e.employee_id, 'low_stock',
               'Low retail stock',
               CONCAT(NEW.item_name, ' is low: ',
                      NEW.stock_count, ' remaining (threshold ',
                      NEW.restock_threshold, ').'),
               'inventory', NEW.item_id
          FROM employees e
          LEFT JOIN departments d ON d.dept_id = e.dept_id
         WHERE e.role = 'manager'
           AND e.is_active = 1
           AND LOWER(COALESCE(d.dept_name, '')) LIKE '%retail%';

        -- All admins
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        SELECT employee_id, 'low_stock',
               'Low retail stock',
               CONCAT(NEW.item_name, ' is low: ',
                      NEW.stock_count, ' remaining (threshold ',
                      NEW.restock_threshold, ').'),
               'inventory', NEW.item_id
          FROM employees
         WHERE role = 'admin'
           AND is_active = 1;
    END IF;
END//

-- ── Rebuilt: animal-sick notify ───────────────────────────────
-- Scope now matches the product rule: only managers + admins get
-- notifications. The Vet / Animal Care dept managers act on
-- sick-animal reports; individual assigned vets/caretakers used to
-- be pinged too but no longer are (they track their animals
-- through the My Animals tab instead).
CREATE TRIGGER trg_animal_sick_notify
AFTER UPDATE ON animals
FOR EACH ROW
BEGIN
    IF NEW.health_status IN ('sick','critical')
       AND (OLD.health_status IS NULL OR OLD.health_status NOT IN ('sick','critical'))
    THEN
        -- Vet / Animal Care managers
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        SELECT e.employee_id, 'animal_health',
               CASE WHEN NEW.health_status = 'critical'
                    THEN CONCAT('CRITICAL: ', NEW.name, ' needs urgent care')
                    ELSE CONCAT(NEW.name, ' is sick')
               END,
               CONCAT(NEW.name, ' (', NEW.species_common_name,
                      ') was flagged as ', NEW.health_status, '.'),
               'animal', NEW.animal_id
          FROM employees e
          LEFT JOIN departments d ON d.dept_id = e.dept_id
         WHERE e.role = 'manager'
           AND e.is_active = 1
           AND (LOWER(COALESCE(d.dept_name, '')) LIKE '%vet%'
                OR LOWER(COALESCE(d.dept_name, '')) LIKE '%animal%'
                OR LOWER(COALESCE(d.dept_name, '')) LIKE '%care%');

        -- All admins
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        SELECT employee_id, 'animal_health',
               CASE WHEN NEW.health_status = 'critical'
                    THEN CONCAT('CRITICAL: ', NEW.name, ' needs urgent care')
                    ELSE CONCAT(NEW.name, ' is sick')
               END,
               CONCAT(NEW.name, ' (', NEW.species_common_name,
                      ') was flagged as ', NEW.health_status, '.'),
               'animal', NEW.animal_id
          FROM employees
         WHERE role = 'admin'
           AND is_active = 1;
    END IF;
END//

DELIMITER ;

-- ──────────────────────────────────────────────────────────────
-- Cleanup: purge previously-delivered notifications that violate
-- the new scope. Without this, the inbox would still show stale
-- "Low retail stock" rows on Sarah's (vet manager) dashboard.
-- ──────────────────────────────────────────────────────────────

-- Any notification addressed to a non-admin/non-manager employee.
DELETE n FROM notifications n
  JOIN employees e ON e.employee_id = n.recipient_id
 WHERE e.role NOT IN ('admin', 'manager');

-- Retail low-stock notifications delivered to non-retail managers.
DELETE n FROM notifications n
  JOIN employees e   ON e.employee_id = n.recipient_id
  LEFT JOIN departments d ON d.dept_id = e.dept_id
 WHERE n.notification_type = 'low_stock'
   AND n.target_type       = 'inventory'
   AND e.role              = 'manager'
   AND LOWER(COALESCE(d.dept_name, '')) NOT LIKE '%retail%';

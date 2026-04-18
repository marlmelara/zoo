-- ============================================================
-- COOG ZOO — Migration 0013
-- Replace the "employee #N" / "Employee #N" fragments in notify
-- triggers with the employee's actual name. Animal-sick trigger
-- already uses the animal's name.
-- ============================================================

USE coog_zoo;

DROP TRIGGER IF EXISTS trg_supply_request_notify;
DROP TRIGGER IF EXISTS trg_hours_request_notify;

DELIMITER //

-- ── Rebuilt: supply-request notify ─────────────────────────────
CREATE TRIGGER trg_supply_request_notify
AFTER INSERT ON supply_requests
FOR EACH ROW
BEGIN
    DECLARE mgr_id    INT           DEFAULT NULL;
    DECLARE requester VARCHAR(255)  DEFAULT NULL;

    -- Pull the requester's name + their dept manager in one go.
    SELECT d.manager_id,
           CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))
      INTO mgr_id, requester
      FROM employees e
      LEFT JOIN departments d ON d.dept_id = e.dept_id
     WHERE e.employee_id = NEW.requested_by
     LIMIT 1;

    IF requester IS NULL OR TRIM(requester) = '' THEN
        SET requester = 'an employee';
    END IF;

    -- Notify the department manager (skip if the manager IS the requester).
    IF mgr_id IS NOT NULL AND mgr_id <> NEW.requested_by THEN
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        VALUES
            (mgr_id, 'supply_request',
             'New supply request',
             CONCAT(requester, ' requested ', NEW.requested_quantity,
                    ' x ', NEW.item_name, '. Awaiting your review.'),
             'supply_request', NEW.request_id);
    END IF;

    -- Notify every admin too.
    INSERT INTO notifications
        (recipient_id, notification_type, title, message, target_type, target_id)
    SELECT employee_id, 'supply_request',
           'New supply request',
           CONCAT(requester, ' requested ', NEW.requested_quantity,
                  ' x ', NEW.item_name, '.'),
           'supply_request', NEW.request_id
      FROM employees
     WHERE role = 'admin'
       AND is_active = 1
       AND employee_id <> NEW.requested_by;
END//

-- ── Rebuilt: hours-request notify ──────────────────────────────
CREATE TRIGGER trg_hours_request_notify
AFTER INSERT ON hours_requests
FOR EACH ROW
BEGIN
    DECLARE mgr_id   INT           DEFAULT NULL;
    DECLARE emp_name VARCHAR(255)  DEFAULT NULL;

    SELECT d.manager_id,
           CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))
      INTO mgr_id, emp_name
      FROM employees e
      LEFT JOIN departments d ON d.dept_id = e.dept_id
     WHERE e.employee_id = NEW.employee_id
     LIMIT 1;

    IF emp_name IS NULL OR TRIM(emp_name) = '' THEN
        SET emp_name = 'An employee';
    END IF;

    IF mgr_id IS NOT NULL AND mgr_id <> NEW.employee_id THEN
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        VALUES
            (mgr_id, 'hours_request',
             'New hours submission',
             CONCAT(emp_name, ' submitted an hours request for review.'),
             'hours_request', NEW.request_id);
    END IF;

    INSERT INTO notifications
        (recipient_id, notification_type, title, message, target_type, target_id)
    SELECT employee_id, 'hours_request',
           'New hours submission',
           CONCAT(emp_name, ' submitted an hours request.'),
           'hours_request', NEW.request_id
      FROM employees
     WHERE role = 'admin'
       AND is_active = 1
       AND employee_id <> NEW.employee_id
       AND (mgr_id IS NULL OR employee_id <> mgr_id);
END//

DELIMITER ;

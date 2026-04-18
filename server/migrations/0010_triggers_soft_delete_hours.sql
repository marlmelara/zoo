-- ============================================================
-- COOG ZOO — Migration 0010
-- Soft-delete columns, notifications table, hours-request system,
-- and MySQL triggers for: supply-request notify, low-stock notify,
-- and hours-request notify.
-- Run against the coog_zoo database.
-- ============================================================

USE coog_zoo;

-- ──────────────────────────────────────────────────────────────
-- 1. SOFT DELETE COLUMNS
-- ──────────────────────────────────────────────────────────────
ALTER TABLE customers ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE employees ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE animals   ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

CREATE INDEX idx_customers_active ON customers(is_active);
CREATE INDEX idx_employees_active ON employees(is_active);
CREATE INDEX idx_animals_active   ON animals(is_active);

-- ──────────────────────────────────────────────────────────────
-- 2. NOTIFICATIONS
--    Produced by triggers; consumed by managers/admins via the API.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    notification_id  INT AUTO_INCREMENT PRIMARY KEY,
    recipient_id     INT NOT NULL,                 -- employee_id of the recipient
    notification_type VARCHAR(50) NOT NULL,        -- 'supply_request','low_stock','hours_request', ...
    title            VARCHAR(255) NOT NULL,
    message          TEXT NOT NULL,
    target_type      VARCHAR(50),                  -- 'supply_request','inventory','operational_supply','hours_request'
    target_id        INT,
    is_read          TINYINT(1) NOT NULL DEFAULT 0,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipient_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at);

-- ──────────────────────────────────────────────────────────────
-- 3. HOURS REQUESTS
--    An employee submits a batch of hours (one request, many entries).
--    The dept manager reviews and approves/denies the whole request.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hours_requests (
    request_id   INT AUTO_INCREMENT PRIMARY KEY,
    employee_id  INT NOT NULL,
    status       ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
    reviewed_by  INT,
    reviewed_at  DATETIME,
    review_notes TEXT,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES employees(employee_id) ON DELETE SET NULL
);
CREATE INDEX idx_hours_requests_emp    ON hours_requests(employee_id, created_at);
CREATE INDEX idx_hours_requests_status ON hours_requests(status, created_at);

CREATE TABLE IF NOT EXISTS hours_request_entries (
    entry_id    INT AUTO_INCREMENT PRIMARY KEY,
    request_id  INT NOT NULL,
    work_date   DATE NOT NULL,
    hours       DECIMAL(4,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
    description TEXT,
    FOREIGN KEY (request_id) REFERENCES hours_requests(request_id) ON DELETE CASCADE
);
CREATE INDEX idx_hours_entries_request ON hours_request_entries(request_id);

-- ──────────────────────────────────────────────────────────────
-- 4. TRIGGERS
-- ──────────────────────────────────────────────────────────────

-- Drop existing triggers so this migration is re-runnable.
DROP TRIGGER IF EXISTS trg_supply_request_notify;
DROP TRIGGER IF EXISTS trg_inventory_low_stock_notify;
DROP TRIGGER IF EXISTS trg_op_supplies_low_stock_notify;
DROP TRIGGER IF EXISTS trg_hours_request_notify;

DELIMITER //

-- ── Trigger #1 ────────────────────────────────────────────────
-- When a supply request is created, notify the department manager
-- (and any admins) of the employee who submitted it.
CREATE TRIGGER trg_supply_request_notify
AFTER INSERT ON supply_requests
FOR EACH ROW
BEGIN
    DECLARE mgr_id INT DEFAULT NULL;

    -- Find the department manager of the requester.
    SELECT d.manager_id
      INTO mgr_id
      FROM employees e
      LEFT JOIN departments d ON d.dept_id = e.dept_id
     WHERE e.employee_id = NEW.requested_by
     LIMIT 1;

    -- Notify the manager (if one exists and isn't the requester themselves).
    IF mgr_id IS NOT NULL AND mgr_id <> NEW.requested_by THEN
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        VALUES
            (mgr_id, 'supply_request',
             'New supply request',
             CONCAT('Request for ', NEW.requested_quantity, ' x ', NEW.item_name,
                    ' is awaiting your review.'),
             'supply_request', NEW.request_id);
    END IF;

    -- Always notify admins too.
    INSERT INTO notifications
        (recipient_id, notification_type, title, message, target_type, target_id)
    SELECT employee_id, 'supply_request',
           'New supply request',
           CONCAT('Request for ', NEW.requested_quantity, ' x ', NEW.item_name,
                  ' submitted by employee #', NEW.requested_by),
           'supply_request', NEW.request_id
      FROM employees
     WHERE role = 'admin'
       AND is_active = 1
       AND employee_id <> NEW.requested_by;
END//

-- ── Trigger #2 ────────────────────────────────────────────────
-- When retail inventory stock drops to/below its threshold (and was
-- above before), notify every admin + manager. Only fires on the
-- transition so we don't spam on every decrement.
CREATE TRIGGER trg_inventory_low_stock_notify
AFTER UPDATE ON inventory
FOR EACH ROW
BEGIN
    IF NEW.stock_count <= NEW.restock_threshold
       AND OLD.stock_count >  OLD.restock_threshold THEN
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        SELECT employee_id, 'low_stock',
               'Low retail stock',
               CONCAT(NEW.item_name, ' is low: ',
                      NEW.stock_count, ' remaining (threshold ',
                      NEW.restock_threshold, ').'),
               'inventory', NEW.item_id
          FROM employees
         WHERE role IN ('admin','manager')
           AND is_active = 1;
    END IF;
END//

-- ── Trigger #3 ────────────────────────────────────────────────
-- Same low-stock alert but for operational supplies. Scoped to the
-- dept manager + all admins.
CREATE TRIGGER trg_op_supplies_low_stock_notify
AFTER UPDATE ON operational_supplies
FOR EACH ROW
BEGIN
    DECLARE mgr_id INT DEFAULT NULL;

    IF NEW.stock_count <= NEW.restock_threshold
       AND OLD.stock_count >  OLD.restock_threshold THEN

        SELECT manager_id INTO mgr_id
          FROM departments
         WHERE dept_id = NEW.department_id
         LIMIT 1;

        IF mgr_id IS NOT NULL THEN
            INSERT INTO notifications
                (recipient_id, notification_type, title, message, target_type, target_id)
            VALUES
                (mgr_id, 'low_stock',
                 'Low operational supply',
                 CONCAT(NEW.item_name, ' is low: ',
                        NEW.stock_count, ' remaining (threshold ',
                        NEW.restock_threshold, ').'),
                 'operational_supply', NEW.supply_id);
        END IF;

        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        SELECT employee_id, 'low_stock',
               'Low operational supply',
               CONCAT(NEW.item_name, ' is low: ',
                      NEW.stock_count, ' remaining (threshold ',
                      NEW.restock_threshold, ').'),
               'operational_supply', NEW.supply_id
          FROM employees
         WHERE role = 'admin'
           AND is_active = 1
           AND (mgr_id IS NULL OR employee_id <> mgr_id);
    END IF;
END//

-- ── Trigger #4 ────────────────────────────────────────────────
-- Hours-request notification: when an employee submits a new hours
-- request, notify their dept manager (and admins).
CREATE TRIGGER trg_hours_request_notify
AFTER INSERT ON hours_requests
FOR EACH ROW
BEGIN
    DECLARE mgr_id INT DEFAULT NULL;

    SELECT d.manager_id
      INTO mgr_id
      FROM employees e
      LEFT JOIN departments d ON d.dept_id = e.dept_id
     WHERE e.employee_id = NEW.employee_id
     LIMIT 1;

    IF mgr_id IS NOT NULL AND mgr_id <> NEW.employee_id THEN
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        VALUES
            (mgr_id, 'hours_request',
             'New hours submission',
             CONCAT('Employee #', NEW.employee_id,
                    ' submitted an hours request for review.'),
             'hours_request', NEW.request_id);
    END IF;

    INSERT INTO notifications
        (recipient_id, notification_type, title, message, target_type, target_id)
    SELECT employee_id, 'hours_request',
           'New hours submission',
           CONCAT('Employee #', NEW.employee_id,
                  ' submitted an hours request for review.'),
           'hours_request', NEW.request_id
      FROM employees
     WHERE role = 'admin'
       AND is_active = 1
       AND employee_id <> NEW.employee_id
       AND (mgr_id IS NULL OR employee_id <> mgr_id);
END//

DELIMITER ;

-- ──────────────────────────────────────────────────────────────
-- Done.
-- To verify triggers are installed:
--   SHOW TRIGGERS FROM coog_zoo;
-- To verify tables:
--   SHOW CREATE TABLE notifications;
--   SHOW CREATE TABLE hours_requests;
--   SHOW CREATE TABLE hours_request_entries;
-- ──────────────────────────────────────────────────────────────

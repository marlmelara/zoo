-- ============================================================
-- COOG ZOO — Migration 0026
-- Broaden the sick-animal alert so every clinician-adjacent
-- employee is notified, not just managers.
--
-- Who receives an animal_health notification on a transition into
-- sick/critical:
--   * Every active admin
--   * Every active vet
--   * Every active animal caretaker
--   * Every active manager of the Vet / Animal-Care departments
--     (dept name contains "vet", "animal", or "care")
--
-- Union ensures assigned vets/caretakers are always covered
-- (they are, by definition, vets/caretakers).
-- ============================================================

USE coog_zoo;

DROP TRIGGER IF EXISTS trg_animal_sick_notify;

DELIMITER //

CREATE TRIGGER trg_animal_sick_notify
AFTER UPDATE ON animals
FOR EACH ROW
BEGIN
    IF NEW.health_status IN ('sick','critical')
       AND (OLD.health_status IS NULL OR OLD.health_status NOT IN ('sick','critical'))
    THEN
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        SELECT DISTINCT e.employee_id,
               'animal_health',
               CASE WHEN NEW.health_status = 'critical'
                    THEN CONCAT('CRITICAL: ', NEW.name, ' needs urgent care')
                    ELSE CONCAT(NEW.name, ' is sick')
               END,
               CONCAT(NEW.name, ' (', NEW.species_common_name,
                      ') was flagged as ', NEW.health_status, '.'),
               'animal', NEW.animal_id
          FROM employees e
          LEFT JOIN departments d ON d.dept_id = e.dept_id
         WHERE e.is_active = 1
           AND (
                 -- admins + all clinical staff
                 e.role IN ('admin', 'vet', 'caretaker')
                 OR (e.role = 'manager'
                     AND (LOWER(COALESCE(d.dept_name, '')) LIKE '%vet%'
                       OR LOWER(COALESCE(d.dept_name, '')) LIKE '%animal%'
                       OR LOWER(COALESCE(d.dept_name, '')) LIKE '%care%'))
           );
    END IF;
END//

DELIMITER ;

-- Verify:
--   SHOW CREATE TRIGGER trg_animal_sick_notify;

-- ============================================================
-- COOG ZOO — Migration 0012
-- Expanded medical records + animal health-status flag +
-- animal care log + "animal sick" trigger that notifies the
-- assigned vets/caretakers until the animal is marked healthy.
-- ============================================================

USE coog_zoo;

-- ──────────────────────────────────────────────────────────────
-- 1. ANIMAL HEALTH STATUS (quick-look flag)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE animals
    ADD COLUMN health_status
        ENUM('healthy','under_observation','sick','critical','recovering')
        NOT NULL DEFAULT 'healthy';
ALTER TABLE animals
    ADD COLUMN last_health_update DATETIME NULL;

CREATE INDEX idx_animals_health_status ON animals(health_status);

-- ──────────────────────────────────────────────────────────────
-- 2. EXPANDED MEDICAL HISTORY
--    Adds the fields a real vet record would carry.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE medical_history
    ADD COLUMN diagnosis          TEXT AFTER disease,
    ADD COLUMN treatment          TEXT AFTER diagnosis,
    ADD COLUMN medications        TEXT AFTER treatment,
    ADD COLUMN severity           ENUM('minor','moderate','severe','critical')
                                  NOT NULL DEFAULT 'minor' AFTER medications,
    ADD COLUMN status             ENUM('active','monitoring','resolved','chronic')
                                  NOT NULL DEFAULT 'active' AFTER severity,
    ADD COLUMN weight_kg          DECIMAL(6,2) AFTER status,
    ADD COLUMN temperature_c      DECIMAL(4,1) AFTER weight_kg,
    ADD COLUMN heart_rate_bpm     INT AFTER temperature_c,
    ADD COLUMN notes              TEXT AFTER heart_rate_bpm,
    ADD COLUMN recorded_by        INT AFTER notes,
    ADD COLUMN next_followup_date DATE AFTER recorded_by,
    ADD COLUMN created_at         DATETIME DEFAULT CURRENT_TIMESTAMP AFTER next_followup_date,
    ADD COLUMN updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
    ADD CONSTRAINT fk_mh_recorded_by
        FOREIGN KEY (recorded_by) REFERENCES employees(employee_id) ON DELETE SET NULL;

CREATE INDEX idx_medical_history_status ON medical_history(status, created_at);

-- ──────────────────────────────────────────────────────────────
-- 3. ANIMAL CARE LOG — lightweight daily log of who worked on
-- which animal. Separate from medical records so non-vet
-- caretakers can write observations, feedings, cleaning, etc.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS animal_care_log (
    log_id      INT AUTO_INCREMENT PRIMARY KEY,
    animal_id   INT NOT NULL,
    employee_id INT,
    log_type    ENUM('feeding','cleaning','health_check','enrichment',
                     'observation','medication_given','behavioral','other')
                NOT NULL DEFAULT 'observation',
    notes       TEXT NOT NULL,
    logged_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (animal_id)   REFERENCES animals(animal_id)   ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE SET NULL
);
CREATE INDEX idx_care_log_animal ON animal_care_log(animal_id, logged_at);

-- ──────────────────────────────────────────────────────────────
-- 4. TRIGGERS
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_animal_sick_notify;
DROP TRIGGER IF EXISTS trg_animal_healthy_resolved;

DELIMITER //

-- ── Trigger (Animal #1): Sick animal notify ───────────────────
-- When an animal's health_status transitions TO sick or critical,
-- every vet and caretaker assigned to that animal receives a
-- persistent notification. They must log a care update or file
-- a medical record to start resolving it.
CREATE TRIGGER trg_animal_sick_notify
AFTER UPDATE ON animals
FOR EACH ROW
BEGIN
    IF NEW.health_status IN ('sick','critical')
       AND (OLD.health_status IS NULL OR OLD.health_status NOT IN ('sick','critical'))
    THEN
        -- Assigned vets
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        SELECT va.vet_id, 'animal_health',
               CASE WHEN NEW.health_status = 'critical'
                    THEN CONCAT('CRITICAL: ', NEW.name, ' needs urgent care')
                    ELSE CONCAT(NEW.name, ' is sick')
               END,
               CONCAT(NEW.name, ' (', NEW.species_common_name,
                      ') was flagged as ', NEW.health_status,
                      '. File a medical record / care log ASAP.'),
               'animal', NEW.animal_id
          FROM vet_animal_assignments va
         WHERE va.animal_id = NEW.animal_id;

        -- Assigned caretakers
        INSERT INTO notifications
            (recipient_id, notification_type, title, message, target_type, target_id)
        SELECT ca.caretaker_id, 'animal_health',
               CASE WHEN NEW.health_status = 'critical'
                    THEN CONCAT('CRITICAL: ', NEW.name, ' needs urgent care')
                    ELSE CONCAT(NEW.name, ' is sick')
               END,
               CONCAT(NEW.name, ' (', NEW.species_common_name,
                      ') was flagged as ', NEW.health_status,
                      '. Post a care-log update on its condition.'),
               'animal', NEW.animal_id
          FROM caretaker_animal_assignments ca
         WHERE ca.animal_id = NEW.animal_id;
    END IF;
END//

-- ── Trigger (Animal #2): Healthy again → resolve notifications ─
-- When the animal returns to 'healthy', every outstanding
-- animal_health notification for it auto-resolves so the sidebar
-- stops pulsing.
CREATE TRIGGER trg_animal_healthy_resolved
AFTER UPDATE ON animals
FOR EACH ROW
BEGIN
    IF NEW.health_status = 'healthy'
       AND OLD.health_status IN ('sick','critical','under_observation','recovering')
    THEN
        UPDATE notifications
           SET is_resolved = 1
         WHERE target_type = 'animal'
           AND target_id   = NEW.animal_id
           AND notification_type = 'animal_health';
    END IF;
END//

DELIMITER ;

-- ──────────────────────────────────────────────────────────────
-- Verification queries (run these to show the professor):
--
--   SHOW TRIGGERS FROM coog_zoo;
--   SHOW CREATE TRIGGER trg_supply_request_notify;
--   SHOW CREATE TRIGGER trg_inventory_low_stock_notify;
--   SHOW CREATE TRIGGER trg_hours_request_notify;
--   SHOW CREATE TRIGGER trg_animal_sick_notify;
--
-- For a structured listing with the trigger body:
--   SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE
--     FROM information_schema.TRIGGERS
--    WHERE TRIGGER_SCHEMA = 'coog_zoo'
--    ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME;
-- ──────────────────────────────────────────────────────────────

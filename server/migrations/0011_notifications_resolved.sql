-- ============================================================
-- COOG ZOO — Migration 0011
-- Make notifications "persistent until handled":
--   * add is_resolved column to notifications
--   * add triggers that auto-resolve notifications when the
--     underlying target (supply request / hours request /
--     stock level) is resolved.
-- ============================================================

USE coog_zoo;

-- ──────────────────────────────────────────────────────────────
-- 1. NEW COLUMN
-- ──────────────────────────────────────────────────────────────
ALTER TABLE notifications
    ADD COLUMN is_resolved TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX idx_notifications_unresolved
    ON notifications(recipient_id, is_resolved, created_at);

-- ──────────────────────────────────────────────────────────────
-- 2. RESOLUTION TRIGGERS
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_supply_request_resolved;
DROP TRIGGER IF EXISTS trg_hours_request_resolved;
DROP TRIGGER IF EXISTS trg_inventory_restocked_resolved;
DROP TRIGGER IF EXISTS trg_op_supplies_restocked_resolved;

DELIMITER //

-- ── Trigger R1 ────────────────────────────────────────────────
-- When a supply request leaves 'pending' (approved/denied), mark
-- every matching notification as resolved so managers only see
-- work that's still outstanding.
CREATE TRIGGER trg_supply_request_resolved
AFTER UPDATE ON supply_requests
FOR EACH ROW
BEGIN
    IF OLD.status = 'pending' AND NEW.status <> 'pending' THEN
        UPDATE notifications
           SET is_resolved = 1
         WHERE target_type = 'supply_request'
           AND target_id   = NEW.request_id;
    END IF;
END//

-- ── Trigger R2 ────────────────────────────────────────────────
-- Same idea for hours requests.
CREATE TRIGGER trg_hours_request_resolved
AFTER UPDATE ON hours_requests
FOR EACH ROW
BEGIN
    IF OLD.status = 'pending' AND NEW.status <> 'pending' THEN
        UPDATE notifications
           SET is_resolved = 1
         WHERE target_type = 'hours_request'
           AND target_id   = NEW.request_id;
    END IF;
END//

-- ── Trigger R3 ────────────────────────────────────────────────
-- When retail inventory stock goes back above threshold, clear
-- any lingering low-stock notifications for that item.
CREATE TRIGGER trg_inventory_restocked_resolved
AFTER UPDATE ON inventory
FOR EACH ROW
BEGIN
    IF NEW.stock_count >  NEW.restock_threshold
       AND OLD.stock_count <= OLD.restock_threshold THEN
        UPDATE notifications
           SET is_resolved = 1
         WHERE target_type = 'inventory'
           AND target_id   = NEW.item_id
           AND notification_type = 'low_stock';
    END IF;
END//

-- ── Trigger R4 ────────────────────────────────────────────────
-- Same for operational supplies.
CREATE TRIGGER trg_op_supplies_restocked_resolved
AFTER UPDATE ON operational_supplies
FOR EACH ROW
BEGIN
    IF NEW.stock_count >  NEW.restock_threshold
       AND OLD.stock_count <= OLD.restock_threshold THEN
        UPDATE notifications
           SET is_resolved = 1
         WHERE target_type = 'operational_supply'
           AND target_id   = NEW.supply_id
           AND notification_type = 'low_stock';
    END IF;
END//

DELIMITER ;

-- ──────────────────────────────────────────────────────────────
-- 3. Backfill: any existing supply / hours requests that are
-- already out of 'pending' status should have their
-- notifications marked resolved right now.
-- ──────────────────────────────────────────────────────────────
UPDATE notifications n
  JOIN supply_requests sr
    ON sr.request_id = n.target_id
 SET n.is_resolved = 1
 WHERE n.target_type = 'supply_request'
   AND sr.status <> 'pending';

UPDATE notifications n
  JOIN hours_requests hr
    ON hr.request_id = n.target_id
 SET n.is_resolved = 1
 WHERE n.target_type = 'hours_request'
   AND hr.status <> 'pending';

-- ──────────────────────────────────────────────────────────────
-- Verify:
--   SHOW TRIGGERS FROM coog_zoo;
--   SELECT is_resolved, COUNT(*) FROM notifications GROUP BY is_resolved;
-- ──────────────────────────────────────────────────────────────

-- ============================================================
-- COOG ZOO — Migration 0021
-- Retroactively fix the one oversold event — "Play With The
-- Otters" ended up at 41/40 because it was booked before the
-- race-safe capacity guard (000f3a5) landed. We delete the
-- orphaned excess ticket and back the counters out so the event
-- lines up at 40/40 — and the ticket never shows up on anyone's
-- "My Tickets" or receipt.
--
-- The excess ticket (ticket_id 116, customer_id NULL) was the
-- 41st allocation for event_id 12. Its transaction (#81) also
-- had no other line items, so we nuke that transaction too;
-- if there were other line items we'd only back out the event
-- portion, but inspection confirms it was a single-ticket
-- transaction.
--
-- Idempotent: the DELETEs and UPDATEs are filtered tightly so
-- re-running is a no-op after the first pass.
-- ============================================================

USE coog_zoo;

-- 1. Delete the orphan ticket (if it still exists).
DELETE FROM tickets
 WHERE ticket_id = 116
   AND event_id  = 12;

-- 2. Nuke the transaction it belonged to, if that transaction has
--    no remaining tickets (prevents wiping a multi-line receipt).
DELETE t
  FROM transactions t
  LEFT JOIN tickets tk ON tk.transaction_id = t.transaction_id
 WHERE t.transaction_id = 81
   AND tk.ticket_id IS NULL;

-- 3. Re-derive event capacity counters from the surviving ticket
--    rows so they match reality exactly (belt + suspenders).
UPDATE events e
   SET actual_attendance = (SELECT COUNT(*) FROM tickets WHERE event_id = e.event_id),
       tickets_sold      = (SELECT COUNT(*) FROM tickets WHERE event_id = e.event_id)
 WHERE e.event_id = 12;

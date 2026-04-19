-- ============================================================
-- COOG ZOO — Migration 0019
-- Expand activity_log.action_type whitelist to cover
-- deactivate/reactivate events for employees and customers,
-- and arrive/depart events for animals, so the new "Log" button
-- on staff/customer/animal profiles can show a complete
-- lifecycle history (who activated/deactivated them and when).
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
        'customer_deactivated', 'customer_reactivated'
    ));

-- ============================================================
-- COOG ZOO — Migration 0023
-- Managers now report to an admin. Every manager whose manager_id
-- is NULL gets pointed at the lowest-numbered active admin (the
-- seed "Zoo Admin" in every dev database). Going forward the
-- Create-User flow assigns this explicitly.
-- ============================================================

USE coog_zoo;

-- Prefer the literal "Zoo Admin" seed account; if that's been renamed
-- or removed, fall back to the lowest-numbered active admin so the
-- migration still leaves every manager with a supervisor.
UPDATE employees m
   JOIN (
       SELECT employee_id
         FROM employees
        WHERE role = 'admin' AND is_active = 1
     ORDER BY
         (first_name = 'Zoo' AND last_name = 'Admin') DESC,
         employee_id ASC
        LIMIT 1
   ) AS a
   SET m.manager_id = a.employee_id
 WHERE m.role = 'manager';

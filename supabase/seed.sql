-- Seed Data for Zoo App (matches current live schema)

-- 1. Geography (Zones)
INSERT INTO animal_zones (zone_name, location_description) VALUES
('Savanna', 'Open plains for African wildlife'),
('Rainforest', 'Dense vegetation and high humidity'),
('Arctic', 'Cold enclosure with ice and water features'),
('Reptile House', 'Temperature controlled indoor facility');

-- 2. Departments
INSERT INTO departments (dept_name) VALUES
('Veterinary Services'),
('Animal Care'),
('Administration'),
('Security'),
('Retail & Operations');

-- 3. Employees
INSERT INTO employees (first_name, last_name, contact_info, pay_rate_cents, shift_timeframe, dept_id, role) VALUES
('Sarah', 'Connor', 'sarah@zoo.com', 450000, '08:00-16:00', 1, 'vet'),
('Alan', 'Grant', 'alan@zoo.com', 380000, '07:00-15:00', 2, 'caretaker'),
('Ellie', 'Sattler', 'ellie@zoo.com', 390000, '07:00-15:00', 2, 'caretaker'),
('John', 'Hammond', 'john@zoo.com', 800000, '09:00-17:00', 3, 'admin'),
('Robert', 'Muldoon', 'robert@zoo.com', 350000, '18:00-06:00', 4, 'security');

-- Department managers
UPDATE departments SET manager_id = 1 WHERE dept_name = 'Veterinary Services';
UPDATE departments SET manager_id = 2 WHERE dept_name = 'Animal Care';
UPDATE departments SET manager_id = 4 WHERE dept_name = 'Administration';
UPDATE departments SET manager_id = 5 WHERE dept_name = 'Security';

-- Employee manager_ids (report to dept manager)
UPDATE employees SET manager_id = 2 WHERE employee_id = 3; -- Ellie reports to Alan
UPDATE employees SET manager_id = 5 WHERE employee_id = 5; -- Muldoon is his own dept head (no manager)

-- Role-specific tables
INSERT INTO vets (employee_id, license_no, specialty) VALUES
(1, 'VET-998877', 'Large Mammals');

INSERT INTO animal_caretakers (employee_id, specialization_species) VALUES
(2, 'Large Carnivores'),
(3, 'Reptiles');

INSERT INTO managers (employee_id, office_location) VALUES
(4, 'Admin Building, Executive Suite');

-- 4. Animals & Health
INSERT INTO health_records (vet_id) VALUES
(1), (1), (1), (1);

INSERT INTO animals (name, species_common_name, species_binomial, age, zone_id, health_record_id) VALUES
('Leo', 'African Lion', 'Panthera leo', 5, 1, 1),
('Burt', 'Polar Bear', 'Ursus maritimus', 8, 3, 2),
('Sly', 'Green Anaconda', 'Eunectes murinus', 4, 4, 3),
('Tony the Tiger', 'Tiger', 'Panthera tigris', 13, 1, 4);

-- Assign caretakers to animals
UPDATE animal_caretakers SET assigned_animal_id = 1 WHERE employee_id = 2; -- Alan cares for Leo
UPDATE animal_caretakers SET assigned_animal_id = 3 WHERE employee_id = 3; -- Ellie cares for Sly

INSERT INTO medical_history (record_id, injury, disease, date_treated, animal_age_at_treatment) VALUES
(1, 'Minor scratch on paw', NULL, '2025-11-15', 5),
(2, NULL, 'Seasonal Allergies', '2025-06-10', 7);

-- 5. Customers
INSERT INTO customers (age, gender, is_member) VALUES
(34, 'Male', TRUE),
(28, 'Female', FALSE),
(8, 'Male', FALSE),
(65, 'Female', TRUE);

-- 6. Events
INSERT INTO events (title, description, event_date, max_capacity, actual_attendance) VALUES
('Lion Feeding Show', 'Watch our keepers feed Leo the African Lion and learn about lion nutrition and behavior.', '2026-03-15', 50, 0),
('Arctic Explorer Tour', 'A guided tour of the Arctic zone featuring Burt the Polar Bear and cold-climate conservation efforts.', '2026-03-20', 100, 0);

-- 7. Shops & Inventory
INSERT INTO shops (name, type) VALUES
('Safari Gift Shop', 'Gift'),
('Jungle Cafe', 'Food');

INSERT INTO inventory (outlet_id, item_name, stock_count, restock_threshold, cost_to_restock_cents, category, price_cents) VALUES
(1, 'Plush Lion', 150, 20, 800, 'Gift', 1999),
(1, 'Zoo T-Shirt', 80, 15, 1000, 'Gift', 2499),
(2, 'Cheeseburger', 50, 10, 300, 'Food', 899),
(2, 'Soda', 200, 30, 100, 'Food', 350),
(1, 'Pinwheel Hat', 137, 20, 700, 'Gift', 2000);

-- Zoo Database Schema (matches live Supabase instance)
-- WARNING: This schema is for reference. Table order handles circular dependencies.

-- ══════════════════════════════════════
-- Geography
-- ══════════════════════════════════════

CREATE TABLE animal_zones (
  zone_id SERIAL PRIMARY KEY,
  zone_name TEXT NOT NULL,
  location_description TEXT
);

-- ══════════════════════════════════════
-- Human Resources
-- ══════════════════════════════════════

CREATE TABLE departments (
  dept_id SERIAL PRIMARY KEY,
  dept_name TEXT NOT NULL,
  manager_id INT
);

CREATE TABLE employees (
  employee_id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  contact_info TEXT,
  pay_rate_cents INT NOT NULL,
  shift_timeframe TEXT,
  dept_id INT REFERENCES departments(dept_id),
  user_id UUID REFERENCES auth.users(id),
  manager_id INT REFERENCES employees(employee_id),
  role TEXT NOT NULL DEFAULT 'security'
    CHECK (role IN ('admin', 'manager', 'vet', 'caretaker', 'security', 'retail'))
);

ALTER TABLE departments
ADD CONSTRAINT fk_manager
FOREIGN KEY (manager_id) REFERENCES employees(employee_id);

-- Role-specific tables
CREATE TABLE vets (
  employee_id INT PRIMARY KEY REFERENCES employees(employee_id),
  license_no TEXT NOT NULL,
  specialty TEXT
);

CREATE TABLE animal_caretakers (
  employee_id INT PRIMARY KEY REFERENCES employees(employee_id),
  specialization_species TEXT,
  assigned_animal_id INT
);

CREATE TABLE managers (
  employee_id INT PRIMARY KEY REFERENCES employees(employee_id),
  office_location TEXT
);

-- ══════════════════════════════════════
-- Animals & Health
-- ══════════════════════════════════════

CREATE TABLE health_records (
  record_id SERIAL PRIMARY KEY,
  vet_id INT REFERENCES vets(employee_id)
);

CREATE TABLE animals (
  animal_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  species_common_name TEXT NOT NULL,
  species_binomial TEXT,
  age INT,
  zone_id INT REFERENCES animal_zones(zone_id),
  health_record_id INT UNIQUE REFERENCES health_records(record_id)
);

ALTER TABLE animal_caretakers
ADD CONSTRAINT fk_assigned_animal
FOREIGN KEY (assigned_animal_id) REFERENCES animals(animal_id);

CREATE TABLE medical_history (
  history_id SERIAL PRIMARY KEY,
  record_id INT REFERENCES health_records(record_id),
  injury TEXT,
  disease TEXT,
  date_treated DATE,
  animal_age_at_treatment INT
);

-- ══════════════════════════════════════
-- Customers & Events
-- ══════════════════════════════════════

CREATE TABLE customers (
  customer_id SERIAL PRIMARY KEY,
  age INT,
  gender TEXT,
  is_member BOOLEAN DEFAULT FALSE
);

CREATE TABLE events (
  event_id SERIAL PRIMARY KEY,
  title TEXT,
  description TEXT,
  event_date DATE,
  max_capacity INT CHECK (max_capacity <= 150),
  actual_attendance INT
);

CREATE TABLE event_assignments (
  assignment_id SERIAL PRIMARY KEY,
  event_id INT REFERENCES events(event_id),
  employee_id INT REFERENCES employees(employee_id),
  animal_id INT REFERENCES animals(animal_id)
);

-- ══════════════════════════════════════
-- Donations & Transactions
-- ══════════════════════════════════════

CREATE TABLE donations (
  donation_id SERIAL PRIMARY KEY,
  donor_name TEXT,
  amount_cents INT NOT NULL,
  donation_date TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transactions (
  transaction_id SERIAL PRIMARY KEY,
  transaction_date TIMESTAMP DEFAULT NOW(),
  total_amount_cents INT,
  donation_id INT REFERENCES donations(donation_id)
);

-- ══════════════════════════════════════
-- Tickets
-- ══════════════════════════════════════

CREATE TABLE tickets (
  ticket_id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(customer_id),
  type TEXT CHECK (type IN ('Admission', 'Attraction')),
  event_id INT REFERENCES events(event_id),
  price_cents INT NOT NULL,
  transaction_id INT REFERENCES transactions(transaction_id)
);

-- ══════════════════════════════════════
-- Retail & Inventory
-- ══════════════════════════════════════

CREATE TABLE shops (
  shop_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('Gift', 'Food', 'Misc'))
);

CREATE TABLE inventory (
  item_id SERIAL PRIMARY KEY,
  outlet_id INT REFERENCES shops(shop_id),
  item_name TEXT NOT NULL,
  stock_count INT NOT NULL DEFAULT 0,
  restock_threshold INT NOT NULL DEFAULT 10,
  is_low_stock BOOLEAN DEFAULT (stock_count <= restock_threshold),
  cost_to_restock_cents INT NOT NULL DEFAULT 500,
  category TEXT CHECK (category IN ('Gift', 'Food', 'Misc')),
  price_cents DOUBLE PRECISION CHECK (price_cents > 0.0)
);

CREATE TABLE shop_items (
  shop_item_id SERIAL PRIMARY KEY,
  shop_id INT REFERENCES shops(shop_id),
  item_id INT REFERENCES inventory(item_id),
  sale_price_cents INT NOT NULL
);

CREATE TABLE sale_items (
  sale_item_id SERIAL PRIMARY KEY,
  transaction_id INT REFERENCES transactions(transaction_id),
  item_id INT REFERENCES inventory(item_id),
  quantity INT NOT NULL,
  price_at_sale_cents INT NOT NULL
);

-- ══════════════════════════════════════
-- Operational Supplies & Requests
-- ══════════════════════════════════════

CREATE TABLE operational_supplies (
  supply_id    SERIAL PRIMARY KEY,
  department_id INT NOT NULL REFERENCES departments(dept_id),
  item_name    TEXT NOT NULL,
  stock_count  INT NOT NULL DEFAULT 0,
  restock_threshold INT NOT NULL DEFAULT 10,
  is_low_stock BOOLEAN GENERATED ALWAYS AS (stock_count <= restock_threshold) STORED,
  cost_to_restock_cents INT NOT NULL DEFAULT 500,
  category     TEXT,
  description  TEXT
);

CREATE TABLE supply_requests (
  request_id      SERIAL PRIMARY KEY,
  requested_by    INT NOT NULL REFERENCES employees(employee_id),
  supply_type     TEXT NOT NULL CHECK (supply_type IN ('retail', 'operational')),
  item_id         INT NOT NULL,
  item_name       TEXT NOT NULL,
  requested_quantity INT NOT NULL CHECK (requested_quantity > 0),
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by     INT REFERENCES employees(employee_id),
  created_at      TIMESTAMP DEFAULT NOW(),
  reviewed_at     TIMESTAMP
);

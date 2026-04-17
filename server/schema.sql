-- ============================================================
-- COOG ZOO — MySQL 8.0 Schema
-- Migrated from PostgreSQL (Supabase)
-- ============================================================

CREATE DATABASE IF NOT EXISTS coog_zoo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE coog_zoo;

-- ============================================================
-- AUTH — replaces Supabase auth.users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id     INT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ANIMAL ZONES
-- ============================================================
CREATE TABLE IF NOT EXISTS animal_zones (
    zone_id              INT AUTO_INCREMENT PRIMARY KEY,
    zone_name            VARCHAR(255) NOT NULL,
    location_description TEXT
);

-- ============================================================
-- DEPARTMENTS (declared before employees due to FK cycle;
--  manager_id FK added via ALTER after employees is created)
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
    dept_id    INT AUTO_INCREMENT PRIMARY KEY,
    dept_name  VARCHAR(255) NOT NULL,
    manager_id INT
);

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
    employee_id    INT AUTO_INCREMENT PRIMARY KEY,
    first_name     VARCHAR(100) NOT NULL,
    middle_name    VARCHAR(100),
    last_name      VARCHAR(100) NOT NULL,
    contact_info   TEXT,
    pay_rate_cents INT NOT NULL DEFAULT 2000,
    shift_timeframe VARCHAR(50),
    dept_id        INT,
    user_id        INT,
    manager_id     INT,
    role           ENUM('admin','manager','vet','caretaker','security','retail') NOT NULL DEFAULT 'retail',
    FOREIGN KEY (dept_id)    REFERENCES departments(dept_id) ON DELETE SET NULL,
    FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE SET NULL,
    FOREIGN KEY (manager_id) REFERENCES employees(employee_id) ON DELETE SET NULL
);

-- Add manager_id FK to departments now that employees exists
ALTER TABLE departments
    ADD CONSTRAINT fk_dept_manager
    FOREIGN KEY (manager_id) REFERENCES employees(employee_id) ON DELETE SET NULL;

-- ============================================================
-- EMPLOYEE SUB-TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS vets (
    employee_id INT PRIMARY KEY,
    license_no  VARCHAR(100) NOT NULL,
    specialty   VARCHAR(255),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS animal_caretakers (
    employee_id            INT PRIMARY KEY,
    specialization_species VARCHAR(255),
    assigned_animal_id     INT,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
    -- assigned_animal_id FK added after animals table
);

CREATE TABLE IF NOT EXISTS managers (
    employee_id     INT PRIMARY KEY,
    office_location VARCHAR(255),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);

-- ============================================================
-- HEALTH RECORDS (declared before animals due to FK)
-- ============================================================
CREATE TABLE IF NOT EXISTS health_records (
    record_id  INT AUTO_INCREMENT PRIMARY KEY,
    vet_id     INT,
    FOREIGN KEY (vet_id) REFERENCES vets(employee_id) ON DELETE SET NULL
);

-- ============================================================
-- ANIMALS
-- ============================================================
CREATE TABLE IF NOT EXISTS animals (
    animal_id         INT AUTO_INCREMENT PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    species_common_name VARCHAR(255) NOT NULL,
    species_binomial  VARCHAR(255),
    age               INT,
    zone_id           INT,
    health_record_id  INT UNIQUE,
    FOREIGN KEY (zone_id)          REFERENCES animal_zones(zone_id)    ON DELETE SET NULL,
    FOREIGN KEY (health_record_id) REFERENCES health_records(record_id) ON DELETE SET NULL
);

-- Now add the deferred FK on animal_caretakers
ALTER TABLE animal_caretakers
    ADD CONSTRAINT fk_caretaker_animal
    FOREIGN KEY (assigned_animal_id) REFERENCES animals(animal_id) ON DELETE SET NULL;

-- ============================================================
-- MEDICAL HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_history (
    history_id              INT AUTO_INCREMENT PRIMARY KEY,
    record_id               INT,
    injury                  TEXT,
    disease                 TEXT,
    date_treated            DATE,
    animal_age_at_treatment INT,
    FOREIGN KEY (record_id) REFERENCES health_records(record_id) ON DELETE SET NULL
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    customer_id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT UNIQUE,
    first_name              VARCHAR(100),
    last_name               VARCHAR(100),
    email                   VARCHAR(255) UNIQUE,
    phone                   VARCHAR(30),
    age                     INT,
    gender                  VARCHAR(30),
    is_member               TINYINT(1) DEFAULT 0,
    address                 VARCHAR(255),
    city                    VARCHAR(100),
    state                   VARCHAR(100),
    zip_code                VARCHAR(20),
    date_of_birth           DATE,
    membership_type         ENUM('explorer','family','premium'),
    membership_start        DATE,
    membership_end          DATE,
    billing_street          VARCHAR(255),
    billing_city            VARCHAR(100),
    billing_state           VARCHAR(100),
    billing_zip             VARCHAR(20),
    billing_phone           VARCHAR(30),
    shipping_street         VARCHAR(255),
    shipping_city           VARCHAR(100),
    shipping_state          VARCHAR(100),
    shipping_zip            VARCHAR(20),
    shipping_phone          VARCHAR(30),
    shipping_same_as_billing TINYINT(1) DEFAULT 1,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ============================================================
-- VENUES
-- ============================================================
CREATE TABLE IF NOT EXISTS venues (
    venue_id  INT AUTO_INCREMENT PRIMARY KEY,
    venue_name VARCHAR(255) NOT NULL,
    location  TEXT,
    capacity  INT DEFAULT 150
);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    event_id           INT AUTO_INCREMENT PRIMARY KEY,
    title              VARCHAR(255),
    description        TEXT,
    event_date         DATE,
    start_time         TIME,
    end_time           TIME,
    venue_id           INT,
    max_capacity       INT CHECK (max_capacity <= 150),
    actual_attendance  INT,
    ticket_price_cents INT DEFAULT 0,
    tickets_sold       INT DEFAULT 0,
    FOREIGN KEY (venue_id) REFERENCES venues(venue_id) ON DELETE SET NULL
);

-- ============================================================
-- DONATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS donations (
    donation_id   INT AUTO_INCREMENT PRIMARY KEY,
    donor_name    VARCHAR(255),
    amount_cents  INT NOT NULL,
    donation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    customer_id   INT,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id      INT AUTO_INCREMENT PRIMARY KEY,
    transaction_date    DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount_cents  INT,
    donation_id         INT,
    customer_id         INT,
    guest_email         VARCHAR(255),
    is_donation         TINYINT(1) DEFAULT 0,
    FOREIGN KEY (donation_id)  REFERENCES donations(donation_id)   ON DELETE SET NULL,
    FOREIGN KEY (customer_id)  REFERENCES customers(customer_id)   ON DELETE SET NULL
);

-- ============================================================
-- TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id      INT AUTO_INCREMENT PRIMARY KEY,
    customer_id    INT,
    type           VARCHAR(50) CHECK (type IN ('adult','youth','senior','member','event','Admission','Attraction')),
    event_id       INT,
    price_cents    INT NOT NULL,
    transaction_id INT,
    FOREIGN KEY (customer_id)    REFERENCES customers(customer_id)       ON DELETE SET NULL,
    FOREIGN KEY (event_id)       REFERENCES events(event_id)             ON DELETE SET NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE SET NULL
);

-- ============================================================
-- SHOPS
-- ============================================================
CREATE TABLE IF NOT EXISTS shops (
    shop_id INT AUTO_INCREMENT PRIMARY KEY,
    name    VARCHAR(255) NOT NULL,
    type    ENUM('Gift','Food','Misc')
);

-- ============================================================
-- INVENTORY (retail items)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
    item_id              INT AUTO_INCREMENT PRIMARY KEY,
    outlet_id            INT,
    item_name            VARCHAR(255) NOT NULL,
    stock_count          INT NOT NULL DEFAULT 0,
    restock_threshold    INT NOT NULL DEFAULT 10,
    is_low_stock         TINYINT(1) GENERATED ALWAYS AS (stock_count <= restock_threshold) STORED,
    cost_to_restock_cents INT NOT NULL DEFAULT 500,
    category             ENUM('Gift','Food','Misc'),
    price_cents          DOUBLE CHECK (price_cents > 0),
    image_url            TEXT,
    FOREIGN KEY (outlet_id) REFERENCES shops(shop_id) ON DELETE SET NULL
);

-- ============================================================
-- SHOP ITEMS (shop ↔ inventory join)
-- ============================================================
CREATE TABLE IF NOT EXISTS shop_items (
    shop_item_id    INT AUTO_INCREMENT PRIMARY KEY,
    shop_id         INT,
    item_id         INT,
    sale_price_cents INT NOT NULL,
    FOREIGN KEY (shop_id)  REFERENCES shops(shop_id)     ON DELETE CASCADE,
    FOREIGN KEY (item_id)  REFERENCES inventory(item_id) ON DELETE CASCADE
);

-- ============================================================
-- SALE ITEMS (line items per transaction)
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
    sale_item_id       INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id     INT,
    item_id            INT,
    quantity           INT NOT NULL,
    price_at_sale_cents INT NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE SET NULL,
    FOREIGN KEY (item_id)        REFERENCES inventory(item_id)           ON DELETE SET NULL
);

-- ============================================================
-- RECEIPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS receipts (
    receipt_id     INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT,
    email          VARCHAR(255) NOT NULL,
    customer_name  VARCHAR(255),
    line_items     JSON DEFAULT (JSON_ARRAY()),
    subtotal_cents INT,
    tax_cents      INT,
    total_cents    INT,
    is_donation    TINYINT(1) DEFAULT 0,
    donation_fund  VARCHAR(255),
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE SET NULL
);

-- ============================================================
-- MEMBERSHIP PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS membership_plans (
    plan_id       INT AUTO_INCREMENT PRIMARY KEY,
    plan_name     VARCHAR(100) NOT NULL,
    price_cents   INT NOT NULL,
    duration_days INT NOT NULL DEFAULT 365,
    discount_rate DECIMAL(5,4) NOT NULL DEFAULT 0.1000
);

-- ============================================================
-- OPERATIONAL SUPPLIES
-- ============================================================
CREATE TABLE IF NOT EXISTS operational_supplies (
    supply_id             INT AUTO_INCREMENT PRIMARY KEY,
    department_id         INT NOT NULL,
    item_name             VARCHAR(255) NOT NULL,
    stock_count           INT NOT NULL DEFAULT 0,
    restock_threshold     INT NOT NULL DEFAULT 10,
    is_low_stock          TINYINT(1) GENERATED ALWAYS AS (stock_count <= restock_threshold) STORED,
    cost_to_restock_cents INT NOT NULL DEFAULT 500,
    category              VARCHAR(100),
    description           TEXT,
    FOREIGN KEY (department_id) REFERENCES departments(dept_id) ON DELETE RESTRICT
);

-- ============================================================
-- SUPPLY REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS supply_requests (
    request_id         INT AUTO_INCREMENT PRIMARY KEY,
    requested_by       INT NOT NULL,
    supply_type        ENUM('retail','operational') NOT NULL,
    item_id            INT NOT NULL,
    item_name          VARCHAR(255) NOT NULL,
    requested_quantity INT NOT NULL CHECK (requested_quantity > 0),
    reason             TEXT,
    status             ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
    reviewed_by        INT,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at        DATETIME,
    FOREIGN KEY (requested_by) REFERENCES employees(employee_id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by)  REFERENCES employees(employee_id) ON DELETE SET NULL
);

-- ============================================================
-- EVENT ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS event_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id      INT,
    employee_id   INT,
    animal_id     INT,
    FOREIGN KEY (event_id)   REFERENCES events(event_id)       ON DELETE SET NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE SET NULL,
    FOREIGN KEY (animal_id)  REFERENCES animals(animal_id)     ON DELETE SET NULL
);

-- ============================================================
-- CARETAKER ↔ ANIMAL ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS caretaker_animal_assignments (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    caretaker_id INT NOT NULL,
    animal_id    INT NOT NULL,
    assigned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (caretaker_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (animal_id)    REFERENCES animals(animal_id)     ON DELETE CASCADE
);

-- ============================================================
-- VET ↔ ANIMAL ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_animal_assignments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    vet_id      INT NOT NULL,
    animal_id   INT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vet_id)    REFERENCES vets(employee_id)     ON DELETE CASCADE,
    FOREIGN KEY (animal_id) REFERENCES animals(animal_id)   ON DELETE CASCADE
);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
    log_id      INT AUTO_INCREMENT PRIMARY KEY,
    action_type VARCHAR(100) NOT NULL CHECK (action_type IN (
        'supply_request_created','supply_request_approved','supply_request_denied',
        'supply_restocked','employee_created','employee_updated','ticket_sold',
        'event_created','donation_received','medical_record_added','animal_added',
        'inventory_updated','animal_vet_assigned','animal_caretaker_assigned',
        'event_employee_assigned'
    )),
    description TEXT NOT NULL,
    performed_by INT,
    target_type VARCHAR(100),
    target_id   INT,
    metadata    JSON DEFAULT (JSON_OBJECT()),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (performed_by) REFERENCES employees(employee_id) ON DELETE SET NULL
);

-- ============================================================
-- SEED: Membership Plans
-- ============================================================
INSERT IGNORE INTO membership_plans (plan_id, plan_name, price_cents, duration_days, discount_rate) VALUES
(1, 'Explorer', 8999,  365, 0.10),
(2, 'Family',   14999, 365, 0.15),
(3, 'Premium',  24999, 365, 0.20);

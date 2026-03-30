-- ══════════════════════════════════════
-- Operational Supplies (non-retail, tied to departments)
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

-- ══════════════════════════════════════
-- Supply Requests (request / approval workflow)
-- ══════════════════════════════════════

CREATE TABLE supply_requests (
  request_id      SERIAL PRIMARY KEY,
  requested_by    INT NOT NULL REFERENCES employees(employee_id),
  supply_type     TEXT NOT NULL CHECK (supply_type IN ('retail', 'operational')),
  item_id         INT NOT NULL,          -- FK to inventory (retail) or operational_supplies (operational)
  item_name       TEXT NOT NULL,          -- denormalized for easy display
  requested_quantity INT NOT NULL CHECK (requested_quantity > 0),
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by     INT REFERENCES employees(employee_id),
  created_at      TIMESTAMP DEFAULT NOW(),
  reviewed_at     TIMESTAMP
);

-- ══════════════════════════════════════
-- Seed: Operational Supplies per Department
-- ══════════════════════════════════════

-- Veterinary Services (dept_id = 1)
INSERT INTO operational_supplies (department_id, item_name, stock_count, restock_threshold, cost_to_restock_cents, category, description) VALUES
(1, 'Syringes (50-pack)',        120, 20, 2500, 'Medical',   'Disposable syringes for injections'),
(1, 'Antibiotic Ointment',       45,  10, 1500, 'Medical',   'Topical antibiotic for wound care'),
(1, 'Surgical Gloves (box)',     60,  15, 800,  'Medical',   'Latex-free exam gloves'),
(1, 'Sedation Medication',       30,  10, 5000, 'Medication', 'General sedation for procedures'),
(1, 'Bandage Rolls',             80,  20, 600,  'Medical',   'Sterile bandage rolls');

-- Animal Care (dept_id = 2)
INSERT INTO operational_supplies (department_id, item_name, stock_count, restock_threshold, cost_to_restock_cents, category, description) VALUES
(2, 'Premium Meat Mix (kg)',     200, 50, 1200, 'Feed',       'Raw meat blend for carnivores'),
(2, 'Herbivore Pellets (kg)',    150, 40, 800,  'Feed',       'Nutrient-enriched pellets'),
(2, 'Fish Supply (kg)',          100, 30, 1500, 'Feed',       'Fresh fish for aquatic/arctic animals'),
(2, 'Enrichment Toys',          25,  5,  2000, 'Enrichment', 'Puzzle feeders and play items'),
(2, 'Bedding Material (bale)',   40,  10, 3000, 'Habitat',    'Straw and wood shavings');

-- Security (dept_id = 4)
INSERT INTO operational_supplies (department_id, item_name, stock_count, restock_threshold, cost_to_restock_cents, category, description) VALUES
(4, 'Two-Way Radios',            12,  3, 8000,  'Equipment', 'Walkie-talkies for patrol'),
(4, 'Flashlight Batteries',      50, 10, 300,   'Equipment', 'AA batteries for flashlights'),
(4, 'First Aid Kits',            8,   2, 4000,  'Safety',    'Visitor first-aid kits');

-- Retail & Operations (dept_id = 6)
INSERT INTO operational_supplies (department_id, item_name, stock_count, restock_threshold, cost_to_restock_cents, category, description) VALUES
(6, 'Receipt Paper Rolls',       30, 5,  400,  'Supplies',  'Thermal receipt rolls for POS'),
(6, 'Shopping Bags (pack)',       100, 20, 200,  'Supplies',  'Branded zoo shopping bags'),
(6, 'Cleaning Spray',            20,  5, 600,  'Cleaning',  'All-purpose cleaner for counters');

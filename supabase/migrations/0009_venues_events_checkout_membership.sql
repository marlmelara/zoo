-- ══════════════════════════════════════
-- 0009: Venues, Event scheduling, Checkout flows, Membership & Billing
-- ══════════════════════════════════════

-- ── Venues (fixed set of event locations) ──
CREATE TABLE IF NOT EXISTS venues (
  venue_id   SERIAL PRIMARY KEY,
  venue_name TEXT NOT NULL,
  location   TEXT,
  capacity   INT NOT NULL DEFAULT 150
);

-- Seed default venues (fixed set for the zoo)
INSERT INTO venues (venue_name, location, capacity) VALUES
  ('Main Amphitheater',   'Central Plaza',       200),
  ('Safari Pavilion',     'East Wing',           100),
  ('Aquatic Center Stage', 'Aquarium Building',   80),
  ('Rainforest Canopy',   'West Trail',           60),
  ('Discovery Classroom', 'Education Center',     40)
ON CONFLICT DO NOTHING;

-- ── Events: add venue, start/end times ──
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_id    INT REFERENCES venues(venue_id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time  TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time    TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price_cents INT DEFAULT 0;

-- Constraint: events must be at least 2 hours and within 9am-5pm
-- (enforced at application level, but we add a check for time bounds)
ALTER TABLE events ADD CONSTRAINT IF NOT EXISTS chk_event_start_time
  CHECK (start_time >= '09:00:00' AND start_time < '17:00:00');

ALTER TABLE events ADD CONSTRAINT IF NOT EXISTS chk_event_end_time
  CHECK (end_time > '09:00:00' AND end_time <= '17:00:00');

ALTER TABLE events ADD CONSTRAINT IF NOT EXISTS chk_event_time_order
  CHECK (end_time > start_time);

-- ── Transactions: add customer tracking, guest email, donation flag ──
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_id  INT REFERENCES customers(customer_id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS guest_email  TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_donation  BOOLEAN DEFAULT FALSE;

-- ── Donations: link to customer if logged in ──
ALTER TABLE donations ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(customer_id);

-- ── Customers: billing & shipping addresses, membership fields ──
-- (some may already exist from prior migrations, using IF NOT EXISTS)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES auth.users(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name       TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name        TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email            TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone            TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth    DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address          TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city             TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state            TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code         TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS membership_type  TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS membership_start DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS membership_end   DATE;

-- Billing address fields
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_street   TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_city     TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_state    TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_zip      TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_phone    TEXT;

-- Shipping address fields
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_street  TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_city    TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_state   TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_zip     TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_phone   TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_same_as_billing BOOLEAN DEFAULT TRUE;

-- ── Membership pricing table ──
CREATE TABLE IF NOT EXISTS membership_plans (
  plan_id     SERIAL PRIMARY KEY,
  plan_name   TEXT NOT NULL,
  price_cents INT NOT NULL,
  duration_days INT NOT NULL DEFAULT 365,
  discount_rate NUMERIC(4,2) NOT NULL DEFAULT 0.10
);

INSERT INTO membership_plans (plan_name, price_cents, duration_days, discount_rate) VALUES
  ('Individual', 8999,  365, 0.10),
  ('Family',     14999, 365, 0.15),
  ('Premium',    24999, 365, 0.20)
ON CONFLICT DO NOTHING;

-- ── Update schema.sql reference note ──
-- Tickets type check updated to support event tickets
-- (dropping old constraint and adding new one)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_type_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_type_check
  CHECK (type IN ('adult', 'youth', 'senior', 'member', 'event'));

-- ── Receipts (email receipts stored for re-send / dashboard view) ──
CREATE TABLE IF NOT EXISTS receipts (
  receipt_id      SERIAL PRIMARY KEY,
  transaction_id  INT REFERENCES transactions(transaction_id),
  email           TEXT NOT NULL,
  customer_name   TEXT,
  line_items      JSONB DEFAULT '[]',
  subtotal_cents  INT,
  tax_cents       INT,
  total_cents     INT,
  is_donation     BOOLEAN DEFAULT FALSE,
  donation_fund   TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

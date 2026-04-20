# Coog Zoo — Database Management Application

Full-stack zoo management system built for **COSC 3380 — Database Systems** (Spring 2026).
Runs on **MySQL 8 + Node.js/Express (API) + React 18 + Vite (client)**.

- **Hosted URL:** _[paste the deployed URL here before submitting]_
- **Team:** Marlon Melara, Ashley Truong, Connor Sivley, Pablo Velazquez-Bremont
- **Course section / Team number:** _[fill in before emailing TAs]_
- **Instructor:** Dr. Rakesh Verma / Prof. Ramamurthy (`uramamur@bcm.edu`)
- **Project document:** [`docs/project-document.tex`](docs/project-document.tex) (LaTeX source — compile to PDF)

---

## What's in this submission

```
zoo/
├── docs/
│   └── project-document.tex     ← the required project document
├── server/                      ← Node.js + Express API
│   ├── routes/                  ← 15 route files, 109 REST endpoints
│   ├── migrations/              ← numbered SQL migrations (triggers, schema tweaks)
│   ├── middleware/              ← JWT auth, role guards
│   ├── lib/                     ← shared router, date utils
│   ├── schema.sql               ← base MySQL 8 schema
│   ├── db.js                    ← mysql2 pool
│   ├── index.js                 ← server entry
│   ├── reregister-users.mjs     ← resets every seeded user's password
│   └── run-migration.mjs        ← DELIMITER-aware migration runner
├── src/                         ← React + Vite front end
│   ├── pages/public/            ← guest-facing pages (Home, Animals, Tickets, Shop, etc.)
│   ├── pages/dashboards/        ← Admin / Manager / Vet / Caretaker / GenEmployee / Customer / Hours
│   ├── components/              ← Navbar, Layout, Feedback, AnimalsPanel, AnimalMedicalPanel,
│   │                             EmployeeDashboardPanels, ZooPaginator, NotificationsBell, …
│   ├── api/                     ← client-side API helpers
│   ├── contexts/                ← AuthContext
│   └── lib/api.js               ← fetch wrapper (JWT auto-attach)
├── public/                      ← static assets, logo, favicon
├── coog_zoo_dump.sql            ← populated database dump (included separately)
├── package.json                 ← front-end deps + scripts
├── vite.config.js
└── README.md                    ← you are here
```

---

## Technology stack

| Layer          | Tech                                                        |
|----------------|-------------------------------------------------------------|
| Database       | MySQL 8.0 (hosted on Azure Database for MySQL — Flexible Server) |
| API            | Node.js 20+, Express, JWT + bcryptjs                        |
| Front end      | React 18, Vite 5, React Router, Recharts (charts)           |
| Icons / styling| lucide-react + hand-rolled CSS + glassmorphism utilities    |

No ORM — every query is written in hand-tuned SQL using the `mysql2` driver, so every semantic constraint (trigger, `CHECK`, row locking, foreign key) lives in the database where it belongs.

---

## Quick install (local, from scratch)

**Prerequisites:** Node.js 20+, MySQL 8+, `npm`.

```bash
# 1. Install front-end + API dependencies
cd zoo
npm install
cd server && npm install && cd ..

# 2. Create the server env file
cat > server/.env <<'EOF'
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-mysql-password
DB_NAME=coog_zoo
JWT_SECRET=change-me-in-production
PORT=3001
EOF

# 3a. OPTION A: load the populated dump we ship (fastest)
mysql -u root -p < coog_zoo_dump.sql

# 3b. OPTION B: build from scratch
mysql -u root -p < server/schema.sql
for f in server/migrations/0010_*.sql server/migrations/00[1-9][0-9]*.sql; do
  node server/run-migration.mjs "$f"
done
# re-hash every seeded account to the default password
node server/reregister-users.mjs

# 4. Run the stack
# (terminal 1)
cd server && npm run dev        # API on http://localhost:3001

# (terminal 2, from repo root)
npm run dev                     # front end on http://localhost:5173
```

Open <http://localhost:5173>.

### Running just one migration
```bash
node server/run-migration.mjs server/migrations/0025_supply_request_action.sql
```

---

## Default logins for graders

Every seeded account shares the same password: **`zoo123456`**.
Customer self-registration also works on `/signup`.

| Role             | Email                          | Notes                                              |
|------------------|--------------------------------|----------------------------------------------------|
| Admin            | `admin@zoo.com`                | Full system access                                 |
| Manager          | `john@zoo.com`                 | Animal Care / Vet manager — see supply approvals   |
| Vet              | `lisa.vet@zoo.com`             | Rich medical-records form, My Animals, My Requests |
| Caretaker        | `sam.caretaker@zoo.com`        | Daily care log, My Events, remove-stock flow       |
| Security         | `security@zoo.com`             | Shift info + events                                |
| Retail Associate | `retail@zoo.com`               | Can also restock shop inventory                    |
| Customer         | `customer@zoo.com`             | Profile, purchases, tickets, donations             |

Exact seeded emails depend on the dump; check `server/reregister-users.mjs` if you add or rename users.

---

## Features at a glance

### Public (guests)
- **Home** with hero, featured animals, events teaser, call-to-action.
- **Our Animals** — live DB roster filterable by zone, per-animal photos.
- **Tickets** (adult / youth / senior / member / event), **Shop** (gifts + food),
  **Donations**, **Events calendar**, **Map**, **Membership**.
- Guest checkout with row-locked inventory so two buyers can't oversell.

### Customer dashboard
- My Profile (required-field gate), My Purchases (paginated + date-filtered),
  My Tickets, My Donations, upcoming/past Events, self-deactivation.

### Employee dashboards (Vet, Caretaker, Security, Retail, General)
- **My Animals** scoped to the employee's assignments.
- **Medical Records** — shared rich form (diagnosis, severity, status,
  treatment, medications, vitals, follow-up, notes) + Care Log.
- **My Events** with Upcoming / Past / All filter.
- **Supplies** with threshold + recommended restock, themed `+ Request Restock` button.
- **My Requests** — dedicated paginated log, shows reviewer + decision date.

### Manager dashboard
- Overview with low-stock callouts.
- **Supply Requests** — status filter, date filter, per-row checkbox,
  **bulk approve/deny** with per-row transactions.
- **My Staff**, **Animal Assignments** (vet + caretaker pickers, health-status dropdown),
  **Events** (assign staff / animals), **Activity Log** (paginated, searchable).

### Admin dashboard
- Overview with period filter (YTD / Q1–Q4 / Full Year / All + year picker).
- **Event Performance** (events × tickets × venues).
- **Membership Insights** (customers × transactions).
- **Shop Performance** (sale_items × inventory × transactions × shops).
- All three analytics tabs support **date range**, **CSV export**, and **Show Data** toggle.
- **Reactivate** any soft-deleted customer / employee / animal.

---

## Triggers (semantic constraints)

Ten MySQL triggers enforce cross-table invariants. See the project
document (§ Semantic Constraints) for the full writeup.

| Trigger                                   | Fires on                                | Rule enforced                                               |
|-------------------------------------------|-----------------------------------------|-------------------------------------------------------------|
| `trg_supply_request_notify`               | INSERT on `supply_requests`             | Manager + admins notified of every new request              |
| `trg_inventory_low_stock_notify`          | UPDATE on `inventory`                   | Retail managers + admins notified on threshold crossing     |
| `trg_op_supplies_low_stock_notify`        | UPDATE on `operational_supplies`        | Dept manager + admins notified on threshold crossing        |
| `trg_hours_request_notify`                | INSERT on `hours_requests`              | Manager + admins notified of new hours submission           |
| `trg_animal_sick_notify`                  | UPDATE on `animals`                     | Vet/animal-care managers + admins notified on sick/critical |
| `trg_supply_request_resolved`             | UPDATE on `supply_requests`             | Auto-resolves notifications when status leaves `pending`    |
| `trg_hours_request_resolved`              | UPDATE on `hours_requests`              | Same for hours submissions                                  |
| `trg_inventory_restocked_resolved`        | UPDATE on `inventory`                   | Clears low-stock notifications when stock > threshold       |
| `trg_op_supplies_restocked_resolved`      | UPDATE on `operational_supplies`        | Same for operational supplies                               |
| `trg_animal_healthy_resolved`             | UPDATE on `animals`                     | Clears sick-animal notifications when status returns healthy|

Verify they're installed: `SHOW TRIGGERS FROM coog_zoo;`

---

## Reproducing the SQL dump

The file `coog_zoo_dump.sql` (shipped in the submission ZIP) was produced with:

```bash
mysqldump -u root -p \
  --routines --triggers --events \
  --single-transaction --set-gtid-purged=OFF \
  coog_zoo > coog_zoo_dump.sql
```

Loading it recreates the schema, triggers, and seed data in one shot.

---

## Academic honesty

This project is the team's own work, developed for the spring 2026 COSC 3380
class. It complies with the [UH Code of Honor](https://www.uh.edu/nsm/students/undergraduate/code-of-honor)
and the [UH Student Handbook](https://publications.uh.edu/content.php?catoid=49&navoid=18552).

## Contacts

- `marlonmelara96@gmail.com`
- `ashleydtruong@gmail.com`
- `connor.sivley@att.net`
- `pablovelazquezbremont@gmail.com`

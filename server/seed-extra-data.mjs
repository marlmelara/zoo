// ============================================================
// Coog Zoo — historical-data seeder
//
// Pads the database with ~24 months of customer signups,
// membership conversions, transactions, tickets, sale items,
// donations, and past events so the analytics charts show a
// real shape (instead of two lonely months).
//
// Idempotent — run as many times as you like; everything keys
// off seed-prefixed emails / titles so a second run is a no-op.
// ============================================================
import 'dotenv/config';
import mysql from 'mysql2/promise';

const SEED_TAG       = '[seed-extra]';
const SEED_EMAIL_PFX = 'seed-c';
const SEED_EVT_PFX   = ''; // historical events no longer get a prefix

// ── deterministic RNG so repeated runs produce identical-looking data ──
let _rngSeed = 12345;
function rng() {
    _rngSeed = (_rngSeed * 9301 + 49297) % 233280;
    return _rngSeed / 233280;
}
const pick   = arr => arr[Math.floor(rng() * arr.length)];
const intIn  = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const dayIn  = (yr, mo) => intIn(1, new Date(yr, mo, 0).getDate());
const dt     = (y, mo, d, h = 12, mi = 0) =>
    `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')} ${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:00`;

// 28 months: 2024-01 → 2026-04
const MONTHS = [];
for (let y = 2024; y <= 2026; y++) {
    const max = (y === 2026) ? 4 : 12;
    for (let m = 1; m <= max; m++) MONTHS.push([y, m]);
}

const FIRST_NAMES = ['Alex','Bailey','Cameron','Devon','Eli','Finley','Grey','Harper','Indra','Jules',
                     'Kai','Logan','Morgan','Nico','Ollie','Parker','Quinn','Riley','Sage','Tatum',
                     'Uri','Val','Wren','Xen','Yael','Zane','Avery','Blair','Casey','Drew',
                     'Emery','Frankie','Gentry','Hollis','Iris','Jude','Kit','Lane','Marlo','Noor'];
const LAST_NAMES  = ['Lopez','Khan','Patel','Nguyen','Smith','Garcia','Chen','Brown','Davis','Miller',
                     'Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Rivera',
                     'Walker','Hall','Young','Allen','Hernandez','King','Wright','Scott','Green','Adams'];
const STATES      = ['TX','TX','TX','TX','LA','OK','NM','AR'];
const CITIES      = ['Houston','Dallas','Austin','San Antonio','Sugar Land','Pearland','Katy','The Woodlands'];

const TICKET_TYPES = [
    { type: 'adult',  price: 2499 },
    { type: 'youth',  price: 1499 },
    { type: 'senior', price: 1999 },
];

// ── Past-event templates: name + capacity + ticket price + month/year ──
// Spread evenly so the Event Performance chart fills out across two years.
const PAST_EVENTS = [
    ['Summer Safari Sleepover',     2024, 6,  60, 4500],
    ['Fourth of July Wildlife Bash',2024, 7,  90, 3500],
    ['Back-to-School Zoo Day',      2024, 8, 100, 2500],
    ['Halloween Boo at the Zoo',    2024, 10, 80, 3000],
    ['Holiday Lights Spectacular',  2024, 12,100, 4000],
    ['New Year Wildlife Walk',      2025, 1,  60, 2000],
    ['Valentines Date Night',       2025, 2,  40, 6000],
    ['Spring Bloom Festival',       2025, 4,  80, 2500],
    ['Earth Month Educational',     2025, 4,  60, 1500],
    ['Mothers Day Brunch',          2025, 5,  50, 5500],
    ['Summer Splash with Penguins', 2025, 7,  60, 4000],
    ['Fall Foliage Foto Walk',      2025, 10, 50, 2000],
    ['Holiday Lights 2025',         2025, 12,100, 4500],
    ['MLK Day Family Free',         2026, 1, 100, 0   ],
    ['Black History Month Showcase',2026, 2,  80, 1500],
];

// ── Helpers ──────────────────────────────────────────────────
async function tableHasSeedRows(conn, sql, params) {
    const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM (${sql}) x`, params);
    return Number(c) > 0;
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
async function main() {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST,
        port:     process.env.DB_PORT,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl:      { rejectUnauthorized: false },
        multipleStatements: false,
    });

    console.log(`${SEED_TAG} connected to ${process.env.DB_HOST}/${process.env.DB_NAME}`);

    // Idempotency guard: bail if seed-customers already exist.
    const [[{ existing }]] = await conn.query(
        `SELECT COUNT(*) AS existing FROM customers WHERE email LIKE ?`,
        [`${SEED_EMAIL_PFX}-%@coog.zoo`]
    );
    if (existing > 0) {
        console.log(`${SEED_TAG} ${existing} seed-customers already present — nothing to do.`);
        await conn.end();
        return;
    }

    // ── 1. Inventory: pull every retail item for sale_items ─────
    const [inv] = await conn.query(
        `SELECT item_id, item_name, category, COALESCE(price_cents, 1000) AS price_cents
           FROM inventory`
    );
    if (inv.length === 0) {
        console.error(`${SEED_TAG} no inventory rows — aborting.`);
        await conn.end(); process.exit(1);
    }
    console.log(`${SEED_TAG} ${inv.length} inventory items available.`);

    // ── 2. Past events ─────────────────────────────────────────
    console.log(`${SEED_TAG} inserting ${PAST_EVENTS.length} historical events…`);
    const venueIds = (await conn.query('SELECT venue_id FROM venues'))[0].map(r => r.venue_id);
    const insertedEvents = [];
    for (const [name, y, mo, cap, price] of PAST_EVENTS) {
        const tagged = SEED_EVT_PFX ? `${SEED_EVT_PFX} ${name}` : name;
        const day = dayIn(y, mo);
        const venueId = pick(venueIds);
        // Skip if same-name same-date already exists.
        const [[existsRow]] = await conn.query(
            `SELECT event_id FROM events WHERE title = ? AND event_date = ?`,
            [tagged, `${y}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`]
        );
        if (existsRow) continue;
        const start = '11:00:00', end = '14:00:00';
        const [r] = await conn.query(
            `INSERT INTO events
                (title, description, event_date, start_time, end_time, venue_id,
                 max_capacity, actual_attendance, ticket_price_cents, tickets_sold)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`,
            [tagged, 'Historical event seeded for analytics charts.',
             `${y}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
             start, end, venueId, cap, price]
        );
        insertedEvents.push({ id: r.insertId, capacity: cap, price, year: y, month: mo, day });
    }
    console.log(`${SEED_TAG}   → ${insertedEvents.length} events inserted.`);

    // ── 3. Seed customers (~3 per month, ~85 total) ───────────
    console.log(`${SEED_TAG} inserting customers across ${MONTHS.length} months…`);
    const customers = []; // { id, year, month }
    let cIdx = 1;
    for (const [y, mo] of MONTHS) {
        const newThisMonth = intIn(2, 4);
        for (let i = 0; i < newThisMonth; i++) {
            const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
            const day = dayIn(y, mo);
            const createdAt = dt(y, mo, day, intIn(9, 20), intIn(0, 59));
            const seqId = String(cIdx).padStart(3, '0');
            const email = `${SEED_EMAIL_PFX}-${seqId}@coog.zoo`;

            // ~55% become members within 0–14 days of signup.
            const isMember = rng() < 0.55 ? 1 : 0;
            let memTier = null, memStart = null, memEnd = null;
            if (isMember) {
                memTier = pick(['explorer','family','premium']);
                const offset = intIn(0, 14);
                const startDay = day + offset;
                let sY = y, sMo = mo, sD = startDay;
                if (sD > new Date(y, mo, 0).getDate()) {
                    sMo += 1;
                    if (sMo > 12) { sMo = 1; sY += 1; }
                    sD = sD - new Date(y, mo, 0).getDate();
                }
                memStart = `${sY}-${String(sMo).padStart(2,'0')}-${String(sD).padStart(2,'0')}`;
                memEnd   = `${sY + 1}-${String(sMo).padStart(2,'0')}-${String(sD).padStart(2,'0')}`;
            }

            const [r] = await conn.query(
                `INSERT INTO customers
                    (first_name, last_name, email, phone, age, gender, is_member,
                     address, city, state, zip_code, date_of_birth,
                     membership_type, membership_start, membership_end,
                     created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [fn, ln, email,
                 `713-${intIn(200,999)}-${String(intIn(0,9999)).padStart(4,'0')}`,
                 intIn(18, 70), pick(['F','M','NB']),
                 isMember,
                 `${intIn(100,9999)} ${pick(['Main','Oak','Elm','Pine'])} St`,
                 pick(CITIES), pick(STATES),
                 String(intIn(77000, 77599)),
                 `${y - intIn(18, 60)}-${String(intIn(1,12)).padStart(2,'0')}-${String(intIn(1,28)).padStart(2,'0')}`,
                 memTier, memStart, memEnd,
                 createdAt]
            );
            customers.push({ id: r.insertId, year: y, month: mo, day, isMember, memTier });
            cIdx++;
        }
    }
    console.log(`${SEED_TAG}   → ${customers.length} customers inserted.`);

    // ── 4. Membership-purchase transactions (those count as paid revenue) ──
    console.log(`${SEED_TAG} inserting membership-purchase transactions…`);
    const planPrice = { explorer: 8999, family: 14999, premium: 24999 };
    let memTxCount = 0;
    for (const c of customers) {
        if (!c.isMember || !c.memTier) continue;
        const price = planPrice[c.memTier];
        const txDate = dt(c.year, c.month, c.day, intIn(10, 18), intIn(0, 59));
        await conn.query(
            `INSERT INTO transactions
                (transaction_date, total_amount_cents, customer_id, is_donation)
             VALUES (?, ?, ?, 0)`,
            [txDate, price, c.id]
        );
        memTxCount++;
    }
    console.log(`${SEED_TAG}   → ${memTxCount} membership transactions.`);

    // ── 5. Admission tickets (general visits) ───────────────────
    console.log(`${SEED_TAG} inserting admission tickets…`);
    let admTxCount = 0, admTicketCount = 0;
    for (const c of customers) {
        // Each customer makes 0–4 admission visits in the months
        // between their signup and the present day.
        const visits = intIn(0, 4);
        for (let v = 0; v < visits; v++) {
            // Visit happens 0–24 months after signup (but no later than 2026-04).
            const offset = intIn(0, 24);
            let vY = c.year, vMo = c.month + offset;
            while (vMo > 12) { vMo -= 12; vY += 1; }
            if (vY > 2026 || (vY === 2026 && vMo > 4)) continue;
            const vDay = dayIn(vY, vMo);
            const txDate = dt(vY, vMo, vDay, intIn(10, 17), 0);

            // Build the ticket bundle (1–4 tickets per visit).
            const ticketCount = intIn(1, 4);
            const tickets = Array.from({ length: ticketCount }, () => pick(TICKET_TYPES));
            const total = tickets.reduce((s, t) => s + t.price, 0);

            const [tx] = await conn.query(
                `INSERT INTO transactions
                    (transaction_date, total_amount_cents, customer_id, is_donation)
                 VALUES (?, ?, ?, 0)`,
                [txDate, total, c.id]
            );
            for (const t of tickets) {
                await conn.query(
                    `INSERT INTO tickets (customer_id, type, price_cents, transaction_id)
                     VALUES (?, ?, ?, ?)`,
                    [c.id, t.type, t.price, tx.insertId]
                );
                admTicketCount++;
            }
            admTxCount++;
        }
    }
    console.log(`${SEED_TAG}   → ${admTxCount} admission transactions, ${admTicketCount} tickets.`);

    // ── 6. Tickets for the seeded past events ──────────────────
    // These both create ticket rows (linked to a transaction) and bump
    // events.tickets_sold + actual_attendance so the Performance chart
    // shows a believable fill-rate distribution.
    console.log(`${SEED_TAG} inserting event tickets…`);
    let evtTixCount = 0;
    for (const ev of insertedEvents) {
        // Fill-rate target between 30% and 95%.
        const targetPct = 0.30 + rng() * 0.65;
        const sold      = Math.max(1, Math.round(ev.capacity * targetPct));
        const attended  = Math.max(1, Math.round(sold * (0.75 + rng() * 0.2)));

        // Pick attendees randomly from customers who existed by event date.
        const eligible = customers.filter(c =>
            c.year < ev.year || (c.year === ev.year && c.month <= ev.month)
        );
        if (eligible.length === 0) continue;

        for (let i = 0; i < sold; i++) {
            const buyer = pick(eligible);
            const txDate = dt(ev.year, ev.month, Math.max(1, ev.day - intIn(0, 14)),
                              intIn(10, 19), intIn(0, 59));
            const [tx] = await conn.query(
                `INSERT INTO transactions
                    (transaction_date, total_amount_cents, customer_id, is_donation)
                 VALUES (?, ?, ?, 0)`,
                [txDate, ev.price, buyer.id]
            );
            await conn.query(
                `INSERT INTO tickets (customer_id, type, event_id, price_cents, transaction_id)
                 VALUES (?, 'event', ?, ?, ?)`,
                [buyer.id, ev.id, ev.price, tx.insertId]
            );
            evtTixCount++;
        }
        await conn.query(
            `UPDATE events SET tickets_sold = ?, actual_attendance = ? WHERE event_id = ?`,
            [sold, attended, ev.id]
        );
    }
    console.log(`${SEED_TAG}   → ${evtTixCount} event tickets across seeded events.`);

    // ── 7. Retail purchases (sale_items) ────────────────────────
    console.log(`${SEED_TAG} inserting retail sales…`);
    let retailTxCount = 0, retailLineCount = 0;
    for (const c of customers) {
        const visits = intIn(0, 5);
        for (let v = 0; v < visits; v++) {
            const offset = intIn(0, 24);
            let vY = c.year, vMo = c.month + offset;
            while (vMo > 12) { vMo -= 12; vY += 1; }
            if (vY > 2026 || (vY === 2026 && vMo > 4)) continue;
            const vDay = dayIn(vY, vMo);
            const txDate = dt(vY, vMo, vDay, intIn(10, 19), 0);

            const lineCount = intIn(1, 4);
            const lines = Array.from({ length: lineCount }, () => {
                const item = pick(inv);
                return { item, qty: intIn(1, 3) };
            });
            const total = lines.reduce((s, l) => s + l.item.price_cents * l.qty, 0);

            const [tx] = await conn.query(
                `INSERT INTO transactions
                    (transaction_date, total_amount_cents, customer_id, is_donation)
                 VALUES (?, ?, ?, 0)`,
                [txDate, total, c.id]
            );
            for (const l of lines) {
                await conn.query(
                    `INSERT INTO sale_items
                        (transaction_id, item_id, quantity, price_at_sale_cents)
                     VALUES (?, ?, ?, ?)`,
                    [tx.insertId, l.item.item_id, l.qty, l.item.price_cents]
                );
                retailLineCount++;
            }
            retailTxCount++;
        }
    }
    console.log(`${SEED_TAG}   → ${retailTxCount} retail transactions, ${retailLineCount} line items.`);

    // ── 8. Donations ────────────────────────────────────────────
    console.log(`${SEED_TAG} inserting donations…`);
    let donCount = 0;
    for (const c of customers) {
        if (rng() > 0.30) continue; // ~30% of customers donate
        const amount = pick([2500, 5000, 10000, 25000, 50000, 100000, 250000]);
        const offset = intIn(0, 24);
        let vY = c.year, vMo = c.month + offset;
        while (vMo > 12) { vMo -= 12; vY += 1; }
        if (vY > 2026 || (vY === 2026 && vMo > 4)) continue;
        const vDay = dayIn(vY, vMo);
        const dDate = dt(vY, vMo, vDay, intIn(10, 19), 0);

        const [d] = await conn.query(
            `INSERT INTO donations (donor_name, amount_cents, donation_date, customer_id)
             VALUES (?, ?, ?, ?)`,
            [`Customer #${c.id}`, amount, dDate, c.id]
        );
        await conn.query(
            `INSERT INTO transactions
                (transaction_date, total_amount_cents, customer_id, is_donation, donation_id)
             VALUES (?, ?, ?, 1, ?)`,
            [dDate, amount, c.id, d.insertId]
        );
        donCount++;
    }
    console.log(`${SEED_TAG}   → ${donCount} donations.`);

    console.log(`${SEED_TAG} ✓ done.`);
    await conn.end();
}

main().catch(err => {
    console.error(`${SEED_TAG} fatal:`, err);
    process.exit(1);
});

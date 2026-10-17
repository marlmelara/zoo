// ============================================================
// The oversell guarantee.
//
// The README's headline claim is that two concurrent checkouts
// cannot both sell the last unit. These tests are that claim,
// executed: N real HTTP requests fired at one remaining item or
// one remaining seat, asserting exactly one winner and that the
// stored counters never leave their legal range.
//
// Enforcement lives in:
//   server/routes/transactions.js — SELECT ... FOR UPDATE on inventory
//   server/routes/tickets.js      — SELECT ... FOR UPDATE on events
//
// ── Proof that these tests have teeth ───────────────────────
// A concurrency test that also passes against the broken version
// proves nothing, so this was checked rather than assumed. Both
// route files were temporarily reverted to their pre-fix state
// (`git show 3374aad^:server/routes/...`), which had:
//
//   transactions.js — no row lock, no stock check, and
//     `UPDATE inventory SET stock_count = GREATEST(0, stock_count - ?)`
//   tickets.js — no DB transaction, no capacity check, a plain
//     `db.query` INSERT plus one counter bump per ticket
//
// With that code in place, all five tests in this file failed on
// iteration 1 (16/21 passing overall — only the roles tests stayed
// green). Measured directly against the same fixtures:
//
//   stock_count = 1, N concurrent POST /api/transactions
//     N=2  statuses 201,500                   stock=0  units sold=1
//     N=3  statuses 201,201,500               stock=0  units sold=2
//     N=8  statuses 201,201,201,500×5         stock=0  units sold=3
//
//   one seat left, 8 concurrent POST /api/tickets
//     statuses 201×8   actual_attendance=17/10   tickets issued=8
//     a 2-ticket batch against 1 remaining seat → 201
//     the 3-event cart → 201, 5 tickets written, sold-out event 11/10
//
// That is precisely the failure the GREATEST() clamp was hiding:
// stock_count pinned at 0 and the capacity column overflowing, while
// three to eight customers were charged for one unit. (The 500s are
// InnoDB deadlocks between the unguarded concurrent UPDATEs — the old
// code didn't just oversell, it also fell over.) Restoring the
// current code turned all five green again.
// ============================================================
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { useDatabase } from './helpers/config.js';
import { connect, provisionTestDatabase, dropTestDatabase } from './helpers/database.js';
import { startTestServer } from './helpers/server.js';
import {
    seedInventoryItem, setStock, getStock, countSaleItems,
    seedEvent, setAttendance, getEventCounters, countTickets,
    clearCheckoutData,
} from './helpers/seed.js';

useDatabase('oversell');

// 8 concurrent requests, below server/db.js's connectionLimit of 10 so
// every request is genuinely in flight rather than queued on the pool.
const CONCURRENCY = Number(process.env.TEST_CONCURRENCY || 8);
// One race can be won by luck. Twenty in a row cannot.
const ITERATIONS  = Number(process.env.TEST_ITERATIONS  || 20);

let server;
let db;

before(async () => {
    await provisionTestDatabase();
    server = await startTestServer();
    db = await connect();
});

after(async () => {
    await db?.end();
    await server?.close();
    await dropTestDatabase();
});

function summarise(results) {
    const created = results.filter(r => r.status === 201);
    const refused = results.filter(r => r.status === 409);
    const other   = results.filter(r => r.status !== 201 && r.status !== 409);
    return { created, refused, other };
}

async function countRows(table) {
    const [rows] = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
    return rows[0].n;
}

const shopCheckout = (itemId, quantity) => ({
    total_amount_cents: 999 * quantity,
    guest_email: 'race@example.test',
    receipt: {
        email: 'race@example.test',
        line_items: [{ description: 'Plush Otter', quantity, unitPriceCents: 999 }],
        subtotal_cents: 999 * quantity,
        tax_cents: 0,
        total_cents: 999 * quantity,
    },
    sale_items: [{ item_id: itemId, quantity, price_at_sale_cents: 999 }],
});

const eventTickets = (eventId, count) => ({
    tickets: Array.from({ length: count }, () => ({
        type: 'event', event_id: eventId, price_cents: 2500,
    })),
});

describe('shop inventory', () => {
    it('concurrent shop checkouts cannot both sell the last unit', async () => {
        const itemId = await seedInventoryItem(db, { name: 'Plush Otter', stock: 1 });

        for (let i = 1; i <= ITERATIONS; i++) {
            await clearCheckoutData(db);
            await setStock(db, itemId, 1);

            const results = await Promise.all(
                Array.from({ length: CONCURRENCY }, () =>
                    server.post('/api/transactions', shopCheckout(itemId, 1)))
            );
            const { created, refused, other } = summarise(results);

            assert.deepEqual(other, [],
                `iteration ${i}: unexpected statuses ${JSON.stringify(other)}`);
            assert.equal(created.length, 1,
                `iteration ${i}: expected exactly one 201, got ${created.length} ` +
                `(409s: ${refused.length})`);
            assert.equal(refused.length, CONCURRENCY - 1);

            const stock = await getStock(db, itemId);
            assert.equal(stock, 0, `iteration ${i}: stock_count should be 0, got ${stock}`);
            assert.ok(stock >= 0, `iteration ${i}: stock_count went negative (${stock})`);

            // The losers rolled back completely: one sale, one transaction,
            // one receipt — not eight of each with the stock clamped at zero.
            assert.equal(await countSaleItems(db, itemId), 1,
                `iteration ${i}: more than one sale recorded for the last unit`);
            assert.equal(await countRows('transactions'), 1,
                `iteration ${i}: a refused checkout left its transaction behind`);
            assert.equal(await countRows('receipts'), 1,
                `iteration ${i}: a refused checkout left its receipt behind`);
        }
    });

    it('a checkout for more than the remaining stock is refused outright', async () => {
        await clearCheckoutData(db);
        const itemId = await seedInventoryItem(db, { name: 'Last Mug', stock: 1 });

        const res = await server.post('/api/transactions', shopCheckout(itemId, 3));

        assert.equal(res.status, 409);
        assert.match(res.body.error, /only has 1 left/);
        assert.equal(res.body.remaining, 1);
        assert.equal(await getStock(db, itemId), 1, 'stock was touched by a refused order');
        assert.equal(await countSaleItems(db, itemId), 0);
        assert.equal(await countRows('transactions'), 0);
    });
});

describe('event capacity', () => {
    it('concurrent ticket purchases cannot oversell the last seat', async () => {
        const capacity = 10;
        const eventId = await seedEvent(db,
            { title: 'Otter Feeding', maxCapacity: capacity, attendance: capacity - 1 });

        for (let i = 1; i <= ITERATIONS; i++) {
            await clearCheckoutData(db);
            // One seat short of the batch: capacity - 1 taken, everyone wants 1.
            await setAttendance(db, eventId, capacity - 1);

            const results = await Promise.all(
                Array.from({ length: CONCURRENCY }, () =>
                    server.post('/api/tickets', eventTickets(eventId, 1)))
            );
            const { created, refused, other } = summarise(results);

            assert.deepEqual(other, [],
                `iteration ${i}: unexpected statuses ${JSON.stringify(other)}`);
            assert.equal(created.length, 1,
                `iteration ${i}: expected exactly one 201, got ${created.length} ` +
                `(409s: ${refused.length})`);
            assert.equal(refused.length, CONCURRENCY - 1);

            const ev = await getEventCounters(db, eventId);
            assert.ok(ev.actual_attendance <= ev.max_capacity,
                `iteration ${i}: actual_attendance ${ev.actual_attendance} ` +
                `exceeds max_capacity ${ev.max_capacity}`);
            assert.equal(ev.actual_attendance, capacity);
            assert.equal(ev.tickets_sold, capacity);
            assert.equal(await countTickets(db, eventId), 1,
                `iteration ${i}: more than one ticket issued for the last seat`);
        }
    });

    it('a batch larger than the remaining capacity is refused outright', async () => {
        await clearCheckoutData(db);
        const eventId = await seedEvent(db,
            { title: 'Penguin Parade', maxCapacity: 10, attendance: 9 });

        const res = await server.post('/api/tickets', eventTickets(eventId, 2));

        assert.equal(res.status, 409);
        assert.match(res.body.error, /only has 1 seat left/);
        assert.equal(res.body.remaining, 1);
        assert.equal(await countTickets(db, eventId), 0);
        assert.equal((await getEventCounters(db, eventId)).actual_attendance, 9);
    });

    it('a cart that oversells one of three events inserts no tickets', async () => {
        await clearCheckoutData(db);
        const roomy   = await seedEvent(db, { title: 'Roomy',  maxCapacity: 50, attendance: 0 });
        const roomier = await seedEvent(db, { title: 'Roomier', maxCapacity: 50, attendance: 0 });
        const soldOut = await seedEvent(db, { title: 'Sold Out', maxCapacity: 10, attendance: 10 });

        const res = await server.post('/api/tickets', {
            tickets: [
                ...eventTickets(roomy, 2).tickets,
                ...eventTickets(roomier, 2).tickets,
                ...eventTickets(soldOut, 1).tickets,
            ],
        });

        assert.equal(res.status, 409);
        assert.match(res.body.error, /"Sold Out" is sold out/);
        assert.equal(res.body.event_id, soldOut);

        // All-or-nothing: the two events with room must be untouched too.
        const inserted = await countRows('tickets');
        assert.equal(inserted, 0, `expected 0 tickets inserted, got ${inserted}`);
        for (const [eventId, attendance] of [[roomy, 0], [roomier, 0], [soldOut, 10]]) {
            const ev = await getEventCounters(db, eventId);
            assert.equal(ev.actual_attendance, attendance);
            assert.equal(ev.tickets_sold, attendance);
        }
    });
});

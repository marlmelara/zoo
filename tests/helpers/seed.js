// ============================================================
// Minimal fixtures. Each helper inserts only the columns the rows
// under test actually need, and returns the generated id.
// ============================================================

export async function seedInventoryItem(conn, { name, stock, price = 999 }) {
    const [res] = await conn.query(
        `INSERT INTO inventory (item_name, stock_count, restock_threshold,
                                category, price_cents)
         VALUES (?, ?, 0, 'Gift', ?)`,
        // restock_threshold 0 keeps trg_inventory_low_stock_notify from
        // firing on every decrement — it isn't what these tests measure.
        [name, stock, price]
    );
    return res.insertId;
}

export async function setStock(conn, itemId, stock) {
    await conn.query('UPDATE inventory SET stock_count = ? WHERE item_id = ?',
        [stock, itemId]);
}

export async function getStock(conn, itemId) {
    const [rows] = await conn.query(
        'SELECT stock_count FROM inventory WHERE item_id = ?', [itemId]);
    return rows[0].stock_count;
}

export async function seedEvent(conn, { title, maxCapacity, attendance = 0 }) {
    const [res] = await conn.query(
        `INSERT INTO events (title, event_date, max_capacity, actual_attendance,
                             tickets_sold, ticket_price_cents)
         VALUES (?, CURDATE(), ?, ?, ?, 2500)`,
        [title, maxCapacity, attendance, attendance]
    );
    return res.insertId;
}

export async function setAttendance(conn, eventId, attendance) {
    await conn.query(
        'UPDATE events SET actual_attendance = ?, tickets_sold = ? WHERE event_id = ?',
        [attendance, attendance, eventId]);
}

export async function getEventCounters(conn, eventId) {
    const [rows] = await conn.query(
        `SELECT max_capacity, COALESCE(actual_attendance, 0) AS actual_attendance,
                tickets_sold
           FROM events WHERE event_id = ?`,
        [eventId]);
    return rows[0];
}

export async function countTickets(conn, eventId) {
    const [rows] = await conn.query(
        'SELECT COUNT(*) AS n FROM tickets WHERE event_id = ?', [eventId]);
    return rows[0].n;
}

export async function countSaleItems(conn, itemId) {
    const [rows] = await conn.query(
        'SELECT COALESCE(SUM(quantity), 0) AS n FROM sale_items WHERE item_id = ?',
        [itemId]);
    return Number(rows[0].n);
}

// Wipe everything a checkout can create, so one iteration of the race
// can't colour the next. Child rows first — FKs are ON DELETE SET NULL,
// not CASCADE, so orphans would otherwise survive.
export async function clearCheckoutData(conn) {
    for (const table of ['sale_items', 'tickets', 'receipts', 'transactions']) {
        await conn.query(`DELETE FROM ${table}`);
    }
}

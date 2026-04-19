import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { toIsoUtc } from '../lib/dates.js';

const router = Router();

// GET /api/transactions/my — customer's non-donation transactions with receipts
router.get('/my', requireAuth, async (req, res) => {
    try {
        const { customerId } = req.user;
        const [txns] = await db.query(
            `SELECT t.*, r.receipt_id, r.email AS receipt_email, r.customer_name,
                    r.line_items, r.subtotal_cents, r.tax_cents, r.total_cents,
                    r.is_donation AS receipt_is_donation, r.donation_fund
             FROM transactions t
             LEFT JOIN receipts r ON r.transaction_id = t.transaction_id
             WHERE t.customer_id = ? AND t.is_donation = 0
             ORDER BY t.transaction_date DESC`,
            [customerId]
        );
        if (txns.length === 0) return res.json([]);

        // Derive line items from tickets + sale_items for orders without receipts.
        const txnIds = txns.map(t => t.transaction_id);
        const [tkRows] = await db.query(
            `SELECT tk.transaction_id, tk.type, tk.event_id, tk.price_cents,
                    e.title AS event_title
             FROM tickets tk
             LEFT JOIN events e ON e.event_id = tk.event_id
             WHERE tk.transaction_id IN (?)`,
            [txnIds]
        );
        const [siRows] = await db.query(
            `SELECT si.transaction_id, si.quantity, si.price_at_sale_cents,
                    i.item_name
             FROM sale_items si
             LEFT JOIN inventory i ON i.item_id = si.item_id
             WHERE si.transaction_id IN (?)`,
            [txnIds]
        );
        const ticketsByTxn = {};
        for (const t of tkRows) (ticketsByTxn[t.transaction_id] ||= []).push(t);
        const saleItemsByTxn = {};
        for (const s of siRows) (saleItemsByTxn[s.transaction_id] ||= []).push(s);

        const ticketTypeLabel = (type) => {
            switch (type) {
                case 'adult':  return 'Adult';
                case 'youth':  return 'Youth';
                case 'child':  return 'Child';
                case 'senior': return 'Senior';
                case 'member': return 'Member';
                default:       return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'General';
            }
        };

        const shaped = txns.map(t => {
            // Prefer the stored receipt line_items when present.
            let lineItems = t.line_items;
            if (typeof lineItems === 'string') {
                try { lineItems = JSON.parse(lineItems); } catch { lineItems = null; }
            }
            if (!Array.isArray(lineItems) || lineItems.length === 0) {
                // Build line items from tickets + sale_items.
                const derived = [];
                const grouped = {};
                for (const tk of (ticketsByTxn[t.transaction_id] || [])) {
                    const key = tk.event_id
                        ? `event-${tk.event_id}-${tk.price_cents}`
                        : `adm-${tk.type}-${tk.price_cents}`;
                    if (!grouped[key]) {
                        grouped[key] = {
                            description: tk.event_id
                                ? `Event: ${tk.event_title || 'Ticket'}`
                                : `${ticketTypeLabel(tk.type)} Ticket`,
                            quantity: 0,
                            unitPriceCents: tk.price_cents,
                        };
                    }
                    grouped[key].quantity += 1;
                }
                derived.push(...Object.values(grouped));
                for (const si of (saleItemsByTxn[t.transaction_id] || [])) {
                    derived.push({
                        description: si.item_name || 'Shop item',
                        quantity: si.quantity,
                        unitPriceCents: si.price_at_sale_cents,
                    });
                }
                lineItems = derived;
            }
            return {
                ...t,
                transaction_date: toIsoUtc(t.transaction_date),
                line_items: lineItems,
            };
        });
        return res.json(shaped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/transactions — admin: all transactions
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT t.*, c.first_name, c.last_name
             FROM transactions t
             LEFT JOIN customers c ON t.customer_id = c.customer_id
             ORDER BY t.transaction_date DESC`
        );
        // Same UTC normalization as /my so the admin log matches reality.
        const shaped = rows.map(r => ({ ...r, transaction_date: toIsoUtc(r.transaction_date) }));
        return res.json(shaped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/transactions — create transaction + receipt + optional sale_items atomically
router.post('/', async (req, res) => {
    const { total_amount_cents, customer_id, guest_email, is_donation,
            donation_id, receipt, sale_items } = req.body;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [txnResult] = await conn.query(
            `INSERT INTO transactions
             (total_amount_cents, customer_id, guest_email, is_donation, donation_id)
             VALUES (?, ?, ?, ?, ?)`,
            [total_amount_cents, customer_id || null, guest_email || null,
             is_donation ? 1 : 0, donation_id || null]
        );
        const transactionId = txnResult.insertId;

        let receiptId = null;
        if (receipt) {
            const [recResult] = await conn.query(
                `INSERT INTO receipts
                 (transaction_id, email, customer_name, line_items, subtotal_cents,
                  tax_cents, total_cents, is_donation, donation_fund)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [transactionId,
                 receipt.email, receipt.customer_name || null,
                 JSON.stringify(receipt.line_items || []),
                 receipt.subtotal_cents, receipt.tax_cents, receipt.total_cents,
                 receipt.is_donation ? 1 : 0, receipt.donation_fund || null]
            );
            receiptId = recResult.insertId;
        }

        // If sale_items provided (shop/POS checkout), atomically check stock +
        // decrement. Each inventory row is locked FOR UPDATE so two concurrent
        // checkouts can't both sell the last unit — the second one blocks on
        // the lock, then reads the post-decrement stock and rolls back with a
        // clear error. Previous code silently clamped at 0 via GREATEST(),
        // meaning the customer could be charged for items that weren't in
        // stock.
        if (Array.isArray(sale_items) && sale_items.length > 0) {
            // Collapse duplicate item_ids so one row covers the whole order.
            const byItem = new Map();
            for (const si of sale_items) {
                const prev = byItem.get(si.item_id);
                if (prev) prev.quantity += Number(si.quantity);
                else byItem.set(si.item_id, { ...si, quantity: Number(si.quantity) });
            }

            for (const si of byItem.values()) {
                const [rows] = await conn.query(
                    `SELECT item_name, stock_count FROM inventory WHERE item_id = ? FOR UPDATE`,
                    [si.item_id]
                );
                if (rows.length === 0) {
                    await conn.rollback();
                    return res.status(400).json({ error: `Shop item #${si.item_id} no longer exists.` });
                }
                const inv = rows[0];
                if (inv.stock_count < si.quantity) {
                    await conn.rollback();
                    return res.status(409).json({
                        error: inv.stock_count <= 0
                            ? `"${inv.item_name}" is sold out.`
                            : `"${inv.item_name}" only has ${inv.stock_count} left, but you tried to buy ${si.quantity}.`,
                        item_id: si.item_id,
                        remaining: Math.max(0, inv.stock_count),
                    });
                }
                await conn.query(
                    `INSERT INTO sale_items (transaction_id, item_id, quantity, price_at_sale_cents)
                     VALUES (?, ?, ?, ?)`,
                    [transactionId, si.item_id, si.quantity, si.price_at_sale_cents]
                );
                await conn.query(
                    'UPDATE inventory SET stock_count = stock_count - ? WHERE item_id = ?',
                    [si.quantity, si.item_id]
                );
            }
        }

        await conn.commit();
        return res.status(201).json({ transaction_id: transactionId, receipt_id: receiptId });
    } catch (err) {
        await conn.rollback();
        return res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// POST /api/transactions/sale-items
router.post('/sale-items', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid items array' });
    }
    
    // Insert each sale item
    for (const item of items) {
      await db.query(
        `INSERT INTO sale_items (transaction_id, item_id, quantity, price_at_sale_cents)
        VALUES (?, ?, ?, ?)`,
        [item.transaction_id, item.item_id, item.quantity, item.price_at_sale_cents]
        );
    }
    
    res.status(201).json({ success: true, message: `${items.length} sale items created` });
  } catch (error) {
    console.error('Error creating sale items:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/transactions/:id/sale-items
router.get('/:id/sale-items', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
        `SELECT * FROM sale_items WHERE transaction_id = ?`,
        [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sale items:', error);
    res.status(500).json({ error: error.message });
  }
});
export default router;

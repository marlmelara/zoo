import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

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
        return res.json(txns);
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
        return res.json(rows);
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

        // If sale_items provided (POS checkout), insert them and decrement stock
        if (Array.isArray(sale_items) && sale_items.length > 0) {
            for (const si of sale_items) {
                await conn.query(
                    `INSERT INTO sale_items (transaction_id, item_id, quantity, price_at_sale_cents)
                     VALUES (?, ?, ?, ?)`,
                    [transactionId, si.item_id, si.quantity, si.price_at_sale_cents]
                );
                await conn.query(
                    'UPDATE inventory SET stock_count = GREATEST(0, stock_count - ?) WHERE item_id = ?',
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

export default router;

import React, { useState } from 'react';
import api from '../../../../lib/api';
import { Ticket, CreditCard } from 'lucide-react';

export default function Tickets() {
    const [ticketType, setTicketType] = useState('Admission');
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const prices = {
        'Admission': 2500, // Cents
        'Attraction': 1000 // Cents
    };

    const handlePurchase = async () => {
        setLoading(true);
        setMessage('');
        try {
            const totalCents = prices[ticketType] * quantity;

            // 1. Create Transaction
            const txnData = await api.post('/transactions', { total_amount_cents: totalCents });

            // 2. Create Tickets linked to Transaction
            const ticketsToCreate = Array.from({ length: quantity }).map(() => ({
                price_cents: prices[ticketType],
                type: ticketType,
                transaction_id: txnData.transaction_id
            }));

            await api.post('/tickets', { tickets: ticketsToCreate });

            setMessage(`Success! Purchase ID: ${txnData.transaction_id}`);
            setQuantity(1);
        } catch (error) {
            console.error('Purchase failed:', error);
            setMessage('Transaction failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>Ticketing</h1>
            <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <div className="glass-panel" style={{ padding: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <CreditCard color="var(--color-primary)" />
                            <h3 style={{ margin: 0 }}>New Sale</h3>
                        </div>

                        <div style={{ margin: '20px 0' }}>
                            <label style={{ display: 'block', marginBottom: '8px' }}>Ticket Type</label>
                            <select
                                className="glass-input"
                                value={ticketType}
                                onChange={(e) => setTicketType(e.target.value)}
                            >
                                <option value="Admission">General Admission ($25.00)</option>
                                <option value="Attraction">Special Attraction ($10.00)</option>
                            </select>
                        </div>

                        <div style={{ margin: '20px 0' }}>
                            <label style={{ display: 'block', marginBottom: '8px' }}>Quantity</label>
                            <input
                                type="number"
                                className="glass-input"
                                value={quantity}
                                min="1"
                                onChange={(e) => setQuantity(parseInt(e.target.value))}
                            />
                        </div>

                        <div style={{ marginTop: '30px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <span>Total</span>
                                <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                    ${((prices[ticketType] * quantity) / 100).toFixed(2)}
                                </span>
                            </div>

                            <button
                                className="glass-button"
                                style={{ width: '100%', background: 'var(--color-primary)', color: 'white', opacity: loading ? 0.7 : 1 }}
                                onClick={handlePurchase}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : 'Complete Sale'}
                            </button>

                            {message && (
                                <p style={{ marginTop: '15px', textAlign: 'center', color: message.includes('Success') ? 'var(--color-primary)' : 'var(--color-accent)' }}>
                                    {message}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, minWidth: '300px' }}>
                    <h3>Recent Transactions</h3>
                    <div className="glass-panel" style={{ padding: '20px' }}>
                        <p style={{ color: 'var(--color-text-muted)' }}>Transaction history implementation pending.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';
import { Package, ShoppingCart, Clock } from 'lucide-react';

export default function PurchasesTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchPurchases();
  }, [user?.id]);

  async function fetchPurchases() {
    try {
      const { data: custData } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('user_id', user.id)
        .single();

      if (!custData) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('transactions')
        .select('*, receipts(*)')
        .eq('customer_id', custData.customer_id)
        .eq('is_donation', false)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (err) {
      console.error('Error fetching purchases:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredPurchases = purchases.filter(txn => {
    const d = new Date(txn.transaction_date);
    if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const totalSpent = filteredPurchases.reduce((sum, t) => sum + t.total_amount_cents, 0) / 100;

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title"><Package size={24} /> My Purchases</h2>
        <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-secondary)', padding: '0.5rem 1.125rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <ShoppingCart size={14} /> Shop Now
        </button>
      </div>

      {purchases.length > 0 && (
        <div className="filter-bar">
          <span className="filter-label">Filter by date:</span>
          <input type="date" className="glass-input filter-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span style={{ color: 'var(--color-text-muted)' }}>to</span>
          <input type="date" className="glass-input filter-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          {(dateFrom || dateTo) && (
            <button className="glass-button" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem' }}>Clear</button>
          )}
        </div>
      )}

      {loading ? (
        <p>Loading purchases...</p>
      ) : purchases.length === 0 ? (
        <div className="empty-state">
          <Package size={48} className="empty-state-icon" />
          <p>No purchases yet.</p>
          <p style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>Your order history and itemized receipts will appear here.</p>
          <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-primary)', padding: '0.6rem 1.5rem' }}>Browse Tickets & Shop</button>
        </div>
      ) : (
        <div>
          {filteredPurchases.map(txn => {
            const receipt = txn.receipts?.[0] || null;
            const lineItems = receipt?.line_items || [];
            return (
              <div key={txn.transaction_id} className="item-card">
                <div className="item-card-header">
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Order #{txn.transaction_id}</h3>
                    <div className="item-meta">
                      <Clock size={12} />
                      {new Date(txn.transaction_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      {' at '}
                      {new Date(txn.transaction_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </div>
                  </div>
                  <p className="item-price">${(txn.total_amount_cents / 100).toFixed(2)}</p>
                </div>
                {lineItems.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', padding: '0.75rem', marginTop: '0.75rem' }}>
                    {lineItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: idx < lineItems.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                        <span style={{ fontSize: '0.8rem' }}>{item.description} <span style={{ color: 'var(--color-text-muted)' }}>x{item.quantity}</span></span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)' }}>${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</span>
                      </div>
                    ))}
                    {receipt && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        <span>Subtotal: ${(receipt.subtotal_cents / 100).toFixed(2)}</span>
                        <span>Tax: ${(receipt.tax_cents / 100).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="totals-bar">
            <span style={{ color: 'var(--color-text-muted)', marginRight: '1rem' }}>Total Spent:</span>
            <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--color-primary)' }}>${totalSpent.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
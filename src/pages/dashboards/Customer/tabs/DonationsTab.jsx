import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';
import { Heart, Clock } from 'lucide-react';

export default function DonationsTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchDonations();
  }, [user?.id]);

  async function fetchDonations() {
    try {
      const { data: custData } = await supabase
        .from('customers')
        .select('customer_id, first_name, last_name')
        .eq('user_id', user.id)
        .single();

      if (!custData) { setLoading(false); return; }

      let { data, error } = await supabase
        .from('donations')
        .select('*')
        .eq('customer_id', custData.customer_id)
        .order('donation_date', { ascending: false });

      if (error) throw error;

      if ((!data || data.length === 0) && custData.first_name) {
        const { data: byName } = await supabase
          .from('donations')
          .select('*')
          .ilike('donor_name', `%${custData.first_name}%${custData.last_name}%`)
          .order('donation_date', { ascending: false });
        data = byName || [];
      }

      setDonations(data || []);
    } catch (err) {
      console.error('Error fetching donations:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredDonations = donations.filter(donation => {
    const d = donation.donation_date ? new Date(donation.donation_date) : null;
    if (!d) return true;
    if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const totalDonated = filteredDonations.reduce((sum, d) => sum + d.amount_cents, 0) / 100;

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title"><Heart size={24} /> My Donations</h2>
        <button className="glass-button" onClick={() => navigate('/donations')} style={{ background: '#ef4444', padding: '0.5rem 1.125rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Heart size={14} /> Make a Donation
        </button>
      </div>

      {donations.length > 0 && (
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
        <p>Loading donations...</p>
      ) : donations.length === 0 ? (
        <div className="empty-state">
          <Heart size={48} className="empty-state-icon" />
          <p>No donations on record.</p>
          <p style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>Your donations help protect endangered animals and fund conservation programs.</p>
          <button className="glass-button" onClick={() => navigate('/donations')} style={{ background: '#ef4444', padding: '0.6rem 1.5rem' }}>Donate Now</button>
        </div>
      ) : (
        <div>
          {filteredDonations.map(donation => (
            <div key={donation.donation_id} className="item-card">
              <div className="item-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="item-icon donation">
                    <Heart size={22} color="#ef4444" />
                  </div>
                  <div>
                    <h3 className="item-title" style={{ marginBottom: '0.25rem' }}>Donation</h3>
                    <div className="item-meta">
                      <Clock size={12} />
                      {donation.donation_date
                        ? `${new Date(donation.donation_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date(donation.donation_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
                        : 'Date not recorded'}
                    </div>
                  </div>
                </div>
                <p className="item-price" style={{ color: '#ef4444' }}>${(donation.amount_cents / 100).toFixed(2)}</p>
              </div>
            </div>
          ))}
          <div className="totals-bar">
            <span style={{ color: 'var(--color-text-muted)', marginRight: '1rem' }}>Total Donated:</span>
            <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#ef4444' }}>${totalDonated.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
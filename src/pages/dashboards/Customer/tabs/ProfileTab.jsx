import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';
import { User, Mail, Phone, MapPin, Calendar, Star, Gift, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
];

export default function ProfileTab() {
  const { user, customerId, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  async function fetchProfile() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setEditForm(data || {});
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileUpdate(e) {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          phone: editForm.phone,
          address: editForm.address,
          city: editForm.city,
          state: editForm.state,
          zip_code: editForm.zip_code,
          date_of_birth: editForm.date_of_birth,
        })
        .eq('customer_id', profile.customer_id);

      if (error) throw error;
      setEditing(false);
      fetchProfile();
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Failed to update profile: ' + err.message);
    }
  }

  async function handleDeleteAccount() {
    try {
      setDeleting(true);
      if (customerId) {
        await supabase.from('tickets').delete().eq('customer_id', customerId);
        await supabase.from('donations').update({ customer_id: null }).eq('customer_id', customerId);
        await supabase.from('transactions').update({ customer_id: null }).eq('customer_id', customerId);
        await supabase.from('customers').delete().eq('customer_id', customerId);
      }
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Error deleting account:', err);
      alert('Failed to delete account: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  const isMembershipActive = profile?.membership_type && profile?.membership_end && new Date(profile.membership_end) >= new Date();

  const membershipColor = (type) => {
    switch (type) {
      case 'premium': return '#f59e0b';
      case 'family': return '#3b82f6';
      case 'explorer': return '#10b981';
      default: return 'var(--color-text-muted)';
    }
  };

  if (loading) return <p>Loading profile...</p>;
  if (!profile) return <p style={{ color: 'var(--color-text-muted)' }}>Could not load profile.</p>;

  return (
    <div>
      {editing ? (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Edit Profile</h2>
          <form onSubmit={handleProfileUpdate}>
            <div className="form-grid-2col">
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>First Name</label>
                <input className="glass-input" value={editForm.first_name || ''} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Last Name</label>
                <input className="glass-input" value={editForm.last_name || ''} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Phone</label>
                <input className="glass-input" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Date of Birth</label>
                <input className="glass-input" type="date" value={editForm.date_of_birth || ''} onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
              </div>
              <div className="form-grid-full">
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Street Address</label>
                <input className="glass-input" value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>City</label>
                <input className="glass-input" value={editForm.city || ''} onChange={e => setEditForm({ ...editForm, city: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>State</label>
                <select className="glass-input" value={editForm.state || ''} onChange={e => setEditForm({ ...editForm, state: e.target.value })}>
                  <option value="">Select a state</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Zip Code</label>
                <input className="glass-input" value={editForm.zip_code || ''} onChange={e => setEditForm({ ...editForm, zip_code: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="submit" className="glass-button" style={{ background: 'var(--color-primary)', flex: 1 }}>Save Changes</button>
              <button type="button" className="glass-button" onClick={() => { setEditing(false); setEditForm(profile); }} style={{ flex: 1 }}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <div>
          {/* Profile Card */}
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div className="profile-avatar">
                  <User size={35} color="white" />
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>{profile.first_name} {profile.last_name}</h2>
                  {isMembershipActive ? (
                    <span style={{
                      fontSize: '0.8rem', padding: '0.25rem 0.75rem', borderRadius: '2rem',
                      background: `${membershipColor(profile.membership_type)}22`,
                      color: membershipColor(profile.membership_type), textTransform: 'capitalize', fontWeight: 600, display: 'inline-block', marginTop: '0.25rem'
                    }}>
                      {profile.membership_type} Member
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Guest Visitor</span>
                  )}
                </div>
              </div>
              <button className="glass-button" onClick={() => setEditing(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Edit Profile</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="info-card">
                <div className="info-card-label"><Mail size={14} /><span>Email</span></div>
                <p className="info-card-value">{profile.email || user?.email || 'Not set'}</p>
              </div>
              <div className="info-card">
                <div className="info-card-label"><Phone size={14} /><span>Phone</span></div>
                <p className="info-card-value">{profile.phone || 'Not set'}</p>
              </div>
              <div className="info-card">
                <div className="info-card-label"><MapPin size={14} /><span>Address</span></div>
                <p className="info-card-value">
                  {profile.address ? [profile.address, profile.city, profile.state, profile.zip_code].filter(Boolean).join(', ') : 'Not set'}
                </p>
              </div>
              <div className="info-card">
                <div className="info-card-label"><Calendar size={14} /><span>Date of Birth</span></div>
                <p className="info-card-value">
                  {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Completion Prompt */}
          {(!profile.phone || !profile.address || !profile.date_of_birth) && (
            <div style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <p style={{ margin: '0 0 0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>Complete your profile</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Add your {[!profile.phone && 'phone number', !profile.date_of_birth && 'date of birth', !profile.address && 'address'].filter(Boolean).join(', ')} for faster checkout.
                </p>
              </div>
              <button className="glass-button" onClick={() => setEditing(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'rgba(59,130,246,0.25)', flexShrink: 0 }}>Edit Profile</button>
            </div>
          )}

          {/* Membership Card */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Star size={20} color={membershipColor(profile.membership_type)} /> Membership
            </h3>
            {isMembershipActive ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                  <div className="info-card">
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0 0 0.25rem' }}>Plan</p>
                    <p style={{ fontWeight: 600, margin: 0, textTransform: 'capitalize', color: membershipColor(profile.membership_type) }}>{profile.membership_type}</p>
                  </div>
                  <div className="info-card">
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0 0 0.25rem' }}>Start Date</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>{profile.membership_start ? new Date(profile.membership_start).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div className="info-card">
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0 0 0.25rem' }}>Expires</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>{profile.membership_end ? new Date(profile.membership_end).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
                {profile.membership_end && new Date(profile.membership_end) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#fcd34d' }}>
                      <RefreshCw size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                      Your membership expires soon. Renew to keep your perks!
                    </span>
                    <button className="glass-button" onClick={() => navigate('/checkout')} style={{ background: 'var(--color-secondary)', padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Renew Membership</button>
                  </div>
                )}
                <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  As a member, you get free general admission and discounted rates on tickets and shop purchases.
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--color-text-muted)' }}>
                <Gift size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <p>You don't have an active membership.</p>
                <p style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>Become a member for free admission, discounts, and exclusive perks!</p>
                <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-primary)', padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}>View Membership Plans</button>
              </div>
            )}
          </div>

          {/* Delete Account */}
          <div className="delete-account-section">
            <div className="delete-account-content">
              <div>
                <h4 className="delete-account-title"><AlertTriangle size={16} /> Delete Account</h4>
                <p className="delete-account-text">Permanently delete your account and all associated data. This action cannot be undone.</p>
              </div>
              <button className="delete-button" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={14} /> Delete Account
              </button>
            </div>
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
              <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
                <h2 style={{ margin: '0 0 0.5rem' }}>Are you sure?</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  This will permanently delete your account, purchase history, and all associated data. This action <strong style={{ color: '#f87171' }}>cannot be undone</strong>.
                </p>
                <div className="modal-buttons">
                  <button className="glass-button" onClick={() => setShowDeleteConfirm(false)} style={{ padding: '0.6rem 1.5rem' }}>Cancel</button>
                  <button className="glass-button" onClick={handleDeleteAccount} disabled={deleting} style={{ padding: '0.6rem 1.5rem', background: '#ef4444', color: 'white' }}>
                    {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
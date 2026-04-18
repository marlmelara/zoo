import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import {
    User, Ticket, Heart, Calendar, MapPin, Phone, Mail,
    Star, Gift, ShoppingCart, RefreshCw, Clock, Package, Trash2, AlertTriangle
} from 'lucide-react';

const TABS = ['My Profile', 'My Purchases', 'My Tickets', 'My Donations', 'Events'];

export default function CustomerDashboard() {
    const { user, customerId, signOut } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('My Profile');

    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);

    const [tickets, setTickets] = useState([]);
    const [ticketsLoading, setTicketsLoading] = useState(true);

    const [donations, setDonations] = useState([]);
    const [donationsLoading, setDonationsLoading] = useState(true);

    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    const [purchases, setPurchases] = useState([]);
    const [purchasesLoading, setPurchasesLoading] = useState(true);

    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ── Filters ──
    const [purchaseDateFrom, setPurchaseDateFrom] = useState('');
    const [purchaseDateTo, setPurchaseDateTo] = useState('');
    const [ticketDateFrom, setTicketDateFrom] = useState('');
    const [ticketDateTo, setTicketDateTo] = useState('');
    const [donationDateFrom, setDonationDateFrom] = useState('');
    const [donationDateTo, setDonationDateTo] = useState('');
    const [eventsFilter, setEventsFilter] = useState('upcoming');
    const [eventsDateFrom, setEventsDateFrom] = useState('');
    const [eventsDateTo, setEventsDateTo] = useState('');

    useEffect(() => {
        if (!user?.userId) return;
        fetchProfile();
        fetchTickets();
        fetchDonations();
        fetchEvents();
        fetchPurchases();
    }, [user?.userId]);

    async function fetchProfile() {
        try {
            const data = await api.get('/customers/me');
            setProfile(data);
            setEditForm(data || {});
            // If any required field is missing, force edit mode on the profile tab.
            if (data && !isProfileComplete(data)) {
                setActiveTab('My Profile');
                setEditing(true);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setProfileLoading(false);
        }
    }

    function isProfileComplete(p) {
        if (!p) return false;
        const req = ['first_name', 'last_name', 'phone', 'date_of_birth',
                     'address', 'city', 'state', 'zip_code'];
        return req.every(k => p[k] && String(p[k]).trim() !== '');
    }
    const profileIncomplete = profile && !isProfileComplete(profile);

    async function fetchTickets() {
        try {
            const data = await api.get('/tickets/my');
            setTickets(data || []);
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setTicketsLoading(false);
        }
    }

    async function fetchDonations() {
        try {
            const data = await api.get('/donations/my');
            setDonations(data || []);
        } catch (err) {
            console.error('Error fetching donations:', err);
        } finally {
            setDonationsLoading(false);
        }
    }

    async function fetchEvents() {
        try {
            const data = await api.get('/events');
            setEvents(data || []);
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setEventsLoading(false);
        }
    }

    async function fetchPurchases() {
        try {
            const data = await api.get('/transactions/my');
            setPurchases(data || []);
        } catch (err) {
            console.error('Error fetching purchases:', err);
        } finally {
            setPurchasesLoading(false);
        }
    }

    async function handleDeleteAccount() {
        try {
            setDeleting(true);
            await api.delete('/customers/me');
            await signOut();
            navigate('/');
        } catch (err) {
            console.error('Error deleting account:', err);
            alert('Failed to delete account: ' + err.message);
        } finally {
            setDeleting(false);
        }
    }

    // Phone/zip format helpers for the profile edit form.
    const formatPhone = (v) => {
        const d = String(v).replace(/\D/g, '').slice(0, 10);
        if (d.length <= 3) return d;
        if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
        return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    };
    const digitsOnly = (v, max) => String(v).replace(/\D/g, '').slice(0, max);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const minDob   = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate())
        .toISOString().split('T')[0];

    async function handleProfileUpdate(e) {
        e.preventDefault();
        const required = {
            first_name: 'First name', last_name: 'Last name',
            phone: 'Phone', date_of_birth: 'Date of birth',
            address: 'Street address', city: 'City', state: 'State', zip_code: 'Zip code',
        };
        for (const [k, label] of Object.entries(required)) {
            if (!editForm[k] || !String(editForm[k]).trim()) {
                alert(`${label} is required.`);
                return;
            }
        }
        if ((editForm.phone || '').replace(/\D/g, '').length !== 10) {
            alert('Phone number must be exactly 10 digits.');
            return;
        }
        if (!/^\d{5}$/.test(editForm.zip_code || '')) {
            alert('Zip code must be exactly 5 digits.');
            return;
        }
        const dob = new Date(editForm.date_of_birth);
        if (Number.isNaN(dob.getTime()) || dob > today || dob < new Date(minDob)) {
            alert('Please enter a valid date of birth.');
            return;
        }
        try {
            await api.patch('/customers/me', {
                first_name: editForm.first_name,
                last_name: editForm.last_name,
                phone: editForm.phone,
                address: editForm.address,
                city: editForm.city,
                state: editForm.state,
                zip_code: editForm.zip_code,
                date_of_birth: editForm.date_of_birth,
            });
            setEditing(false);
            fetchProfile();
        } catch (err) {
            console.error('Error updating profile:', err);
            alert('Failed to update profile: ' + err.message);
        }
    }

    // Check if membership is active (not expired)
    const isMembershipActive = profile?.membership_type && profile?.membership_end && new Date(profile.membership_end) >= new Date();

    const membershipColor = (type) => {
        switch (type) {
            case 'premium': return '#f59e0b';
            case 'family': return '#3b82f6';
            case 'explorer': return '#10b981';
            default: return 'var(--color-text-muted)';
        }
    };

    const formatTime = (timeString) => {
        if (!timeString) return '';
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    const ticketTypeLabel = (type) => {
        switch (type) {
            case 'adult': return 'Adult';
            case 'child': return 'Child';
            case 'senior': return 'Senior';
            case 'member': return 'Member';
            default: return type || 'General';
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0 }}>My Account</h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>
                        Welcome back{profile ? `, ${profile.first_name}` : ''}!
                    </p>
                </div>
                {isMembershipActive && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: '20px',
                        background: `${membershipColor(profile.membership_type)}22`,
                        border: `1px solid ${membershipColor(profile.membership_type)}44`
                    }}>
                        <Star size={16} color={membershipColor(profile.membership_type)} />
                        <span style={{ fontWeight: 600, color: membershipColor(profile.membership_type), textTransform: 'capitalize' }}>
                            {profile.membership_type} Member
                        </span>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className="glass-button"
                        onClick={() => setActiveTab(tab)}
                        style={{
                            background: activeTab === tab ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: activeTab === tab ? 700 : 400
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* ═══════════ MY PROFILE TAB ═══════════ */}
            {activeTab === 'My Profile' && (
                <div>
                    {profileLoading ? <p>Loading profile...</p> : !profile ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>Could not load profile.</p>
                    ) : editing ? (
                        <div className="glass-panel" style={{ padding: '30px' }}>
                            <h2 style={{ marginTop: 0 }}>Edit Profile</h2>
                            {profileIncomplete && (
                                <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <AlertTriangle size={18} color="#f59e0b" />
                                    <span style={{ fontSize: '0.9rem', color: '#fcd34d' }}>
                                        Please complete all required profile information before continuing.
                                    </span>
                                </div>
                            )}
                            <form onSubmit={handleProfileUpdate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>First Name <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="glass-input" value={editForm.first_name || ''} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} required maxLength={50} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="glass-input" value={editForm.last_name || ''} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} required maxLength={50} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Phone <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="glass-input" type="tel" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: formatPhone(e.target.value) })} required maxLength={14} inputMode="numeric" placeholder="(123) 456-7890" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="glass-input" type="date" value={editForm.date_of_birth || ''} onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })} required min={minDob} max={todayStr} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Street Address <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="glass-input" value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} required maxLength={200} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>City <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="glass-input" value={editForm.city || ''} onChange={e => setEditForm({ ...editForm, city: e.target.value })} required maxLength={100} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>State <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select className="glass-input" value={editForm.state || ''} onChange={e => setEditForm({ ...editForm, state: e.target.value })} required style={{ padding: '12px', width: '100%', boxSizing: 'border-box' }}>
                                        <option value="">Select a state</option>
                                        {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Zip Code <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input className="glass-input" value={editForm.zip_code || ''} onChange={e => setEditForm({ ...editForm, zip_code: digitsOnly(e.target.value, 5) })} required maxLength={5} inputMode="numeric" pattern="\d{5}" placeholder="12345" />
                                </div>
                                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button type="submit" className="glass-button" style={{ background: 'var(--color-primary)', flex: 1 }}>Save Changes</button>
                                    {!profileIncomplete && (
                                        <button type="button" className="glass-button" onClick={() => { setEditing(false); setEditForm(profile); }} style={{ flex: 1 }}>Cancel</button>
                                    )}
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div>
                            {/* Profile Card */}
                            <div className="glass-panel" style={{ padding: '30px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '25px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{
                                            width: '70px', height: '70px', borderRadius: '50%',
                                            background: 'var(--color-primary)', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <User size={35} color="white" />
                                        </div>
                                        <div>
                                            <h2 style={{ margin: 0 }}>{profile.first_name} {profile.last_name}</h2>
                                            {isMembershipActive ? (
                                                <span style={{
                                                    fontSize: '13px', padding: '4px 10px', borderRadius: '20px',
                                                    background: `${membershipColor(profile.membership_type)}22`,
                                                    color: membershipColor(profile.membership_type),
                                                    textTransform: 'capitalize', fontWeight: 600
                                                }}>
                                                    {profile.membership_type} Member
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Guest Visitor</span>
                                            )}
                                        </div>
                                    </div>
                                    <button className="glass-button" onClick={() => setEditing(true)} style={{ padding: '8px 16px', fontSize: '13px' }}>
                                        Edit Profile
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                                            <Mail size={14} color="var(--color-text-muted)" />
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0}}>Email</p>
                                        </div>
                                        <p style={{ fontWeight: 600, margin: 0 }}>{profile.email || user?.email || 'Not set'}</p>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                                            <Phone size={14} color="var(--color-text-muted)" />
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>Phone</p>
                                        </div>
                                        <p style={{ fontWeight: 600, margin: 0 }}>{profile.phone || 'Not set'}</p>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                                            <MapPin size={14} color="var(--color-text-muted)" />
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>Address</p>
                                        </div>
                                        <p style={{ fontWeight: 600, margin: 0 }}>
                                            {profile.address ? [profile.address, profile.city, profile.state, profile.zip_code].filter(Boolean).join(', ') : 'Not set'}
                                        </p>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                                            <Calendar size={14} color="var(--color-text-muted)" />
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>Date of Birth</p>
                                        </div>
                                        <p style={{ fontWeight: 600, margin: 0 }}>
                                            {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Profile Completion Prompt */}
                            {(!profile.phone || !profile.address || !profile.date_of_birth) && (
                                <div style={{ marginBottom: '20px', padding: '16px 20px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '0.9rem' }}>Complete your profile</p>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                            Add your {[!profile.phone && 'phone number', !profile.date_of_birth && 'date of birth', !profile.address && 'address'].filter(Boolean).join(', ')} for faster checkout.
                                        </p>
                                    </div>
                                    <button className="glass-button" onClick={() => setEditing(true)} style={{ padding: '8px 16px', fontSize: '0.8rem', background: 'rgba(59,130,246,0.25)', flexShrink: 0 }}>
                                        Edit Profile
                                    </button>
                                </div>
                            )}

                            {/* Membership Card */}
                            <div className="glass-panel" style={{ padding: '25px' }}>
                                <h3 style={{ margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Star size={20} color={membershipColor(profile.membership_type)} /> Membership
                                </h3>
                                {isMembershipActive ? (
                                    <div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 5px' }}>Plan</p>
                                                <p style={{ fontWeight: 600, margin: 0, textTransform: 'capitalize', color: membershipColor(profile.membership_type) }}>
                                                    {profile.membership_type}
                                                </p>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 5px' }}>Start Date</p>
                                                <p style={{ fontWeight: 600, margin: 0 }}>
                                                    {profile.membership_start ? new Date(profile.membership_start).toLocaleDateString() : 'N/A'}
                                                </p>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 5px' }}>Expires</p>
                                                <p style={{ fontWeight: 600, margin: 0 }}>
                                                    {profile.membership_end ? new Date(profile.membership_end).toLocaleDateString() : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        {profile.membership_end && new Date(profile.membership_end) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                                            <div style={{ marginTop: '15px', padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.85rem', color: '#fcd34d' }}>
                                                    <RefreshCw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                                    Your membership expires soon. Renew to keep your perks!
                                                </span>
                                                <button className="glass-button" onClick={() => {
                                                    const discountMap = { explorer: 0.10, family: 0.15, premium: 0.20 };
                                                    const priceMap = { explorer: 8999, family: 14999, premium: 24999 };
                                                    const cart = JSON.parse(localStorage.getItem('zooCart') || '{"admission":null,"events":{},"shop":{},"membership":null}');
                                                    cart.membership = {
                                                        plan_name: profile.membership_type,
                                                        price_cents: priceMap[profile.membership_type] || 8999,
                                                        discount_rate: discountMap[profile.membership_type] || 0.10,
                                                        duration_days: 365,
                                                    };
                                                    localStorage.setItem('zooCart', JSON.stringify(cart));
                                                    navigate('/checkout');
                                                }} style={{ background: 'var(--color-secondary)', padding: '8px 16px', fontSize: '0.8rem' }}>
                                                    Renew Membership
                                                </button>
                                            </div>
                                        )}
                                        <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                            As a member, you get free general admission and discounted rates on tickets and shop purchases.
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>
                                        <Gift size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                                        <p>You don't have an active membership.</p>
                                        <p style={{ fontSize: '13px', marginBottom: '15px' }}>Become a member for free admission, discounts, and exclusive perks!</p>
                                        <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-primary)', padding: '10px 24px', fontSize: '0.9rem' }}>
                                            View Membership Plans
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Delete Account */}
                            <div style={{ marginTop: '30px', padding: '20px', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', background: 'rgba(239,68,68,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 4px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertTriangle size={16} /> Delete Account
                                        </h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                            Permanently delete your account and all associated data. This action cannot be undone.
                                        </p>
                                    </div>
                                    <button className="glass-button" onClick={() => setShowDeleteConfirm(true)} style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', padding: '8px 16px', fontSize: '0.8rem', flexShrink: 0 }}>
                                        <Trash2 size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Delete Account
                                    </button>
                                </div>
                            </div>

                            {/* Delete Confirmation Modal */}
                            {showDeleteConfirm && (
                                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowDeleteConfirm(false)}>
                                    <div className="glass-panel" onClick={e => e.stopPropagation()} style={{ padding: '30px', maxWidth: '440px', width: '100%', textAlign: 'center' }}>
                                        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
                                        <h2 style={{ margin: '0 0 8px' }}>Are you sure?</h2>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                                            This will permanently delete your account, purchase history, and all associated data. This action <strong style={{ color: '#f87171' }}>cannot be undone</strong>.
                                        </p>
                                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                            <button className="glass-button" onClick={() => setShowDeleteConfirm(false)} style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.1)' }}>
                                                Cancel
                                            </button>
                                            <button className="glass-button" onClick={handleDeleteAccount} disabled={deleting} style={{ padding: '10px 24px', background: '#ef4444', color: 'white' }}>
                                                {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ MY PURCHASES TAB ═══════════ */}
            {activeTab === 'My Purchases' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                            <Package size={24} /> My Purchases
                        </h2>
                        <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-secondary)', padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShoppingCart size={14} /> Shop Now
                        </button>
                    </div>
                    {/* Date Range Filter */}
                    {purchases.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Filter by date:</span>
                            <input type="date" className="glass-input" value={purchaseDateFrom} onChange={e => setPurchaseDateFrom(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }} />
                            <span style={{ color: 'var(--color-text-muted)' }}>to</span>
                            <input type="date" className="glass-input" value={purchaseDateTo} onChange={e => setPurchaseDateTo(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }} />
                            {(purchaseDateFrom || purchaseDateTo) && (
                                <button className="glass-button" onClick={() => { setPurchaseDateFrom(''); setPurchaseDateTo(''); }} style={{ padding: '6px 12px', fontSize: '12px' }}>Clear</button>
                            )}
                        </div>
                    )}
                    {purchasesLoading ? <p>Loading purchases...</p> : purchases.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Package size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No purchases yet.</p>
                            <p style={{ fontSize: '13px', marginBottom: '15px' }}>Your order history and itemized receipts will appear here.</p>
                            <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-primary)', padding: '10px 24px' }}>
                                Browse Tickets & Shop
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {purchases.filter(txn => {
                                const d = new Date(txn.transaction_date);
                                if (purchaseDateFrom && d < new Date(purchaseDateFrom + 'T00:00:00')) return false;
                                if (purchaseDateTo && d > new Date(purchaseDateTo + 'T23:59:59')) return false;
                                return true;
                            }).map(txn => {
                                const lineItems = Array.isArray(txn.line_items) ? txn.line_items : (typeof txn.line_items === 'string' ? JSON.parse(txn.line_items || '[]') : []);
                                return (
                                    <div key={txn.transaction_id} className="glass-panel" style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: lineItems.length > 0 ? '12px' : 0 }}>
                                            <div>
                                                <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>
                                                    Order #{txn.transaction_id}
                                                </h3>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                                    <Clock size={12} />
                                                    {new Date(txn.transaction_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                    {' at '}
                                                    {new Date(txn.transaction_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </div>
                                            </div>
                                            <p style={{ fontWeight: 'bold', fontSize: '18px', margin: 0, color: 'var(--color-primary)' }}>
                                                ${(txn.total_amount_cents / 100).toFixed(2)}
                                            </p>
                                        </div>
                                        {lineItems.length > 0 && (
                                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px' }}>
                                                {lineItems.map((item, idx) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: idx < lineItems.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                                                        <span style={{ fontSize: '13px' }}>
                                                            {item.description} <span style={{ color: 'var(--color-text-muted)' }}>x{item.quantity}</span>
                                                        </span>
                                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>
                                                            ${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                                {(txn.subtotal_cents != null) && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                                        <span>Subtotal: ${(txn.subtotal_cents / 100).toFixed(2)}</span>
                                                        <span>Tax: ${(txn.tax_cents / 100).toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', textAlign: 'right' }}>
                                <span style={{ color: 'var(--color-text-muted)', marginRight: '15px' }}>Total Spent:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '20px', color: 'var(--color-primary)' }}>
                                    ${(purchases.reduce((sum, t) => sum + t.total_amount_cents, 0) / 100).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ MY TICKETS TAB ═══════════ */}
            {activeTab === 'My Tickets' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                            <Ticket size={24} /> My Tickets
                        </h2>
                        <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-secondary)', padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShoppingCart size={14} /> Buy Tickets
                        </button>
                    </div>
                    {isMembershipActive && (
                        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '10px 16px', marginBottom: '15px', fontSize: '0.85rem', color: 'black' }}>
                            <Star size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            As a <strong style={{ textTransform: 'capitalize' }}>{profile.membership_type}</strong> member, you get free general admission and discounted rates on event tickets!
                        </div>
                    )}
                    {/* Date Range Filter */}
                    {tickets.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Filter by date:</span>
                            <input type="date" className="glass-input" value={ticketDateFrom} onChange={e => setTicketDateFrom(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }} />
                            <span style={{ color: 'var(--color-text-muted)' }}>to</span>
                            <input type="date" className="glass-input" value={ticketDateTo} onChange={e => setTicketDateTo(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }} />
                            {(ticketDateFrom || ticketDateTo) && (
                                <button className="glass-button" onClick={() => { setTicketDateFrom(''); setTicketDateTo(''); }} style={{ padding: '6px 12px', fontSize: '12px' }}>Clear</button>
                            )}
                        </div>
                    )}
                    {ticketsLoading ? <p>Loading tickets...</p> : tickets.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Ticket size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No tickets purchased yet.</p>
                            <p style={{ fontSize: '13px', marginBottom: '15px' }}>Buy tickets from our website to visit the zoo!</p>
                            <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-primary)', padding: '10px 24px' }}>
                                Browse Tickets
                            </button>
                        </div>
                    ) : (() => {
                        const inRange = tickets.filter(ticket => {
                            const d = ticket.transactions?.transaction_date ? new Date(ticket.transactions.transaction_date) : null;
                            if (!d) return true;
                            if (ticketDateFrom && d < new Date(ticketDateFrom + 'T00:00:00')) return false;
                            if (ticketDateTo && d > new Date(ticketDateTo + 'T23:59:59')) return false;
                            return true;
                        });
                        const eventTickets = inRange.filter(t => t.type === 'event' && t.events);
                        const admissionTickets = inRange.filter(t => !(t.type === 'event' && t.events));

                        const renderAdmission = (ticket) => {
                            const purchaseDate = ticket.transactions?.transaction_date;
                            return (
                                <div key={ticket.ticket_id} className="glass-panel" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div style={{ display: 'flex', alignItems: 'start', gap: '15px', flex: 1 }}>
                                            <div style={{
                                                width: '45px', height: '45px', borderRadius: '10px',
                                                background: 'rgba(16, 185, 129, 0.2)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                            }}>
                                                <Ticket size={22} color="var(--color-primary)" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ margin: '0 0 4px' }}>General Admission</h3>
                                                <span style={{
                                                    fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                    background: 'rgba(255,255,255,0.1)', textTransform: 'capitalize'
                                                }}>
                                                    {ticketTypeLabel(ticket.type)}
                                                </span>
                                                {purchaseDate && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                                                        <Clock size={11} />
                                                        Purchased {new Date(purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(purchaseDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                                            <p style={{ fontWeight: 'bold', fontSize: '18px', margin: 0, color: 'var(--color-primary)' }}>
                                                ${(ticket.price_cents / 100).toFixed(2)}
                                            </p>
                                            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                                                Ticket #{ticket.ticket_id}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        };

                        const renderEvent = (ticket) => {
                            const ev = ticket.events;
                            const purchaseDate = ticket.transactions?.transaction_date;
                            return (
                                <div key={ticket.ticket_id} className="glass-panel" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div style={{ display: 'flex', alignItems: 'start', gap: '15px', flex: 1 }}>
                                            <div style={{
                                                width: '45px', height: '45px', borderRadius: '10px',
                                                background: 'rgba(245,158,11,0.2)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                            }}>
                                                <Calendar size={22} color="#f59e0b" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ margin: '0 0 4px' }}>{ev.title}</h3>
                                                <span style={{
                                                    fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                    background: 'rgba(245,158,11,0.15)', color: '#fbbf24', textTransform: 'capitalize'
                                                }}>
                                                    Event
                                                </span>
                                                <div style={{ marginTop: '8px' }}>
                                                    {ev.description && (
                                                        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 4px' }}>{ev.description}</p>
                                                    )}
                                                    {ev.event_date && (
                                                        <p style={{ fontSize: '13px', color: 'var(--color-secondary)', fontWeight: 600, margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <Clock size={12} />
                                                            {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                                            {ev.start_time && ` · ${formatTime(ev.start_time)}`}
                                                            {ev.end_time && ` – ${formatTime(ev.end_time)}`}
                                                        </p>
                                                    )}
                                                    {ev.venues?.venue_name && (
                                                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <MapPin size={12} /> {ev.venues.venue_name}{ev.venues.location ? ` — ${ev.venues.location}` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                                {purchaseDate && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                                                        <Clock size={11} />
                                                        Purchased {new Date(purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(purchaseDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                                            <p style={{ fontWeight: 'bold', fontSize: '18px', margin: 0, color: 'var(--color-primary)' }}>
                                                ${(ticket.price_cents / 100).toFixed(2)}
                                            </p>
                                            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                                                Ticket #{ticket.ticket_id}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {admissionTickets.length > 0 && (
                                    <div>
                                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px', fontSize: '1rem', color: 'var(--color-primary)' }}>
                                            <Ticket size={18} /> Admission Tickets ({admissionTickets.length})
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {admissionTickets.map(renderAdmission)}
                                        </div>
                                    </div>
                                )}
                                {eventTickets.length > 0 && (
                                    <div>
                                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px', fontSize: '1rem', color: '#fbbf24' }}>
                                            <Calendar size={18} /> Event Tickets ({eventTickets.length})
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {eventTickets.map(renderEvent)}
                                        </div>
                                    </div>
                                )}
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', textAlign: 'right' }}>
                                    <span style={{ color: 'var(--color-text-muted)', marginRight: '15px' }}>Total Spent:</span>
                                    <span style={{ fontWeight: 'bold', fontSize: '20px', color: 'var(--color-primary)' }}>
                                        ${(inRange.reduce((sum, t) => sum + t.price_cents, 0) / 100).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ═══════════ MY DONATIONS TAB ═══════════ */}
            {activeTab === 'My Donations' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                            <Heart size={24} /> My Donations
                        </h2>
                        <button className="glass-button" onClick={() => navigate('/donations')} style={{ background: '#ef4444', padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Heart size={14} /> Make a Donation
                        </button>
                    </div>
                    {/* Date Range Filter */}
                    {donations.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Filter by date:</span>
                            <input type="date" className="glass-input" value={donationDateFrom} onChange={e => setDonationDateFrom(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }} />
                            <span style={{ color: 'var(--color-text-muted)' }}>to</span>
                            <input type="date" className="glass-input" value={donationDateTo} onChange={e => setDonationDateTo(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }} />
                            {(donationDateFrom || donationDateTo) && (
                                <button className="glass-button" onClick={() => { setDonationDateFrom(''); setDonationDateTo(''); }} style={{ padding: '6px 12px', fontSize: '12px' }}>Clear</button>
                            )}
                        </div>
                    )}
                    {donationsLoading ? <p>Loading donations...</p> : donations.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Heart size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No donations on record.</p>
                            <p style={{ fontSize: '13px', marginBottom: '15px' }}>Your donations help protect endangered animals and fund conservation programs.</p>
                            <button className="glass-button" onClick={() => navigate('/donations')} style={{ background: '#ef4444', padding: '10px 24px' }}>
                                Donate Now
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {donations.filter(donation => {
                                const d = donation.donation_date ? new Date(donation.donation_date) : null;
                                if (!d) return true;
                                if (donationDateFrom && d < new Date(donationDateFrom + 'T00:00:00')) return false;
                                if (donationDateTo && d > new Date(donationDateTo + 'T23:59:59')) return false;
                                return true;
                            }).map(donation => (
                                <div key={donation.donation_id} className="glass-panel" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{
                                                width: '45px', height: '45px', borderRadius: '10px',
                                                background: 'rgba(239, 68, 68, 0.2)', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Heart size={22} color="#ef4444" />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: '0 0 3px' }}>Donation</h3>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                                    <Clock size={12} />
                                                    {donation.donation_date
                                                        ? `${new Date(donation.donation_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date(donation.donation_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
                                                        : 'Date not recorded'}
                                                </div>
                                            </div>
                                        </div>
                                        <p style={{ fontWeight: 'bold', fontSize: '18px', margin: 0, color: '#ef4444' }}>
                                            ${(donation.amount_cents / 100).toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', textAlign: 'right' }}>
                                <span style={{ color: 'var(--color-text-muted)', marginRight: '15px' }}>Total Donated:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '20px', color: '#ef4444' }}>
                                    ${(donations.reduce((sum, d) => sum + d.amount_cents, 0) / 100).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ EVENTS TAB ═══════════ */}
            {activeTab === 'Events' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                            <Calendar size={24} /> Events
                        </h2>
                        <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-secondary)', padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Ticket size={14} /> Buy Event Tickets
                        </button>
                    </div>
                    {/* Upcoming / All Toggle + Date Range */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
                            {['upcoming', 'all'].map(f => (
                                <button key={f} className="glass-button" onClick={() => setEventsFilter(f)} style={{
                                    padding: '6px 16px', fontSize: '13px', borderRadius: 0,
                                    background: eventsFilter === f ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                                    fontWeight: eventsFilter === f ? 700 : 400,
                                    textTransform: 'capitalize',
                                }}>
                                    {f === 'upcoming' ? 'Upcoming' : 'All Events'}
                                </button>
                            ))}
                        </div>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>Date range:</span>
                        <input type="date" className="glass-input" value={eventsDateFrom} onChange={e => setEventsDateFrom(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>to</span>
                        <input type="date" className="glass-input" value={eventsDateTo} onChange={e => setEventsDateTo(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }} />
                        {(eventsDateFrom || eventsDateTo) && (
                            <button className="glass-button" onClick={() => { setEventsDateFrom(''); setEventsDateTo(''); }} style={{ padding: '6px 12px', fontSize: '12px' }}>Clear</button>
                        )}
                    </div>
                    {eventsLoading ? <p>Loading events...</p> : events.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Calendar size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No events at this time.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {events.filter(event => {
                                const eventDate = new Date(event.event_date + 'T00:00:00');
                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                if (eventsFilter === 'upcoming' && eventDate < today) return false;
                                if (eventsDateFrom && eventDate < new Date(eventsDateFrom + 'T00:00:00')) return false;
                                if (eventsDateTo && eventDate > new Date(eventsDateTo + 'T23:59:59')) return false;
                                return true;
                            }).map(event => {
                                const eventDate = new Date(event.event_date + 'T00:00:00');
                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                const isPast = eventDate < today;
                                return (
                                    <div key={event.event_id} className="glass-panel" style={{ padding: '20px', opacity: isPast ? 0.65 : 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' }}>
                                                    <Calendar color={isPast ? 'var(--color-text-muted)' : 'var(--color-secondary)'} size={20} />
                                                    <h3 style={{ margin: 0 }}>{event.title}</h3>
                                                    <span style={{
                                                        fontSize: '11px', padding: '2px 10px', borderRadius: '10px', fontWeight: 600,
                                                        background: isPast ? 'rgba(255,255,255,0.08)' : 'rgba(16,185,129,0.15)',
                                                        color: isPast ? 'var(--color-text-muted)' : '#6ee7b7',
                                                    }}>
                                                        {isPast ? 'Past' : 'Upcoming'}
                                                    </span>
                                                </div>
                                                {event.description && (
                                                    <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '5px 0' }}>{event.description}</p>
                                                )}
                                                <p style={{ color: isPast ? 'var(--color-text-muted)' : 'var(--color-secondary)', fontWeight: 600, fontSize: '14px', margin: '5px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Clock size={13} />
                                                    {eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                                    {event.start_time && ` · ${formatTime(event.start_time)}`}
                                                    {event.end_time && ` – ${formatTime(event.end_time)}`}
                                                </p>
                                                {event.venue_name && (
                                                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <MapPin size={13} /> {event.venue_name}{event.venue_location ? ` — ${event.venue_location}` : ''}
                                                    </p>
                                                )}
                                                {event.ticket_price_cents > 0 && (
                                                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
                                                        <Ticket size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                        ${(event.ticket_price_cents / 100).toFixed(2)} per ticket
                                                    </p>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right', fontSize: '13px', flexShrink: 0, marginLeft: '12px' }}>
                                                {!isPast && event.max_capacity && (
                                                    <p style={{ margin: '0 0 8px', color: 'var(--color-text-muted)' }}>
                                                        {event.max_capacity - (event.actual_attendance || 0)} spots left
                                                    </p>
                                                )}
                                                {isPast && event.actual_attendance != null && (
                                                    <p style={{ margin: '0 0 8px', color: 'var(--color-text-muted)' }}>
                                                        {event.actual_attendance} attended
                                                    </p>
                                                )}
                                                {!isPast && event.ticket_price_cents > 0 && (
                                                    <button className="glass-button" onClick={() => {
                                                        const cart = JSON.parse(localStorage.getItem('zooCart') || '{"admission":null,"events":{},"shop":{},"membership":null}');
                                                        const eid = event.event_id;
                                                        const existing = cart.events[eid];
                                                        cart.events[eid] = {
                                                            event_id: eid,
                                                            title: event.title,
                                                            date: eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
                                                            venue: event.venue_name || null,
                                                            price_cents: event.ticket_price_cents,
                                                            quantity: existing ? existing.quantity + 1 : 1,
                                                        };
                                                        localStorage.setItem('zooCart', JSON.stringify(cart));
                                                        navigate('/checkout');
                                                    }} style={{ background: 'var(--color-secondary)', padding: '6px 14px', fontSize: '0.8rem' }}>
                                                        ${(event.ticket_price_cents / 100).toFixed(2)} — Add to Cart
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
];

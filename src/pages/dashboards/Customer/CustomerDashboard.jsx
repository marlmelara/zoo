import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import {
    User, Ticket, Heart, Calendar, MapPin, Phone, Mail,
    Star, Gift, ShoppingCart, RefreshCw
} from 'lucide-react';

const TABS = ['My Profile', 'My Tickets', 'My Donations', 'Upcoming Events'];

export default function CustomerDashboard() {
    const { user, customerId } = useAuth();
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

    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({});

    useEffect(() => {
        if (!user?.id) return;
        fetchProfile();
        fetchTickets();
        fetchDonations();
        fetchEvents();
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
            setProfileLoading(false);
        }
    }

    async function fetchTickets() {
        try {
            const { data: custData } = await supabase
                .from('customers')
                .select('customer_id')
                .eq('user_id', user.id)
                .single();

            if (!custData) { setTicketsLoading(false); return; }

            const { data, error } = await supabase
                .from('tickets')
                .select('*, events(title, event_date)')
                .eq('customer_id', custData.customer_id)
                .order('ticket_id', { ascending: false });

            if (error) throw error;
            setTickets(data || []);
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setTicketsLoading(false);
        }
    }

    async function fetchDonations() {
        try {
            const { data: custData } = await supabase
                .from('customers')
                .select('customer_id, first_name, last_name')
                .eq('user_id', user.id)
                .single();

            if (!custData) { setDonationsLoading(false); return; }

            let { data, error } = await supabase
                .from('donations')
                .select('*')
                .eq('customer_id', custData.customer_id)
                .order('donation_date', { ascending: false });

            if (error) throw error;

            // Also match by donor name if no customer_id link
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
            setDonationsLoading(false);
        }
    }

    async function fetchEvents() {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .gte('event_date', new Date().toISOString().split('T')[0])
                .order('event_date', { ascending: true });

            if (error) throw error;
            setEvents(data || []);
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setEventsLoading(false);
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

    const membershipColor = (type) => {
        switch (type) {
            case 'premium': return '#f59e0b';
            case 'family': return '#3b82f6';
            case 'individual': return '#10b981';
            default: return 'var(--color-text-muted)';
        }
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
                {profile?.membership_type && (
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
                            <form onSubmit={handleProfileUpdate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>First Name</label>
                                    <input className="glass-input" value={editForm.first_name || ''} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} required />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Last Name</label>
                                    <input className="glass-input" value={editForm.last_name || ''} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} required />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Phone</label>
                                    <input className="glass-input" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Date of Birth</label>
                                    <input className="glass-input" type="date" value={editForm.date_of_birth || ''} onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Street Address</label>
                                    <input className="glass-input" value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>City</label>
                                    <input className="glass-input" value={editForm.city || ''} onChange={e => setEditForm({ ...editForm, city: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>State</label>
                                    <input className="glass-input" value={editForm.state || ''} onChange={e => setEditForm({ ...editForm, state: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Zip Code</label>
                                    <input className="glass-input" value={editForm.zip_code || ''} onChange={e => setEditForm({ ...editForm, zip_code: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button type="submit" className="glass-button" style={{ background: 'var(--color-primary)', flex: 1 }}>Save Changes</button>
                                    <button type="button" className="glass-button" onClick={() => { setEditing(false); setEditForm(profile); }} style={{ flex: 1 }}>Cancel</button>
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
                                            {profile.membership_type ? (
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
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>Email</p>
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
                                            {profile.address ? `${profile.address}, ${profile.city}, ${profile.state} ${profile.zip_code}` : 'Not set'}
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

                            {/* Membership Card */}
                            <div className="glass-panel" style={{ padding: '25px' }}>
                                <h3 style={{ margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Star size={20} color={membershipColor(profile.membership_type)} /> Membership
                                </h3>
                                {profile.membership_type ? (
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
                                                <p style={{ fontWeight: 600, margin: 0, color: profile.membership_end && new Date(profile.membership_end) < new Date() ? '#ef4444' : 'inherit' }}>
                                                    {profile.membership_end ? new Date(profile.membership_end).toLocaleDateString() : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        {profile.membership_end && new Date(profile.membership_end) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                                            <div style={{ marginTop: '15px', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
                                                    <RefreshCw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                                    {new Date(profile.membership_end) < new Date() ? 'Your membership has expired.' : 'Your membership expires soon.'}
                                                </span>
                                                <button className="glass-button" onClick={() => navigate('/checkout', { state: { membershipRenewal: { type: profile.membership_type, customerId: profile.customer_id } } })} style={{ background: 'var(--color-secondary)', padding: '8px 16px', fontSize: '0.8rem' }}>
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
                    {profile?.membership_type && (
                        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '10px 16px', marginBottom: '15px', fontSize: '0.85rem', color: '#6ee7b7' }}>
                            <Star size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                            As a <strong style={{ textTransform: 'capitalize' }}>{profile.membership_type}</strong> member, you get free general admission and discounted rates on event tickets!
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
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {tickets.map(ticket => (
                                <div key={ticket.ticket_id} className="glass-panel" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{
                                                width: '45px', height: '45px', borderRadius: '10px',
                                                background: 'rgba(16, 185, 129, 0.2)', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Ticket size={22} color="var(--color-primary)" />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: '0 0 3px' }}>
                                                    {ticket.events?.title || 'General Admission'}
                                                </h3>
                                                <span style={{
                                                    fontSize: '12px', padding: '2px 8px', borderRadius: '10px',
                                                    background: 'rgba(255,255,255,0.1)', textTransform: 'capitalize'
                                                }}>
                                                    {ticketTypeLabel(ticket.type)}
                                                </span>
                                                {ticket.events?.event_date && (
                                                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '10px' }}>
                                                        {new Date(ticket.events.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontWeight: 'bold', fontSize: '18px', margin: 0, color: 'var(--color-primary)' }}>
                                                ${(ticket.price_cents / 100).toFixed(2)}
                                            </p>
                                            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                                                Ticket #{ticket.ticket_id}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', textAlign: 'right' }}>
                                <span style={{ color: 'var(--color-text-muted)', marginRight: '15px' }}>Total Spent:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '20px', color: 'var(--color-primary)' }}>
                                    ${(tickets.reduce((sum, t) => sum + t.price_cents, 0) / 100).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}
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
                            {donations.map(donation => (
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
                                                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                                    {donation.donation_date
                                                        ? new Date(donation.donation_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                                        : 'Date not recorded'}
                                                </span>
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

            {/* ═══════════ UPCOMING EVENTS TAB ═══════════ */}
            {activeTab === 'Upcoming Events' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                            <Calendar size={24} /> Upcoming Events
                        </h2>
                        <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-secondary)', padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Ticket size={14} /> Buy Event Tickets
                        </button>
                    </div>
                    {eventsLoading ? <p>Loading events...</p> : events.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Calendar size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No upcoming events at this time.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {events.map(event => (
                                <div key={event.event_id} className="glass-panel" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                                <Calendar color="var(--color-secondary)" size={20} />
                                                <h3 style={{ margin: 0 }}>{event.title}</h3>
                                            </div>
                                            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '5px 0' }}>{event.description}</p>
                                            <p style={{ color: 'var(--color-secondary)', fontWeight: 600, fontSize: '14px' }}>
                                                {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '13px' }}>
                                            {event.max_capacity && (
                                                <p style={{ margin: '0 0 8px', color: 'var(--color-text-muted)' }}>
                                                    {event.max_capacity - (event.actual_attendance || 0)} spots left
                                                </p>
                                            )}
                                            {event.ticket_price_cents > 0 && (
                                                <button className="glass-button" onClick={() => navigate('/checkout', { state: { eventTicket: { event_id: event.event_id, title: event.title, date: new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), price_cents: event.ticket_price_cents, quantity: 1 } } })} style={{ background: 'var(--color-secondary)', padding: '6px 14px', fontSize: '0.8rem' }}>
                                                    ${(event.ticket_price_cents / 100).toFixed(2)} — Buy Ticket
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { LayoutDashboard, Cat, Users, Ticket, Calendar } from 'lucide-react';

export default function Dashboard() {
    const { role } = useAuth();
    const [stats, setStats] = useState({
        animals: 0,
        visitors: 0,
        staff: 0,
        totalRevenue: 0,
        ticketRevenue: 0,
        retailRevenue: 0,
        lowStock: 0,
        upcomingEvents: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const { count: animalCount } = await supabase.from('animals').select('*', { count: 'exact', head: true });
            const { count: staffCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });
            const { count: customerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
            const { count: lowStockCount } = await supabase.from('inventory_items').select('*', { count: 'exact', head: true }).eq('is_low_stock', true);
            const { count: eventsCount } = await supabase.from('events').select('*', { count: 'exact', head: true }).gte('event_date', new Date().toISOString());

            // Calculate Ticket Revenue
            const { data: tickets } = await supabase.from('tickets').select('price_cents');
            const ticketRevenueCents = tickets?.reduce((sum, t) => sum + (t.price_cents || 0), 0) || 0;

            // Calculate Retail Revenue (try/catch in case sale_items doesn't exist yet)
            let retailRevenueCents = 0;
            try {
                const { data: sales, error } = await supabase.from('sale_items').select('quantity, price_at_sale_cents');
                if (!error && sales) {
                    retailRevenueCents = sales.reduce((sum, s) => sum + (s.quantity * s.price_at_sale_cents), 0);
                }
            } catch (e) {
                console.warn("Sale items table might not exist yet", e);
            }

            const totalRevenueCents = ticketRevenueCents + retailRevenueCents;

            setStats({
                animals: animalCount || 0,
                visitors: customerCount || 0,
                staff: staffCount || 0,
                totalRevenue: totalRevenueCents / 100,
                ticketRevenue: ticketRevenueCents / 100,
                retailRevenue: retailRevenueCents / 100,
                lowStock: lowStockCount || 0,
                upcomingEvents: eventsCount || 0
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <h1>Dashboard</h1>
            <div className="grid-cards">
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <Cat size={24} color="var(--color-primary)" />
                        <h3>Total Animals</h3>
                    </div>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>
                        {loading ? '...' : stats.animals}
                    </p>
                </div>
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <Users size={24} color="var(--color-secondary)" />
                        <h3>Total Staff</h3>
                    </div>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>
                        {loading ? '...' : stats.staff}
                    </p>
                </div>
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <LayoutDashboard size={24} color="var(--color-accent)" />
                        <h3>Total Customers</h3>
                    </div>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>
                        {loading ? '...' : stats.visitors}
                    </p>
                </div>

                {/* Revenue Card with Breakdown - Visible only to Admin/Manager */}
                {(role === 'admin' || role === 'manager') && (
                    <div className="glass-panel" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <Ticket size={24} color="#f59e0b" />
                            <h3>Total Revenue</h3>
                        </div>
                        <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0', color: 'var(--color-primary)' }}>
                            {loading ? '...' : `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </p>
                        {/* Breakdown */}
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Tickets:</span>
                                <span>${stats.ticketRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Retail:</span>
                                <span>${stats.retailRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Low Stock Alert */}
            <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <Ticket size={24} color="var(--color-accent)" />
                    <h3>Low Stock Items</h3>
                </div>
                <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0', color: stats.lowStock > 0 ? 'var(--color-accent)' : 'inherit' }}>
                    {loading ? '...' : stats.lowStock}
                </p>
            </div>

            {/* Upcoming Events */}
            <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <Calendar size={24} color="var(--color-secondary)" />
                    <h3>Upcoming Events</h3>
                </div>
                <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>
                    {loading ? '...' : stats.upcomingEvents}
                </p>
            </div>
        </div>
    );
}

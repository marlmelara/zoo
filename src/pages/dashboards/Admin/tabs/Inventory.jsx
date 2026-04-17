import React, { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { ShoppingBag, Coffee, AlertTriangle, Package, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';

export default function Inventory() {
    const [outlets, setOutlets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState([]);
    const [isCheckout, setIsCheckout] = useState(false);

    // Add Item State
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItem, setNewItem] = useState({
        outlet_id: '', item_name: '', stock_count: '', restock_threshold: 10, price_cents: '', description: ''
    });

    useEffect(() => {
        fetchInventory();
    }, []);

    async function fetchInventory() {
        try {
            const data = await api.get('/inventory/with-shops');
            setOutlets(data || []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    }

    const [searchTerm, setSearchTerm] = useState('');

    const filteredOutlets = outlets.filter(outlet => {
        const matchesOutlet = outlet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            outlet.type.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesItems = outlet.inventory?.some(item =>
            item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return matchesOutlet || matchesItems;
    });

    const addToCart = (item) => {
        setCart(prev => {
            const existing = prev.find(i => i.item_id === item.item_id);
            if (existing) {
                return prev.map(i => i.item_id === item.item_id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    };

    const removeFromCart = (itemId) => {
        setCart(prev => prev.filter(i => i.item_id !== itemId));
    };

    const updateQuantity = (itemId, delta) => {
        setCart(prev => prev.map(i => {
            if (i.item_id === itemId) {
                const newQty = i.quantity + delta;
                return newQty > 0 ? { ...i, quantity: newQty } : i;
            }
            return i;
        }));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price_cents || 0) * item.quantity, 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsCheckout(true);
        try {
            const sale_items = cart.map(item => ({
                item_id: item.item_id,
                quantity: item.quantity,
                price_at_sale_cents: item.price_cents || 0,
            }));

            await api.post('/transactions', {
                total_amount_cents: cartTotal,
                sale_items,
            });

            setCart([]);
            alert('Checkout successful!');
            fetchInventory();
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Checkout failed. ' + error.message);
        } finally {
            setIsCheckout(false);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            await api.post('/inventory', {
                ...newItem,
                stock_count: parseInt(newItem.stock_count),
                restock_threshold: parseInt(newItem.restock_threshold),
                price_cents: Math.round(parseFloat(newItem.price_cents) * 100),
                outlet_id: parseInt(newItem.outlet_id)
            });

            setShowAddForm(false);
            setNewItem({ outlet_id: '', item_name: '', stock_count: '', restock_threshold: 10, price_cents: '', description: '' });
            fetchInventory();
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Failed to add item: ' + error.message);
        }
    };

    const handleRestock = async (item) => {
        const amountStr = prompt(`Restock ${item.item_name}. Enter quantity to add:`, '10');
        if (!amountStr) return;
        const amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) return;

        try {
            await api.patch(`/inventory/${item.item_id}/restock`, { quantity: amount });
            fetchInventory();
        } catch (error) {
            console.error('Error restocking:', error);
            alert('Failed to restock: ' + error.message);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'start' }}>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                        <h1 style={{ margin: 0 }}>Inventory Management</h1>
                        <input
                            type="text"
                            placeholder="Search outlets or items..."
                            className="glass-input"
                            style={{ maxWidth: '300px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        className="glass-button"
                        onClick={() => setShowAddForm(!showAddForm)}
                        style={{ background: showAddForm ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)' }}
                    >
                        {showAddForm ? 'Cancel' : '+ Add Item'}
                    </button>
                </div>

                {showAddForm && (
                    <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px', border: '1px solid var(--color-secondary)' }}>
                        <h3>New Inventory Item</h3>
                        <form onSubmit={handleAddItem} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Outlet</label>
                                <select required className="glass-input" value={newItem.outlet_id} onChange={e => setNewItem({ ...newItem, outlet_id: e.target.value })}>
                                    <option value="">Select Outlet...</option>
                                    {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.name} ({o.type})</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Item Name</label>
                                <input required className="glass-input" value={newItem.item_name} onChange={e => setNewItem({ ...newItem, item_name: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Price ($)</label>
                                <input required type="number" step="0.01" className="glass-input" value={newItem.price_cents} onChange={e => setNewItem({ ...newItem, price_cents: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Initial Stock</label>
                                <input required type="number" className="glass-input" value={newItem.stock_count} onChange={e => setNewItem({ ...newItem, stock_count: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Low Stock Threshold</label>
                                <input required type="number" className="glass-input" value={newItem.restock_threshold} onChange={e => setNewItem({ ...newItem, restock_threshold: e.target.value })} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Description</label>
                                <input className="glass-input" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} />
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                                <button type="submit" className="glass-button" style={{ background: 'var(--color-secondary)', width: '100%' }}>Save Item</button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? (
                    <p>Loading inventory...</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                        {filteredOutlets.map(outlet => (
                            <div key={outlet.outlet_id} className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px' }}>
                                    {outlet.type === 'Food' ? <Coffee color="var(--color-primary)" /> : <ShoppingBag color="var(--color-secondary)" />}
                                    <h2 style={{ margin: 0, fontSize: '20px' }}>{outlet.name}</h2>
                                    <span style={{
                                        marginLeft: 'auto',
                                        fontSize: '12px',
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.1)'
                                    }}>
                                        {outlet.type}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {outlet.inventory?.map(item => (
                                        <div key={item.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Package size={16} color="var(--color-text-muted)" />
                                                <div>
                                                    <span style={{ display: 'block', fontWeight: 'bold' }}>{item.item_name}</span>
                                                    {item.description && <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{item.description}</span>}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span style={{ fontWeight: 'bold', fontSize: '18px', display: 'block' }}>{item.stock_count}</span>
                                                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Stock</span>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span style={{ fontWeight: 'bold', fontSize: '18px', display: 'block' }}>${((item.price_cents || 0) / 100).toFixed(2)}</span>
                                                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Price</span>
                                                </div>

                                                <button
                                                    onClick={() => handleRestock(item)}
                                                    className="glass-button"
                                                    style={{ padding: '5px 10px', fontSize: '12px', background: 'rgba(255,255,255,0.05)' }}
                                                    title="Quick Restock"
                                                >
                                                    + Stock
                                                </button>

                                                {item.stock_count <= item.restock_threshold && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-accent)', background: 'rgba(244, 63, 94, 0.1)', padding: '5px 8px', borderRadius: '6px' }}>
                                                        <AlertTriangle size={14} />
                                                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Low</span>
                                                    </div>
                                                )}

                                                <button
                                                    className="glass-button"
                                                    style={{ padding: '5px', borderRadius: '50%' }}
                                                    onClick={() => addToCart(item)}
                                                    disabled={item.stock_count === 0}
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {outlet.inventory?.length === 0 && <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>No items in stock.</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Cart Sidebar */}
            <div className="glass-panel" style={{ width: '300px', padding: '20px', position: 'sticky', top: '20px', height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px' }}>
                    <ShoppingCart color="var(--color-accent)" />
                    <h2 style={{ margin: 0 }}>POS Cart</h2>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {cart.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '20px' }}>Cart is empty.</p>
                    ) : (
                        cart.map(item => (
                            <div key={item.item_id} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span style={{ fontWeight: 'bold' }}>{item.item_name}</span>
                                    <button onClick={() => removeFromCart(item.item_id)} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: 0 }}><Trash2 size={14} /></button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '15px', padding: '2px 8px' }}>
                                        <button onClick={() => updateQuantity(item.item_id, -1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}><Minus size={12} /></button>
                                        <span style={{ fontSize: '14px' }}>{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.item_id, 1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}><Plus size={12} /></button>
                                    </div>
                                    <span>${((item.price_cents || 0) * item.quantity / 100).toFixed(2)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '20px', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '18px', fontWeight: 'bold' }}>
                        <span>Total:</span>
                        <span>${(cartTotal / 100).toFixed(2)}</span>
                    </div>
                    <button
                        className="glass-button"
                        style={{ width: '100%', background: 'var(--color-accent)' }}
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || isCheckout}
                    >
                        {isCheckout ? 'Processing...' : 'Checkout'}
                    </button>
                </div>
            </div>
        </div>
    );
}

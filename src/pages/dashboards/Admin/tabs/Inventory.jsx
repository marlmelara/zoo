import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';
import {
    ShoppingBag, AlertTriangle, Package, Plus, Trash2, Briefcase,
    Stethoscope, PawPrint, Shield, Activity, ClipboardList,
    Pencil, X, ImagePlus,
} from 'lucide-react';
import { StatusFilter, DateRangeFilter } from '../../../../components/AnimalsPanel';
import BulkActionBar from '../../../../components/BulkActionBar';
import {
    createOperationalSupply, deleteOperationalSupply, deleteInventoryItem,
} from '../../../../api/supplies';
import { queryActivity } from '../../../../api/activityLog';
import { useToast, useConfirm, usePrompt } from '../../../../components/Feedback';
import ZooPaginator from '../../../../components/ZooPaginator';

const GREEN      = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

// Inventory activity log only cares about these action_types.
const INV_ACTIONS = new Set([
    'supply_request_created', 'supply_request_approved', 'supply_request_denied',
    'supply_restocked', 'inventory_updated',
]);

const DEPT_ICON = {
    'Retail & Operations': <ShoppingBag size={14} />,
    'Animal Care':         <PawPrint  size={14} />,
    'Veterinary Services': <Stethoscope size={14} />,
    'Administration':      <Briefcase  size={14} />,
    'Security':            <Shield    size={14} />,
};

export default function Inventory() {
    const { role, deptId, deptName } = useAuth();
    const toast   = useToast();
    const confirm = useConfirm();
    const prompt  = usePrompt();
    const canManage = role === 'admin' || role === 'manager';

    // Scope: admin sees everything; each manager sees only their own
    // department's operational supplies. The Retail & Operations manager
    // additionally sees the retail bucket (shop items) since retail + ops
    // are their full surface.
    const allowedBuckets = useMemo(() => {
        if (role === 'admin') return null;            // null = no restriction
        const buckets = new Set();
        if (deptId != null) buckets.add(String(deptId));
        if ((deptName || '').toLowerCase().includes('retail')) buckets.add('retail');
        return buckets;
    }, [role, deptId, deptName]);
    const canSeeBucket = (bucket) =>
        allowedBuckets === null || allowedBuckets.has(bucket);

    const [mainTab, setMainTab] = useState('items');       // items | activity
    const [deptFilter, setDeptFilter] = useState('all');   // 'all' | 'retail' | dept_id (number as string)

    // Items + shops + operational supplies
    const [outlets, setOutlets] = useState([]);            // retail shops + their items
    const [opsSupplies, setOpsSupplies] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Add-item form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItem, setNewItem] = useState({
        kind: 'retail',    // 'retail' | 'operational'
        outlet_id: '',
        department_id: '',
        item_name: '',
        stock_count: '',
        restock_threshold: 10,
        price_cents: '',
        description: '',
        category: '',
        image_url: '',     // base64 data URL for retail items
    });

    // Edit-item modal state (retail only — stores image on the item)
    const [editing, setEditing] = useState(null); // { item_id, item_name, price_cents, ... } or null
    const [editForm, setEditForm] = useState({});

    // Manage mode
    const [manageMode, setManageMode] = useState(false);
    const [selected, setSelected] = useState(() => new Set());

    // Activity log state. Server-side pagination (25 per page) + search +
    // date range. When date range is set we switch to "fetch all in range".
    const ACTIVITY_PAGE_SIZE = 25;
    const [activity, setActivity] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [activityTotal, setActivityTotal] = useState(0);
    const [activityPage,  setActivityPage]  = useState(0);
    const [activitySearch, setActivitySearch] = useState('');
    const [logFrom, setLogFrom] = useState('');
    const [logTo, setLogTo]     = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => { fetchAll(); }, []);
    useEffect(() => { if (mainTab === 'activity') loadActivity(); }, [mainTab]);
    // Re-fetch when activity-log filters change. Debounced so search
    // doesn't fire per keystroke.
    useEffect(() => {
        if (mainTab !== 'activity') return;
        const h = setTimeout(() => loadActivity(), 220);
        return () => clearTimeout(h);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activityPage, logFrom, logTo, activitySearch, mainTab]);
    // Reset to first page when filters change so narrowed results don't
    // leave the user on a now-empty page 3.
    useEffect(() => { setActivityPage(0); }, [logFrom, logTo, activitySearch]);

    async function fetchAll() {
        setLoading(true);
        try {
            const [shopData, opsData, depts] = await Promise.all([
                api.get('/inventory/with-shops'),
                api.get('/supplies'),
                api.get('/employees/departments/all'),
            ]);
            setOutlets(shopData || []);
            setOpsSupplies(opsData || []);
            setDepartments(depts || []);
        } catch (err) {
            console.error('Error fetching inventory:', err);
        } finally {
            setLoading(false);
        }
    }

    async function loadActivity() {
        setActivityLoading(true);
        try {
            const hasRange = !!(logFrom || logTo);
            const { rows, total } = await queryActivity({
                limit:       hasRange ? 1000 : ACTIVITY_PAGE_SIZE,
                offset:      hasRange ? 0 : activityPage * ACTIVITY_PAGE_SIZE,
                actionTypes: Array.from(INV_ACTIONS),
                from:        logFrom || '',
                to:          logTo   || '',
                search:      activitySearch,
            });
            setActivity(rows);
            setActivityTotal(total);
        } catch (err) {
            console.error('Error loading activity log:', err);
        } finally {
            setActivityLoading(false);
        }
    }

    // ── Derive a single flat "items" list across retail shops + operational supplies.
    //   source-tagged so the UI can badge and the manage action knows which endpoint to hit.
    const allItems = useMemo(() => {
        const retail = outlets.flatMap(outlet =>
            (outlet.inventory || []).map(i => ({
                key: `r-${i.item_id}`,
                source: 'retail',
                id:    i.item_id,
                name:  i.item_name,
                description: i.description || null,
                stock: i.stock_count,
                threshold: i.restock_threshold,
                price_cents: i.price_cents,
                image_url:  i.image_url || null,
                shop_name: outlet.name,
                dept_bucket: 'retail',
                dept_name: 'Retail & Operations',
                is_low_stock: i.stock_count <= i.restock_threshold,
            }))
        );
        const ops = opsSupplies.map(s => ({
            key: `o-${s.supply_id}`,
            source: 'operational',
            id:    s.supply_id,
            name:  s.item_name,
            description: s.description || null,
            stock: s.stock_count,
            threshold: s.restock_threshold,
            price_cents: null,
            shop_name: null,
            dept_bucket: String(s.department_id),
            dept_name: s.dept_name || 'Operational',
            is_low_stock: !!s.is_low_stock,
        }));
        return [...retail, ...ops];
    }, [outlets, opsSupplies]);

    const filteredItems = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const out = allItems.filter(item => {
            // Hide buckets the current user isn't allowed to see at all.
            if (!canSeeBucket(item.dept_bucket)) return false;
            const inDept = deptFilter === 'all' || item.dept_bucket === deptFilter;
            if (!inDept) return false;
            if (!term) return true;
            return item.name.toLowerCase().includes(term) ||
                   item.dept_name.toLowerCase().includes(term);
        });
        // Low-stock first, then by how close to empty, then alphabetical.
        out.sort((a, b) => {
            if (a.is_low_stock !== b.is_low_stock) return a.is_low_stock ? -1 : 1;
            if (a.is_low_stock && b.is_low_stock) return a.stock - b.stock;
            return a.name.localeCompare(b.name);
        });
        return out;
    }, [allItems, deptFilter, searchTerm]);

    // Dept tabs for filter pills — Retail bucket + each real department except
    // Administration (no inventory surface — admins don't hold stock).
    // For non-admin managers, hide the buckets they aren't allowed to view;
    // drop the "All" tab when they're left with a single bucket (redundant).
    const deptTabs = useMemo(() => {
        const full = [
            { key: 'all',    label: 'All' },
            { key: 'retail', label: 'Retail' },
            ...departments
                .filter(d => d.dept_name !== 'Administration')
                .map(d => ({ key: String(d.dept_id), label: d.dept_name })),
        ];
        if (allowedBuckets === null) return full; // admin sees all
        const real = full.filter(t => t.key !== 'all' && allowedBuckets.has(t.key));
        return allowedBuckets.size > 1 ? [{ key: 'all', label: 'All' }, ...real] : real;
    }, [departments, allowedBuckets]);

    // Clamp deptFilter to a visible tab when the role-based tab list changes
    // (e.g. after login, departments load in, etc.).
    useEffect(() => {
        if (deptTabs.length === 0) return;
        if (!deptTabs.find(t => t.key === deptFilter)) {
            setDeptFilter(deptTabs[0].key);
        }
    }, [deptTabs, deptFilter]);

    // Server filters by action_type whitelist, date range, and search.
    // Client still narrows by dept pill because retail/ops bucketing
    // depends on a mix of target_type and the performer's department —
    // not something SQL would model cleanly here.
    //   • Retail pill → target_type === 'inventory' (shop-item restocks only).
    //   • A real department pill → performer works in that dept AND the event
    //     is not a shop-item restock (so shop restocks don't double-count).
    const filteredActivity = useMemo(() => {
        return (activity || []).filter(a => {
            const bucket = a.target_type === 'inventory'
                ? 'retail'
                : String(a.performer?.dept_id || '');
            if (!canSeeBucket(bucket)) return false;
            if (deptFilter === 'all') return true;
            if (deptFilter === 'retail') return bucket === 'retail';
            return bucket === deptFilter;
        });
    }, [activity, deptFilter, allowedBuckets]);

    // ── Add / Delete handlers ──
    async function handleAddItem(e) {
        e.preventDefault();
        try {
            if (newItem.kind === 'retail') {
                await api.post('/inventory', {
                    outlet_id: parseInt(newItem.outlet_id) || null,
                    item_name: newItem.item_name,
                    stock_count: parseInt(newItem.stock_count) || 0,
                    restock_threshold: parseInt(newItem.restock_threshold) || 10,
                    price_cents: Math.round(parseFloat(newItem.price_cents) * 100) || 0,
                    category: newItem.category || null,
                    image_url: newItem.image_url || null,
                });
            } else {
                await createOperationalSupply({
                    department_id: parseInt(newItem.department_id),
                    item_name: newItem.item_name,
                    stock_count: parseInt(newItem.stock_count) || 0,
                    restock_threshold: parseInt(newItem.restock_threshold) || 10,
                    category: newItem.category || null,
                    description: newItem.description || null,
                });
            }
            setShowAddForm(false);
            setNewItem({ kind: newItem.kind, outlet_id: '', department_id: '',
                         item_name: '', stock_count: '', restock_threshold: 10,
                         price_cents: '', description: '', category: '', image_url: '' });
            fetchAll();
            toast.success('Item added.');
        } catch (err) {
            toast.error('Failed to add item: ' + err.message);
        }
    }

    // ── Edit (retail items only) ──
    function startEditRetail(item) {
        setEditing(item);
        setEditForm({
            item_name: item.name || '',
            price_cents: ((item.price_cents || 0) / 100).toFixed(2),
            stock_count: item.stock,
            restock_threshold: item.threshold,
            image_url: '',              // new upload goes here
            existing_image: item.image_url || null,
        });
    }
    function cancelEdit() { setEditing(null); setEditForm({}); }
    async function handleEditSave(e) {
        e.preventDefault();
        if (!editing) return;
        try {
            await api.patch(`/inventory/${editing.id}`, {
                item_name: editForm.item_name,
                price_cents: Math.round(parseFloat(editForm.price_cents) * 100) || 0,
                stock_count: parseInt(editForm.stock_count) || 0,
                restock_threshold: parseInt(editForm.restock_threshold) || 10,
                // Only send image_url if the user picked a new one; otherwise
                // leave the existing value alone.
                ...(editForm.image_url ? { image_url: editForm.image_url } : {}),
            });
            cancelEdit();
            fetchAll();
            toast.success('Changes saved.');
        } catch (err) {
            toast.error('Failed to save: ' + err.message);
        }
    }

    async function handleRestock(item) {
        const amt = await prompt({
            title: `Restock ${item.name}`,
            message: 'Enter the quantity to add.',
            placeholder: 'e.g. 20',
            inputType: 'number',
            defaultValue: String(item.threshold * 2),
            confirmLabel: 'Restock',
        });
        if (amt == null) return;
        const qty = parseInt(amt);
        if (!(qty > 0)) return;
        try {
            if (item.source === 'retail') {
                await api.patch(`/inventory/${item.id}/restock`, { quantity: qty });
            } else {
                // operational supplies don't have a restock endpoint; fall back
                // to approving a zero-round-trip manager restock via PATCH.
                await api.patch(`/supplies/${item.id}`, { stock_count_delta: qty });
            }
            toast.success(`Restocked ${item.name} +${qty}.`);
            fetchAll();
        } catch (err) {
            toast.error('Restock failed: ' + err.message);
        }
    }

    function toggleSelect(key) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }
    function exitManageMode() { setManageMode(false); setSelected(new Set()); }
    function selectAllVisible() { setSelected(new Set(filteredItems.map(i => i.key))); }

    async function handleDeleteSelected() {
        if (selected.size === 0) return;
        const ok = await confirm({
            title: `Permanently delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`,
            message: 'This cannot be undone — the items will be removed from inventory entirely.',
            confirmLabel: 'Delete',
            tone: 'danger',
        });
        if (!ok) return;
        const items = filteredItems.filter(i => selected.has(i.key));
        const results = await Promise.allSettled(items.map(i =>
            i.source === 'retail' ? deleteInventoryItem(i.id) : deleteOperationalSupply(i.id)
        ));
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed) {
            toast.error(`${failed} deletion${failed === 1 ? '' : 's'} failed.`);
        } else {
            toast.success(`Deleted ${items.length} item${items.length === 1 ? '' : 's'}.`);
        }
        exitManageMode();
        fetchAll();
    }

    // ── Derived department options for add form ──
    const selectedDept = departments.find(d => String(d.dept_id) === newItem.department_id);

    return (
        <div>
            {/* ══ Header ══ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                    <h1 style={{ margin: 0 }}>Inventory Management</h1>
                    {mainTab === 'items' && (
                        <input
                            type="text"
                            placeholder="Search items..."
                            className="glass-input"
                            style={{ maxWidth: '300px' }}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    )}
                </div>
                {mainTab === 'items' && canManage && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className="glass-button"
                            onClick={() => setShowAddForm(v => !v)}
                            style={{ background: showAddForm ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255,255,255,0.1)' }}
                        >
                            {showAddForm ? 'Cancel' : '+ Add Item'}
                        </button>
                        {manageMode ? (
                            <button className="glass-button" onClick={exitManageMode}
                                style={{ background: 'rgba(239,68,68,0.18)', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                × Exit Removal
                            </button>
                        ) : (
                            <button className="glass-button" onClick={() => setManageMode(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Trash2 size={14} /> Manage Items
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ══ Main tabs: Items / Activity Log ══ */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
                {[
                    { key: 'items',    label: 'Inventory Items', icon: <Package size={14} /> },
                    { key: 'activity', label: 'Activity Log',    icon: <ClipboardList size={14} /> },
                ].map(t => {
                    const active = mainTab === t.key;
                    return (
                        <button key={t.key} onClick={() => setMainTab(t.key)}
                            className="glass-button"
                            style={{
                                background: active ? GREEN : 'rgba(255, 245, 231, 0.72)',
                                color:      active ? 'white' : GREEN_DARK,
                                padding:    '10px 18px',
                                fontSize:   '14px',
                                fontWeight: active ? 700 : 500,
                                display: 'flex', alignItems: 'center', gap: '8px',
                                border: active ? 'none' : '1px solid rgba(121,162,128,0.25)',
                            }}>
                            {t.icon} {t.label}
                        </button>
                    );
                })}
            </div>

            {/* ══ Department filter pills (both tabs share this) ══ */}
            <div style={{ marginBottom: '20px' }}>
                <StatusFilter
                    label="Dept"
                    tabs={deptTabs}
                    value={deptFilter}
                    onChange={setDeptFilter}
                />
            </div>

            {/* ═══ Add form ═══ */}
            {mainTab === 'items' && showAddForm && (
                <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', border: `1px solid ${GREEN}` }}>
                    <h3 style={{ marginTop: 0, color: GREEN_DARK }}>New Inventory Item</h3>
                    <form onSubmit={handleAddItem} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px' }}>
                            {[{ k: 'retail', l: 'Retail / Shop Item' }, { k: 'operational', l: 'Operational Supply' }].map(o => (
                                <button key={o.k} type="button"
                                    onClick={() => setNewItem({ ...newItem, kind: o.k })}
                                    style={{
                                        padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                                        background: newItem.kind === o.k ? GREEN : 'rgba(255, 245, 231, 0.72)',
                                        color:      newItem.kind === o.k ? 'white' : GREEN_DARK,
                                        border: newItem.kind === o.k ? 'none' : '1px solid rgba(121,162,128,0.25)',
                                        borderRadius: '8px', cursor: 'pointer', flex: 1,
                                    }}>{o.l}</button>
                            ))}
                        </div>
                        {newItem.kind === 'retail' ? (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Outlet / Shop</label>
                                <select required className="glass-input" value={newItem.outlet_id}
                                    onChange={e => setNewItem({ ...newItem, outlet_id: e.target.value })}>
                                    <option value="">Select shop...</option>
                                    {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.name} ({o.type})</option>)}
                                </select>
                            </div>
                        ) : (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Department</label>
                                <select required className="glass-input" value={newItem.department_id}
                                    onChange={e => setNewItem({ ...newItem, department_id: e.target.value })}>
                                    <option value="">Select department...</option>
                                    {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label style={labelStyle}>Item Name</label>
                            <input required className="glass-input" value={newItem.item_name}
                                onChange={e => setNewItem({ ...newItem, item_name: e.target.value })} />
                        </div>
                        <div>
                            <label style={labelStyle}>Category</label>
                            <input className="glass-input" value={newItem.category}
                                onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                placeholder={newItem.kind === 'retail' ? 'Gift / Food / Misc' : 'e.g. Food, Cleaning'} />
                        </div>
                        {newItem.kind === 'retail' && (
                            <div>
                                <label style={labelStyle}>Price ($)</label>
                                <input required type="number" step="0.01" className="glass-input"
                                    value={newItem.price_cents}
                                    onChange={e => setNewItem({ ...newItem, price_cents: e.target.value })} />
                            </div>
                        )}
                        <div>
                            <label style={labelStyle}>Initial Stock</label>
                            <input required type="number" min="0" className="glass-input"
                                value={newItem.stock_count}
                                onChange={e => setNewItem({ ...newItem, stock_count: e.target.value })} />
                        </div>
                        <div>
                            <label style={labelStyle}>Low-stock Threshold</label>
                            <input required type="number" min="0" className="glass-input"
                                value={newItem.restock_threshold}
                                onChange={e => setNewItem({ ...newItem, restock_threshold: e.target.value })} />
                        </div>
                        {newItem.kind === 'operational' && (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Description</label>
                                <input className="glass-input" value={newItem.description}
                                    onChange={e => setNewItem({ ...newItem, description: e.target.value })} />
                            </div>
                        )}
                        {newItem.kind === 'retail' && (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Item Image (optional)</label>
                                <ImagePicker
                                    value={newItem.image_url}
                                    onChange={dataUrl => setNewItem({ ...newItem, image_url: dataUrl })}
                                />
                            </div>
                        )}
                        <div style={{ gridColumn: '1 / -1', marginTop: '6px' }}>
                            <button type="submit" className="glass-button" style={{ background: GREEN, color: 'white', width: '100%', fontWeight: 600 }}>
                                Save Item
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ══ Retail Edit modal ══
                Portaled to <body> so it escapes the parent .glass-panel's
                backdrop-filter (which creates a containing block and traps
                `position: fixed`, making it scroll with the list instead of
                staying centered in the viewport). */}
            {editing && createPortal((
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }} onClick={cancelEdit}>
                    <div onClick={e => e.stopPropagation()} style={{
                        width: '520px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
                        padding: '28px', background: 'rgba(255,255,255,0.96)',
                        border: `1px solid ${GREEN}`, borderRadius: '14px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, color: GREEN_DARK }}>Edit: {editing.name}</h2>
                            <button onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN_DARK }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleEditSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Item Name</label>
                                <input required className="glass-input" value={editForm.item_name}
                                    onChange={e => setEditForm({ ...editForm, item_name: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Price ($)</label>
                                <input required type="number" step="0.01" className="glass-input" value={editForm.price_cents}
                                    onChange={e => setEditForm({ ...editForm, price_cents: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Stock</label>
                                <input required type="number" min="0" className="glass-input" value={editForm.stock_count}
                                    onChange={e => setEditForm({ ...editForm, stock_count: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Low-stock Threshold</label>
                                <input required type="number" min="0" className="glass-input" value={editForm.restock_threshold}
                                    onChange={e => setEditForm({ ...editForm, restock_threshold: e.target.value })} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Image</label>
                                <ImagePicker
                                    value={editForm.image_url || editForm.existing_image}
                                    onChange={dataUrl => setEditForm({ ...editForm, image_url: dataUrl })}
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '4px' }}>
                                <button type="button" onClick={cancelEdit} className="glass-button" style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button type="submit" className="glass-button" style={{ flex: 2, background: GREEN, color: 'white', fontWeight: 700 }}>
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ), document.body)}

            {/* ══ ITEMS TAB ══ */}
            {mainTab === 'items' && (
                <ItemsList
                    loading={loading}
                    items={filteredItems}
                    manageMode={manageMode}
                    selected={selected}
                    toggleSelect={toggleSelect}
                    onRestock={handleRestock}
                    onEdit={canManage ? startEditRetail : null}
                />
            )}

            {/* ══ ACTIVITY LOG TAB ══ */}
            {mainTab === 'activity' && (
                <>
                    <input
                        type="text"
                        placeholder="Search by item, action, or person..."
                        className="glass-input"
                        value={activitySearch}
                        onChange={e => setActivitySearch(e.target.value)}
                        style={{ maxWidth: '440px', marginBottom: '14px', display: 'block' }}
                    />
                    <DateRangeFilter
                        from={logFrom} to={logTo}
                        onFrom={setLogFrom} onTo={setLogTo}
                    />
                    <ActivityLog
                        loading={activityLoading}
                        items={filteredActivity}
                    />
                    {!activityLoading && !(logFrom || logTo) && (
                        <ZooPaginator
                            page={activityPage}
                            totalPages={Math.max(1, Math.ceil(activityTotal / ACTIVITY_PAGE_SIZE))}
                            onChange={(p) => setActivityPage(p)}
                        />
                    )}
                    {!activityLoading && (logFrom || logTo) && activityTotal > 0 && (
                        <p style={{ marginTop: '12px', fontSize: '12px', color: GREEN_DARK, opacity: 0.8 }}>
                            Showing all {activityTotal} inventory event{activityTotal === 1 ? '' : 's'} in the selected range.
                        </p>
                    )}
                </>
            )}

            {/* ══ Bulk action bar (items tab only) ══ */}
            {mainTab === 'items' && manageMode && (
                <BulkActionBar
                    count={selected.size}
                    onSelectAll={selectAllVisible}
                    onRemove={handleDeleteSelected}
                    onCancel={exitManageMode}
                    actionLabel="Delete Selected"
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function ItemsList({ loading, items, manageMode, selected, toggleSelect, onRestock, onEdit }) {
    if (loading) return <p style={{ color: GREEN_DARK }}>Loading inventory...</p>;
    if (items.length === 0) return (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: GREEN_DARK, background: 'rgba(255, 245, 231, 0.72)' }}>
            <Package size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
            <p>No items in this view.</p>
        </div>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: manageMode ? '90px' : 0 }}>
            {items.map(item => {
                const checked = selected.has(item.key);
                return (
                    <div
                        key={item.key}
                        onClick={() => manageMode && toggleSelect(item.key)}
                        style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'rgba(255, 245, 231, 0.78)',
                            border: item.is_low_stock ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(121,162,128,0.25)',
                            borderRadius: '12px', padding: '14px 16px',
                            cursor: manageMode ? 'pointer' : 'default',
                            outline: checked ? '2px solid #ef4444' : 'none',
                            transition: 'outline 150ms',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            {manageMode && (
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSelect(item.key)}
                                    onClick={e => e.stopPropagation()}
                                    style={{ width: '18px', height: '18px', accentColor: '#ef4444' }}
                                />
                            )}
                            {item.image_url ? (
                                <img
                                    src={item.image_url}
                                    alt={item.name}
                                    style={{
                                        width: '42px', height: '42px', objectFit: 'cover',
                                        borderRadius: '8px', border: '1px solid rgba(121,162,128,0.25)',
                                        background: 'white', flexShrink: 0,
                                    }}
                                />
                            ) : (
                                <Package size={20} color={item.is_low_stock ? '#dc2626' : GREEN_DARK} />
                            )}
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: 'var(--color-text-dark)', fontSize: '15px' }}>{item.name}</div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: GREEN_DARK, marginTop: '2px' }}>
                                    <DeptBadge dept_name={item.dept_name} shop_name={item.shop_name} source={item.source} />
                                    {item.description && <span style={{ opacity: 0.8 }}>· {item.description}</span>}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexShrink: 0 }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-dark)' }}>
                                    <strong style={{ fontSize: '18px' }}>{item.stock}</strong>
                                    <span style={{ opacity: 0.7 }}> / thr {item.threshold}</span>
                                </div>
                                {item.is_low_stock ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px',
                                                  color: '#dc2626', background: 'rgba(239,68,68,0.12)',
                                                  padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                        <AlertTriangle size={12} /> Low
                                    </div>
                                ) : null}
                            </div>
                            {item.source === 'retail' && item.price_cents != null && (
                                <div style={{ textAlign: 'right', minWidth: '70px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '16px', color: GREEN_DARK }}>
                                        ${((item.price_cents || 0) / 100).toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: '10px', color: GREEN_DARK, opacity: 0.7 }}>Price</div>
                                </div>
                            )}
                            {!manageMode && (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {item.source === 'retail' && onEdit && (
                                        <button onClick={e => { e.stopPropagation(); onEdit(item); }}
                                            title="Edit item"
                                            style={{
                                                padding: '6px 10px', fontSize: '12px', fontWeight: 600,
                                                background: 'rgba(121,162,128,0.18)', color: GREEN_DARK,
                                                border: '1px solid rgba(121,162,128,0.35)',
                                                borderRadius: '8px', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                            }}>
                                            <Pencil size={12} /> Edit
                                        </button>
                                    )}
                                    <button onClick={e => { e.stopPropagation(); onRestock(item); }}
                                        style={{
                                            padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                                            background: GREEN, color: 'white', border: 'none',
                                            borderRadius: '8px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                        }}>
                                        <Plus size={14} /> Restock
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DeptBadge({ dept_name, shop_name, source }) {
    const icon = DEPT_ICON[dept_name] || <Package size={12} />;
    const label = source === 'retail' ? (shop_name || dept_name) : dept_name;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: '8px',
            background: 'rgba(121,162,128,0.15)', color: GREEN_DARK, fontWeight: 600,
        }}>
            {icon} {label}
        </span>
    );
}

function ActivityLog({ loading, items }) {
    if (loading) return <p style={{ color: GREEN_DARK }}>Loading activity...</p>;
    if (items.length === 0) return (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: GREEN_DARK, background: 'rgba(255, 245, 231, 0.72)' }}>
            <Activity size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
            <p>No inventory activity matches this filter.</p>
        </div>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map(a => (
                <div key={a.log_id} style={{
                    background: 'rgba(255, 245, 231, 0.78)',
                    border: '1px solid rgba(121,162,128,0.25)',
                    borderRadius: '10px', padding: '12px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '14px',
                }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '14px' }}>
                            {a.description}
                        </div>
                        <div style={{ fontSize: '11px', color: GREEN_DARK, marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '1px 8px', borderRadius: '8px', background: 'rgba(121,162,128,0.15)', fontWeight: 600 }}>
                                {a.action_type.replace(/_/g, ' ')}
                            </span>
                            {a.performer && (
                                <span>by <strong>{a.performer.first_name} {a.performer.last_name}</strong>
                                    {a.performer.dept_name ? ` · ${a.performer.dept_name}` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ fontSize: '11px', color: GREEN_DARK, whiteSpace: 'nowrap' }}>
                        {new Date(a.created_at).toLocaleString()}
                    </div>
                </div>
            ))}
        </div>
    );
}

// BulkBar moved to /components/BulkActionBar.jsx (shared + portaled).

const labelStyle = {
    display: 'block',
    fontSize: '11px',
    color: GREEN_DARK,
    marginBottom: '4px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
};

// Client-side image resize + JPEG compression. Max 600px on the long edge
// and quality 0.82 keeps a real photo around ~80 KB — well inside the
// MEDIUMTEXT column headroom and tolerable for JSON payloads.
function resizeToDataUrl(file, maxEdge = 600, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Invalid image.'));
            img.onload = () => {
                const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function ImagePicker({ value, onChange }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const inputId = React.useId();
    async function onFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!/^image\//.test(file.type)) {
            toast.warn('Please choose an image file.');
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            toast.warn('Image too large (limit 8 MB).');
            return;
        }
        try {
            setBusy(true);
            onChange(await resizeToDataUrl(file));
        } catch (err) {
            toast.error('Failed to read image: ' + err.message);
        } finally {
            setBusy(false);
            e.target.value = '';
        }
    }
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
                width: '72px', height: '72px', flexShrink: 0,
                borderRadius: '10px', border: '1px dashed rgba(121,162,128,0.5)',
                background: value ? 'white' : 'rgba(255, 245, 231, 0.78)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
                {value
                    ? <img src={value} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <ImagePlus size={24} color={GREEN_DARK} style={{ opacity: 0.6 }} />}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <label htmlFor={inputId}
                    style={{
                        cursor: busy ? 'wait' : 'pointer',
                        background: GREEN, color: 'white', fontWeight: 600,
                        padding: '8px 14px', borderRadius: '8px', fontSize: '13px',
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        opacity: busy ? 0.7 : 1,
                    }}>
                    <ImagePlus size={14} /> {busy ? 'Processing…' : (value ? 'Replace' : 'Upload')}
                </label>
                <input id={inputId} type="file" accept="image/*" onChange={onFile} disabled={busy}
                    style={{ display: 'none' }} />
                {value && (
                    <button type="button" onClick={() => onChange('')}
                        style={{
                            background: 'rgba(239,68,68,0.15)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.35)',
                            padding: '8px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                        }}>
                        Remove
                    </button>
                )}
            </div>
        </div>
    );
}

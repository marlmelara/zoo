import React, { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { User, Stethoscope, Briefcase, Shield, Trash2, PawPrint, ShoppingBag } from 'lucide-react';
import { StatusFilter } from '../../../../components/AnimalsPanel';

export default function Staff() {
    const { role } = useAuth();
    const canManage = role === 'admin';
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [statusFilter, setStatusFilter] = useState('active');
    const [manageMode, setManageMode] = useState(false);
    const [selected, setSelected] = useState(() => new Set());
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', contact_info: '', pay_rate_cents: '', shift_timeframe: '', dept_id: '',
        email: '', password: '', role: 'general',
        license_no: '', specialty: '',
        specialization_species: '',
        office_location: ''
    });

    useEffect(() => {
        fetchStaff();
        fetchDepartments();
    }, [statusFilter]);

    async function fetchStaff() {
        setLoading(true);
        try {
            const data = await api.get(`/employees?status=${statusFilter}`);
            setStaff(data || []);
        } catch (error) {
            console.error('Error fetching staff:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchDepartments() {
        const data = await api.get('/employees/departments/all');
        if (data) setDepartments(data);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            let derivedRole = formData.role;
            const selectedDept = departments.find(d => d.dept_id == formData.dept_id);
            if (selectedDept) {
                const deptName = selectedDept.dept_name.toLowerCase();
                if (deptName.includes('vet')) derivedRole = 'vet';
                else if (deptName.includes('admin') || deptName.includes('manager')) derivedRole = 'manager';
                else if (deptName.includes('care') || deptName.includes('animal')) derivedRole = 'caretaker';
            }

            await api.post('/employees', {
                first_name: formData.first_name,
                last_name: formData.last_name,
                contact_info: formData.contact_info,
                pay_rate_cents: parseInt(formData.pay_rate_cents) * 100,
                shift_timeframe: formData.shift_timeframe,
                dept_id: formData.dept_id,
                email: formData.email,
                password: formData.password,
                role: derivedRole,
                license_no: formData.license_no,
                specialty: formData.specialty,
                specialization_species: formData.specialization_species,
                office_location: formData.office_location,
            });

            setShowForm(false);
            setFormData({
                first_name: '', last_name: '', contact_info: '', pay_rate_cents: '', shift_timeframe: '', dept_id: '',
                email: '', password: '', role: 'general',
                license_no: '', specialty: '', specialization_species: '', office_location: ''
            });
            fetchStaff();
        } catch (error) {
            console.error('Error adding staff:', error);
            alert('Failed to add staff: ' + error.message);
        }
    }

    function toggleSelect(id) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function selectAllVisible() {
        setSelected(new Set(filteredStaff.filter(p => p.is_active).map(p => p.employee_id)));
    }

    function exitManageMode() {
        setManageMode(false);
        setSelected(new Set());
    }

    async function handleRemoveSelected() {
        if (selected.size === 0) return;
        const confirmed = window.confirm(
            `Deactivate ${selected.size} staff member${selected.size === 1 ? '' : 's'}? They can be reactivated from the Reactivate tab.`
        );
        if (!confirmed) return;
        const ids = Array.from(selected);
        const results = await Promise.allSettled(ids.map(id => api.delete(`/employees/${id}`)));
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length) alert(`${failed.length} deactivation${failed.length === 1 ? '' : 's'} failed.`);
        exitManageMode();
        fetchStaff();
    }

    const getRoleIcon = (deptName) => {
        switch (deptName) {
            case 'Veterinary Services': return <Stethoscope size={20} color="var(--color-primary)" />;
            case 'Animal Care':         return <PawPrint size={20} color="rgb(123, 144, 79)" />;
            case 'Administration':      return <Briefcase size={20} color="var(--color-secondary)" />;
            case 'Security':            return <Shield size={20} color="var(--color-accent)" />;
            case 'Retail & Operations': return <ShoppingBag size={20} color="#c2410c" />;
            default: return <User size={20} color="var(--color-text-muted)" />;
        }
    };

    const [searchTerm, setSearchTerm] = useState('');

    const filteredStaff = staff.filter(person =>
        person.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (person.dept_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const STATUS_TABS = [
        { key: 'active',   label: 'Active' },
        { key: 'inactive', label: 'Inactive' },
        { key: 'all',      label: 'All' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                    <h1 style={{ margin: 0 }}>Staff Management</h1>
                    <input
                        type="text"
                        placeholder="Search staff..."
                        className="glass-input"
                        style={{ maxWidth: '300px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {(role === 'admin' || role === 'manager') && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className="glass-button"
                            onClick={() => setShowForm(!showForm)}
                            style={{ background: showForm ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)' }}
                        >
                            {showForm ? 'Cancel' : '+ Add Staff'}
                        </button>
                        {canManage && (
                            manageMode ? (
                                <button className="glass-button" onClick={exitManageMode}
                                    style={{ background: 'rgba(239,68,68,0.18)', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                    × Exit Removal
                                </button>
                            ) : (
                                <button className="glass-button" onClick={() => setManageMode(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Trash2 size={14} /> Manage Staff
                                </button>
                            )
                        )}
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '20px' }}>
                <StatusFilter
                    label="Status"
                    tabs={STATUS_TABS}
                    value={statusFilter}
                    onChange={setStatusFilter}
                />
            </div>

            {showForm && (
                <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px', border: '1px solid var(--color-secondary)' }}>
                    <h3>New Staff Member</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <input placeholder="First Name" required className="glass-input" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                        <input placeholder="Last Name" required className="glass-input" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
                        <input placeholder="Email" type="email" required className="glass-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        <input placeholder="Password" type="password" required className="glass-input" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                        <input placeholder="Contact Info" className="glass-input" value={formData.contact_info} onChange={e => setFormData({ ...formData, contact_info: e.target.value })} />
                        <input placeholder="Hourly Rate ($)" type="number" required className="glass-input" value={formData.pay_rate_cents} onChange={e => setFormData({ ...formData, pay_rate_cents: e.target.value })} />
                        <input placeholder="Shift (e.g. 9-5)" className="glass-input" value={formData.shift_timeframe} onChange={e => setFormData({ ...formData, shift_timeframe: e.target.value })} />

                        <select required className="glass-input" value={formData.dept_id} onChange={e => setFormData({ ...formData, dept_id: e.target.value })}>
                            <option value="">Select Department...</option>
                            {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                        </select>

                        {departments.find(d => d.dept_id == formData.dept_id)?.dept_name.toLowerCase().includes('vet') && (
                            <>
                                <input placeholder="License Number" required className="glass-input" value={formData.license_no} onChange={e => setFormData({ ...formData, license_no: e.target.value })} />
                                <input placeholder="Specialty" className="glass-input" value={formData.specialty} onChange={e => setFormData({ ...formData, specialty: e.target.value })} />
                            </>
                        )}
                        {departments.find(d => d.dept_id == formData.dept_id)?.dept_name.toLowerCase().includes('admin') && (
                            <input placeholder="Office Location" required className="glass-input" value={formData.office_location} onChange={e => setFormData({ ...formData, office_location: e.target.value })} />
                        )}
                        {(departments.find(d => d.dept_id == formData.dept_id)?.dept_name.toLowerCase().includes('care') || departments.find(d => d.dept_id == formData.dept_id)?.dept_name.toLowerCase().includes('animal')) && (
                            <input placeholder="Specialization (Species)" required className="glass-input" value={formData.specialization_species} onChange={e => setFormData({ ...formData, specialization_species: e.target.value })} />
                        )}

                        <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                            <button type="submit" className="glass-button" style={{ background: 'var(--color-secondary)', width: '100%' }}>Save Staff Member</button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <p>Loading staff...</p>
            ) : filteredStaff.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <p>No {statusFilter === 'all' ? '' : statusFilter} staff to display.</p>
                </div>
            ) : (
                <div className="grid-cards" style={{ paddingBottom: manageMode ? '90px' : 0 }}>
                    {filteredStaff.map(person => {
                        const inactive = person.is_active === 0;
                        const selectable = manageMode && !inactive;
                        const checked = selected.has(person.employee_id);
                        return (
                            <div
                                key={person.employee_id}
                                className="glass-panel"
                                onClick={() => selectable && toggleSelect(person.employee_id)}
                                style={{
                                    padding: '20px', position: 'relative',
                                    opacity: inactive ? 0.55 : 1,
                                    cursor: selectable ? 'pointer' : 'default',
                                    outline: checked ? '2px solid #ef4444' : 'none',
                                    transition: 'outline 120ms',
                                }}
                            >
                                {manageMode && !inactive && (
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSelect(person.employee_id)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ position: 'absolute', top: '12px', left: '12px', width: '18px', height: '18px', accentColor: '#ef4444', zIndex: 2 }}
                                    />
                                )}
                                {inactive && (
                                    <span style={{
                                        position: 'absolute', top: '12px', left: '12px',
                                        fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                                        background: 'rgba(239,68,68,0.18)', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase',
                                    }}>Inactive</span>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px', paddingLeft: (manageMode && !inactive) || inactive ? '28px' : 0, transition: 'padding 150ms' }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 5px' }}>{person.first_name} {person.last_name}</h3>
                                        <span style={{
                                            fontSize: '12px',
                                            padding: '4px 8px',
                                            borderRadius: '20px',
                                            background: 'rgba(255,255,255,0.1)',
                                            color: 'var(--color-text-muted)'
                                        }}>
                                            {person.dept_name || 'Unassigned'}
                                        </span>
                                    </div>
                                    {getRoleIcon(person.dept_name)}
                                </div>

                                <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <p>Shift: {person.shift_timeframe}</p>

                                    {person.license_no && (
                                        <div style={{ color: 'var(--color-primary)' }}>
                                            <p>Vet License: {person.license_no}</p>
                                            <p>Specialty: {person.specialty}</p>
                                        </div>
                                    )}
                                    {person.specialization_species && (
                                        <div style={{ color: 'var(--color-text)' }}>
                                            <p>Specialization: {person.specialization_species}</p>
                                        </div>
                                    )}
                                    {person.office_location && (
                                        <p>Office: {person.office_location}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {manageMode && (
                <BulkActionBar
                    count={selected.size}
                    onSelectAll={selectAllVisible}
                    onRemove={handleRemoveSelected}
                    onCancel={exitManageMode}
                    actionLabel="Deactivate Selected"
                />
            )}
        </div>
    );
}

function BulkActionBar({ count, onSelectAll, onRemove, onCancel, actionLabel }) {
    return (
        <div style={{
            position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            background: '#1a1f2e', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '14px', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: '14px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 999,
        }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                <strong style={{ color: 'white' }}>{count}</strong> selected
            </span>
            <button onClick={onSelectAll}
                style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Select All
            </button>
            <button onClick={onRemove} disabled={count === 0}
                style={{ background: count === 0 ? 'rgba(239,68,68,0.25)' : '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: count === 0 ? 'not-allowed' : 'pointer' }}>
                {actionLabel}
            </button>
            <button onClick={onCancel}
                style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer' }}>
                Cancel
            </button>
        </div>
    );
}

// Full animal management UI. Used by the Admin, Vet, and Caretaker
// dashboards — the backend authorizes POST/PATCH/DELETE for all three
// roles, and both vet + caretaker are the staff who actually handle
// animal arrival and departure.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { Activity, X, Trash2, Pencil } from 'lucide-react';
import BulkActionBar from './BulkActionBar';
import LifecycleLogModal, { LifecycleLogButton } from './LifecycleLogModal';
import { useToast, useConfirm } from './Feedback';

const GREEN = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

export default function AnimalsPanel({ title = 'Animals', accentColor = 'var(--color-primary)' }) {
    const toast   = useToast();
    const confirm = useConfirm();
    const [animals, setAnimals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [zones, setZones] = useState([]);

    const [statusFilter, setStatusFilter] = useState('active');
    const [manageMode, setManageMode] = useState(false);
    const [selected, setSelected] = useState(() => new Set());

    // Edit state: holds the animal currently being edited (or null).
    const [editing, setEditing] = useState(null);

    const [selectedAnimal, setSelectedAnimal] = useState(null);
    const [medicalHistory, setMedicalHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showHistoryForm, setShowHistoryForm] = useState(false);
    const [historyForm, setHistoryForm] = useState({ injury: '', disease: '', date_treated: '', animal_age_at_treatment: '' });

    const [formData, setFormData] = useState({
        name: '',
        species_common_name: '',
        species_binomial: '',
        age: '',
        zone_id: '',
        arrived_date: '',
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [logTarget, setLogTarget]   = useState(null);

    useEffect(() => {
        fetchAnimals();
        fetchZones();
    }, [statusFilter]);

    async function fetchAnimals() {
        setLoading(true);
        try {
            const data = await api.get(`/animals?status=${statusFilter}`);
            setAnimals(data || []);
        } catch (error) {
            console.error('Error fetching animals:', error.message);
        } finally {
            setLoading(false);
        }
    }

    async function fetchZones() {
        const data = await api.get('/animals/zones/all');
        if (data) setZones(data);
    }

    async function fetchMedicalHistory(animal) {
        if (!animal.animal_id) return;
        setHistoryLoading(true);
        try {
            const data = await api.get(`/animals/${animal.animal_id}/medical-history`);
            setMedicalHistory(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setHistoryLoading(false);
        }
    }

    async function handleHistorySubmit(e) {
        e.preventDefault();
        try {
            await api.post(`/animals/${selectedAnimal.animal_id}/medical-history`, {
                ...historyForm,
                animal_age_at_treatment: parseInt(historyForm.animal_age_at_treatment),
            });
            setShowHistoryForm(false);
            setHistoryForm({ injury: '', disease: '', date_treated: '', animal_age_at_treatment: '' });
            fetchMedicalHistory(selectedAnimal);
        } catch (error) {
            console.error('Error adding medical record', error);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            if (editing) {
                await api.patch(`/animals/${editing.animal_id}`, {
                    name: formData.name,
                    species_common_name: formData.species_common_name,
                    species_binomial: formData.species_binomial || null,
                    age: formData.age === '' ? null : parseInt(formData.age),
                    zone_id: formData.zone_id === '' ? null : parseInt(formData.zone_id),
                    arrived_date: formData.arrived_date || null,
                });
            } else {
                await api.post('/animals', {
                    ...formData,
                    age: parseInt(formData.age),
                    zone_id: parseInt(formData.zone_id),
                    arrived_date: formData.arrived_date || null,
                });
            }
            setShowForm(false);
            setEditing(null);
            setFormData({ name: '', species_common_name: '', species_binomial: '', age: '', zone_id: '', arrived_date: '' });
            fetchAnimals();
        } catch (error) {
            console.error('Error saving animal:', error);
            toast.error('Failed to save animal: ' + error.message);
        }
    }

    function startEdit(animal) {
        setEditing(animal);
        setFormData({
            name: animal.name || '',
            species_common_name: animal.species_common_name || '',
            species_binomial: animal.species_binomial || '',
            age: animal.age ?? '',
            zone_id: animal.zone_id ?? '',
            arrived_date: animal.arrived_date ? animal.arrived_date.slice(0, 10) : '',
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelForm() {
        setShowForm(false);
        setEditing(null);
        setFormData({ name: '', species_common_name: '', species_binomial: '', age: '', zone_id: '', arrived_date: '' });
    }

    function toggleSelect(id) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }
    function selectAllVisible() {
        setSelected(new Set(filteredAnimals.filter(a => a.is_active).map(a => a.animal_id)));
    }
    function exitManageMode() {
        setManageMode(false);
        setSelected(new Set());
    }
    async function handleRemoveSelected() {
        if (selected.size === 0) return;
        const ok = await confirm({
            title: `Mark ${selected.size} animal${selected.size === 1 ? '' : 's'} as departed?`,
            message: 'They can be restored by an admin from the Reactivate tab.',
            confirmLabel: 'Mark Departed',
            tone: 'danger',
        });
        if (!ok) return;
        const ids = Array.from(selected);
        const results = await Promise.allSettled(ids.map(id => api.delete(`/animals/${id}`)));
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length) {
            toast.error(`${failed.length} removal${failed.length === 1 ? '' : 's'} failed.`);
        } else {
            toast.success(`Marked ${ids.length} animal${ids.length === 1 ? '' : 's'} as departed.`);
        }
        exitManageMode();
        fetchAnimals();
    }

    const filteredAnimals = animals.filter(animal =>
        animal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        animal.species_common_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        animal.species_binomial?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const STATUS_TABS = [
        { key: 'active',   label: 'Active' },
        { key: 'departed', label: 'Departed' },
        { key: 'all',      label: 'All' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                    <h1 style={{ margin: 0 }}>{title}</h1>
                    <input
                        type="text"
                        placeholder="Search animals..."
                        className="glass-input"
                        style={{ maxWidth: '300px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="glass-button"
                        onClick={() => showForm ? cancelForm() : setShowForm(true)}
                        style={{ background: showForm ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255,255,255,0.1)' }}
                    >
                        {showForm ? 'Cancel' : '+ Add Animal'}
                    </button>
                    {manageMode ? (
                        <button className="glass-button" onClick={exitManageMode}
                            style={{ background: 'rgba(239,68,68,0.18)', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                            × Exit Removal
                        </button>
                    ) : (
                        <button className="glass-button" onClick={() => setManageMode(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Trash2 size={14} /> Manage Animals
                        </button>
                    )}
                </div>
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
                <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px', border: `1px solid ${accentColor}` }}>
                    <h3>{editing ? `Edit Animal: ${editing.name}` : 'New Animal Profile'}</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Name</label>
                            <input required className="glass-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Common Species Name</label>
                            <input required className="glass-input" value={formData.species_common_name} onChange={e => setFormData({ ...formData, species_common_name: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Scientific Name</label>
                            <input className="glass-input" value={formData.species_binomial} onChange={e => setFormData({ ...formData, species_binomial: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Age (Years)</label>
                            <input required type="number" className="glass-input" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Zone</label>
                            <select required className="glass-input" value={formData.zone_id} onChange={e => setFormData({ ...formData, zone_id: e.target.value })}>
                                <option value="">Select Zone...</option>
                                {zones.map(z => <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Arrival Date</label>
                            <input
                                type="date"
                                className="glass-input"
                                value={formData.arrived_date}
                                onChange={e => setFormData({ ...formData, arrived_date: e.target.value })}
                                max={new Date().toISOString().slice(0, 10)}
                                placeholder="Defaults to today"
                            />
                        </div>
                        <div style={{ gridColumn: '1 / -1', marginTop: '10px', display: 'flex', gap: '10px' }}>
                            <button type="submit" className="glass-button" style={{ background: accentColor, color: 'white', flex: 1 }}>
                                {editing ? 'Save Changes' : 'Save Animal'}
                            </button>
                            {editing && (
                                <button type="button" onClick={cancelForm} className="glass-button" style={{ flex: 0.3 }}>Cancel</button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <p>Loading animals...</p>
            ) : filteredAnimals.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <p>No {statusFilter === 'all' ? '' : statusFilter} animals to display.</p>
                </div>
            ) : (
                <div className="grid-cards" style={{ paddingBottom: manageMode ? '90px' : 0 }}>
                    {filteredAnimals.map(animal => {
                        const departed = animal.is_active === 0;
                        const selectable = manageMode && !departed;
                        const checked = selected.has(animal.animal_id);
                        return (
                            <div
                                key={animal.animal_id}
                                className="glass-panel"
                                onClick={() => selectable && toggleSelect(animal.animal_id)}
                                style={{
                                    padding: '20px', position: 'relative',
                                    opacity: departed ? 0.55 : 1,
                                    cursor: selectable ? 'pointer' : 'default',
                                    outline: checked ? '2px solid #ef4444' : 'none',
                                    transition: 'outline 120ms',
                                }}
                            >
                                {manageMode && !departed && (
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSelect(animal.animal_id)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ position: 'absolute', top: '12px', left: '12px', width: '18px', height: '18px', accentColor: '#ef4444' }}
                                    />
                                )}
                                {departed && (
                                    <span style={{
                                        position: 'absolute', top: '12px', right: '12px',
                                        fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                                        background: 'rgba(239,68,68,0.18)', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase',
                                    }}>Departed</span>
                                )}
                                <h3 style={{ margin: '0 0 10px', paddingRight: '80px', paddingLeft: manageMode && !departed ? '28px' : 0, transition: 'padding 150ms' }}>{animal.name}</h3>
                                <p style={{ color: accentColor, fontSize: '14px', marginBottom: '15px' }}>{animal.species_common_name}</p>
                                <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '15px' }}>
                                    <p>Age: {animal.age} years</p>
                                    <p>Zone: {animal.zone_name || 'Unassigned'}</p>
                                    {animal.arrived_date && (
                                        <p style={{ fontSize: '12px', opacity: 0.85 }}>
                                            Arrived: {new Date(animal.arrived_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    )}
                                    {departed && animal.departed_date && (
                                        <p style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
                                            Departed: {new Date(animal.departed_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        className="glass-button"
                                        style={{ flex: 1, fontSize: '12px', padding: '8px' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedAnimal(animal);
                                            fetchMedicalHistory(animal);
                                        }}
                                    >
                                        Medical Records
                                    </button>
                                    {!manageMode && !departed && (
                                        <button
                                            className="glass-button"
                                            title="Edit animal"
                                            style={{ fontSize: '12px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            onClick={(e) => { e.stopPropagation(); startEdit(animal); }}
                                        >
                                            <Pencil size={12} /> Edit
                                        </button>
                                    )}
                                    <LifecycleLogButton
                                        compact
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLogTarget({ entity: 'animal', id: animal.animal_id, name: animal.name });
                                        }}
                                    />
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
                    actionLabel="Mark Departed"
                />
            )}

            {logTarget && (
                <LifecycleLogModal
                    entity={logTarget.entity}
                    id={logTarget.id}
                    name={logTarget.name}
                    onClose={() => setLogTarget(null)}
                />
            )}

            {selectedAnimal && createPortal((
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }} onClick={() => setSelectedAnimal(null)}>
                    <div onClick={e => e.stopPropagation()} className="glass-panel" style={{ width: '600px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', padding: '30px', background: '#0f172a', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Activity color="var(--color-accent)" />
                                <h2 style={{ margin: 0 }}>Medical History: {selectedAnimal.name}</h2>
                            </div>
                            <button onClick={() => setSelectedAnimal(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
                        </div>

                        {!showHistoryForm ? (
                            <button
                                className="glass-button"
                                onClick={() => setShowHistoryForm(true)}
                                style={{ width: '100%', marginBottom: '20px', background: 'rgba(255,255,255,0.05)' }}
                            >
                                + Add Medical Entry
                            </button>
                        ) : (
                            <form onSubmit={handleHistorySubmit} style={{ marginBottom: '30px', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '10px' }}>
                                <h4 style={{ marginTop: 0 }}>New Entry</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <input placeholder="Injury (Optional)" className="glass-input" value={historyForm.injury} onChange={e => setHistoryForm({ ...historyForm, injury: e.target.value })} />
                                    <input placeholder="Disease (Optional)" className="glass-input" value={historyForm.disease} onChange={e => setHistoryForm({ ...historyForm, disease: e.target.value })} />
                                    <input type="date" required className="glass-input" value={historyForm.date_treated} onChange={e => setHistoryForm({ ...historyForm, date_treated: e.target.value })} />
                                    <input type="number" placeholder="Age at Treatment" required className="glass-input" value={historyForm.animal_age_at_treatment} onChange={e => setHistoryForm({ ...historyForm, animal_age_at_treatment: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                    <button type="submit" className="glass-button" style={{ background: accentColor, flex: 1 }}>Save</button>
                                    <button type="button" className="glass-button" onClick={() => setShowHistoryForm(false)} style={{ flex: 1 }}>Cancel</button>
                                </div>
                            </form>
                        )}

                        {historyLoading ? <p>Loading records...</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {medicalHistory.length === 0 ? <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>No medical history found.</p> :
                                    medicalHistory.map(record => (
                                        <div key={record.history_id} style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                <span style={{ fontWeight: 'bold' }}>{new Date(record.date_treated).toLocaleDateString()}</span>
                                                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Age: {record.animal_age_at_treatment}</span>
                                            </div>
                                            <p style={{ margin: '5px 0', color: 'var(--color-primary)' }}>{record.disease ? `Disease: ${record.disease} ` : ''}</p>
                                            <p style={{ margin: '5px 0', color: 'orange' }}>{record.injury ? `Injury: ${record.injury} ` : ''}</p>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                </div>
            ), document.body)}
        </div>
    );
}

// Shared status/filter pill-group used by AnimalsPanel, Staff, and Events.
// Kept here (instead of its own file) so every "manage" surface picks up
// the green-themed style that matches the rest of the dashboard.
export function StatusFilter({ label = 'Status', tabs, value, onChange }) {
    return (
        <div style={{
            display: 'inline-flex',
            gap: '4px',
            background: 'rgba(255, 245, 231, 0.72)',
            border: '1px solid rgba(121,162,128,0.25)',
            padding: '4px 6px',
            borderRadius: '12px',
            flexWrap: 'wrap',
        }}>
            <span style={{
                fontSize: '10px', color: GREEN_DARK, alignSelf: 'center',
                padding: '0 10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
            }}>{label}</span>
            {tabs.map(t => {
                const active = value === t.key;
                return (
                    <button key={t.key} onClick={() => onChange(t.key)} type="button"
                        style={{
                            padding: '6px 14px', fontSize: '12px',
                            background: active ? GREEN : 'transparent',
                            color: active ? 'white' : GREEN_DARK,
                            fontWeight: active ? 700 : 500,
                            border: 'none', borderRadius: '8px',
                            cursor: 'pointer', transition: 'background 150ms, color 150ms',
                        }}>{t.label}</button>
                );
            })}
        </div>
    );
}

// Shared From/To date-range filter used by the Inventory activity log and
// the Hours "My Reviews" tab. Kept alongside StatusFilter so the whole
// dashboard toolkit imports from one place.
export function DateRangeFilter({ from, to, onFrom, onTo, label = 'Date range' }) {
    const dateInput = {
        padding: '5px 8px', fontSize: '12px',
        border: '1px solid rgba(121,162,128,0.3)', borderRadius: '6px',
        background: 'white', color: GREEN_DARK, fontFamily: 'inherit',
    };
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
            background: 'rgba(255, 245, 231, 0.72)',
            border: '1px solid rgba(121,162,128,0.25)',
            borderRadius: '12px', padding: '6px 12px',
            marginBottom: '16px',
        }}>
            <span style={{ fontSize: '10px', color: GREEN_DARK, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                {label}
            </span>
            <input type="date" value={from} max={to || undefined}
                onChange={e => onFrom(e.target.value)} style={dateInput} />
            <span style={{ fontSize: '12px', color: GREEN_DARK }}>→</span>
            <input type="date" value={to} min={from || undefined}
                onChange={e => onTo(e.target.value)} style={dateInput} />
            {(from || to) && (
                <button type="button" onClick={() => { onFrom(''); onTo(''); }}
                    style={{
                        background: 'transparent', border: 'none', color: GREEN_DARK,
                        fontSize: '12px', cursor: 'pointer', textDecoration: 'underline',
                    }}>Clear</button>
            )}
        </div>
    );
}

// BulkActionBar now lives in ./BulkActionBar.jsx (shared + portaled).

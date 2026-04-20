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
import AnimalMedicalPanel from './AnimalMedicalPanel';
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

    // Medical-records modal now delegates to AnimalMedicalPanel so the
    // full schema (diagnosis/severity/status/treatment/medications/vitals
    // /notes/follow-up) is available to admins. Keeping just the "which
    // animal is selected" state here.
    const [selectedAnimal, setSelectedAnimal] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        species_common_name: '',
        species_binomial: '',
        age: '',
        zone_id: '',
        arrived_date: '',
        date_of_birth: '',
        image_url: '',
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [zoneFilter, setZoneFilter] = useState('all');
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

    async function handleSubmit(e) {
        e.preventDefault();
        // DOB sanity: either no DOB, or DOB is on/before the arrival date.
        // The server enforces the same invariant — this just surfaces
        // a friendly message before we round-trip.
        if (formData.date_of_birth && formData.arrived_date
            && formData.date_of_birth > formData.arrived_date) {
            toast.warn('Date of birth must be on or before the arrival date.');
            return;
        }
        try {
            if (editing) {
                await api.patch(`/animals/${editing.animal_id}`, {
                    name: formData.name,
                    species_common_name: formData.species_common_name,
                    species_binomial: formData.species_binomial || null,
                    age: formData.age === '' ? null : parseInt(formData.age),
                    zone_id: formData.zone_id === '' ? null : parseInt(formData.zone_id),
                    arrived_date: formData.arrived_date || null,
                    date_of_birth: formData.date_of_birth || null,
                    image_url: formData.image_url?.trim() || null,
                });
            } else {
                await api.post('/animals', {
                    ...formData,
                    age: parseInt(formData.age),
                    zone_id: parseInt(formData.zone_id),
                    arrived_date: formData.arrived_date || null,
                    date_of_birth: formData.date_of_birth || null,
                    image_url: formData.image_url?.trim() || null,
                });
            }
            setShowForm(false);
            setEditing(null);
            setFormData({ name: '', species_common_name: '', species_binomial: '', age: '', zone_id: '', arrived_date: '', date_of_birth: '', image_url: '' });
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
            arrived_date: animal.arrived_date ? String(animal.arrived_date).slice(0, 10) : '',
            date_of_birth: animal.date_of_birth ? String(animal.date_of_birth).slice(0, 10) : '',
            image_url: animal.image_url || '',
        });
        setShowForm(true);
    }

    function cancelForm() {
        setShowForm(false);
        setEditing(null);
        setFormData({ name: '', species_common_name: '', species_binomial: '', age: '', zone_id: '', arrived_date: '', date_of_birth: '', image_url: '' });
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

    const filteredAnimals = animals
        .filter(a => zoneFilter === 'all' || String(a.zone_id) === String(zoneFilter))
        .filter(animal => {
            const q = searchTerm.toLowerCase();
            return (
                animal.name.toLowerCase().includes(q) ||
                animal.species_common_name.toLowerCase().includes(q) ||
                animal.species_binomial?.toLowerCase().includes(q) ||
                (animal.zone_name || '').toLowerCase().includes(q)
            );
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const STATUS_TABS = [
        { key: 'active',   label: 'Active' },
        { key: 'departed', label: 'Departed' },
        { key: 'all',      label: 'All' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
                <h1 style={{ margin: 0 }}>{title}</h1>
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

            {/* Search sits below the heading so it matches every other
                list view (Manager's Animal Assignments, My Staff, Events). */}
            <input
                type="text"
                placeholder="Search by name, species, or zone..."
                className="glass-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: '440px', marginBottom: '14px', display: 'block' }}
            />

            <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <StatusFilter
                    label="Status"
                    tabs={STATUS_TABS}
                    value={statusFilter}
                    onChange={setStatusFilter}
                />
                <StatusFilter
                    label="Zone"
                    tabs={[
                        { key: 'all', label: 'All' },
                        ...zones.map(z => ({ key: String(z.zone_id), label: z.zone_name })),
                    ]}
                    value={zoneFilter}
                    onChange={setZoneFilter}
                />
            </div>

            {showForm && createPortal((
                <div onClick={cancelForm} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        width: '560px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
                        padding: '28px', background: 'rgba(255,255,255,0.96)', color: 'var(--color-text-dark)',
                        border: `1px solid ${GREEN}`, borderRadius: '14px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <h2 style={{ margin: 0, color: GREEN_DARK }}>{editing ? `Edit Animal: ${editing.name}` : 'New Animal Profile'}</h2>
                            <button onClick={cancelForm} style={{ background: 'none', border: 'none', color: GREEN_DARK, cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={animalLabelStyle}>Name</label>
                                <input required className="glass-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label style={animalLabelStyle}>Common Species Name</label>
                                <input required className="glass-input" value={formData.species_common_name} onChange={e => setFormData({ ...formData, species_common_name: e.target.value })} />
                            </div>
                            <div>
                                <label style={animalLabelStyle}>Scientific Name</label>
                                <input className="glass-input" value={formData.species_binomial} onChange={e => setFormData({ ...formData, species_binomial: e.target.value })} />
                            </div>
                            <div>
                                <label style={animalLabelStyle}>Age (Years)</label>
                                <input required type="number" className="glass-input" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
                            </div>
                            <div>
                                <label style={animalLabelStyle}>Zone</label>
                                <select required className="glass-input" value={formData.zone_id} onChange={e => setFormData({ ...formData, zone_id: e.target.value })}>
                                    <option value="">Select Zone...</option>
                                    {zones.map(z => <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={animalLabelStyle}>Arrival Date</label>
                                <input
                                    type="date"
                                    className="glass-input"
                                    value={formData.arrived_date}
                                    onChange={e => setFormData({ ...formData, arrived_date: e.target.value })}
                                    max={new Date().toISOString().slice(0, 10)}
                                    placeholder="Defaults to today"
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={animalLabelStyle}>Date of Birth</label>
                                <input
                                    type="date"
                                    className="glass-input"
                                    value={formData.date_of_birth}
                                    max={formData.arrived_date || new Date().toISOString().slice(0, 10)}
                                    onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                                    placeholder="Same day as arrival if born here"
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={animalLabelStyle}>Photo URL</label>
                                <input
                                    type="url"
                                    className="glass-input"
                                    value={formData.image_url}
                                    onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                                    placeholder="https://… (shown on the public Our Animals page)"
                                />
                                {formData.image_url?.trim() && (
                                    <div style={{ marginTop: '8px', border: `1px solid ${GREEN}33`, borderRadius: '8px', padding: '8px', maxWidth: '220px' }}>
                                        <img
                                            src={formData.image_url}
                                            alt="Preview"
                                            style={{ width: '100%', borderRadius: '6px', display: 'block' }}
                                            onError={e => { e.currentTarget.style.display = 'none'; }}
                                            onLoad={e => { e.currentTarget.style.display = 'block'; }}
                                        />
                                        <div style={{ fontSize: '11px', color: GREEN_DARK, marginTop: '4px' }}>Preview</div>
                                    </div>
                                )}
                            </div>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '6px' }}>
                                <button type="button" onClick={cancelForm} className="glass-button" style={{ flex: 1 }}>Cancel</button>
                                <button type="submit" className="glass-button" style={{ flex: 2, background: GREEN, color: 'white', fontWeight: 700 }}>
                                    {editing ? 'Save Changes' : 'Save Animal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ), document.body)}

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
                                {animal.image_url && (
                                    <div style={{ marginBottom: '10px', borderRadius: '8px', overflow: 'hidden', aspectRatio: '16/10', background: 'rgba(121,162,128,0.1)' }}>
                                        <img
                                            src={animal.image_url}
                                            alt={animal.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                            loading="lazy"
                                            onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                                        />
                                    </div>
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
                                {/* Bottom row: left group (actions) and right group (Log).
                                    `marginLeft: auto` on the right group pushes Log flush
                                    to the card's bottom-right — matches Staff cards. */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <button
                                        className="glass-button"
                                        style={{ fontSize: '12px', padding: '8px' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedAnimal(animal);
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
                                    <div style={{ marginLeft: 'auto' }}>
                                        <LifecycleLogButton
                                            compact
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setLogTarget({ entity: 'animal', id: animal.animal_id, name: animal.name });
                                            }}
                                        />
                                    </div>
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
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }} onClick={() => setSelectedAnimal(null)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        width: '680px', maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto',
                        padding: '28px', background: 'rgba(255,255,255,0.98)',
                        border: `1px solid ${GREEN}`, borderRadius: '14px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Activity color={GREEN_DARK} size={20} />
                                <h2 style={{ margin: 0, color: GREEN_DARK, fontSize: '20px' }}>
                                    Medical Records: {selectedAnimal.name}
                                </h2>
                            </div>
                            <button onClick={() => setSelectedAnimal(null)} style={{ background: 'none', border: 'none', color: GREEN_DARK, cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        {/* Shared panel — exposes the full schema the server accepts
                            (diagnosis, severity, status, treatment, medications,
                             vitals, follow-up, notes) + the care log. */}
                        {/* Admin can edit both domains. */}
                        <AnimalMedicalPanel animalId={selectedAnimal.animal_id} canFileMedical={true} canFileCare={true} />
                    </div>
                </div>
            ), document.body)}
        </div>
    );
}

const animalLabelStyle = {
    display: 'block',
    fontSize: '11px',
    color: GREEN_DARK,
    marginBottom: '4px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
};

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

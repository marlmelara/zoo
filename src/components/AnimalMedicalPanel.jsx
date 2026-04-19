import React, { useEffect, useState } from 'react';
import {
    getMedicalHistory, addMedicalHistory,
    getCareLog, addCareLog,
} from '../api/animals';
import {
    Stethoscope, FileText, Plus, Calendar, User, Activity,
} from 'lucide-react';

const GREEN      = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

const SEVERITY_COLORS = {
    minor:    { bg: 'rgba(16,185,129,0.15)', fg: '#10b981' },
    moderate: { bg: 'rgba(234,179,8,0.15)',  fg: '#ca8a04' },
    severe:   { bg: 'rgba(245,158,11,0.2)',  fg: '#d97706' },
    critical: { bg: 'rgba(239,68,68,0.2)',   fg: '#dc2626' },
};
const STATUS_COLORS = {
    active:     { bg: 'rgba(239,68,68,0.15)',  fg: '#dc2626' },
    monitoring: { bg: 'rgba(59,130,246,0.15)', fg: '#3b82f6' },
    resolved:   { bg: 'rgba(16,185,129,0.15)', fg: '#10b981' },
    chronic:    { bg: 'rgba(139,92,246,0.15)', fg: '#7c3aed' },
};

export default function AnimalMedicalPanel({ animalId, canFileMedical = false }) {
    const [history, setHistory]     = useState([]);
    const [care, setCare]           = useState([]);
    const [loading, setLoading]     = useState(true);
    const [tab, setTab]             = useState('history');  // history | care
    const [showMedForm, setShowMedForm]   = useState(false);
    const [showCareForm, setShowCareForm] = useState(false);

    async function load() {
        try {
            setLoading(true);
            const [h, c] = await Promise.all([
                getMedicalHistory(animalId),
                getCareLog(animalId),
            ]);
            setHistory(h || []);
            setCare(c || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); /* eslint-disable-line */ }, [animalId]);

    return (
        <div style={{
            marginTop: '16px',
            background: 'rgba(255, 245, 231, 0.55)',
            border: '1px solid rgba(121,162,128,0.2)',
            borderRadius: '10px',
            padding: '14px',
        }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>
                    <Stethoscope size={14} /> Medical history ({history.length})
                </TabBtn>
                <TabBtn active={tab === 'care'} onClick={() => setTab('care')}>
                    <FileText size={14} /> Care log ({care.length})
                </TabBtn>
            </div>

            {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
             : tab === 'history' ? (
                <>
                    <button className="glass-button"
                        onClick={() => setShowMedForm(v => !v)}
                        disabled={!canFileMedical}
                        title={canFileMedical ? '' : 'Only vets, managers, and admins can file medical records.'}
                        style={{ background: GREEN, color: 'white', fontSize: '12px', padding: '6px 12px', marginBottom: '10px',
                                 opacity: canFileMedical ? 1 : 0.5, cursor: canFileMedical ? 'pointer' : 'not-allowed' }}>
                        <Plus size={12} /> {showMedForm ? 'Cancel' : 'Add medical entry'}
                    </button>
                    {showMedForm && canFileMedical && (
                        <MedicalForm
                            animalId={animalId}
                            onSaved={async () => { setShowMedForm(false); await load(); }}
                        />
                    )}
                    {history.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No medical records yet.</p>
                    ) : history.map(h => <MedicalEntry key={h.history_id} h={h} />)}
                </>
             ) : (
                <>
                    <button className="glass-button"
                        onClick={() => setShowCareForm(v => !v)}
                        style={{ background: GREEN, color: 'white', fontSize: '12px', padding: '6px 12px', marginBottom: '10px' }}>
                        <Plus size={12} /> {showCareForm ? 'Cancel' : 'Add care note'}
                    </button>
                    {showCareForm && (
                        <CareForm
                            animalId={animalId}
                            onSaved={async () => { setShowCareForm(false); await load(); }}
                        />
                    )}
                    {care.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No care log entries yet.</p>
                    ) : care.map(c => <CareEntry key={c.log_id} c={c} />)}
                </>
             )}
        </div>
    );
}

function TabBtn({ active, onClick, children }) {
    return (
        <button onClick={onClick} style={{
            padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: active ? GREEN : 'rgba(255, 245, 231, 0.78)',
            color: active ? 'white' : GREEN_DARK,
            fontSize: '12px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '4px',
        }}>{children}</button>
    );
}

function MedicalEntry({ h }) {
    const sev = SEVERITY_COLORS[h.severity] || SEVERITY_COLORS.minor;
    const st  = STATUS_COLORS[h.status] || STATUS_COLORS.active;
    return (
        <div style={{
            padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(255, 245, 231, 0.78)',
            border: '1px solid rgba(121,162,128,0.2)',
            marginBottom: '6px', fontSize: '13px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Tag bg={sev.bg} fg={sev.fg}>Severity: {h.severity}</Tag>
                    <Tag bg={st.bg}  fg={st.fg}>{h.status}</Tag>
                    {h.date_treated && (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            <Calendar size={11} style={{ verticalAlign: '-2px', marginRight: '3px' }} />
                            {new Date(h.date_treated + 'T00:00:00').toLocaleDateString()}
                        </span>
                    )}
                </div>
                {h.recorded_by_first && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        <User size={11} style={{ verticalAlign: '-2px' }} /> {h.recorded_by_first} {h.recorded_by_last} ({h.recorded_by_role})
                    </span>
                )}
            </div>
            {h.diagnosis && <Row label="Diagnosis"   value={h.diagnosis} />}
            {h.injury    && <Row label="Injury"      value={h.injury} />}
            {h.disease   && <Row label="Disease"     value={h.disease} />}
            {h.treatment && <Row label="Treatment"   value={h.treatment} />}
            {h.medications && <Row label="Medications" value={h.medications} />}
            {(h.weight_kg != null || h.temperature_c != null || h.heart_rate_bpm != null) && (
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    {h.weight_kg != null      && <span>{h.weight_kg} kg</span>}
                    {h.temperature_c != null  && <span>{h.temperature_c}°C</span>}
                    {h.heart_rate_bpm != null && <span>{h.heart_rate_bpm} bpm</span>}
                </div>
            )}
            {h.notes && <Row label="Notes" value={h.notes} />}
            {h.next_followup_date && (
                <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px' }}>
                    Follow-up: {new Date(h.next_followup_date + 'T00:00:00').toLocaleDateString()}
                </div>
            )}
        </div>
    );
}

function CareEntry({ c }) {
    return (
        <div style={{
            padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(255, 245, 231, 0.78)',
            border: '1px solid rgba(121,162,128,0.2)',
            marginBottom: '6px', fontSize: '13px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: GREEN_DARK, textTransform: 'capitalize' }}>
                    <Activity size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                    {(c.log_type || 'observation').replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {c.first_name ? `${c.first_name} ${c.last_name} (${c.role}) · ` : ''}
                    {new Date(c.logged_at).toLocaleString()}
                </span>
            </div>
            <div style={{ color: 'var(--color-text-dark)' }}>{c.notes}</div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div style={{ marginTop: '2px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', marginRight: '6px' }}>{label}</span>
            <span>{value}</span>
        </div>
    );
}

function Tag({ bg, fg, children }) {
    return (
        <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.3px',
            textTransform: 'uppercase',
            padding: '2px 8px', borderRadius: '8px',
            background: bg, color: fg,
        }}>{children}</span>
    );
}

function MedicalForm({ animalId, onSaved }) {
    const [form, setForm] = useState({
        diagnosis: '', injury: '', disease: '',
        treatment: '', medications: '',
        severity: 'minor', status: 'active',
        weight_kg: '', temperature_c: '', heart_rate_bpm: '',
        notes: '',
        date_treated: new Date().toISOString().split('T')[0],
        next_followup_date: '',
    });
    const [saving, setSaving] = useState(false);
    const up = (k) => (e) => setForm(s => ({ ...s, [k]: e.target.value }));

    async function submit(e) {
        e.preventDefault();
        if (!form.diagnosis && !form.injury && !form.disease && !form.notes) {
            return alert('Please provide at least a diagnosis, injury, disease, or notes.');
        }
        try {
            setSaving(true);
            await addMedicalHistory(animalId, {
                ...form,
                weight_kg:      form.weight_kg      === '' ? null : Number(form.weight_kg),
                temperature_c:  form.temperature_c  === '' ? null : Number(form.temperature_c),
                heart_rate_bpm: form.heart_rate_bpm === '' ? null : Number(form.heart_rate_bpm),
            });
            onSaved();
        } catch (err) {
            alert('Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} style={{
            padding: '12px', background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(121,162,128,0.25)', borderRadius: '10px', marginBottom: '10px',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
        }}>
            <FormField label="Date" style={{ gridColumn: '1 / -1' }}>
                <input className="glass-input" type="date" value={form.date_treated} onChange={up('date_treated')} />
            </FormField>
            <FormField label="Severity">
                <select className="glass-input" value={form.severity} onChange={up('severity')}>
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="critical">Critical</option>
                </select>
            </FormField>
            <FormField label="Status">
                <select className="glass-input" value={form.status} onChange={up('status')}>
                    <option value="active">Active</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                    <option value="chronic">Chronic</option>
                </select>
            </FormField>
            <FormField label="Diagnosis" style={{ gridColumn: '1 / -1' }}>
                <input className="glass-input" value={form.diagnosis} onChange={up('diagnosis')} maxLength={500} />
            </FormField>
            <FormField label="Injury"><input className="glass-input" value={form.injury} onChange={up('injury')} maxLength={500} /></FormField>
            <FormField label="Disease"><input className="glass-input" value={form.disease} onChange={up('disease')} maxLength={500} /></FormField>
            <FormField label="Treatment" style={{ gridColumn: '1 / -1' }}>
                <input className="glass-input" value={form.treatment} onChange={up('treatment')} maxLength={500} />
            </FormField>
            <FormField label="Medications" style={{ gridColumn: '1 / -1' }}>
                <input className="glass-input" value={form.medications} onChange={up('medications')} maxLength={500} />
            </FormField>
            <FormField label="Weight (kg)"><input type="number" step="0.1" className="glass-input" value={form.weight_kg} onChange={up('weight_kg')} /></FormField>
            <FormField label="Temperature (°C)"><input type="number" step="0.1" className="glass-input" value={form.temperature_c} onChange={up('temperature_c')} /></FormField>
            <FormField label="Heart rate (bpm)"><input type="number" className="glass-input" value={form.heart_rate_bpm} onChange={up('heart_rate_bpm')} /></FormField>
            <FormField label="Next follow-up"><input type="date" className="glass-input" value={form.next_followup_date} onChange={up('next_followup_date')} /></FormField>
            <FormField label="Notes" style={{ gridColumn: '1 / -1' }}>
                <textarea className="glass-input" rows={3} value={form.notes} onChange={up('notes')} maxLength={2000} />
            </FormField>
            <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
                <button type="submit" className="glass-button" disabled={saving}
                    style={{ background: GREEN, color: 'white' }}>
                    {saving ? 'Saving...' : 'Save medical entry'}
                </button>
            </div>
        </form>
    );
}

function CareForm({ animalId, onSaved }) {
    const [logType, setLogType] = useState('observation');
    const [notes, setNotes]     = useState('');
    const [saving, setSaving]   = useState(false);

    async function submit(e) {
        e.preventDefault();
        if (!notes.trim()) return alert('Please write some notes.');
        try {
            setSaving(true);
            await addCareLog(animalId, { log_type: logType, notes });
            setNotes(''); setLogType('observation');
            onSaved();
        } catch (err) {
            alert('Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} style={{
            padding: '12px', background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(121,162,128,0.25)', borderRadius: '10px', marginBottom: '10px',
            display: 'grid', gap: '8px',
        }}>
            <FormField label="Type">
                <select className="glass-input" value={logType} onChange={e => setLogType(e.target.value)}>
                    <option value="observation">Observation</option>
                    <option value="feeding">Feeding</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="health_check">Health check</option>
                    <option value="medication_given">Medication given</option>
                    <option value="enrichment">Enrichment</option>
                    <option value="behavioral">Behavioral</option>
                    <option value="other">Other</option>
                </select>
            </FormField>
            <FormField label="Notes">
                <textarea className="glass-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Ate well at 9am, appetite normal." maxLength={1000} required />
            </FormField>
            <div style={{ textAlign: 'right' }}>
                <button type="submit" className="glass-button" disabled={saving}
                    style={{ background: GREEN, color: 'white' }}>
                    {saving ? 'Saving...' : 'Save care note'}
                </button>
            </div>
        </form>
    );
}

function FormField({ label, children, style }) {
    return (
        <div style={style}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', marginBottom: '3px' }}>
                {label}
            </label>
            {children}
        </div>
    );
}

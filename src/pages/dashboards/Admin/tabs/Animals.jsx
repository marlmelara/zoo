
import React, { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { Activity, Plus, X } from 'lucide-react';

export default function Animals() {
    const [animals, setAnimals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [zones, setZones] = useState([]);

    // Medical History State
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
        zone_id: ''
    });

    useEffect(() => {
        fetchAnimals();
        fetchZones();
    }, []);

    async function fetchAnimals() {
        try {
            const data = await api.get('/animals');
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
                animal_age_at_treatment: parseInt(historyForm.animal_age_at_treatment)
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
            await api.post('/animals', {
                ...formData,
                age: parseInt(formData.age),
                zone_id: parseInt(formData.zone_id),
            });
            setShowForm(false);
            setFormData({ name: '', species_common_name: '', species_binomial: '', age: '', zone_id: '' });
            fetchAnimals();
        } catch (error) {
            console.error('Error adding animal:', error);
            alert('Failed to add animal. See console.');
        }
    }

    const [searchTerm, setSearchTerm] = useState('');

    const filteredAnimals = animals.filter(animal =>
        animal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        animal.species_common_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        animal.species_binomial?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                    <h1 style={{ margin: 0 }}>Animals</h1>
                    <input
                        type="text"
                        placeholder="Search animals..."
                        className="glass-input"
                        style={{ maxWidth: '300px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    className="glass-button"
                    onClick={() => setShowForm(!showForm)}
                    style={{ background: showForm ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)' }}
                >
                    {showForm ? 'Cancel' : '+ Add Animal'}
                </button>
            </div>

            {showForm && (
                <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px', border: '1px solid var(--color-primary)' }}>
                    <h3>New Animal Profile</h3>
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
                        <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                            <button type="submit" className="glass-button" style={{ background: 'var(--color-primary)', width: '100%' }}>Save Animal</button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <p>Loading animals...</p>
            ) : animals.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <p>No animals found. Please execute the SQL migration script to create the tables.</p>
                </div>
            ) : (
                <div className="grid-cards">
                    {filteredAnimals.map(animal => (
                        <div key={animal.animal_id} className="glass-panel" style={{ padding: '20px', position: 'relative' }}>
                            <h3 style={{ margin: '0 0 10px' }}>{animal.name}</h3>
                            <p style={{ color: 'var(--color-primary)', fontSize: '14px', marginBottom: '15px' }}>{animal.species_common_name}</p>
                            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '15px' }}>
                                <p>Age: {animal.age} years</p>
                                <p>Zone: {animal.zone_name || 'Unassigned'}</p>
                            </div>
                            <button
                                className="glass-button"
                                style={{ width: '100%', fontSize: '12px', padding: '8px' }}
                                onClick={() => {
                                    setSelectedAnimal(animal);
                                    fetchMedicalHistory(animal);
                                }}
                            >
                                View Medical Records
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Medical History Modal */}
            {selectedAnimal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="glass-panel" style={{ width: '600px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', padding: '30px', background: '#0f172a', border: '1px solid var(--glass-border)' }}>
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
                                    <button type="submit" className="glass-button" style={{ background: 'var(--color-primary)', flex: 1 }}>Save</button>
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
            )}
        </div>
    );
}


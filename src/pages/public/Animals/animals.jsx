// Public "Our Animals" gallery — previously hard-coded to a static list of
// 29 stock species photos. Now pulls live from /api/animals (active only),
// grouped/filterable by animal_zones, so whatever's actually on site is
// what the guest sees. Per-animal image_url is rendered when present;
// names without a photo get a themed placeholder card.
import React, { useEffect, useMemo, useState } from 'react';
import { FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';
import { PawPrint } from 'lucide-react';
import logo from '../../../images/logo.png';
import './animals.css';
import Navbar from '../../../components/Navbar';

export default function AnimalGallery() {
    const [animals, setAnimals] = useState([]);
    const [zones,   setZones]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedZone, setSelectedZone] = useState('All Zones');
    const [selectedAnimal, setSelectedAnimal] = useState(null);

    useEffect(() => {
        // Public endpoint — no auth. Defaults to active animals only.
        Promise.all([
            fetch('/api/animals').then(r => r.ok ? r.json() : []),
            fetch('/api/animals/zones/all').then(r => r.ok ? r.json() : []),
        ])
            .then(([animalData, zoneData]) => {
                // Guard against departed animals sneaking in if the default
                // ever changes on the server — gallery is "who lives here".
                setAnimals((animalData || []).filter(a => a.is_active !== 0));
                setZones(zoneData || []);
            })
            .catch(err => console.error('Error loading animals page:', err))
            .finally(() => setLoading(false));
    }, []);

    // Zone dropdown options: "All Zones" + every zone present in the data,
    // alphabetized. Sourcing from the zones table (not animals.zone_name)
    // so empty zones still appear — helps guests who want to see if a
    // zone they read about is currently occupied or being refurbed.
    const zoneOptions = useMemo(() => {
        const names = zones.map(z => z.zone_name).filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        return ['All Zones', ...names];
    }, [zones]);

    const filteredAnimals = useMemo(() => {
        const q = selectedZone;
        const rows = q === 'All Zones'
            ? animals
            : animals.filter(a => a.zone_name === q);
        return rows.slice().sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
        );
    }, [animals, selectedZone]);

    return (
        <main className="animals-page">
            <Navbar />

            {selectedAnimal && (
                <div className="animal-popup-overlay" onClick={() => setSelectedAnimal(null)}>
                    <div className="animal-popup" onClick={e => e.stopPropagation()}>
                        <button className="animal-popup-close" onClick={() => setSelectedAnimal(null)}>✕</button>
                        {selectedAnimal.image_url ? (
                            <img src={selectedAnimal.image_url} alt={selectedAnimal.name} />
                        ) : (
                            <div style={{
                                width: '100%', aspectRatio: '4 / 3', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(123, 144, 79, 0.12)',
                                borderRadius: '12px', marginBottom: '16px', color: 'rgb(102, 122, 66)',
                            }}>
                                <PawPrint size={48} />
                            </div>
                        )}
                        <h2>{selectedAnimal.name}</h2>
                        <div className="animal-popup-names">
                            <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>
                                {selectedAnimal.species_common_name}
                            </p>
                            {selectedAnimal.species_binomial && (
                                <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--zoo-muted)' }}>
                                    {selectedAnimal.species_binomial}
                                </p>
                            )}
                            <span className="animal-popup-zone" style={{ marginTop: '10px' }}>
                                <FaMapMarkerAlt /> {selectedAnimal.zone_name || 'Unassigned'}
                            </span>
                            {typeof selectedAnimal.age === 'number' && (
                                <p style={{ marginTop: '12px', color: 'var(--zoo-muted)' }}>
                                    Age: <strong>{selectedAnimal.age}</strong> year{selectedAnimal.age === 1 ? '' : 's'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="animals-page-inner">
                <h1 className="animals-title">Our Animals</h1>

                <div className="zone-filter">
                    <label htmlFor="zone-select">Filter by Zone:</label>
                    <select
                        id="zone-select"
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        className="zone-select"
                    >
                        {zoneOptions.map(zone => (
                            <option key={zone} value={zone}>{zone}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--zoo-muted)' }}>
                        Loading the crew…
                    </p>
                ) : filteredAnimals.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--zoo-muted)', padding: '40px' }}>
                        No animals to show
                        {selectedZone !== 'All Zones' ? ` in ${selectedZone}` : ''} right now.
                    </p>
                ) : (
                    <section className="animals-grid">
                        {filteredAnimals.map(animal => (
                            <article
                                key={animal.animal_id}
                                className="animal-card"
                                onClick={() => setSelectedAnimal(animal)}
                                style={{ cursor: 'pointer' }}
                            >
                                {animal.image_url ? (
                                    <img
                                        src={animal.image_url}
                                        alt={animal.name}
                                        loading="lazy"
                                        onError={(e) => {
                                            // Swap broken images for the placeholder card.
                                            e.currentTarget.style.display = 'none';
                                            const placeholder = e.currentTarget.nextElementSibling;
                                            if (placeholder) placeholder.style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <div style={{
                                    width: '100%', aspectRatio: '4 / 3',
                                    display: animal.image_url ? 'none' : 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    background: 'linear-gradient(135deg, rgba(123,144,79,0.18) 0%, rgba(255, 245, 231, 0.9) 100%)',
                                    color: 'rgb(102, 122, 66)',
                                }}>
                                    <PawPrint size={48} />
                                </div>
                                <div className="animal-name">
                                    {animal.name}
                                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--zoo-muted)', marginTop: '4px' }}>
                                        {animal.species_common_name}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </div>

            <footer className="footer" style={{ background: 'rgb(123, 144, 79)' }}>
                <div className="footer-container">
                    <div className="footer-main">
                        <div className="footer-section footer-brand">
                            <div className="footer-logo">
                                <div className="logo-placeholder">
                                    <img src={logo} style={{ maxWidth: '200px', width: '100%', height: 'auto' }} alt="Coog Zoo" />
                                </div>
                            </div>
                            <p className="footer-description" style={{ color: 'white' }}>
                                Discover amazing wildlife, attend exciting events, and support animal conservation at Coog Zoo.
                            </p>
                        </div>

                        <div className="footer-section">
                            <h3 className="footer-title">Contact Us</h3>
                            <div className="footer-contact-info">
                                <div className="contact-item">
                                    <FaMapMarkerAlt className="contact-icon" style={{ color: 'white' }} />
                                    <div>
                                        <p>4302 University Dr</p>
                                        <p>Houston, TX 77004</p>
                                    </div>
                                </div>
                                <div className="contact-item">
                                    <FaPhone className="contact-icon" style={{ color: 'white' }} />
                                    <a href="tel:5555555555">555-555-5555</a>
                                </div>
                                <div className="contact-item">
                                    <FaEnvelope className="contact-icon" style={{ color: 'white' }} />
                                    <a href="mailto:info@coogzoo.org">info@coogzoo.org</a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="footer-bottom">
                        <div className="footer-bottom-content" style={{ color: 'white' }}>
                            <p>&copy; {new Date().getFullYear()} Coog Zoo. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}

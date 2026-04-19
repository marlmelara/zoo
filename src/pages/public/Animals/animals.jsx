import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaClock, FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';
import logo from '../../../images/logo.png';
import './animals.css';
import Navbar from '../../../components/Navbar';

// Import all animal images
import stVincentAmazonParrot from '../../../images/animals_amazon_parrot.jpg';
import greenAnaconda from '../../../images/animals_anaconda.jpg';
import blackMamba from '../../../images/animals_black_mamba.jpg';
import blueMacaw from '../../../images/animals_blue_macaw.jpg';
import easternBongo from '../../../images/animals_bongo.jpg';
import bonnetheadShark from '../../../images/animals_bonnethead_shark.jpg';
import chimpanzee from '../../../images/animals_chimp.jpg';
import cougar from '../../../images/animals_cougar.jpg';
import whoopingCrane from '../../../images/animals_crane.jpg';
import asianElephant from '../../../images/animals_elephant.jpg';
import ChileanFlamingo from '../../../images/animals_flamingo.jpg';
import masaiGiraffe from '../../../images/animals_giraffe.jpg';
import domesticatedGoat from '../../../images/animals_goat.jpeg';
import gorilla from '../../../images/animals_gorilla.jpg';
import humboldtPenguin from '../../../images/animals_humboldt_penguin.jpg';
import jaguar from '../../../images/animals_jaguar.jpg';
import komodoDragon from '../../../images/animals_komodo_dragon.jpg';
import africanLion from '../../../images/animals_lion.jpg';
import ocelot from '../../../images/animals_ocelot.jpg';
import orangutan from '../../../images/animals_orangutan.jpg';
import ostrich from '../../../images/animals_ostrich.jpg';
import paintedAfricanDog from '../../../images/animals_painted_dog.jpg';
import southerWhiteRhinoceros from '../../../images/animals_rhinoceros.jpg';
import northAmericanRiverOtter from '../../../images/animals_river_otter.jpg';
import siamang from '../../../images/animals_siamang.jpg';
import goldenHeadLiontamarin from '../../../images/animals_tamarin.jpg';
import houstonToad from '../../../images/animals_toad.jpg';
import africanSpurredTortoise from '../../../images/animals_tortoise.jpg';
import grantZebra from '../../../images/animals_zebra.jpg';

const animals = [
  { name: 'St. Vincent Amazon Parrot', src: stVincentAmazonParrot, zone: 'Birds of the World' },
  { name: 'Green Anaconda', src: greenAnaconda, zone: 'Reptile Lair' },
  { name: 'Black Mamba', src: blackMamba, zone: 'Reptile Lair' },
  { name: 'Blue Macaw', src: blueMacaw, zone: 'Birds of the World' },
  { name: 'Eastern Bongo', src: easternBongo, zone: 'Animals of Africa' },
  { name: 'Bonnethead Shark', src: bonnetheadShark, zone: 'Galapagos Islands' },
  { name: 'Chimpanzee', src: chimpanzee, zone: 'World of Primates' },
  { name: 'Cougar', src: cougar, zone: 'Big Cat Zone' },
  { name: 'Whooping Crane', src: whoopingCrane, zone: 'Birds of the World' },
  { name: 'Asian Elephant', src: asianElephant, zone: 'Elephants of Asia' },
  { name: 'Chilean Flamingo', src: ChileanFlamingo, zone: 'Birds of the World' },
  { name: 'Masai Giraffe', src: masaiGiraffe, zone: 'Animals of Africa' },
  { name: 'Domesticated Goat', src: domesticatedGoat, zone: "Children's Zoo" },
  { name: 'Gorilla', src: gorilla, zone: 'World of Primates' },
  { name: 'Humboldt Penguin', src: humboldtPenguin, zone: 'Galapagos Islands' },
  { name: 'Jaguar', src: jaguar, zone: 'Big Cat Zone' },
  { name: 'Komodo Dragon', src: komodoDragon, zone: 'Reptile Lair' },
  { name: 'African Lion', src: africanLion, zone: 'Big Cat Zone' },
  { name: 'Ocelot', src: ocelot, zone: 'Big Cat Zone' },
  { name: 'Orangutan', src: orangutan, zone: 'World of Primates' },
  { name: 'Ostrich', src: ostrich, zone: 'Animals of Africa' },
  { name: 'Painted African Dog', src: paintedAfricanDog, zone: 'Animals of Africa' },
  { name: 'Southern White Rhinoceros', src: southerWhiteRhinoceros, zone: 'Animals of Africa' },
  { name: 'North American River Otter', src: northAmericanRiverOtter, zone: "Children's Zoo" },
  { name: 'Siamang', src: siamang, zone: 'World of Primates' },
  { name: 'Golden-Head Liontamarin', src: goldenHeadLiontamarin, zone: 'World of Primates' },
  { name: 'Houston Toad', src: houstonToad, zone: "Children's Zoo" },
  { name: 'African Spurred Tortoise', src: africanSpurredTortoise, zone: 'Reptile Lair' },
  { name: 'Grant\'s Zebra', src: grantZebra, zone: 'Animals of Africa' },
].sort((a, b) => a.name.localeCompare(b.name));

export default function AnimalGallery() {
  const [selectedZone, setSelectedZone] = useState('All Zones');
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [dbAnimals, setDbAnimals] = useState([]);
  useEffect(() => {
    fetch('/api/animals')
      .then(res => res.json())
      .then(data => setDbAnimals(data))
      .catch(err => console.error(err));
  }, []);

  const zones = ['All Zones', 'World of Primates', 'Elephants of Asia', 'Big Cat Zone', 'Reptile Lair', 'Animals of Africa', "Children's Zoo", 'Birds of the World', 'Galapagos Islands'];

  const filteredAnimals = selectedZone === 'All Zones'
    ? animals
    : animals.filter(animal => animal.zone === selectedZone);

  return (
    <main className="animals-page">
      <Navbar />

      {/* Popup */}
      {selectedAnimal && (
        <div className="animal-popup-overlay" onClick={() => setSelectedAnimal(null)}>
          <div className="animal-popup" onClick={e => e.stopPropagation()}>
            <button className="animal-popup-close" onClick={() => setSelectedAnimal(null)}>✕</button>
            <img src={selectedAnimal.src} alt={selectedAnimal.name} />
            <h2>{selectedAnimal.name}</h2>
            <div className="animal-popup-names">
              {(() => {
                const names = dbAnimals
                  .filter(a => a.species_common_name === selectedAnimal.name && a.is_active === 1)
                  .map(a => a.name);
                return names.length === 0
                  ? <p>None currently at the zoo</p>
                  : <p>Meet our {selectedAnimal.name}{names.length > 1 ? 's' : ''}: {names.join(', ')}</p>;
              })()}
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
            {zones.map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </div>

        <section className="animals-grid">
          {filteredAnimals.map(animal => (
            <article
              key={animal.name}
              className="animal-card"
              onClick={() => setSelectedAnimal(animal)}
              style={{ cursor: 'pointer' }}
            >
              <img src={animal.src} alt={animal.name} loading="lazy" />
              <div className="animal-name">{animal.name}</div>
            </article>
          ))}
        </section>
      </div>
      {/* Footer */}
            <footer className="footer" style={{background: "rgb(123, 144, 79)"}}>
              <div className="footer-container">
                <div className="footer-main">
                  <div className="footer-section footer-brand">
                    <div className="footer-logo">
                      <div className="logo-placeholder">
                        <img src={logo} style={{ maxWidth: '200px', width: '100%', height: 'auto' }} alt="Coog Zoo" />
                      </div>
                    </div>
                    <p className="footer-description" style={{color:"white"}}>
                      Discover amazing wildlife, attend exciting events, and support animal conservation at Coog Zoo.
                    </p>
                  </div>
      
                  <div className="footer-section">
                    <h3 className="footer-title">Contact Us</h3>
                    <div className="footer-contact-info">
                      <div className="contact-item">
                        <FaMapMarkerAlt className="contact-icon" style={{color:"white"}} />
                        <div>
                          <p>4302 University Dr</p>
                          <p>Houston, TX 77004</p>
                        </div>
                      </div>
                      <div className="contact-item">
                        <FaPhone className="contact-icon" style={{color:"white"}} />
                        <a href="tel:5555555555">555-555-5555</a>
                      </div>
                      <div className="contact-item">
                        <FaEnvelope className="contact-icon" style={{color:"white"}}/>
                        <a href="mailto:info@coogzoo.org">info@coogzoo.org</a>
                      </div>
                    </div>
                  </div>
                </div>
      
                <div className="footer-bottom">
                  <div className="footer-bottom-content" style={{color:"white"}}>
                    <p>&copy; {new Date().getFullYear()} Coog Zoo. All rights reserved.</p>
                  </div>
                </div>
              </div>
            </footer>
    </main>
  );
}

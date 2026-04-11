import React from 'react';
import './animals.css';

// Import all animal images
import amazonParrot from '../../../images/animals_amazon_parrot.jpg';
import anaconda from '../../../images/animals_anaconda.jpg';
import blackMamba from '../../../images/animals_black_mamba.jpg';
import blueMacaw from '../../../images/animals_blue_macaw.jpg';
import bongo from '../../../images/animals_bongo.jpg';
import bonnetheadShark from '../../../images/animals_bonnethead_shark.jpg';
import chimp from '../../../images/animals_chimp.jpg';
import cougar from '../../../images/animals_cougar.jpg';
import crane from '../../../images/animals_crane.jpg';
import elephant from '../../../images/animals_elephant.jpg';
import flamingo from '../../../images/animals_flamingo.jpg';
import giraffe from '../../../images/animals_giraffe.jpg';
import goat from '../../../images/animals_goat.jpeg';
import gorilla from '../../../images/animals_gorilla.jpg';
import humboldtPenguin from '../../../images/animals_humboldt_penguin.jpg';
import jaguar from '../../../images/animals_jaguar.jpg';
import komodoDragon from '../../../images/animals_komodo_dragon.jpg';
import lion from '../../../images/animals_lion.jpg';
import ocelot from '../../../images/animals_ocelot.jpg';
import orangutan from '../../../images/animals_orangutan.jpg';
import ostrich from '../../../images/animals_ostrich.jpg';
import paintedDog from '../../../images/animals_painted_dog.jpg';
import rhinoceros from '../../../images/animals_rhinoceros.jpg';
import riverOtter from '../../../images/animals_river_otter.jpg';
import siamang from '../../../images/animals_siamang.jpg';
import tamarin from '../../../images/animals_tamarin.jpg';
import toad from '../../../images/animals_toad.jpg';
import tortoise from '../../../images/animals_tortoise.jpg';
import zebra from '../../../images/animals_zebra.jpg';

const animals = [
  { name: 'Amazon Parrot', src: amazonParrot },
  { name: 'Anaconda', src: anaconda },
  { name: 'Black Mamba', src: blackMamba },
  { name: 'Blue Macaw', src: blueMacaw },
  { name: 'Bongo', src: bongo },
  { name: 'Bonnethead Shark', src: bonnetheadShark },
  { name: 'Chimp', src: chimp },
  { name: 'Cougar', src: cougar },
  { name: 'Crane', src: crane },
  { name: 'Elephant', src: elephant },
  { name: 'Flamingo', src: flamingo },
  { name: 'Giraffe', src: giraffe },
  { name: 'Goat', src: goat },
  { name: 'Gorilla', src: gorilla },
  { name: 'Humboldt Penguin', src: humboldtPenguin },
  { name: 'Jaguar', src: jaguar },
  { name: 'Komodo Dragon', src: komodoDragon },
  { name: 'Lion', src: lion },
  { name: 'Ocelot', src: ocelot },
  { name: 'Orangutan', src: orangutan },
  { name: 'Ostrich', src: ostrich },
  { name: 'Painted Dog', src: paintedDog },
  { name: 'Rhinoceros', src: rhinoceros },
  { name: 'River Otter', src: riverOtter },
  { name: 'Siamang', src: siamang },
  { name: 'Tamarin', src: tamarin },
  { name: 'Toad', src: toad },
  { name: 'Tortoise', src: tortoise },
  { name: 'Zebra', src: zebra },
].sort((a, b) => a.name.localeCompare(b.name));

export default function AnimalGallery() {
  return (
    <main className="animals-page">
      <div className="animals-hero">
        <h1>Our Animals</h1>
      </div>

      <section className="animals-grid">
        {animals.map(animal => (
          <article key={animal.name} className="animal-card">
            <img src={animal.src} alt={animal.name} loading="lazy" />
            <div className="animal-name">{animal.name}</div>
          </article>
        ))}
      </section>
    </main>
  );
}

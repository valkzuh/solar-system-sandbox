// Templates for bodies the user can create in the sandbox.

import { MEARTH, MSUN, MJUP, RSUN, REARTH, G } from '../core/constants.js';
import { PROC } from './catalog.js';
import { planetRadiusFromMass, msLuminosity, msRadius, effectiveTemperature, schwarzschildRadiusKm, luminosityFromRT } from '../core/stellar.js';

const GAS_PALETTES = [
  { c1: [0.82, 0.72, 0.58], c2: [0.62, 0.45, 0.32], c3: [0.95, 0.9, 0.82] }, // Jovian
  { c1: [0.88, 0.8, 0.62], c2: [0.76, 0.66, 0.48], c3: [0.95, 0.9, 0.78] }, // Saturnian
  { c1: [0.3, 0.22, 0.2], c2: [0.14, 0.1, 0.1], c3: [0.5, 0.3, 0.2] }, // Hot Jupiter (dark)
  { c1: [0.7, 0.72, 0.85], c2: [0.45, 0.5, 0.7], c3: [0.9, 0.92, 1.0] }, // Cold, ammonia-rich
];
const ICE_PALETTES = [
  { c1: [0.62, 0.82, 0.86], c2: [0.55, 0.76, 0.82], c3: [0.8, 0.92, 0.95] },
  { c1: [0.25, 0.4, 0.85], c2: [0.2, 0.32, 0.7], c3: [0.6, 0.72, 0.95] },
];

export const TEMPLATES = [
  {
    id: 'terran', group: 'Planets', name: 'Terrestrial world', icon: '🌍', desc: 'Earth-like: oceans, continents, clouds, air.',
    make: (seed, m = 1) => ({ kind: 'planet', mass: m * MEARTH, radius: planetRadiusFromMass(m) * REARTH, albedo: 0.3, geoAlbedo: 0.37, greenhouse: 33, atmosphere: 'earth',
      appearance: { proc: { type: PROC.TERRESTRIAL, seed, water: 0.62, ice: 0.12, clouds: 0.45 } }, massRange: [0.05, 10] }),
  },
  {
    id: 'ocean', group: 'Planets', name: 'Ocean world', icon: '🌊', desc: 'Global ocean with scattered islands.',
    make: (seed, m = 2) => ({ kind: 'planet', mass: m * MEARTH, radius: planetRadiusFromMass(m) * REARTH * 1.05, albedo: 0.28, geoAlbedo: 0.3, greenhouse: 40, atmosphere: 'earth',
      appearance: { proc: { type: PROC.TERRESTRIAL, seed, water: 0.97, ice: 0.08, clouds: 0.6 } } }),
  },
  {
    id: 'desert', group: 'Planets', name: 'Desert world', icon: '🏜️', desc: 'Dry, dusty and cratered, thin air.',
    make: (seed, m = 0.3) => ({ kind: 'planet', mass: m * MEARTH, radius: planetRadiusFromMass(m) * REARTH, albedo: 0.25, geoAlbedo: 0.2, greenhouse: 5, atmosphere: 'mars',
      appearance: { proc: { type: PROC.ROCKY, seed, c1: [0.62, 0.36, 0.2], c2: [0.42, 0.24, 0.14], c3: [0.85, 0.7, 0.55], craters: 0.4, detail: 0.6, maria: 0.4 } } }),
  },
  {
    id: 'lava', group: 'Planets', name: 'Lava world', icon: '🌋', desc: 'Molten surface glowing with thermal emission.',
    make: (seed, m = 1.5) => ({ kind: 'planet', mass: m * MEARTH, radius: planetRadiusFromMass(m) * REARTH, albedo: 0.1, geoAlbedo: 0.1, heat: 1400,
      appearance: { proc: { type: PROC.LAVA, seed } } }),
  },
  {
    id: 'ice', group: 'Planets', name: 'Ice world', icon: '🧊', desc: 'Frozen crust crossed by fractures.',
    make: (seed, m = 0.5) => ({ kind: 'planet', mass: m * MEARTH, radius: planetRadiusFromMass(m) * REARTH * 1.15, albedo: 0.65, geoAlbedo: 0.7,
      appearance: { proc: { type: PROC.ICY, seed, c1: [0.9, 0.93, 0.97], c2: [0.55, 0.62, 0.72], c3: [1, 1, 1], lineae: 0.8, craters: 0.3 } } }),
  },
  {
    id: 'gas', group: 'Planets', name: 'Gas giant', icon: '🪐', desc: 'Banded hydrogen–helium giant.',
    make: (seed, m = 318) => ({ kind: 'planet', mass: m * MEARTH, radius: planetRadiusFromMass(m) * REARTH, flattening: 0.06, albedo: 0.34, geoAlbedo: 0.5, greenhouse: 15, atmosphere: 'jupiter',
      appearance: { proc: { type: PROC.GAS, seed, turbulence: 0.6, ...GAS_PALETTES[seed % GAS_PALETTES.length] } } }),
  },
  {
    id: 'ringed', group: 'Planets', name: 'Ringed giant', icon: '💫', desc: 'Gas giant with a broad ice ring system.',
    make: (seed, m = 95) => {
      const r = planetRadiusFromMass(m) * REARTH;
      return { kind: 'planet', mass: m * MEARTH, radius: r, flattening: 0.09, albedo: 0.34, geoAlbedo: 0.5, atmosphere: 'saturn',
        rings: { inner: r * 1.3, outer: r * 2.4, tint: [0.82, 0.76, 0.66], opacity: 0.9 },
        appearance: { proc: { type: PROC.GAS, seed, turbulence: 0.3, ...GAS_PALETTES[1] } } };
    },
  },
  {
    id: 'icegiant', group: 'Planets', name: 'Ice giant', icon: '🔵', desc: 'Methane-tinted Neptune-class world.',
    make: (seed, m = 17) => ({ kind: 'planet', mass: m * MEARTH, radius: planetRadiusFromMass(m) * REARTH, flattening: 0.02, albedo: 0.29, geoAlbedo: 0.44, atmosphere: 'neptune',
      appearance: { proc: { type: PROC.ICE_GIANT, seed, turbulence: 0.25, ...ICE_PALETTES[seed % ICE_PALETTES.length] } } }),
  },
  {
    id: 'moon', group: 'Small bodies', name: 'Cratered moon', icon: '🌑', desc: 'Airless, heavily cratered.',
    make: (seed, m = 0.0123) => ({ kind: 'moon', mass: m * MEARTH, radius: planetRadiusFromMass(m) * REARTH * 1.05, albedo: 0.12, geoAlbedo: 0.12,
      appearance: { proc: { type: PROC.ROCKY, seed, c1: [0.45, 0.44, 0.42], c2: [0.3, 0.29, 0.28], c3: [0.7, 0.7, 0.68], craters: 1.0, detail: 0.9, maria: 0.5 } } }),
  },
  {
    id: 'asteroid', group: 'Small bodies', name: 'Asteroid', icon: '🪨', desc: 'Irregular rubble pile.',
    make: (seed, m = 1e-9) => {
      const r = Math.cbrt((m * MEARTH) / ((4 / 3) * Math.PI * 2.5e12));
      return { kind: 'asteroid', mass: m * MEARTH, radius: r, albedo: 0.1, geoAlbedo: 0.12, shape: [r * 1.35, r * 1.0, r * 0.75],
        rotation: { periodH: 4 + (seed % 20), poleRA: seed * 37 % 360, poleDec: 20, W0: 0 },
        appearance: { proc: { type: PROC.ROCKY, seed, c1: [0.4, 0.37, 0.33], c2: [0.25, 0.23, 0.21], c3: [0.55, 0.52, 0.48], craters: 1.0, detail: 1.0 } } };
    },
  },
  {
    id: 'comet', group: 'Small bodies', name: 'Comet', icon: '☄️', desc: 'Icy nucleus that grows a tail near a star.',
    make: (seed) => ({ kind: 'comet', mass: 2e14, radius: 5, albedo: 0.04, geoAlbedo: 0.04, massless: true, comet: { activity: 1.2 }, shape: [7, 5, 4],
      rotation: { periodH: 30, poleRA: 30, poleDec: 40, W0: 0 },
      appearance: { proc: { type: PROC.NUCLEUS, seed, c1: [0.22, 0.2, 0.19], c2: [0.12, 0.11, 0.1], c3: [0.3, 0.28, 0.26], craters: 0.5, detail: 1.0 } } }),
  },
  {
    id: 'reddwarf', group: 'Stars', name: 'Red dwarf', icon: '🔴', desc: 'M-type: small, cool, long-lived.',
    make: (seed, m = 0.2) => starSpec(m),
  },
  {
    id: 'sunlike', group: 'Stars', name: 'Sun-like star', icon: '🌞', desc: 'G-type main-sequence star.',
    make: (seed, m = 1) => starSpec(m),
  },
  {
    id: 'bluegiant', group: 'Stars', name: 'Blue giant', icon: '🔷', desc: 'Massive O/B star; can go supernova.',
    make: (seed, m = 18) => starSpec(m),
  },
  {
    id: 'browndwarf', group: 'Stars', name: 'Brown dwarf', icon: '🟤', desc: 'Failed star glowing from contraction heat.',
    make: (seed, m = 0.05) => ({ kind: 'star', mass: m * MSUN, radius: 0.1 * RSUN, star: { temperature: 1300, luminosity: luminosityFromRT(0.1, 1300) }, fixedStar: true }),
  },
  {
    id: 'whitedwarf', group: 'Stars', name: 'White dwarf', icon: '⚪', desc: 'Earth-sized stellar ember.',
    make: (seed, m = 0.6) => ({ kind: 'whitedwarf', mass: m * MSUN, radius: 0.0126 * RSUN, star: { temperature: 20000, luminosity: luminosityFromRT(0.0126, 20000) } }),
  },
  {
    id: 'neutron', group: 'Stars', name: 'Neutron star', icon: '✴️', desc: '1.4 solar masses in a 12 km sphere.',
    make: () => ({ kind: 'neutron', mass: 1.4 * MSUN, radius: 12, star: { temperature: 600000, luminosity: luminosityFromRT(12 / RSUN, 600000) } }),
  },
  {
    id: 'blackhole', group: 'Exotic', name: 'Black hole', icon: '⚫', desc: 'Stellar-mass black hole; lenses the sky.',
    make: (seed, m = 10) => ({ kind: 'blackhole', mass: m * MSUN, radius: schwarzschildRadiusKm(m * MSUN) }),
  },
  {
    id: 'smbh', group: 'Exotic', name: 'Supermassive black hole', icon: '🕳️', desc: 'Sagittarius A*-class: 4 million suns.',
    make: (seed, m = 4.15e6) => ({ kind: 'blackhole', mass: m * MSUN, radius: schwarzschildRadiusKm(m * MSUN) }),
  },
];

export function starSpec(mSun) {
  const l = msLuminosity(mSun);
  const r = msRadius(mSun);
  return { kind: 'star', mass: mSun * MSUN, radius: r * RSUN, star: { luminosity: l, temperature: effectiveTemperature(l, r) } };
}

export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

export { MEARTH, MSUN, MJUP, G };

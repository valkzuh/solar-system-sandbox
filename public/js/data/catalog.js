// Physical and orbital data for real solar system bodies.
//
// GM values: JPL DE440 / SSD satellite ephemerides (km^3/s^2).
// Radii: IAU WGCCRE 2015 mean radii (km). Albedos: NASA planetary fact sheets.
// Moon orbits without a high-precision theory in astronomy-engine are given as
// mean elements relative to the parent's equator (a km, e, i deg, period days).

import { TSUN } from '../core/constants.js';

const T = (file) => `assets/textures/${file}`;

// Procedural surface presets. `type` indices are interpreted by the planet shader.
export const PROC = {
  NONE: 0,
  ROCKY: 1,
  ICY: 2,
  VOLCANIC: 3,
  TERRESTRIAL: 4,
  GAS: 5,
  ICE_GIANT: 6,
  LAVA: 7,
  HAZE: 8,
  DESERT: 9,
  NUCLEUS: 10,
};

export const ATMOSPHERES = {
  earth: { height: 100, rayleigh: [5.802e-3, 13.558e-3, 33.1e-3], rayleighH: 8.0, mie: 3.996e-3, mieH: 1.2, mieG: 0.8, mieColor: [1, 1, 1], absorb: [0.65e-3, 1.881e-3, 0.085e-3], absorbH: 25 },
  mars: { height: 80, rayleigh: [0.19e-3, 0.1e-3, 0.058e-3], rayleighH: 11.1, mie: 0.03, mieH: 11.1, mieG: 0.65, mieColor: [1.0, 0.62, 0.38], absorb: [0, 0, 0], absorbH: 10 },
  venus: { height: 250, rayleigh: [0.9e-3, 0.62e-3, 0.3e-3], rayleighH: 15.9, mie: 0.9e-3, mieH: 22, mieG: 0.7, mieColor: [1.0, 0.86, 0.62], absorb: [0, 0.02e-3, 0.08e-3], absorbH: 20 },
  titan: { height: 600, rayleigh: [0.12e-3, 0.06e-3, 0.02e-3], rayleighH: 40, mie: 0.06, mieH: 55, mieG: 0.6, mieColor: [1.0, 0.6, 0.25], absorb: [0.0, 0.03e-3, 0.09e-3], absorbH: 60 },
  jupiter: { height: 600, rayleigh: [0.02e-3, 0.035e-3, 0.08e-3], rayleighH: 27, mie: 0.02e-3, mieH: 27, mieG: 0.7, mieColor: [1.0, 0.9, 0.8], absorb: [0, 0, 0], absorbH: 27 },
  saturn: { height: 800, rayleigh: [0.012e-3, 0.02e-3, 0.045e-3], rayleighH: 59.5, mie: 0.02e-3, mieH: 59.5, mieG: 0.7, mieColor: [1.0, 0.92, 0.75], absorb: [0, 0, 0], absorbH: 59 },
  uranus: { height: 500, rayleigh: [0.02e-3, 0.06e-3, 0.08e-3], rayleighH: 27.7, mie: 0.01e-3, mieH: 27.7, mieG: 0.7, mieColor: [0.8, 1.0, 1.0], absorb: [0.02e-3, 0, 0], absorbH: 27 },
  neptune: { height: 450, rayleigh: [0.015e-3, 0.05e-3, 0.12e-3], rayleighH: 19.7, mie: 0.01e-3, mieH: 19.7, mieG: 0.7, mieColor: [0.8, 0.9, 1.0], absorb: [0.03e-3, 0, 0], absorbH: 20 },
  pluto: { height: 200, rayleigh: [0.004e-3, 0.012e-3, 0.03e-3], rayleighH: 50, mie: 0.001e-3, mieH: 50, mieG: 0.6, mieColor: [0.8, 0.9, 1.0], absorb: [0, 0, 0], absorbH: 50 },
  thin: { height: 60, rayleigh: [2.9e-3, 6.8e-3, 16.5e-3], rayleighH: 8.0, mie: 2e-3, mieH: 1.2, mieG: 0.8, mieColor: [1, 1, 1], absorb: [0, 0, 0], absorbH: 25 },
  thick: { height: 200, rayleigh: [1.2e-3, 0.9e-3, 0.5e-3], rayleighH: 15, mie: 1.2e-3, mieH: 20, mieG: 0.7, mieColor: [1.0, 0.9, 0.7], absorb: [0, 0, 0.02e-3], absorbH: 20 },
};

/*
 * Body spec fields:
 *   id, name, kind: star | planet | dwarf | moon | asteroid | comet
 *   parent: id of the body it orbits (for hierarchy/initialisation)
 *   gm (km^3/s^2), radius (km), flattening
 *   albedo: Bond albedo (energy balance); geoAlbedo: geometric albedo (brightness)
 *   greenhouse: K added to equilibrium temperature (atmosphere / internal heat)
 *   ephem: 'astronomy' (planets via VSOP87), 'moon', 'jupiterMoon', 'elements', 'heliocentric-elements'
 *   rotation: { iau: 'Earth' } | { locked: true } | { periodH, poleRA, poleDec, W0 }
 *   appearance: textures / procedural preset
 */
export const SOLAR_SYSTEM = [
  {
    id: 'sun', j2: 2.2e-07, j2Radius: 695700, name: 'Sun', kind: 'star', gm: 132712440041.279419, radius: 695700,
    star: { temperature: TSUN, luminosity: 1 }, rotation: { iau: 'Sun' }, ephem: 'astronomy', iau: 'Sun',
    info: 'G2V main-sequence star. 99.86% of the solar system mass.',
  },
  {
    id: 'mercury', name: 'Mercury', kind: 'planet', parent: 'sun', gm: 22031.868551, radius: 2439.4,
    albedo: 0.088, geoAlbedo: 0.142, greenhouse: 0, ephem: 'astronomy', iau: 'Mercury', rotation: { iau: 'Mercury' },
    appearance: { map: T('mercurymap.jpg'), bump: T('mercurybump.jpg'), bumpScale: 1.2, lonOffset: 0.0, proc: { type: PROC.ROCKY, seed: 11, craters: 0.35, detail: 0.6 } },
    info: 'Smallest planet; 3:2 spin-orbit resonance, 430 °C days and −180 °C nights.',
  },
  {
    id: 'venus', name: 'Venus', kind: 'planet', parent: 'sun', gm: 324858.592, radius: 6051.8,
    albedo: 0.76, geoAlbedo: 0.689, greenhouse: 505, ephem: 'astronomy', iau: 'Venus', rotation: { iau: 'Venus' },
    atmosphere: 'venus',
    appearance: { map: T('venusmap.jpg'), bump: T('venusbump.jpg'), bumpScale: 0.6, clouds: 'venus', proc: { type: PROC.HAZE, seed: 21, c1: [0.93, 0.86, 0.7], c2: [0.85, 0.74, 0.55], c3: [0.98, 0.95, 0.85], bands: 0.35 } },
    info: 'Runaway greenhouse: 92 bar CO₂ atmosphere, sulfuric acid clouds, 464 °C surface. Rotates retrograde once every 243 days.',
  },
  {
    id: 'earth', j2: 0.00108263, j2Radius: 6378.137, name: 'Earth', kind: 'planet', parent: 'sun', gm: 398600.435436, radius: 6371.0084, flattening: 1 / 298.257,
    albedo: 0.306, geoAlbedo: 0.367, greenhouse: 33, ephem: 'astronomy', iau: 'Earth', rotation: { iau: 'Earth' },
    atmosphere: 'earth',
    appearance: { special: 'earth', map: T('earth_day_4k.jpg'), night: T('earth_night_4k.jpg'), packed: T('earth_bump_rough_clouds_4k.jpg') },
    info: 'Our home. The only known world with surface liquid water oceans and life.',
  },
  {
    id: 'moon', j2: 0.0002033, j2Radius: 1738.0, name: 'Moon', kind: 'moon', parent: 'earth', gm: 4902.800066, radius: 1737.4,
    albedo: 0.11, geoAlbedo: 0.12, greenhouse: 0, ephem: 'moon', iau: 'Moon', rotation: { iau: 'Moon' },
    appearance: { map: T('moon_1k.jpg'), bump: T('moonbump1k.jpg'), bumpScale: 1.0, proc: { type: PROC.ROCKY, seed: 31, craters: 0.25, detail: 0.5 } },
    info: 'Tidally locked; stabilises Earth’s axial tilt. Formed ~4.5 Gyr ago in a giant impact.',
  },
  {
    id: 'mars', j2: 0.00195545, j2Radius: 3396.19, name: 'Mars', kind: 'planet', parent: 'sun', gm: 42828.375214, radius: 3389.5, flattening: 0.00589,
    albedo: 0.25, geoAlbedo: 0.17, greenhouse: 5, ephem: 'astronomy', iau: 'Mars', rotation: { iau: 'Mars' },
    atmosphere: 'mars',
    appearance: { map: T('mars_1k_color.jpg'), bump: T('mars_1k_topo.jpg'), bumpScale: 2.2, lonOffset: 0.5, proc: { type: PROC.ROCKY, seed: 41, craters: 0.2, detail: 0.5 } },
    info: 'Cold desert world with Olympus Mons, Valles Marineris and polar CO₂/water ice caps.',
  },
  {
    id: 'phobos', name: 'Phobos', kind: 'moon', parent: 'mars', gm: 7.087546066894452e-4, radius: 11.08,
    albedo: 0.071, geoAlbedo: 0.071, ephem: 'elements', orbit: { a: 9376, e: 0.0151, i: 1.075, periodDays: 0.31891 }, rotation: { locked: true },
    shape: [13.0, 11.4, 9.1],
    appearance: { proc: { type: PROC.ROCKY, seed: 51, c1: [0.36, 0.33, 0.3], c2: [0.25, 0.23, 0.21], c3: [0.45, 0.42, 0.38], craters: 1.0, detail: 1.0 } },
    info: 'Spiralling inward; will be torn apart into a ring in ~30-50 Myr.',
  },
  {
    id: 'deimos', name: 'Deimos', kind: 'moon', parent: 'mars', gm: 9.615569648120313e-5, radius: 6.2,
    albedo: 0.068, geoAlbedo: 0.068, ephem: 'elements', orbit: { a: 23458, e: 0.00033, i: 1.788, periodDays: 1.26244 }, rotation: { locked: true },
    shape: [7.8, 6.0, 5.1],
    appearance: { proc: { type: PROC.ROCKY, seed: 52, c1: [0.4, 0.36, 0.32], c2: [0.3, 0.27, 0.24], c3: [0.5, 0.46, 0.4], craters: 0.6, detail: 0.7 } },
    info: 'Smooth, regolith-blanketed captured(?) moonlet.',
  },
  {
    id: 'ceres', name: 'Ceres', kind: 'dwarf', parent: 'sun', gm: 62.6284, radius: 469.7, flattening: 0.075,
    albedo: 0.034, geoAlbedo: 0.09, ephem: 'heliocentric-elements',
    helio: { a: 2.7672, e: 0.0785, i: 10.588, node: 80.268, argp: 73.638, M: 291.3, epochJD: 2459600.5 },
    rotation: { periodH: 9.07417, poleRA: 291.418, poleDec: 66.764, W0: 170.65 },
    appearance: { proc: { type: PROC.ROCKY, seed: 61, c1: [0.3, 0.3, 0.29], c2: [0.22, 0.22, 0.21], c3: [0.95, 0.95, 0.92], craters: 0.8, detail: 0.8, spots: 0.6 } },
    info: 'Largest asteroid-belt object; bright sodium-carbonate spots in Occator crater.',
  },
  {
    id: 'vesta', name: 'Vesta', kind: 'asteroid', parent: 'sun', gm: 17.2882, radius: 262.7,
    albedo: 0.2, geoAlbedo: 0.42, ephem: 'heliocentric-elements', shape: [286.3, 278.6, 223.2],
    helio: { a: 2.3615, e: 0.0887, i: 7.142, node: 103.81, argp: 151.2, M: 169.4, epochJD: 2459600.5 },
    rotation: { periodH: 5.342128, poleRA: 309.031, poleDec: 42.235, W0: 285.39 },
    appearance: { proc: { type: PROC.ROCKY, seed: 62, c1: [0.55, 0.52, 0.47], c2: [0.4, 0.37, 0.33], c3: [0.7, 0.67, 0.6], craters: 0.9, detail: 1.0 } },
    info: 'Differentiated protoplanet with the giant Rheasilvia impact basin.',
  },
  {
    id: 'pallas', name: 'Pallas', kind: 'asteroid', parent: 'sun', gm: 13.63, radius: 256,
    albedo: 0.1, geoAlbedo: 0.15, ephem: 'heliocentric-elements', shape: [283, 263, 224],
    helio: { a: 2.773, e: 0.2302, i: 34.84, node: 172.9, argp: 310.9, M: 136.3, epochJD: 2459600.5 },
    rotation: { periodH: 7.8132, poleRA: 33, poleDec: -3, W0: 0 },
    appearance: { proc: { type: PROC.ROCKY, seed: 63, c1: [0.34, 0.34, 0.34], c2: [0.25, 0.25, 0.25], c3: [0.45, 0.45, 0.44], craters: 0.9, detail: 1.0 } },
    info: 'Highly inclined (35°) B-type asteroid.',
  },
  {
    id: 'hygiea', name: 'Hygiea', kind: 'asteroid', parent: 'sun', gm: 5.78, radius: 216,
    albedo: 0.07, geoAlbedo: 0.07, ephem: 'heliocentric-elements',
    helio: { a: 3.1415, e: 0.1125, i: 3.832, node: 283.2, argp: 312.3, M: 205.0, epochJD: 2459600.5 },
    rotation: { periodH: 13.83, poleRA: 305, poleDec: 50, W0: 0 },
    appearance: { proc: { type: PROC.ROCKY, seed: 64, c1: [0.24, 0.24, 0.23], c2: [0.18, 0.18, 0.17], c3: [0.32, 0.32, 0.31], craters: 0.7, detail: 0.8 } },
    info: 'Nearly spherical C-type asteroid; a dwarf-planet candidate.',
  },
  {
    id: 'jupiter', j2: 0.01469643, j2Radius: 71492, name: 'Jupiter', kind: 'planet', parent: 'sun', gm: 126686531.9, radius: 69911, flattening: 0.06487,
    albedo: 0.343, geoAlbedo: 0.538, greenhouse: 15, ephem: 'astronomy', iau: 'Jupiter', rotation: { iau: 'Jupiter' },
    atmosphere: 'jupiter',
    appearance: { map: T('jupitermap.jpg'), lonOffset: 0.0, proc: { type: PROC.GAS, seed: 71, turbulence: 0.55, detailOnly: true } },
    info: 'Gas giant with 2.5× the mass of all other planets combined; the Great Red Spot is a centuries-old storm.',
  },
  {
    id: 'io', name: 'Io', kind: 'moon', parent: 'jupiter', gm: 5959.9155, radius: 1821.49,
    albedo: 0.63, geoAlbedo: 0.63, ephem: 'jupiterMoon', jupiterIndex: 0, rotation: { locked: true },
    appearance: { proc: { type: PROC.VOLCANIC, seed: 81, c1: [0.93, 0.85, 0.45], c2: [0.85, 0.55, 0.2], c3: [0.98, 0.97, 0.85] } },
    info: 'Most volcanically active body known, heated by tidal flexing in the Laplace resonance.',
  },
  {
    id: 'europa', name: 'Europa', kind: 'moon', parent: 'jupiter', gm: 3202.7121, radius: 1560.8,
    albedo: 0.68, geoAlbedo: 0.67, ephem: 'jupiterMoon', jupiterIndex: 1, rotation: { locked: true },
    appearance: { proc: { type: PROC.ICY, seed: 82, c1: [0.92, 0.88, 0.8], c2: [0.62, 0.42, 0.28], c3: [0.98, 0.97, 0.95], lineae: 1.0, craters: 0.05 } },
    info: 'Young ice shell over a global salty ocean — a prime target in the search for life.',
  },
  {
    id: 'ganymede', name: 'Ganymede', kind: 'moon', parent: 'jupiter', gm: 9887.8328, radius: 2631.2,
    albedo: 0.43, geoAlbedo: 0.43, ephem: 'jupiterMoon', jupiterIndex: 2, rotation: { locked: true },
    appearance: { proc: { type: PROC.ICY, seed: 83, c1: [0.6, 0.57, 0.52], c2: [0.38, 0.34, 0.3], c3: [0.85, 0.84, 0.82], lineae: 0.35, craters: 0.6, patches: 0.7 } },
    info: 'Largest moon in the solar system; bigger than Mercury and has its own magnetic field.',
  },
  {
    id: 'callisto', name: 'Callisto', kind: 'moon', parent: 'jupiter', gm: 7179.2834, radius: 2410.3,
    albedo: 0.22, geoAlbedo: 0.22, ephem: 'jupiterMoon', jupiterIndex: 3, rotation: { locked: true },
    appearance: { proc: { type: PROC.ROCKY, seed: 84, c1: [0.33, 0.3, 0.26], c2: [0.24, 0.21, 0.18], c3: [0.8, 0.78, 0.74], craters: 1.0, detail: 0.9 } },
    info: 'The most heavily cratered surface in the solar system.',
  },
  {
    id: 'saturn', j2: 0.01629071, j2Radius: 60268, name: 'Saturn', kind: 'planet', parent: 'sun', gm: 37931206.159, radius: 58232, flattening: 0.09796,
    albedo: 0.342, geoAlbedo: 0.499, greenhouse: 14, ephem: 'astronomy', iau: 'Saturn', rotation: { iau: 'Saturn' },
    atmosphere: 'saturn',
    rings: { inner: 74500, outer: 140220, color: T('saturnringcolor.jpg'), alpha: T('saturnringpattern.gif'), opacity: 1.0 },
    appearance: { map: T('saturnmap.jpg'), proc: { type: PROC.GAS, seed: 91, turbulence: 0.25, detailOnly: true } },
    info: 'Least dense planet; its rings are mostly water ice and only ~10-100 m thick.',
  },
  {
    id: 'mimas', name: 'Mimas', kind: 'moon', parent: 'saturn', gm: 2.5026, radius: 198.2,
    albedo: 0.6, geoAlbedo: 0.962, ephem: 'elements', orbit: { a: 185539, e: 0.0196, i: 1.574, periodDays: 0.942422 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ROCKY, seed: 101, c1: [0.78, 0.78, 0.77], c2: [0.62, 0.62, 0.61], c3: [0.88, 0.88, 0.87], craters: 1.0, detail: 1.0 } },
    info: 'The “Death Star” moon, dominated by the 130 km crater Herschel.',
  },
  {
    id: 'enceladus', name: 'Enceladus', kind: 'moon', parent: 'saturn', gm: 7.2027, radius: 252.1,
    albedo: 0.81, geoAlbedo: 1.375, ephem: 'elements', orbit: { a: 237948, e: 0.0047, i: 0.009, periodDays: 1.370218 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ICY, seed: 102, c1: [0.97, 0.98, 1.0], c2: [0.7, 0.8, 0.88], c3: [1.0, 1.0, 1.0], lineae: 0.5, craters: 0.35 } },
    info: 'Brightest body in the solar system; south-polar geysers feed Saturn’s E ring.',
  },
  {
    id: 'tethys', name: 'Tethys', kind: 'moon', parent: 'saturn', gm: 41.2067, radius: 531.1,
    albedo: 0.8, geoAlbedo: 1.229, ephem: 'elements', orbit: { a: 294619, e: 0.0001, i: 1.091, periodDays: 1.887802 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ROCKY, seed: 103, c1: [0.86, 0.86, 0.85], c2: [0.72, 0.72, 0.71], c3: [0.95, 0.95, 0.94], craters: 0.8, detail: 0.8 } },
    info: 'Nearly pure water ice; scarred by the Ithaca Chasma canyon.',
  },
  {
    id: 'dione', name: 'Dione', kind: 'moon', parent: 'saturn', gm: 73.1146, radius: 561.4,
    albedo: 0.7, geoAlbedo: 0.998, ephem: 'elements', orbit: { a: 377396, e: 0.0022, i: 0.028, periodDays: 2.736915 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ICY, seed: 104, c1: [0.82, 0.82, 0.8], c2: [0.55, 0.55, 0.54], c3: [0.95, 0.95, 0.94], lineae: 0.4, craters: 0.8 } },
    info: 'Bright ice cliffs (“wispy terrain”) on its trailing hemisphere.',
  },
  {
    id: 'rhea', name: 'Rhea', kind: 'moon', parent: 'saturn', gm: 153.9426, radius: 763.5,
    albedo: 0.7, geoAlbedo: 0.949, ephem: 'elements', orbit: { a: 527108, e: 0.001258, i: 0.345, periodDays: 4.518212 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ROCKY, seed: 105, c1: [0.8, 0.79, 0.77], c2: [0.62, 0.61, 0.6], c3: [0.93, 0.93, 0.92], craters: 1.0, detail: 0.9 } },
    info: 'Saturn’s second-largest moon: a heavily cratered ball of ice.',
  },
  {
    id: 'titan', name: 'Titan', kind: 'moon', parent: 'saturn', gm: 8978.1382, radius: 2574.7,
    albedo: 0.265, geoAlbedo: 0.22, greenhouse: 12, ephem: 'elements', orbit: { a: 1221870, e: 0.0288, i: 0.34854, periodDays: 15.945 }, rotation: { locked: true },
    atmosphere: 'titan',
    appearance: { proc: { type: PROC.HAZE, seed: 106, c1: [0.86, 0.6, 0.28], c2: [0.72, 0.48, 0.2], c3: [0.93, 0.72, 0.4], bands: 0.15 } },
    info: 'The only moon with a thick atmosphere (1.5 bar N₂) and surface lakes of liquid methane.',
  },
  {
    id: 'hyperion', name: 'Hyperion', kind: 'moon', parent: 'saturn', gm: 0.3727, radius: 135,
    albedo: 0.3, geoAlbedo: 0.3, ephem: 'elements', orbit: { a: 1481010, e: 0.1230061, i: 0.43, periodDays: 21.276609 },
    rotation: { periodH: 13 * 24, poleRA: 40, poleDec: 83, W0: 0, chaotic: true }, shape: [180, 133, 103],
    appearance: { proc: { type: PROC.ROCKY, seed: 107, c1: [0.6, 0.52, 0.42], c2: [0.4, 0.33, 0.26], c3: [0.72, 0.66, 0.56], craters: 1.0, detail: 1.0, sponge: 1.0 } },
    info: 'Sponge-like, porous moon with chaotic rotation.',
  },
  {
    id: 'iapetus', name: 'Iapetus', kind: 'moon', parent: 'saturn', gm: 120.5038, radius: 734.3,
    albedo: 0.2, geoAlbedo: 0.6, ephem: 'elements', orbit: { a: 3560820, e: 0.0286125, i: 15.47, periodDays: 79.3215 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ROCKY, seed: 108, c1: [0.85, 0.83, 0.8], c2: [0.2, 0.13, 0.08], c3: [0.93, 0.92, 0.9], craters: 0.8, detail: 0.8, twoTone: 1.0 } },
    info: 'Two-toned: a coal-dark leading hemisphere and a snow-bright trailing one, plus an equatorial ridge.',
  },
  {
    id: 'uranus', j2: 0.003510685, j2Radius: 25559, name: 'Uranus', kind: 'planet', parent: 'sun', gm: 5793951.256, radius: 25362, flattening: 0.02293,
    albedo: 0.3, geoAlbedo: 0.488, greenhouse: 0, ephem: 'astronomy', iau: 'Uranus', rotation: { iau: 'Uranus' },
    atmosphere: 'uranus',
    rings: { inner: 38000, outer: 51500, color: T('uranusringcolour.jpg'), alpha: T('uranusringtrans.gif'), opacity: 0.55 },
    appearance: { map: T('uranusmap.jpg'), proc: { type: PROC.ICE_GIANT, seed: 111, detailOnly: true, turbulence: 0.1 } },
    info: 'Ice giant tipped on its side (97.8° obliquity); each pole gets 42 years of daylight.',
  },
  {
    id: 'miranda', name: 'Miranda', kind: 'moon', parent: 'uranus', gm: 4.3, radius: 235.8,
    albedo: 0.2, geoAlbedo: 0.32, ephem: 'elements', orbit: { a: 129390, e: 0.0013, i: 4.338, periodDays: 1.413479 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ICY, seed: 121, c1: [0.62, 0.62, 0.62], c2: [0.45, 0.45, 0.45], c3: [0.78, 0.78, 0.78], lineae: 0.8, craters: 0.5, patches: 0.8 } },
    info: 'Patchwork “Frankenstein” moon with 20 km high cliffs (Verona Rupes).',
  },
  {
    id: 'ariel', name: 'Ariel', kind: 'moon', parent: 'uranus', gm: 83.43, radius: 578.9,
    albedo: 0.23, geoAlbedo: 0.53, ephem: 'elements', orbit: { a: 191020, e: 0.0012, i: 0.041, periodDays: 2.520379 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ICY, seed: 122, c1: [0.62, 0.61, 0.6], c2: [0.42, 0.41, 0.4], c3: [0.78, 0.78, 0.77], lineae: 0.5, craters: 0.6 } },
    info: 'Brightest Uranian moon, cut by long fault valleys.',
  },
  {
    id: 'umbriel', name: 'Umbriel', kind: 'moon', parent: 'uranus', gm: 85.4, radius: 584.7,
    albedo: 0.1, geoAlbedo: 0.26, ephem: 'elements', orbit: { a: 266000, e: 0.0039, i: 0.128, periodDays: 4.144177 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ROCKY, seed: 123, c1: [0.33, 0.33, 0.33], c2: [0.25, 0.25, 0.25], c3: [0.6, 0.6, 0.58], craters: 1.0, detail: 0.8 } },
    info: 'Darkest of the large Uranian moons.',
  },
  {
    id: 'titania', name: 'Titania', kind: 'moon', parent: 'uranus', gm: 226.9, radius: 788.9,
    albedo: 0.17, geoAlbedo: 0.35, ephem: 'elements', orbit: { a: 435910, e: 0.0011, i: 0.079, periodDays: 8.705872 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ROCKY, seed: 124, c1: [0.5, 0.48, 0.46], c2: [0.36, 0.35, 0.33], c3: [0.7, 0.7, 0.68], craters: 0.9, detail: 0.8 } },
    info: 'Largest moon of Uranus, with huge canyon systems.',
  },
  {
    id: 'oberon', name: 'Oberon', kind: 'moon', parent: 'uranus', gm: 205.4, radius: 761.4,
    albedo: 0.14, geoAlbedo: 0.31, ephem: 'elements', orbit: { a: 583520, e: 0.0014, i: 0.068, periodDays: 13.463239 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ROCKY, seed: 125, c1: [0.46, 0.42, 0.4], c2: [0.32, 0.29, 0.27], c3: [0.68, 0.66, 0.64], craters: 1.0, detail: 0.8 } },
    info: 'Outermost major Uranian moon; ancient, reddish and cratered.',
  },
  {
    id: 'neptune', j2: 0.003408428, j2Radius: 25225, name: 'Neptune', kind: 'planet', parent: 'sun', gm: 6835099.97, radius: 24622, flattening: 0.01708,
    albedo: 0.29, geoAlbedo: 0.442, greenhouse: 13, ephem: 'astronomy', iau: 'Neptune', rotation: { iau: 'Neptune' },
    atmosphere: 'neptune',
    appearance: { map: T('neptunemap.jpg'), proc: { type: PROC.ICE_GIANT, seed: 131, detailOnly: true, turbulence: 0.3 } },
    info: 'Windiest planet: supersonic winds up to 2,100 km/h.',
  },
  {
    id: 'triton', name: 'Triton', kind: 'moon', parent: 'neptune', gm: 1428.495, radius: 1353.4,
    albedo: 0.76, geoAlbedo: 0.72, ephem: 'elements', orbit: { a: 354759, e: 0.000016, i: 156.865, periodDays: 5.876854 }, rotation: { locked: true },
    atmosphere: 'pluto',
    appearance: { proc: { type: PROC.ICY, seed: 141, c1: [0.88, 0.8, 0.76], c2: [0.7, 0.6, 0.55], c3: [0.97, 0.92, 0.88], lineae: 0.3, craters: 0.1, patches: 1.0, cantaloupe: 1.0 } },
    info: 'Captured Kuiper-belt object on a retrograde orbit, with nitrogen geysers.',
  },
  {
    id: 'nereid', name: 'Nereid', kind: 'moon', parent: 'neptune', gm: 2.06, radius: 170,
    albedo: 0.155, geoAlbedo: 0.155, ephem: 'elements', orbit: { a: 5513818, e: 0.7507, i: 7.09, periodDays: 360.13619 },
    rotation: { periodH: 11.594, poleRA: 0, poleDec: 90, W0: 0 },
    appearance: { proc: { type: PROC.ROCKY, seed: 142, c1: [0.45, 0.45, 0.45], c2: [0.32, 0.32, 0.32], c3: [0.6, 0.6, 0.6], craters: 0.8, detail: 0.8 } },
    info: 'One of the most eccentric moon orbits known (e = 0.75).',
  },
  {
    id: 'pluto', name: 'Pluto', kind: 'dwarf', parent: 'sun', gm: 869.326, radius: 1188.3,
    albedo: 0.72, geoAlbedo: 0.52, ephem: 'astronomy', iau: 'Pluto', rotation: { iau: 'Pluto' },
    atmosphere: 'pluto',
    appearance: { map: T('plutomap2k.jpg'), bump: T('plutobump2k.jpg'), bumpScale: 0.8, lonOffset: 0.0, proc: { type: PROC.ROCKY, seed: 151, craters: 0.1, detail: 0.3 } },
    info: 'Kuiper-belt dwarf planet with the nitrogen-ice glacier Sputnik Planitia (“the heart”).',
  },
  {
    id: 'charon', name: 'Charon', kind: 'moon', parent: 'pluto', gm: 105.88, radius: 606,
    albedo: 0.25, geoAlbedo: 0.38, ephem: 'elements', orbit: { a: 19591, e: 0.0002, i: 0.08, periodDays: 6.3872273 }, rotation: { locked: true },
    appearance: { proc: { type: PROC.ROCKY, seed: 161, c1: [0.55, 0.54, 0.53], c2: [0.4, 0.39, 0.38], c3: [0.68, 0.67, 0.66], craters: 0.6, detail: 0.7, redCap: 1.0 } },
    info: 'So massive relative to Pluto that the pair orbit a point in empty space between them.',
  },
];

// Comets and interstellar objects: osculating heliocentric ecliptic J2000 elements
// (q in AU, angles in degrees, perihelion date).
export const COMETS = [
  { id: 'halley', name: '1P/Halley', q: 0.58598, e: 0.96714, i: 162.2627, node: 58.42, argp: 111.3325, tp: '1986-02-09T11:00:00Z', radius: 5.5, gm: 1.5e-5, activity: 1.0 },
  { id: 'halebopp', name: 'C/1995 O1 Hale-Bopp', q: 0.914, e: 0.99509, i: 89.43, node: 282.47, argp: 130.59, tp: '1997-04-01T02:00:00Z', radius: 30, gm: 6e-4, activity: 3.0 },
  { id: 'encke', name: '2P/Encke', q: 0.3363, e: 0.8483, i: 11.35, node: 334.2, argp: 187.1, tp: '2023-10-22T12:00:00Z', radius: 2.4, gm: 6e-7, activity: 0.4 },
  { id: 'chury', name: '67P/Churyumov–Gerasimenko', q: 1.2103, e: 0.6497, i: 3.8718, node: 36.33, argp: 22.15, tp: '2021-11-02T00:00:00Z', radius: 2.0, gm: 6.7e-10, activity: 0.3 },
  { id: 'tsuchinshan', name: 'C/2023 A3 Tsuchinshan–ATLAS', q: 0.3914, e: 1.0001, i: 139.11, node: 21.56, argp: 308.49, tp: '2024-09-27T18:00:00Z', radius: 3.0, gm: 1e-6, activity: 1.5 },
  { id: 'oumuamua', name: '1I/ʻOumuamua', q: 0.2556, e: 1.2011, i: 122.74, node: 24.6, argp: 241.81, tp: '2017-09-09T12:00:00Z', radius: 0.11, gm: 0, activity: 0, interstellar: true },
];

export const KIND_LABEL = {
  star: 'Star', planet: 'Planet', dwarf: 'Dwarf planet', moon: 'Moon', asteroid: 'Asteroid', comet: 'Comet',
  blackhole: 'Black hole', neutron: 'Neutron star', whitedwarf: 'White dwarf', debris: 'Debris', probe: 'Probe',
};

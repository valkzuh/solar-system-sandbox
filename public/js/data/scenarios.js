// Built-in scenarios.

import { Body } from '../sim/body.js';
import { buildSolarSystem, bodyFromSpec } from '../sim/systems.js';
import { SOLAR_SYSTEM } from './catalog.js';
import { starSpec, TEMPLATE_BY_ID } from './templates.js';
import { elementsToState } from '../core/kepler.js';
import { G, AU, DAY, DEG, MSUN, MEARTH, REARTH, RSUN, MJUP, RJUP, YEAR, HOUR } from '../core/constants.js';
import { planetRadiusFromMass, luminosityFromRT } from '../core/stellar.js';
import { rng } from '../core/vec.js';
import { PROC } from './catalog.js';

function place(sim, list) {
  sim.addMany(list);
  sim.recenter();
}

// Body on an orbit around a primary state {pos, vel, mass}.
function orbiting(primary, spec, el) {
  const mu = G * (primary.mass + (spec.massless ? 0 : spec.mass));
  const st = elementsToState(mu, {
    a: el.a, e: el.e || 0, i: (el.i || 0) * DEG, node: (el.node || 0) * DEG, argp: (el.argp || 0) * DEG, M: (el.M || 0) * DEG,
  });
  return { r: [primary.pos[0] + st.r[0], primary.pos[1] + st.r[1], primary.pos[2] + st.r[2]], v: [primary.vel[0] + st.v[0], primary.vel[1] + st.v[1], primary.vel[2] + st.v[2]] };
}

function mk(spec) {
  return new Body(spec);
}

const SUN_SPEC = SOLAR_SYSTEM.find((s) => s.id === 'sun');

export const SCENARIOS = [
  {
    id: 'solar-now',
    name: 'Solar System — today',
    desc: 'The real solar system at the current date: planets from VSOP87, the Moon, Galilean satellites and 20+ other moons, dwarf planets, asteroids and comets.',
    build(app, date = new Date()) {
      buildSolarSystem(app.sim, date);
      return { focus: 'earth', warp: HOUR, belts: true, distance: 60000 };
    },
  },
  {
    id: 'inner',
    name: 'Inner planets',
    desc: 'Mercury to Mars with the asteroid belt. Watch Mercury lap the Sun every 88 days.',
    build(app, date = new Date()) {
      buildSolarSystem(app.sim, date);
      return { focus: 'sun', warp: 5 * DAY, belts: true, distance: 4.5 * AU, elevation: 0.9 };
    },
  },
  {
    id: 'earth-moon',
    name: 'Earth & Moon',
    desc: 'Real-time Earth with day/night, city lights, clouds and the Moon. Try 1 min/s to watch the terminator sweep.',
    build(app, date = new Date()) {
      buildSolarSystem(app.sim, date);
      return { focus: 'earth', warp: 60, distance: 25000 };
    },
  },
  {
    id: 'jovian',
    name: 'Jupiter & the Galilean moons',
    desc: 'Io, Europa and Ganymede in their 1:2:4 Laplace resonance. Watch moon shadows transit the cloud tops.',
    build(app, date = new Date()) {
      buildSolarSystem(app.sim, date);
      return { focus: 'jupiter', warp: 2 * HOUR, distance: 2.6e6, elevation: 0.12 };
    },
  },
  {
    id: 'saturn',
    name: 'Saturn & its rings',
    desc: 'The rings cast shadows on the planet and vice-versa; Titan’s haze glows orange.',
    build(app, date = new Date()) {
      buildSolarSystem(app.sim, date);
      return { focus: 'saturn', warp: HOUR, distance: 520000, elevation: 0.35 };
    },
  },
  {
    id: 'pluto',
    name: 'Pluto & Charon',
    desc: 'A binary dwarf planet: both bodies orbit a barycentre outside Pluto.',
    build(app, date = new Date()) {
      buildSolarSystem(app.sim, date);
      return { focus: 'pluto', warp: 3 * HOUR, distance: 60000, elevation: 0.3 };
    },
  },
  {
    id: 'theia',
    name: 'Theia impact (Moon formation)',
    desc: 'A Mars-sized protoplanet strikes the proto-Earth 4.5 billion years ago. The debris disk may coalesce into a moon.',
    build(app) {
      const sun = mk({ ...SUN_SPEC, mass: SUN_SPEC.gm / G });
      const sunS = { pos: [0, 0, 0], vel: [0, 0, 0], mass: sun.mass };
      const earthSpec = { id: 'proto-earth', name: 'Proto-Earth', kind: 'planet', mass: 0.9 * MEARTH, radius: 6100, albedo: 0.2, geoAlbedo: 0.2,
        appearance: { proc: { type: PROC.LAVA, seed: 5 } }, heat: 900, rotation: { periodH: 8, poleRA: 0, poleDec: 70, W0: 0 } };
      const e = orbiting(sunS, earthSpec, { a: AU, M: 0 });
      const theiaSpec = { id: 'theia', name: 'Theia', kind: 'planet', mass: 0.1 * MEARTH, radius: 3390, albedo: 0.15, geoAlbedo: 0.15,
        appearance: { proc: { type: PROC.ROCKY, seed: 9, c1: [0.35, 0.3, 0.27], c2: [0.2, 0.18, 0.16], c3: [0.5, 0.45, 0.4], craters: 0.8 } } };
      // Oblique approach at ~4 km/s relative velocity.
      const off = [12000 * 1.5, 25000, 3000];
      const theiaPos = [e.r[0] + off[0], e.r[1] + off[1], e.r[2] + off[2]];
      const theiaVel = [e.v[0] - 1.2, e.v[1] - 3.6, e.v[2] - 0.3];
      place(app.sim, [
        { body: sun, pos: sunS.pos, vel: sunS.vel },
        { body: mk(earthSpec), pos: e.r, vel: e.v },
        { body: mk(theiaSpec), pos: theiaPos, vel: theiaVel },
      ]);
      return { focus: 'proto-earth', warp: 60, distance: 90000, elevation: 0.5, time: -4.5e9 * YEAR };
    },
  },
  {
    id: 'moon-roche',
    name: 'The Moon crosses the Roche limit',
    desc: 'The Moon is slowed so that it falls inside Earth’s Roche limit (~18,000 km) and is torn into a ring.',
    build(app, date = new Date()) {
      buildSolarSystem(app.sim, date, { comets: false });
      const earth = app.sim.findById('earth');
      const moon = app.sim.findById('moon');
      const r = [moon.pos[0] - earth.pos[0], moon.pos[1] - earth.pos[1], moon.pos[2] - earth.pos[2]];
      const v = [moon.vel[0] - earth.vel[0], moon.vel[1] - earth.vel[1], moon.vel[2] - earth.vel[2]];
      const k = 0.22;
      app.sim.setState(moon, moon.pos, [earth.vel[0] + v[0] * k, earth.vel[1] + v[1] * k, earth.vel[2] + v[2] * k]);
      return { focus: 'earth', warp: HOUR, distance: 900000, elevation: 0.6 };
    },
  },
  {
    id: 'rogue-bh',
    name: 'Rogue black hole flyby',
    desc: 'A 10-solar-mass black hole passes through the solar system at 60 km/s. Watch orbits get scrambled and the sky lens around it.',
    build(app, date = new Date()) {
      buildSolarSystem(app.sim, date);
      const bh = mk({ ...TEMPLATE_BY_ID.blackhole.make(1, 10), id: 'rogue', name: 'Rogue black hole', userCreated: true, info: 'A 10 M☉ black hole on a hyperbolic trajectory.' });
      const sun = app.sim.findById('sun');
      const pos = [sun.pos[0] - 60 * AU, sun.pos[1] + 4 * AU, sun.pos[2] + 1.5 * AU];
      const vel = [sun.vel[0] + 60, sun.vel[1], sun.vel[2]];
      app.sim.add(bh, pos, vel);
      return { focus: 'sun', warp: 20 * DAY, distance: 45 * AU, elevation: 0.7, belts: true };
    },
  },
  {
    id: 'jupiter-star',
    name: 'Jupiter ignites',
    desc: 'Jupiter’s mass is raised to 0.1 M☉ — a red dwarf. The solar system becomes a binary star.',
    build(app, date = new Date()) {
      buildSolarSystem(app.sim, date);
      const j = app.sim.findById('jupiter');
      const spec = starSpec(0.1);
      j.kind = 'star';
      j.mass = spec.mass;
      j.radius = spec.radius;
      j.star = spec.star;
      j.rings = null;
      j.atmosphere = null;
      j.j2 = 0;
      j.name = 'Jupiter (star)';
      app.sim.touch();
      return { focus: 'sun', warp: 30 * DAY, distance: 12 * AU, elevation: 0.7 };
    },
  },
  {
    id: 'trappist',
    name: 'TRAPPIST-1',
    desc: 'Seven Earth-sized planets around an ultracool red dwarf, locked in a resonant chain (Agol et al. 2021).',
    build(app) {
      const mStar = 0.0898 * MSUN;
      const rStar = 0.1192;
      const star = mk({ id: 'trappist1', name: 'TRAPPIST-1', kind: 'star', mass: mStar, radius: rStar * RSUN, star: { temperature: 2566, luminosity: 5.53e-4 }, fixedStar: true, info: 'M8V ultracool dwarf, 40.7 light-years away.' });
      const S = { pos: [0, 0, 0], vel: [0, 0, 0], mass: mStar };
      const planets = [
        ['b', 1.51088, 1.374, 1.116, PROC.LAVA],
        ['c', 2.4218, 1.308, 1.097, PROC.ROCKY],
        ['d', 4.04978, 0.388, 0.788, PROC.TERRESTRIAL],
        ['e', 6.09967, 0.692, 0.92, PROC.TERRESTRIAL],
        ['f', 9.20669, 1.039, 1.045, PROC.ICY],
        ['g', 12.35294, 1.321, 1.129, PROC.ICY],
        ['h', 18.7729, 0.326, 0.755, PROC.ICY],
      ];
      const rand = rng(1);
      const list = [{ body: star, pos: S.pos, vel: S.vel }];
      for (const [n, P, m, r, type] of planets) {
        const a = Math.cbrt((G * (mStar + m * MEARTH) * (P * DAY) ** 2) / (4 * Math.PI * Math.PI));
        const appearance = type === PROC.TERRESTRIAL
          ? { proc: { type, seed: n.charCodeAt(0), water: n === 'e' ? 0.8 : 0.4, ice: n === 'e' ? 0.25 : 0.6, clouds: 0.5 } }
          : type === PROC.ICY
            ? { proc: { type, seed: n.charCodeAt(0), c1: [0.85, 0.83, 0.8], c2: [0.55, 0.5, 0.45], c3: [0.95, 0.95, 0.95], lineae: 0.6, craters: 0.4 } }
            : type === PROC.LAVA
              ? { proc: { type, seed: 3 } }
              : { proc: { type, seed: 7, c1: [0.45, 0.35, 0.3], c2: [0.3, 0.24, 0.2], c3: [0.6, 0.5, 0.45], craters: 0.5 } };
        const spec = { id: `trappist1${n}`, name: `TRAPPIST-1${n}`, kind: 'planet', mass: m * MEARTH, radius: r * REARTH, albedo: 0.3, geoAlbedo: 0.3,
          atmosphere: type === PROC.TERRESTRIAL ? 'thin' : null, rotation: { locked: true }, appearance, greenhouse: type === PROC.TERRESTRIAL ? 20 : 0,
          info: `Period ${P} d, ${m} M⊕, ${r} R⊕.` };
        const st = orbiting(S, spec, { a, e: 0.005, i: rand() * 0.3, M: rand() * 360 });
        list.push({ body: mk(spec), pos: st.r, vel: st.v });
      }
      place(app.sim, list);
      return { focus: 'trappist1', warp: 3 * HOUR, distance: 0.12 * AU, elevation: 0.5 };
    },
  },
  {
    id: 'kepler16',
    name: 'Kepler-16 (circumbinary “Tatooine”)',
    desc: 'A Saturn-mass planet orbiting two stars every 229 days. Experience double sunsets and stellar eclipses.',
    build(app) {
      const mA = 0.6897 * MSUN, mB = 0.20255 * MSUN;
      const A = mk({ id: 'k16a', name: 'Kepler-16 A', kind: 'star', mass: mA, radius: 0.6489 * RSUN, star: { temperature: 4450, luminosity: luminosityFromRT(0.6489, 4450) }, fixedStar: true });
      const B = mk({ id: 'k16b', name: 'Kepler-16 B', kind: 'star', mass: mB, radius: 0.22623 * RSUN, star: { temperature: 3311, luminosity: luminosityFromRT(0.22623, 3311) }, fixedStar: true });
      const aBin = 0.22431 * AU;
      const binS = elementsToState(G * (mA + mB), { a: aBin, e: 0.15944, i: 0, node: 0, argp: 263.464 * DEG, M: 0 });
      const fA = mB / (mA + mB), fB = mA / (mA + mB);
      const posA = binS.r.map((x) => -x * fA), velA = binS.v.map((x) => -x * fA);
      const posB = binS.r.map((x) => x * fB), velB = binS.v.map((x) => x * fB);
      const bary = { pos: [0, 0, 0], vel: [0, 0, 0], mass: mA + mB };
      const pSpec = { id: 'k16ab', name: 'Kepler-16 (AB) b', kind: 'planet', mass: 0.333 * MJUP, radius: 0.7538 * RJUP, flattening: 0.05, albedo: 0.34, geoAlbedo: 0.5, atmosphere: 'saturn',
        appearance: { proc: { type: PROC.GAS, seed: 16, turbulence: 0.35, c1: [0.78, 0.74, 0.66], c2: [0.62, 0.56, 0.48], c3: [0.9, 0.86, 0.8] } },
        rotation: { periodH: 11, poleRA: 0, poleDec: 88, W0: 0 }, info: 'The first confirmed circumbinary planet (Doyle et al. 2011).' };
      const p = orbiting(bary, pSpec, { a: 0.7048 * AU, e: 0.0069, i: 0.3, argp: 318, M: 40 });
      place(app.sim, [
        { body: A, pos: posA, vel: velA },
        { body: B, pos: posB, vel: velB },
        { body: mk(pSpec), pos: p.r, vel: p.v },
      ]);
      return { focus: 'k16a', warp: 12 * HOUR, distance: 2.2 * AU, elevation: 0.7 };
    },
  },
  {
    id: 'alphacen',
    name: 'Alpha Centauri AB',
    desc: 'The nearest Sun-like binary (P = 79.9 yr, e = 0.52) with a hypothetical habitable planet around A.',
    build(app) {
      const mA = 1.0788 * MSUN, mB = 0.9092 * MSUN;
      const A = mk({ id: 'acena', name: 'α Centauri A', kind: 'star', mass: mA, radius: 1.2175 * RSUN, star: { temperature: 5790, luminosity: 1.5059 }, fixedStar: true });
      const B = mk({ id: 'acenb', name: 'α Centauri B', kind: 'star', mass: mB, radius: 0.8591 * RSUN, star: { temperature: 5260, luminosity: 0.4981 }, fixedStar: true });
      const bin = elementsToState(G * (mA + mB), { a: 23.3 * AU, e: 0.5179, i: 0, node: 0, argp: 0, M: 190 * DEG });
      const fA = mB / (mA + mB), fB = mA / (mA + mB);
      const posA = bin.r.map((x) => -x * fA), velA = bin.v.map((x) => -x * fA);
      const posB = bin.r.map((x) => x * fB), velB = bin.v.map((x) => x * fB);
      const tSpec = { ...TEMPLATE_BY_ID.terran.make(77, 1.1), id: 'acenAb', name: 'Pandora (hypothetical)', rotation: { periodH: 26, poleRA: 10, poleDec: 70, W0: 0 }, info: 'Hypothetical Earth-like planet in α Cen A’s habitable zone.' };
      const t = orbiting({ pos: posA, vel: velA, mass: mA }, tSpec, { a: 1.25 * AU, e: 0.01, i: 2, M: 0 });
      place(app.sim, [
        { body: A, pos: posA, vel: velA },
        { body: B, pos: posB, vel: velB },
        { body: mk(tSpec), pos: t.r, vel: t.v },
      ]);
      return { focus: 'acena', warp: 60 * DAY, distance: 45 * AU, elevation: 0.8 };
    },
  },
  {
    id: 'planet9',
    name: 'Planet Nine',
    desc: 'The solar system plus the hypothesised 6 M⊕ Planet Nine on a distant eccentric orbit (Batygin & Brown).',
    build(app, date = new Date()) {
      buildSolarSystem(app.sim, date);
      const sun = app.sim.findById('sun');
      const spec = { ...TEMPLATE_BY_ID.icegiant.make(9, 6.2), id: 'planet9', name: 'Planet Nine (hypothetical)', userCreated: false, greenhouse: 0, info: 'a ≈ 380 AU, e ≈ 0.2, i ≈ 16° (hypothetical).' };
      const st = orbiting({ pos: sun.pos, vel: sun.vel, mass: sun.mass }, spec, { a: 380 * AU, e: 0.2, i: 16, node: 97, argp: 150, M: 180 });
      app.sim.add(mk(spec), st.r, st.v);
      return { focus: 'sun', warp: 2 * YEAR, distance: 900 * AU, elevation: 0.6 };
    },
  },
  {
    id: 'empty',
    name: 'Empty system (one star)',
    desc: 'A lone Sun-like star. Build your own planetary system with the Create tools.',
    build(app) {
      const s = mk({ ...SUN_SPEC, mass: SUN_SPEC.gm / G, name: 'Star', id: 'star1', rotation: { periodH: 609, poleRA: 0, poleDec: 90, W0: 0 } });
      place(app.sim, [{ body: s, pos: [0, 0, 0], vel: [0, 0, 0] }]);
      return { focus: 'star1', warp: 10 * DAY, distance: 3 * AU, elevation: 0.9 };
    },
  },
];

export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
export { bodyFromSpec };

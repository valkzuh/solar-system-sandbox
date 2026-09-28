import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../public/js/sim/simulation.js';
import { Body } from '../public/js/sim/body.js';
import { buildSolarSystem } from '../public/js/sim/systems.js';
import { solarSystemStates } from '../public/js/sim/ephemeris.js';
import { elementsToState, stateToElements } from '../public/js/core/kepler.js';
import { G, AU, DAY, YEAR, GM_SUN, RAD } from '../public/js/core/constants.js';

const sunBody = () => new Body({ id: 'sun', kind: 'star', mass: GM_SUN / G, radius: 695700, star: { temperature: 5772, luminosity: 1 } });

test('Kepler elements round-trip (elliptic and hyperbolic)', () => {
  for (const el of [
    { a: 1.3 * AU, e: 0.3, i: 0.4, node: 1.1, argp: 2.2, M: 0.7 },
    { a: -2 * AU, e: 1.7, i: 2.1, node: 0.3, argp: 4.0, M: 1.5 },
  ]) {
    const s = elementsToState(GM_SUN, el);
    const back = stateToElements(GM_SUN, s.r, s.v);
    assert.ok(Math.abs(back.a - el.a) / Math.abs(el.a) < 1e-9);
    assert.ok(Math.abs(back.e - el.e) < 1e-9);
    assert.ok(Math.abs(back.i - el.i) < 1e-9);
    assert.ok(Math.abs(back.M - el.M) < 1e-7);
  }
});

test('Hermite integrator tracks an exact two-body orbit (Mercury-like, 1 year)', () => {
  const sim = new Simulation();
  sim.relativity = false;
  const probe = new Body({ id: 'p', kind: 'planet', mass: 3.3e23, radius: 2439, massless: true });
  const el = { a: 0.387 * AU, e: 0.2056, i: 0.12, node: 0.8, argp: 0.3, M: 0 };
  const s0 = elementsToState(GM_SUN, el);
  const sun = sunBody();
  sim.addMany([{ body: sun, pos: [0, 0, 0], vel: [0, 0, 0] }, { body: probe, pos: s0.r, vel: s0.v }]);
  for (let k = 0; k < 365; k++) sim.advance(DAY, 1e9);
  const n = Math.sqrt(GM_SUN / el.a ** 3);
  const s1 = elementsToState(GM_SUN, { ...el, M: n * 365 * DAY });
  const err = Math.hypot(probe.pos[0] - sun.pos[0] - s1.r[0], probe.pos[1] - sun.pos[1] - s1.r[1], probe.pos[2] - sun.pos[2] - s1.r[2]);
  assert.ok(err < 150, `position error ${err} km`); // ~2e-6 of the distance travelled
});

test('time reversal returns the system to its initial state', () => {
  const sim = new Simulation();
  const d0 = new Date(Date.UTC(2024, 5, 1));
  sim.time = (d0 - Date.UTC(2000, 0, 1, 12)) / 1000;
  buildSolarSystem(sim, d0, { comets: false, include: ['sun', 'earth', 'moon', 'jupiter', 'io', 'europa'] });
  const start = sim.bodies.map((b) => Array.from(b.pos));
  for (let k = 0; k < 60; k++) sim.advance(DAY, 1e9);
  for (let k = 0; k < 60; k++) sim.advance(-DAY, 1e9);
  sim.bodies.forEach((b, i) => {
    const e = Math.hypot(b.pos[0] - start[i][0], b.pos[1] - start[i][1], b.pos[2] - start[i][2]);
    assert.ok(e < 50, `${b.id} returned ${e.toFixed(2)} km off`);
  });
});

test('full solar system: energy conserved and planets track VSOP87 for a year', () => {
  const sim = new Simulation();
  const d0 = new Date(Date.UTC(2025, 0, 1));
  sim.time = (d0 - Date.UTC(2000, 0, 1, 12)) / 1000;
  buildSolarSystem(sim, d0, { comets: false });
  const e0 = sim.totalEnergy();
  for (let k = 0; k < 365; k++) sim.advance(DAY, 1e9);
  const drift = Math.abs((sim.totalEnergy() - e0) / e0);
  assert.ok(drift < 1e-6, `energy drift ${drift}`);
  const ref = solarSystemStates(new Date(d0.getTime() + 365 * DAY * 1000), { comets: false });
  const sun = sim.findById('sun').pos, rs = ref.get('sun').r;
  for (const id of ['venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
    const p = sim.findById(id).pos, r = ref.get(id).r;
    const d = Math.hypot(r[0] - rs[0], r[1] - rs[1], r[2] - rs[2]);
    const err = Math.hypot(p[0] - sun[0] - r[0] + rs[0], p[1] - sun[1] - r[1] + rs[1], p[2] - sun[2] - r[2] + rs[2]);
    assert.ok(err / d < 1e-3, `${id}: ${(err / d).toExponential(2)} relative error`);
  }
});

test('general relativity: Mercury perihelion advances ~43 arcsec per century', () => {
  const run = (gr) => {
    const sim = new Simulation();
    sim.relativity = gr;
    const el = { a: 0.387098 * AU, e: 0.20563, i: 0, node: 0, argp: 0, M: 0 };
    const s0 = elementsToState(GM_SUN, el);
    const merc = new Body({ id: 'm', kind: 'planet', mass: 3.3e23, radius: 2439, massless: true });
    sim.addMany([{ body: sunBody(), pos: [0, 0, 0], vel: [0, 0, 0] }, { body: merc, pos: s0.r, vel: s0.v }]);
    for (let k = 0; k < 100; k++) sim.advance(0.1 * YEAR, 1e9);
    const el1 = stateToElements(GM_SUN, merc.pos, merc.vel);
    return Math.atan2(el1.eVec[1], el1.eVec[0]);
  };
  const perCentury = ((run(true) - run(false)) * RAD * 3600) * 10;
  assert.ok(Math.abs(perCentury - 42.98) < 1.0, `precession ${perCentury.toFixed(2)}"/century`);
});

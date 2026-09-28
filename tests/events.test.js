import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../public/js/sim/simulation.js';
import { Body } from '../public/js/sim/body.js';
import { installEventHandlers } from '../public/js/sim/events.js';
import { buildSolarSystem } from '../public/js/sim/systems.js';
import { updateHierarchy } from '../public/js/sim/hierarchy.js';
import { elementsToState } from '../public/js/core/kepler.js';
import { G, AU, DAY, GM_SUN, MEARTH, YEAR } from '../public/js/core/constants.js';

const sun = () => new Body({ id: 'sun', kind: 'star', mass: GM_SUN / G, radius: 695700, star: { temperature: 5772, luminosity: 1 } });

function momentum(sim) {
  const p = [0, 0, 0];
  let m = 0;
  for (const b of sim.bodies) {
    m += b.mass;
    for (let c = 0; c < 3; c++) p[c] += b.mass * b.vel[c];
  }
  return { p, m };
}

test('collisions conserve mass and momentum', () => {
  const sim = new Simulation();
  installEventHandlers(sim, null);
  const a = new Body({ id: 'a', kind: 'planet', mass: MEARTH, radius: 6371 });
  const b = new Body({ id: 'b', kind: 'planet', mass: 0.1 * MEARTH, radius: 3390 });
  sim.addMany([
    { body: a, pos: [0, 0, 0], vel: [0, 0, 0] },
    { body: b, pos: [40000, 3000, 0], vel: [-9, 0, 0] },
  ]);
  // Measure momentum immediately before and after the collision is resolved (afterwards,
  // massless debris is deliberately not a gravity source, so momentum then drifts slightly).
  let before = null, after = null;
  const resolve = sim.handlers.collision;
  sim.handlers.collision = (x, y) => {
    before = momentum(sim);
    resolve(x, y);
    after = momentum(sim);
  };
  for (let k = 0; k < 200 && sim.bodies.includes(b); k++) sim.advance(60, 1e9);
  assert.ok(!b.sim, 'impactor merged');
  assert.ok(Math.abs(after.m - before.m) / before.m < 1e-9, 'mass conserved (incl. debris)');
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(after.p[c] - before.p[c]) < 1e-6 * before.m * 9, `momentum ${c}`);
  assert.ok(a.heat > 100, 'giant impact heats the target');
  assert.ok(sim.bodies.some((x) => x.kind === 'debris'), 'ejecta launched');
});

test('a moon dropped inside the Roche limit is tidally disrupted', () => {
  const sim = new Simulation();
  installEventHandlers(sim, null);
  const earth = new Body({ id: 'earth', kind: 'planet', mass: MEARTH, radius: 6371 });
  const moon = new Body({ id: 'moon', kind: 'moon', mass: 7.35e22, radius: 1737 });
  const r = 15000; // well inside the fluid Roche limit (~18,400 km)
  const v = Math.sqrt((G * (earth.mass + moon.mass)) / r);
  sim.addMany([
    { body: earth, pos: [0, 0, 0], vel: [0, 0, 0] },
    { body: moon, pos: [r, 0, 0], vel: [0, v, 0] },
  ]);
  for (let k = 0; k < 120 && moon.sim; k++) sim.advance(60, 1e9);
  assert.ok(!moon.sim, 'moon disrupted');
  const frags = sim.bodies.filter((b) => b.kind === 'debris');
  assert.ok(frags.length > 50, `fragments: ${frags.length}`);
  const fm = frags.reduce((s, b) => s + b.mass, 0);
  assert.ok(Math.abs(fm - 7.35e22) / 7.35e22 < 1e-9, 'fragment mass equals the moon');
});

test('a fast impactor is not disrupted before it hits', () => {
  const sim = new Simulation();
  installEventHandlers(sim, null);
  const earth = new Body({ id: 'earth', kind: 'planet', mass: MEARTH, radius: 6371 });
  const rock = new Body({ id: 'imp', kind: 'planet', mass: 0.05 * MEARTH, radius: 2700 });
  sim.addMany([
    { body: earth, pos: [0, 0, 0], vel: [0, 0, 0] },
    { body: rock, pos: [60000, 1000, 0], vel: [-15, 0, 0] },
  ]);
  const events = [];
  sim.handlers.disruption = () => events.push('disruption');
  const coll = sim.handlers.collision;
  sim.handlers.collision = (a, b) => {
    events.push('collision');
    coll(a, b);
  };
  sim.reinit();
  for (let k = 0; k < 200 && rock.sim; k++) sim.advance(30, 1e9);
  assert.deepEqual(events.slice(0, 1), ['collision']);
});

test('on-rails moons follow their Kepler orbit and resume integration', () => {
  const sim = new Simulation();
  const d0 = new Date(Date.UTC(2025, 0, 1));
  sim.time = (d0 - Date.UTC(2000, 0, 1, 12)) / 1000;
  buildSolarSystem(sim, d0, { comets: false, include: ['sun', 'mars', 'phobos', 'deimos', 'earth', 'moon', 'jupiter'] });
  updateHierarchy(sim);
  const phobos = sim.findById('phobos');
  const mars = sim.findById('mars');
  const e0 = sim.totalEnergy();
  sim.setRails([phobos, sim.findById('deimos')]);
  for (let k = 0; k < 100; k++) sim.advance(YEAR / 100, 1e9);
  const d = Math.hypot(phobos.pos[0] - mars.pos[0], phobos.pos[1] - mars.pos[1], phobos.pos[2] - mars.pos[2]);
  assert.ok(d > 9000 && d < 9700, `Phobos stays at ${d.toFixed(0)} km`);
  sim.setRails([]);
  for (let k = 0; k < 20; k++) sim.advance(DAY / 20, 1e9);
  const d2 = Math.hypot(phobos.pos[0] - mars.pos[0], phobos.pos[1] - mars.pos[1], phobos.pos[2] - mars.pos[2]);
  assert.ok(d2 > 9000 && d2 < 9700, 'resumes a sensible orbit');
  assert.ok(Math.abs((sim.totalEnergy() - e0) / e0) < 1e-6, 'energy of the integrated bodies is unaffected');
});

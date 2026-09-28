// Collision and tidal-disruption physics.
//
// Collisions conserve mass and linear momentum. The outcome depends on the specific impact
// energy relative to the gravitational binding energy of the colliding pair:
//   - small impactors merge (cratering), with a little ejecta,
//   - large impacts merge with substantial debris and melt the surface (magma ocean),
//   - super-catastrophic impacts shatter both bodies into fragments.
// Stars and black holes simply accrete. Bodies inside the Roche limit of a much more massive
// body are torn apart into a stream of fragments that shear into a ring.

import { Body } from './body.js';
import { G, MSUN } from '../core/constants.js';
import { rng, gaussian } from '../core/vec.js';

const MAX_DEBRIS = 1500;
let debrisSerial = 0;

export function installEventHandlers(sim, app) {
  sim.handlers.collision = (a, b) => resolveCollision(sim, a, b, app);
  sim.handlers.disruption = (body, by) => tidalDisruption(sim, body, by, app);
}

function bindingEnergy(m, r) {
  return (3 * G * m * m) / (5 * r); // kg km^2/s^2
}

function debrisCount(sim) {
  let n = 0;
  for (const b of sim.bodies) if (b.kind === 'debris') n++;
  return n;
}

function isAccretor(b) {
  return b.kind === 'star' || b.kind === 'blackhole' || b.kind === 'neutron' || b.kind === 'whitedwarf';
}

export function resolveCollision(sim, a, b, app) {
  // Order: `big` survives.
  let big = a.mass >= b.mass ? a : b;
  let small = big === a ? b : a;
  if (isAccretor(small) && !isAccretor(big)) [big, small] = [small, big];
  const pa = Array.from(big.pos), pb = Array.from(small.pos);
  const va = big.vel, vb = small.vel;
  const M = big.mass + small.mass;
  const vcm = [0, 1, 2].map((k) => (big.mass * va[k] + small.mass * vb[k]) / M);
  const pcm = [0, 1, 2].map((k) => (big.mass * pa[k] + small.mass * pb[k]) / M);
  const vrel = Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]);
  // Impact angular momentum axis (null for head-on collisions).
  const dr = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
  const dv = [vb[0] - va[0], vb[1] - va[1], vb[2] - va[2]];
  const Lh = [dr[1] * dv[2] - dr[2] * dv[1], dr[2] * dv[0] - dr[0] * dv[2], dr[0] * dv[1] - dr[1] * dv[0]];
  const Ll = Math.hypot(...Lh);
  const axis = Ll > 0.25 * Math.hypot(...dr) * vrel ? Lh.map((x) => x / Ll) : null;
  const mu = (big.mass * small.mass) / M;
  const ke = 0.5 * mu * vrel * vrel; // kg km^2/s^2
  const U = bindingEnergy(M, Math.cbrt(big.radius ** 3 + small.radius ** 3));
  const Q = ke / U;
  const event = { type: 'collision', a: big.name, b: small.name, vrel, energyJ: ke * 1e6, Q, pos: pcm, time: sim.time };

  // Debris particles never spawn more debris; they are absorbed.
  if (small.kind === 'debris' || isAccretor(big)) {
    absorb(sim, big, small, pcm, vcm, ke, app);
    event.outcome = isAccretor(big) ? (big.kind === 'blackhole' ? 'swallowed' : 'accreted') : 'absorbed';
    if (small.kind !== 'debris') app?.onEvent?.(event);
    return;
  }

  if (Q > 1.0 && small.mass > 0.05 * big.mass) {
    // Catastrophic disruption: largest remnant keeps a fraction of the mass.
    const lr = Math.max(0.1, 1 - 0.5 * Math.min(Q, 1.8));
    const remnantMass = M * lr;
    const debrisMass = M - remnantMass;
    const survivor = big;
    const rho = (big.mass + small.mass) / ((4 / 3) * Math.PI * (big.radius ** 3 + small.radius ** 3));
    survivor.mass = remnantMass;
    survivor.radius = Math.cbrt(remnantMass / ((4 / 3) * Math.PI * rho));
    survivor.heat = Math.max(survivor.heat, Math.min(4000, heatFrom(ke, M)));
    sim.remove(small);
    sim.setState(survivor, pcm, vcm);
    spawnDebris(sim, survivor, debrisMass, pcm, vcm, Math.sqrt((2 * G * M) / survivor.radius) * 1.15, 120, big.name, axis);
    event.outcome = 'catastrophic disruption';
  } else {
    // Merge; eject a debris fraction for energetic impacts.
    const ejectFrac = Math.min(0.25, 0.05 + Q * 0.3) * (small.mass / M > 0.01 ? 1 : 0.2);
    const debrisMass = small.mass * ejectFrac;
    absorb(sim, big, small, pcm, vcm, ke, app, debrisMass);
    if (debrisMass > 0 && small.mass > 1e18) {
      const vesc = Math.sqrt((2 * G * big.mass) / big.radius);
      const n = Math.round(Math.min(260, 30 + 900 * Math.min(Q, 0.25)));
      spawnDebris(sim, big, debrisMass, pcm, vcm, vesc * 1.05, n, big.name, axis);
    }
    event.outcome = Q > 0.05 ? 'giant impact' : 'impact';
  }
  app?.onEvent?.(event);
}

function heatFrom(keKgKm2s2, massKg) {
  // Temperature rise if a fraction of impact energy melts/heats the outer layers (c_p ~ 1 kJ/kg/K).
  const joules = keKgKm2s2 * 1e6;
  return (0.3 * joules) / (massKg * 1000) * 4;
}

function absorb(sim, big, small, pcm, vcm, ke, app, keepOutMass = 0) {
  const M = big.mass + small.mass - keepOutMass;
  if (big.kind === 'blackhole') {
    big.mass = M;
    big.updateStellarFromMass();
    big.accretion += Math.log10(1 + small.mass / 1e20);
  } else if (big.kind === 'star') {
    big.mass = M;
    big.updateStellarFromMass();
  } else if (isAccretor(big)) {
    big.mass = M;
  } else {
    // Volume-conserving merge (compression ignored).
    big.radius = Math.cbrt(big.radius ** 3 + small.radius ** 3 * (1 - keepOutMass / Math.max(small.mass, 1)));
    big.mass = M;
    if (small.kind !== 'debris') big.heat = Math.max(big.heat, Math.min(4000, big.heat + heatFrom(ke, M)));
    else big.heat = Math.min(4000, big.heat + heatFrom(ke, M));
  }
  sim.remove(small);
  sim.setState(big, pcm, vcm);
  app?.onBodyRemoved?.(small, big);
  app?.onBodyChanged?.(big);
}

// Debris launch. With `axis` (impact angular momentum direction) most ejecta is launched
// prograde and tangentially at sub-escape speeds so it forms an orbiting disk, like the
// proto-lunar disk after the Moon-forming impact; a minority escapes.
export function spawnDebris(sim, parent, totalMass, center, vcm, speed, count, label, axis = null) {
  const room = Math.max(0, MAX_DEBRIS - debrisCount(sim));
  count = Math.min(count, room);
  if (count <= 0 || totalMass <= 0) return [];
  const rand = rng((sim.time * 1000) ^ count);
  const items = [];
  const m = totalMass / count;
  const rho = 3000e9; // kg/km^3 (3 g/cm^3)
  const r = Math.max(0.5, Math.cbrt(m / ((4 / 3) * Math.PI * rho)));
  const R0 = parent.radius * 1.15;
  const vesc = Math.sqrt((2 * G * parent.mass) / R0);
  for (let k = 0; k < count; k++) {
    let dir = [gaussian(rand), gaussian(rand), gaussian(rand)];
    if (axis) {
      // Concentrate toward the plane perpendicular to the impact angular momentum.
      const d = dir[0] * axis[0] + dir[1] * axis[1] + dir[2] * axis[2];
      dir = dir.map((x, c) => x - axis[c] * d * 0.85);
    }
    const l = Math.hypot(...dir) || 1;
    const u = dir.map((x) => x / l);
    let vel;
    if (axis) {
      // Tangential (prograde) launch at 0.72-1.05 v_esc (circular speed is 0.707 v_esc).
      const t = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]];
      const tl = Math.hypot(...t) || 1;
      const st = vesc * (0.72 + 0.33 * Math.pow(rand(), 1.5));
      const sr = vesc * 0.12 * rand();
      vel = [vcm[0] + (t[0] / tl) * st + u[0] * sr, vcm[1] + (t[1] / tl) * st + u[1] * sr, vcm[2] + (t[2] / tl) * st + u[2] * sr];
    }
    const s = speed * (0.75 + 0.6 * rand());
    const body = new Body({
      id: `debris-${++debrisSerial}`,
      name: `Debris ${debrisSerial}`,
      kind: 'debris',
      mass: m,
      radius: r,
      albedo: 0.1,
      geoAlbedo: 0.12,
      massless: true,
      showOrbit: false,
      showLabel: false,
      heat: 2200, // freshly launched melt
      parent: parent.id,
      info: `Ejecta from ${label}.`,
    });
    items.push({ body, pos: [center[0] + u[0] * R0, center[1] + u[1] * R0, center[2] + u[2] * R0], vel: vel || [vcm[0] + u[0] * s, vcm[1] + u[1] * s, vcm[2] + u[2] * s] });
  }
  sim.addMany(items);
  return items.map((i) => i.body);
}

export function tidalDisruption(sim, body, by, app) {
  const pos = Array.from(body.pos);
  const vel = body.vel;
  const count = body.radius > 500 ? 220 : body.radius > 50 ? 90 : 24;
  const room = Math.max(0, MAX_DEBRIS - debrisCount(sim));
  const n = Math.min(count, room);
  if (n < 4) {
    body.noDisrupt = true;
    return;
  }
  const rand = rng(Math.floor(sim.time) ^ body.uid);
  const m = body.mass / n;
  const r = body.radius / Math.cbrt(n);
  // Fragments fill the original body's volume, keeping its bulk velocity; differential
  // tidal velocity (shear) then spreads them along the orbit.
  const rel = [pos[0] - by.pos[0], pos[1] - by.pos[1], pos[2] - by.pos[2]];
  const d = Math.hypot(...rel);
  const radial = rel.map((x) => x / d);
  const items = [];
  const isComet = !!body.comet;
  for (let k = 0; k < n; k++) {
    let q;
    do {
      q = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
    } while (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] > 1);
    // Stretch along the radial direction (tidal elongation).
    const along = q[0] * 2.2;
    const off = [radial[0] * along * body.radius + q[1] * body.radius * 0.6, radial[1] * along * body.radius + q[2] * body.radius * 0.6, radial[2] * along * body.radius];
    // Keplerian shear: inner fragments move faster.
    const dv = -Math.sqrt((G * by.mass) / d) * (along * body.radius) / (2 * d);
    const tang = [vel[0] - by.vel[0], vel[1] - by.vel[1], vel[2] - by.vel[2]];
    const tl = Math.hypot(...tang) || 1;
    const frag = new Body({
      id: `frag-${++debrisSerial}`,
      name: `${body.name} fragment ${k + 1}`,
      kind: 'debris',
      mass: m,
      radius: Math.max(r, 0.2),
      albedo: body.albedo,
      geoAlbedo: body.geoAlbedo,
      massless: true,
      showOrbit: false,
      showLabel: false,
      comet: isComet ? { activity: (body.comet.activity || 1) / Math.sqrt(n) } : null,
      parent: by.id,
      info: `Fragment of ${body.name}, torn apart inside the Roche limit of ${by.name}.`,
    });
    frag.noDisrupt = true;
    items.push({
      body: frag,
      pos: [pos[0] + off[0], pos[1] + off[1], pos[2] + off[2]],
      vel: [vel[0] + (tang[0] / tl) * dv + gaussian(rand) * 0.01, vel[1] + (tang[1] / tl) * dv + gaussian(rand) * 0.01, vel[2] + (tang[2] / tl) * dv + gaussian(rand) * 0.01],
    });
  }
  sim.remove(body);
  sim.addMany(items);
  app?.onBodyRemoved?.(body, by);
  app?.onEvent?.({ type: 'disruption', a: body.name, b: by.name, pos, time: sim.time, outcome: `torn apart by ${by.name}'s tides` });
}

export function supernova(sim, star, app) {
  // Core collapse: most of the envelope is ejected as a fast shell; remnant is a neutron
  // star (< ~20 Msun progenitor) or a black hole.
  const pos = Array.from(star.pos);
  const vel = star.vel;
  const mSun = star.mass / MSUN;
  const remnantKind = mSun > 20 ? 'blackhole' : 'neutron';
  const remnantMass = (remnantKind === 'blackhole' ? Math.max(3, mSun * 0.25) : 1.4) * MSUN;
  const ejecta = star.mass - remnantMass;
  star.kind = remnantKind;
  star.mass = remnantMass;
  if (remnantKind === 'neutron') {
    star.radius = 12;
    star.star = { temperature: 600000, luminosity: 0.02 };
  } else {
    star.star = null;
    star.updateStellarFromMass();
  }
  star.appearance = null;
  star.name = `${star.name} remnant`;
  sim.setState(star, pos, vel);
  spawnDebris(sim, star, ejecta, pos, vel, 8000, 300, 'supernova');
  app?.onBodyChanged?.(star);
  app?.onEvent?.({ type: 'supernova', a: star.name, pos, time: sim.time, outcome: `collapsed to a ${remnantKind === 'blackhole' ? 'black hole' : 'neutron star'}` });
}

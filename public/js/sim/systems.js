// Scenario construction helpers shared by the app and the test-suite.

import { Body } from './body.js';
import { solarSystemStates, iauAxis, eqjToEcl, poleFromRaDec } from './ephemeris.js';
import { G, AU, DEG, MSUN, MEARTH, REARTH, RSUN, MJUP, RJUP } from '../core/constants.js';
import { elementsToState } from '../core/kepler.js';
import { add } from '../core/vec.js';

export function bodyFromSpec(spec, date = new Date()) {
  let pole = null;
  if (spec.iau) pole = iauAxis(spec.iau, date).pole;
  else if (spec.rotation && spec.rotation.poleRA !== undefined) pole = eqjToEcl(poleFromRaDec(spec.rotation.poleRA, spec.rotation.poleDec));
  return new Body({ ...spec, mass: spec.mass ?? spec.gm / G, pole });
}

export function cometBody(c) {
  return new Body({
    id: c.id,
    name: c.name,
    kind: c.interstellar ? 'asteroid' : 'comet',
    mass: Math.max(c.gm / G, 1e10),
    radius: c.radius,
    albedo: 0.04,
    geoAlbedo: 0.04,
    massless: true,
    parent: 'sun',
    comet: c.activity > 0 ? { activity: c.activity } : null,
    rotation: { periodH: 12 + (c.radius % 40), poleRA: (c.node * 7) % 360, poleDec: 30, W0: 0 },
    shape: [c.radius * 1.4, c.radius, c.radius * 0.8],
    appearance: { proc: { type: 10, seed: c.name.length * 13, c1: [0.22, 0.2, 0.19], c2: [0.12, 0.11, 0.1], c3: [0.3, 0.28, 0.26], craters: 0.5, detail: 1.0 } },
    info: c.interstellar
      ? 'First known interstellar object: an elongated body on a hyperbolic (unbound) trajectory.'
      : `Comet with perihelion ${c.q.toFixed(3)} AU and eccentricity ${c.e.toFixed(4)}.`,
  });
}

/** Populate `sim` with the real solar system at `date`. */
export function buildSolarSystem(sim, date, { include = null, comets = true } = {}) {
  const states = solarSystemStates(date, { include, comets });
  const items = [];
  for (const [id, s] of states) {
    const body = s.comet ? cometBody(s.spec) : bodyFromSpec(s.spec, date);
    items.push({ body, pos: s.r, vel: s.v });
  }
  sim.addMany(items);
  sim.recenter();
  return sim;
}

/**
 * Add a body on an orbit around `primary` (a Body in the simulation).
 * el: { a (km), e, i (deg), node, argp, M (deg) } relative to the ecliptic, or to `frame`.
 */
export function orbitState(primary, satMass, el) {
  const mu = G * (primary.mass + satMass);
  const st = elementsToState(mu, {
    a: el.a, e: el.e || 0, i: (el.i || 0) * DEG, node: (el.node || 0) * DEG, argp: (el.argp || 0) * DEG, M: (el.M || 0) * DEG,
  });
  // Place relative to primary; primary recoil is handled by a final recenter.
  return { r: add(primary.pos, st.r), v: add(primary.vel, st.v) };
}

export const UNITS = { G, AU, MSUN, MEARTH, REARTH, RSUN, MJUP, RJUP };

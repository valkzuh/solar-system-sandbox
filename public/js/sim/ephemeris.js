// Builds initial conditions for the real solar system at a given date.
//
// Planets, Pluto, the Sun and the Moon come from astronomy-engine (VSOP87 / ELP / Pluto
// numerical model), the Galilean moons from the L1.2 theory. Other moons use mean orbital
// elements relative to their planet's IAU equator with deterministic phases. Comets and
// minor planets use osculating heliocentric elements propagated with Kepler's equation.

import * as Astronomy from '../../vendor/astronomy/astronomy.js';
import { AU, DAY, DEG, G, GM_SUN, OBLIQUITY_J2000, dateToSimTime } from '../core/constants.js';
import { elementsToState } from '../core/kepler.js';
import { add, cross, norm, rng, hashString, scale, sub } from '../core/vec.js';
import { SOLAR_SYSTEM, COMETS } from '../data/catalog.js';

const cosE = Math.cos(OBLIQUITY_J2000);
const sinE = Math.sin(OBLIQUITY_J2000);

// J2000 equatorial -> J2000 ecliptic.
export function eqjToEcl(v) {
  return [v[0], v[1] * cosE + v[2] * sinE, -v[1] * sinE + v[2] * cosE];
}

export function eclToEqj(v) {
  return [v[0], v[1] * cosE - v[2] * sinE, v[1] * sinE + v[2] * cosE];
}

const AU_PER_DAY = AU / DAY; // km/s

function stateFromAstro(s) {
  return {
    r: eqjToEcl([s.x * AU, s.y * AU, s.z * AU]),
    v: eqjToEcl([s.vx * AU_PER_DAY, s.vy * AU_PER_DAY, s.vz * AU_PER_DAY]),
  };
}

// Unit pole vector (ecliptic) and prime meridian angle (rad) for an IAU body.
export function iauAxis(name, date) {
  const info = Astronomy.RotationAxis(Astronomy.Body[name], date);
  const n = info.north;
  return { pole: eqjToEcl([n.x, n.y, n.z]), poleEqj: [n.x, n.y, n.z], spin: info.spin * DEG };
}

// Orientation basis (ecliptic frame) for a body given its pole in EQJ and spin angle W.
// Returns { x: prime meridian direction, y: 90°E, z: pole } — all ecliptic unit vectors.
export function basisFromPoleSpin(poleEqj, spin) {
  // Ascending node of the body's equator on the ICRF equator.
  let node = [-poleEqj[1], poleEqj[0], 0];
  const nl = Math.hypot(node[0], node[1]);
  node = nl > 1e-9 ? [node[0] / nl, node[1] / nl, 0] : [1, 0, 0];
  const yq = cross(poleEqj, node);
  const c = Math.cos(spin), s = Math.sin(spin);
  const xm = [node[0] * c + yq[0] * s, node[1] * c + yq[1] * s, node[2] * c + yq[2] * s];
  const z = eqjToEcl(poleEqj);
  const x = eqjToEcl(xm);
  const y = cross(z, x);
  return { x, y, z };
}

// Equatorial RA/Dec (deg) pole -> EQJ unit vector.
export function poleFromRaDec(raDeg, decDeg) {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

function jdToSimTime(jd) {
  return (jd - 2451545.0) * DAY;
}

// Moon on mean elements relative to its parent's equator.
function moonFromElements(spec, parentSpec, parentGm, date, t) {
  const o = spec.orbit;
  const rand = rng(hashString(spec.id));
  const node0 = rand() * 360;
  const argp0 = rand() * 360;
  const L0 = rand() * 360; // mean longitude at J2000 (deterministic pseudo-phase)
  const mu = parentGm + spec.gm;
  const n = Math.sqrt(mu / (o.a * o.a * o.a)); // rad/s
  // Apsidal & nodal precession are ignored; phases advance with the true mean motion.
  const M = (L0 - node0 - argp0) * DEG + n * t;
  const local = elementsToState(mu, { a: o.a, e: o.e, i: o.i * DEG, node: node0 * DEG, argp: argp0 * DEG, M });
  // Local frame: parent's equator. Build basis from parent pole.
  let poleEqj;
  if (parentSpec.iau) {
    poleEqj = iauAxis(parentSpec.iau, date).poleEqj;
  } else if (parentSpec.rotation && parentSpec.rotation.poleRA !== undefined) {
    poleEqj = poleFromRaDec(parentSpec.rotation.poleRA, parentSpec.rotation.poleDec);
  } else {
    poleEqj = eclToEqj([0, 0, 1]);
  }
  const zE = eqjToEcl(poleEqj);
  let xE = cross([0, 0, 1], zE);
  if (Math.hypot(...xE) < 1e-9) xE = [1, 0, 0];
  xE = norm(xE);
  const yE = cross(zE, xE);
  const toEcl = (p) => [
    p[0] * xE[0] + p[1] * yE[0] + p[2] * zE[0],
    p[0] * xE[1] + p[1] * yE[1] + p[2] * zE[1],
    p[0] * xE[2] + p[1] * yE[2] + p[2] * zE[2],
  ];
  return { r: toEcl(local.r), v: toEcl(local.v) };
}

// Heliocentric osculating elements (ecliptic J2000) -> state relative to the Sun.
export function helioElementsState(h, t) {
  const mu = GM_SUN;
  const a = h.a * AU;
  const n = Math.sqrt(mu / (a * a * a));
  const M = h.M * DEG + n * (t - jdToSimTime(h.epochJD));
  return elementsToState(mu, { a, e: h.e, i: h.i * DEG, node: h.node * DEG, argp: h.argp * DEG, M });
}

export function cometState(c, t) {
  const tp = dateToSimTime(new Date(c.tp));
  return elementsToState(GM_SUN, {
    q: c.q * AU, e: c.e, i: c.i * DEG, node: c.node * DEG, argp: c.argp * DEG, tp, t,
  });
}

/**
 * Compute barycentric ecliptic states (km, km/s) for every catalog body at `date`.
 * Returns Map id -> { spec, r, v }.
 */
export function solarSystemStates(date, { include = null, comets = true } = {}) {
  const t = dateToSimTime(date);
  const out = new Map();
  const specs = SOLAR_SYSTEM.filter((s) => !include || include.includes(s.id));
  const byId = new Map(SOLAR_SYSTEM.map((s) => [s.id, s]));
  const sunBary = stateFromAstro(Astronomy.BaryState(Astronomy.Body.Sun, date));
  let jupiterMoons = null;

  // Pass 1: bodies with direct ephemerides.
  for (const s of specs) {
    if (s.ephem === 'astronomy') {
      const st = s.id === 'sun' ? sunBary : stateFromAstro(Astronomy.BaryState(Astronomy.Body[s.iau], date));
      out.set(s.id, { spec: s, r: st.r, v: st.v });
    } else if (s.ephem === 'moon') {
      const st = stateFromAstro(Astronomy.BaryState(Astronomy.Body.Moon, date));
      out.set(s.id, { spec: s, r: st.r, v: st.v });
    } else if (s.ephem === 'heliocentric-elements') {
      const rel = helioElementsState(s.helio, t);
      out.set(s.id, { spec: s, r: add(sunBary.r, rel.r), v: add(sunBary.v, rel.v) });
    }
  }
  // Pass 2: moons relative to parents.
  for (const s of specs) {
    const parent = out.get(s.parent);
    if (s.ephem === 'jupiterMoon') {
      if (!parent) continue;
      jupiterMoons = jupiterMoons || Astronomy.JupiterMoons(date);
      const key = ['io', 'europa', 'ganymede', 'callisto'][s.jupiterIndex];
      const st = stateFromAstro(jupiterMoons[key]);
      out.set(s.id, { spec: s, r: add(parent.r, st.r), v: add(parent.v, st.v), rel: st });
    } else if (s.ephem === 'elements') {
      if (!parent) continue;
      const pSpec = byId.get(s.parent);
      const st = moonFromElements(s, pSpec, pSpec.gm, date, t);
      out.set(s.id, { spec: s, r: add(parent.r, st.r), v: add(parent.v, st.v), rel: st });
    }
  }
  // Pass 3: ephemerides give planet-system barycentres (except Earth, whose Moon is explicit);
  // shift each planet so that planet + moons have their barycentre at the ephemeris point.
  for (const s of specs) {
    if (s.ephem !== 'astronomy' || s.id === 'earth' || s.id === 'sun') continue;
    const moons = specs.filter((m) => m.parent === s.id && out.has(m.id));
    if (!moons.length) continue;
    const P = out.get(s.id);
    let mTot = s.gm;
    const dr = [0, 0, 0], dv = [0, 0, 0];
    for (const m of moons) {
      const M = out.get(m.id);
      mTot += m.gm;
      for (let c = 0; c < 3; c++) {
        dr[c] += m.gm * (M.r[c] - P.r[c]);
        dv[c] += m.gm * (M.v[c] - P.v[c]);
      }
    }
    const sr = scale(dr, 1 / mTot), sv = scale(dv, 1 / mTot);
    for (const id of [s.id, ...moons.map((m) => m.id)]) {
      const B = out.get(id);
      B.r = sub(B.r, sr);
      B.v = sub(B.v, sv);
    }
  }
  if (comets) {
    for (const c of COMETS) {
      const rel = cometState(c, t);
      out.set(c.id, { spec: c, comet: true, r: add(sunBary.r, rel.r), v: add(sunBary.v, rel.v) });
    }
  }
  return out;
}

export { Astronomy };
export const GM_SUN_KM = GM_SUN;
export const Gconst = G;

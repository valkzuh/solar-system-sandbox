// Orbital hierarchy: for every body find its dominant attractor ("primary") using Hill
// spheres, and compute osculating Keplerian elements relative to it.

import { G } from '../core/constants.js';
import { stateToElements } from '../core/kepler.js';

export function updateHierarchy(sim) {
  const bodies = sim.bodies.filter((b) => b.sim);
  const massive = bodies.filter((b) => !b.massless && b.mass > 0).sort((a, b) => b.mass - a.mass);
  const hill = new Map();
  const d = (a, b) => {
    const p = a.pos, q = b.pos;
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  };
  // Process in descending mass so primaries are resolved before satellites.
  for (const b of massive) {
    b.primary = findPrimary(b, massive, hill, d);
    if (!b.primary) {
      hill.set(b, Infinity);
    } else {
      const r = d(b, b.primary);
      const el = relElements(b, b.primary);
      const a = el && el.e < 1 && el.a > 0 ? el.a * (1 - el.e) : r;
      const h = a * Math.cbrt(b.mass / (3 * (b.primary.mass + b.mass)));
      hill.set(b, Math.min(h, hill.get(b.primary) ?? Infinity));
    }
  }
  for (const b of bodies) {
    if (b.massless || !(b.mass > 0)) b.primary = findPrimary(b, massive, hill, d);
    b.orbit = b.primary ? relElements(b, b.primary) : null;
  }
}

function findPrimary(b, massive, hill, d) {
  let best = null;
  let bestHill = Infinity;
  let strongest = null;
  let strongestAcc = 0;
  for (const m of massive) {
    if (m === b || m.mass <= b.mass) continue;
    const r = d(b, m);
    const acc = m.mass / (r * r);
    if (acc > strongestAcc) {
      strongestAcc = acc;
      strongest = m;
    }
    const h = hill.get(m);
    if (h === undefined) continue;
    if (r < h && h < bestHill) {
      best = m;
      bestHill = h;
    }
  }
  return best || strongest;
}

export function relElements(b, p) {
  const r = [b.pos[0] - p.pos[0], b.pos[1] - p.pos[1], b.pos[2] - p.pos[2]];
  const bv = b.vel, pv = p.vel;
  const v = [bv[0] - pv[0], bv[1] - pv[1], bv[2] - pv[2]];
  const mu = G * (p.mass + (b.massless ? 0 : b.mass));
  if (!(mu > 0)) return null;
  const el = stateToElements(mu, r, v);
  el.mu = mu;
  el.r = Math.hypot(...r);
  el.speed = Math.hypot(...v);
  el.relPos = r;
  el.relVel = v;
  return el;
}

// Circular-orbit velocity for placing a body at `pos` around `primary`, in the plane
// perpendicular to `normal` (ecliptic north by default), prograde.
export function circularVelocity(primary, pos, mass, normal = [0, 0, 1]) {
  const r = [pos[0] - primary.pos[0], pos[1] - primary.pos[1], pos[2] - primary.pos[2]];
  const rl = Math.hypot(...r);
  let t = [normal[1] * r[2] - normal[2] * r[1], normal[2] * r[0] - normal[0] * r[2], normal[0] * r[1] - normal[1] * r[0]];
  let tl = Math.hypot(...t);
  if (tl < 1e-9) {
    t = [0, 1, 0];
    tl = 1;
  }
  const vc = Math.sqrt((G * (primary.mass + mass)) / rl);
  const pv = primary.vel;
  return [pv[0] + (t[0] / tl) * vc, pv[1] + (t[1] / tl) * vc, pv[2] + (t[2] / tl) * vc];
}

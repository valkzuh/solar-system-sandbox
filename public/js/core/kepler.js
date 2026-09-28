// Two-body orbital mechanics: conversion between Keplerian elements and state vectors.
// Handles elliptic (e < 1) and hyperbolic (e > 1) orbits. Angles in radians.

import { cross, dot, len, sub, norm, scale } from './vec.js';
import { TAU } from './constants.js';

export function solveKeplerElliptic(M, e) {
  M = ((M % TAU) + TAU) % TAU;
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 50; k++) {
    const f = E - e * Math.sin(E) - M;
    const d = f / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-14) break;
  }
  return E;
}

export function solveKeplerHyperbolic(M, e) {
  let H = Math.asinh(M / e);
  for (let k = 0; k < 60; k++) {
    const f = e * Math.sinh(H) - H - M;
    const d = f / (e * Math.cosh(H) - 1);
    H -= d;
    if (Math.abs(d) < 1e-14) break;
  }
  return H;
}

// Rotate a perifocal vector into the reference frame.
function perifocalToFrame(p, i, node, argp) {
  const cO = Math.cos(node), sO = Math.sin(node);
  const ci = Math.cos(i), si = Math.sin(i);
  const cw = Math.cos(argp), sw = Math.sin(argp);
  const r11 = cO * cw - sO * sw * ci;
  const r12 = -cO * sw - sO * cw * ci;
  const r21 = sO * cw + cO * sw * ci;
  const r22 = -sO * sw + cO * cw * ci;
  const r31 = sw * si;
  const r32 = cw * si;
  return [r11 * p[0] + r12 * p[1], r21 * p[0] + r22 * p[1], r31 * p[0] + r32 * p[1]];
}

/**
 * Elements -> state.
 * el: { e, i, node, argp } plus either
 *   { a, M }            mean anomaly at the evaluation time, or
 *   { q, tp, t }        perihelion distance, time of perihelion, evaluation time (seconds).
 * Returns { r:[x,y,z], v:[x,y,z] } in the frame the angles refer to.
 */
export function elementsToState(mu, el) {
  const e = el.e;
  let a = el.a;
  if (a === undefined) a = el.q / (1 - e);
  let M = el.M;
  if (M === undefined) {
    const n = Math.sqrt(mu / Math.abs(a * a * a));
    M = n * (el.t - el.tp);
  }
  let rp, vp;
  if (e < 1) {
    const E = solveKeplerElliptic(M, e);
    const cE = Math.cos(E), sE = Math.sin(E);
    const b = a * Math.sqrt(1 - e * e);
    const r = a * (1 - e * cE);
    rp = [a * (cE - e), b * sE, 0];
    const k = Math.sqrt(mu * a) / r;
    vp = [-k * sE, k * Math.sqrt(1 - e * e) * cE, 0];
  } else {
    // a < 0 for hyperbolic orbits.
    const H = solveKeplerHyperbolic(M, e);
    const cH = Math.cosh(H), sH = Math.sinh(H);
    const aa = -a;
    const b = aa * Math.sqrt(e * e - 1);
    const r = aa * (e * cH - 1);
    rp = [aa * (e - cH), b * sH, 0];
    const k = Math.sqrt(mu * aa) / r;
    vp = [-k * sH, k * Math.sqrt(e * e - 1) * cH, 0];
  }
  return {
    r: perifocalToFrame(rp, el.i, el.node, el.argp),
    v: perifocalToFrame(vp, el.i, el.node, el.argp),
  };
}

/**
 * State -> osculating elements relative to a central body with parameter mu.
 * refNormal is the pole of the reference plane (defaults to +z).
 */
export function stateToElements(mu, r, v) {
  const rl = len(r);
  const vl2 = dot(v, v);
  const h = cross(r, v);
  const hl = len(h);
  const eVec = sub(scale(cross(v, h), 1 / mu), scale(r, 1 / rl));
  const e = len(eVec);
  const energy = vl2 / 2 - mu / rl;
  const a = Math.abs(energy) > 1e-30 ? -mu / (2 * energy) : Infinity;
  const i = hl > 0 ? Math.acos(Math.max(-1, Math.min(1, h[2] / hl))) : 0;
  const nVec = [-h[1], h[0], 0];
  const nl = len(nVec);
  let node = nl > 1e-12 ? Math.acos(Math.max(-1, Math.min(1, nVec[0] / nl))) : 0;
  if (nVec[1] < 0) node = TAU - node;
  let argp;
  if (nl > 1e-12 && e > 1e-10) {
    argp = Math.acos(Math.max(-1, Math.min(1, dot(nVec, eVec) / (nl * e))));
    if (eVec[2] < 0) argp = TAU - argp;
  } else if (e > 1e-10) {
    argp = Math.atan2(eVec[1], eVec[0]);
    if (h[2] < 0) argp = TAU - argp;
  } else {
    argp = 0;
  }
  let nu;
  if (e > 1e-10) {
    nu = Math.acos(Math.max(-1, Math.min(1, dot(eVec, r) / (e * rl))));
    if (dot(r, v) < 0) nu = TAU - nu;
  } else {
    const ref = nl > 1e-12 ? norm(nVec) : [1, 0, 0];
    nu = Math.acos(Math.max(-1, Math.min(1, dot(ref, r) / rl)));
    if (dot(cross(ref, r), h) < 0) nu = TAU - nu;
  }
  let M = 0;
  let period = Infinity;
  if (e < 1) {
    const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
    M = E - e * Math.sin(E);
    period = TAU * Math.sqrt((a * a * a) / mu);
  } else if (e > 1) {
    const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
    M = e * Math.sinh(H) - H;
  }
  const periapsis = hl * hl / mu / (1 + e);
  const apoapsis = e < 1 ? a * (1 + e) : Infinity;
  return { a, e, i, node, argp, nu, M, period, periapsis, apoapsis, h: hl, energy, eVec, hVec: h };
}

/**
 * Sample an orbit (elliptic or hyperbolic branch) as points relative to the focus,
 * in the same frame as the elements. Returns Float64Array of xyz triplets and
 * the per-point true anomaly.
 */
export function sampleOrbit(el, count, maxRadius = Infinity) {
  const pts = new Float64Array(count * 3);
  const anomalies = new Float64Array(count);
  const e = el.e;
  const p = el.h !== undefined && el.mu ? (el.h * el.h) / el.mu : Math.abs(el.a * (1 - e * e));
  let nuMin = -Math.PI, nuMax = Math.PI;
  if (e >= 1) {
    let lim = Math.acos(-1 / e) * 0.999;
    if (isFinite(maxRadius)) {
      const cosNu = (p / maxRadius - 1) / e;
      if (cosNu > -1 && cosNu < 1) lim = Math.min(lim, Math.acos(cosNu));
    }
    nuMin = -lim;
    nuMax = lim;
  }
  for (let k = 0; k < count; k++) {
    let nu;
    if (e < 1) {
      // Sample uniformly in eccentric anomaly so high-e orbits stay smooth near periapsis.
      const E = -Math.PI + (TAU * k) / (count - 1);
      nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    } else {
      nu = nuMin + ((nuMax - nuMin) * k) / (count - 1);
    }
    const r = p / (1 + e * Math.cos(nu));
    const q = perifocalToFrame([r * Math.cos(nu), r * Math.sin(nu), 0], el.i, el.node, el.argp);
    pts[k * 3] = q[0];
    pts[k * 3 + 1] = q[1];
    pts[k * 3 + 2] = q[2];
    anomalies[k] = nu;
  }
  return { pts, anomalies };
}

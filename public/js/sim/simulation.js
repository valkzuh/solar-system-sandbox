// N-body gravitational simulation.
//
// Integrator: 4th-order Hermite predictor-corrector with individual block time steps
// (Makino & Aarseth 1992) and the Aarseth time-step criterion. Each body advances with its
// own power-of-two step, so a 7-hour Phobos orbit and a 165-year Neptune orbit coexist
// efficiently and accurately. Massless bodies (debris, comets, probes) feel gravity but do
// not source it. Optional first post-Newtonian (1PN) correction from stellar-mass sources
// reproduces relativistic perihelion precession (43"/century for Mercury).
//
// Time reversal: the integrator always runs forward on an internal clock; running the
// simulation backwards is done by flipping velocities (Newtonian gravity and the 1PN term
// used here are time-reversal symmetric).

import { C_KMS } from '../core/constants.js';

const C2 = C_KMS * C_KMS;

export class Simulation {
  constructor() {
    this.bodies = [];
    this.n = 0;
    this.cap = 0;
    this.eta = 0.005; // Aarseth accuracy parameter (0.002 precise, 0.015 fast)
    this.etaStart = 0.004;
    this.etaPair = 0.02;
    this.iterations = 2; // P(EC)^n corrector iterations
    this.dtMax = Math.pow(2, 22); // ~48.5 days
    this.dtMin = Math.pow(2, -12);
    this.relativity = true;
    this.collisions = true;
    this.tidalDisruption = true;
    this.time = 0; // physical time, seconds since J2000
    this.dir = 1; // +1 forward, -1 backward
    this.tauBase = 0; // physical time at internal clock zero
    this.tau = 0; // internal clock
    this.stats = { blocks: 0, steps: 0, lagging: false, achievedRate: 0, energy0: null, energy: 0, drift: 0 };
    this.handlers = { collision: null, disruption: null };
    this.pendingEvents = [];
    this.massive = new Int32Array(0);
    this.nMassive = 0;
    this.version = 0; // bumps whenever the body list changes
    this._alloc(64);
  }

  _alloc(cap) {
    const old = this.cap ? this : null;
    const mk = (k) => {
      const a = new Float64Array(cap * k);
      return a;
    };
    const x = mk(3), v = mk(3), a = mk(3), j = mk(3), xp = mk(3), vp = mk(3), rx = mk(3), rv = mk(3);
    const t = mk(1), dt = mk(1), gm = mk(1), rad = mk(1);
    if (old) {
      x.set(this.x); v.set(this.v); a.set(this.a); j.set(this.j); xp.set(this.xp); vp.set(this.vp);
      rx.set(this.rx); rv.set(this.rv); t.set(this.t); dt.set(this.dt); gm.set(this.gmArr); rad.set(this.rad);
    }
    Object.assign(this, { x, v, a, j, xp, vp, rx, rv, t, dt, gmArr: gm, rad });
    this.cap = cap;
    this.grSrc = new Uint8Array(cap);
    this.isDebris = new Uint8Array(cap);
    this.rocheK = new Float64Array(cap);
    this.lastStep = new Float64Array(cap);
    this.j2R2 = new Float64Array(cap);
    this.poleArr = new Float64Array(cap * 3);
  }

  // ---------------------------------------------------------------------------
  // Body management

  bodyPos(i) {
    return this.rx.subarray(i * 3, i * 3 + 3);
  }

  bodyVel(i) {
    const d = this.dir;
    return [this.rv[i * 3] * d, this.rv[i * 3 + 1] * d, this.rv[i * 3 + 2] * d];
  }

  add(body, pos, velPhys) {
    this.sync();
    if (this.n >= this.cap) this._alloc(this.cap * 2);
    const i = this.n++;
    body.index = i;
    body.sim = this;
    this.bodies.push(body);
    this._writeState(i, pos, velPhys);
    this.reinit();
    return body;
  }

  addMany(list) {
    // list: [{ body, pos, vel }]
    this.sync();
    while (this.n + list.length > this.cap) this._alloc(this.cap * 2);
    for (const item of list) {
      const i = this.n++;
      item.body.index = i;
      item.body.sim = this;
      this.bodies.push(item.body);
      this._writeState(i, item.pos, item.vel);
    }
    this.reinit();
  }

  remove(body) {
    this.removeMany([body]);
  }

  removeMany(list) {
    if (!list.length) return;
    this.sync();
    const dead = new Set(list);
    const keep = this.bodies.filter((b) => !dead.has(b));
    const nx = new Float64Array(this.cap * 3);
    const nv = new Float64Array(this.cap * 3);
    keep.forEach((b, k) => {
      for (let c = 0; c < 3; c++) {
        nx[k * 3 + c] = this.x[b.index * 3 + c];
        nv[k * 3 + c] = this.v[b.index * 3 + c];
      }
    });
    list.forEach((b) => {
      b.index = -1;
      b.sim = null;
    });
    keep.forEach((b, k) => (b.index = k));
    this.bodies = keep;
    this.n = keep.length;
    this.x.set(nx);
    this.v.set(nv);
    this.reinit();
  }

  clear() {
    this.bodies.forEach((b) => {
      b.index = -1;
      b.sim = null;
    });
    this.bodies = [];
    this.n = 0;
    this.reinit();
  }

  // Set a body's physical state (position km, velocity km/s).
  setState(body, pos, velPhys) {
    this.sync();
    this._writeState(body.index, pos, velPhys);
    this.reinit();
  }

  // Call after changing masses/radii/kinds.
  touch() {
    this.sync();
    this.reinit();
  }

  _writeState(i, pos, velPhys) {
    for (let c = 0; c < 3; c++) {
      this.x[i * 3 + c] = pos[c];
      this.v[i * 3 + c] = velPhys[c] * this.dir;
      this.rx[i * 3 + c] = pos[c];
      this.rv[i * 3 + c] = velPhys[c] * this.dir;
    }
  }

  setDirection(dir) {
    if (dir === this.dir) return;
    this.sync();
    for (let k = 0; k < this.n * 3; k++) this.v[k] = -this.v[k];
    this.dir = dir;
    this.reinit();
  }

  // ---------------------------------------------------------------------------
  // Integration core

  // Bring every body to the current internal time tau (exact Hermite step of arbitrary length)
  // and restart the block clock at zero.
  sync() {
    const n = this.n;
    if (!n) {
      this.tauBase = this.time;
      this.tau = 0;
      return;
    }
    const tau = this.tau;
    let behind = false;
    for (let i = 0; i < n; i++) if (this.t[i] < tau) behind = true;
    if (behind) {
      this._predictAll(tau);
      const acc = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < n; i++) {
        const h = tau - this.t[i];
        if (h <= 0) continue;
        this._force(i, acc);
        this._correct(i, h, acc);
        this.t[i] = tau;
      }
    }
    // Commit positions for rendering.
    this.rx.set(this.x.subarray(0, n * 3));
    this.rv.set(this.v.subarray(0, n * 3));
    this.tauBase = this.time;
    this.tau = 0;
    for (let i = 0; i < n; i++) this.t[i] = 0;
  }

  reinit() {
    const n = this.n;
    this.version++;
    // Source lists & per-body constants.
    const massive = [];
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      this.gmArr[i] = b.gm;
      this.rad[i] = b.kind === 'blackhole' ? b.radius : b.radius;
      this.isDebris[i] = b.kind === 'debris' ? 1 : 0;
      this.grSrc[i] = b.kind === 'star' || b.kind === 'blackhole' || b.kind === 'neutron' || b.kind === 'whitedwarf' ? 1 : 0;
      // Roche coefficient: fluid (2.44) for self-gravity dominated bodies, rigid (1.26) for small ones.
      const disruptable = !(b.kind === 'star' || b.kind === 'blackhole' || b.kind === 'neutron' || b.kind === 'whitedwarf' || b.kind === 'debris' || b.kind === 'probe');
      // Skip unphysical densities (< 0.1 g/cm^3), e.g. placeholder test particles.
      const physical = b.mass > 0 && b.density > 0.1 && !b.noDisrupt;
      this.rocheK[i] = disruptable && physical && this.handlers.disruption ? (b.radius > 200 ? 2.44 : 1.26) * b.radius / Math.cbrt(b.mass) : 0;
      this.j2R2[i] = b.j2 && b.pole && !b.massless ? b.j2 * b.j2Radius * b.j2Radius : 0;
      if (b.pole) {
        this.poleArr[i * 3] = b.pole[0]; this.poleArr[i * 3 + 1] = b.pole[1]; this.poleArr[i * 3 + 2] = b.pole[2];
      }
      if (!b.massless && b.mass > 0) massive.push(i);
    }
    this.massive = Int32Array.from(massive);
    this.nMassive = massive.length;
    this.tauBase = this.time;
    this.tau = 0;
    const acc = [0, 0, 0, 0, 0, 0];
    this.xp.set(this.x.subarray(0, n * 3));
    this.vp.set(this.v.subarray(0, n * 3));
    for (let i = 0; i < n; i++) {
      this._force(i, acc);
      const i3 = i * 3;
      this.a[i3] = acc[0]; this.a[i3 + 1] = acc[1]; this.a[i3 + 2] = acc[2];
      this.j[i3] = acc[3]; this.j[i3 + 1] = acc[4]; this.j[i3 + 2] = acc[5];
      const am = Math.hypot(acc[0], acc[1], acc[2]);
      const jm = Math.hypot(acc[3], acc[4], acc[5]);
      let h = jm > 0 ? (this.etaStart * am) / jm : this.dtMax;
      if (!(h > 0) || !isFinite(h)) h = this.dtMax;
      this.dt[i] = this._quantizeDown(h);
      this.t[i] = 0;
    }
    this.rx.set(this.x.subarray(0, n * 3));
    this.rv.set(this.v.subarray(0, n * 3));
    this.stats.energy0 = null;
  }

  _quantizeDown(h) {
    if (h >= this.dtMax) return this.dtMax;
    if (h <= this.dtMin) return this.dtMin;
    return Math.pow(2, Math.floor(Math.log2(h)));
  }

  _predictAll(tt) {
    const { x, v, a, j, xp, vp, t } = this;
    for (let i = 0; i < this.n; i++) this._predict(i, tt, x, v, a, j, xp, vp, t);
  }

  _predict(i, tt, x, v, a, j, xp, vp, t) {
    const h = tt - t[i];
    const i3 = i * 3;
    if (h === 0) {
      xp[i3] = x[i3]; xp[i3 + 1] = x[i3 + 1]; xp[i3 + 2] = x[i3 + 2];
      vp[i3] = v[i3]; vp[i3 + 1] = v[i3 + 1]; vp[i3 + 2] = v[i3 + 2];
      return;
    }
    const h2 = (h * h) / 2;
    const h3 = (h2 * h) / 3;
    for (let c = 0; c < 3; c++) {
      const k = i3 + c;
      xp[k] = x[k] + h * v[k] + h2 * a[k] + h3 * j[k];
      vp[k] = v[k] + h * a[k] + h2 * j[k];
    }
  }

  // Acceleration and jerk on body i from all massive bodies at predicted positions.
  _force(i, out) {
    const { xp, vp, gmArr, massive, nMassive } = this;
    const i3 = i * 3;
    const xi = xp[i3], yi = xp[i3 + 1], zi = xp[i3 + 2];
    const ui = vp[i3], vi = vp[i3 + 1], wi = vp[i3 + 2];
    let ax = 0, ay = 0, az = 0, jx = 0, jy = 0, jz = 0;
    const gr = this.relativity;
    const gmi = gmArr[i];
    let tau2 = Infinity;
    for (let m = 0; m < nMassive; m++) {
      const k = massive[m];
      if (k === i) continue;
      const k3 = k * 3;
      const dx = xp[k3] - xi, dy = xp[k3 + 1] - yi, dz = xp[k3 + 2] - zi;
      const du = vp[k3] - ui, dv = vp[k3 + 1] - vi, dw = vp[k3 + 2] - wi;
      const r2 = dx * dx + dy * dy + dz * dz + 1e-12;
      const r = Math.sqrt(r2);
      const gm = gmArr[k];
      const f = gm / (r2 * r);
      // Pair dynamical time for comparable-mass neighbours (e.g. Earth feeling the Moon):
      // the Aarseth criterion alone under-resolves a heavy body's wobble around a light companion.
      if (gm > 1e-3 * gmi && gm <= gmi) {
        const tt = (r2 * r) / (gm + gmi);
        if (tt < tau2) tau2 = tt;
      }
      const rv = (dx * du + dy * dv + dz * dw) / r2;
      ax += f * dx; ay += f * dy; az += f * dz;
      jx += f * (du - 3 * rv * dx);
      jy += f * (dv - 3 * rv * dy);
      jz += f * (dw - 3 * rv * dz);
      if (gr && this.grSrc[k] && gm > 1000 * gmi) {
        // 1PN Schwarzschild correction for a test particle orbiting source k.
        // r_vec from source to particle = -d, v_rel = -dv (sign cancels in the rv term).
        const v2 = du * du + dv * dv + dw * dw;
        const rdotv = dx * du + dy * dv + dz * dw;
        const g = gm / (C2 * r2 * r);
        const s = 4 * gm / r - v2;
        // a = GM/(c^2 r^3) [(4GM/r - v^2) r_vec + 4 (r_vec . v_rel) v_rel], with r_vec = -d, v_rel = -dvel.
        ax -= g * (s * dx + 4 * rdotv * du);
        ay -= g * (s * dy + 4 * rdotv * dv);
        az -= g * (s * dz + 4 * rdotv * dw);
      }
      // J2 oblateness of source k acting on i (only within 60 equatorial radii), and the
      // reaction of i's own oblateness to k. Jerk via a directional finite difference.
      const jk = this.j2R2[k];
      const ji = this.j2R2[i];
      if ((jk > 0 && r2 < (3600 * jk) / this.bodies[k].j2) || (ji > 0 && r2 < (3600 * ji) / this.bodies[i].j2)) {
        const P = this.poleArr;
        const t0 = this._j2pair(dx, dy, dz, gm, jk, P, k3, ji, i3);
        const vr = Math.sqrt(du * du + dv * dv + dw * dw) || 1;
        const eps = (1e-4 * r) / vr;
        const t1 = this._j2pair(dx + du * eps, dy + dv * eps, dz + dw * eps, gm, jk, P, k3, ji, i3);
        ax += t0[0]; ay += t0[1]; az += t0[2];
        jx += (t1[0] - t0[0]) / eps;
        jy += (t1[1] - t0[1]) / eps;
        jz += (t1[2] - t0[2]) / eps;
      }
    }
    out[0] = ax; out[1] = ay; out[2] = az; out[3] = jx; out[4] = jy; out[5] = jz;
    this._pairTau = Math.sqrt(tau2);
  }

  // Acceleration on i from source k's J2 (jk = J2 R^2 of k) plus reaction to i's own J2 (ji).
  // d = x_k - x_i.
  _j2pair(dx, dy, dz, gm, jk, P, k3, ji, i3) {
    const out = this._j2tmp || (this._j2tmp = [0, 0, 0]);
    const r2 = dx * dx + dy * dy + dz * dz;
    const r = Math.sqrt(r2);
    let ax = 0, ay = 0, az = 0;
    if (jk > 0) {
      const px = P[k3], py = P[k3 + 1], pz = P[k3 + 2];
      const z = -(dx * px + dy * py + dz * pz);
      const q = (1.5 * gm * jk) / (r2 * r2 * r);
      const u = 1 - (5 * z * z) / r2;
      ax -= q * (-u * dx + 2 * z * px);
      ay -= q * (-u * dy + 2 * z * py);
      az -= q * (-u * dz + 2 * z * pz);
    }
    if (ji > 0) {
      const px = P[i3], py = P[i3 + 1], pz = P[i3 + 2];
      const z = dx * px + dy * py + dz * pz;
      const q = (1.5 * gm * ji) / (r2 * r2 * r);
      const u = 1 - (5 * z * z) / r2;
      ax += q * (u * dx + 2 * z * px);
      ay += q * (u * dy + 2 * z * py);
      az += q * (u * dz + 2 * z * pz);
    }
    return [ax, ay, az];
  }

  _correct(i, h, acc) {
    const { x, v, a, j, xp, vp } = this;
    const i3 = i * 3;
    const h2 = h * h;
    let a2m = 0, a3m = 0, a1m = 0, j1m = 0;
    const a2v = [0, 0, 0], a3v = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const k = i3 + c;
      const a0 = a[k], j0 = j[k], a1 = acc[c], j1 = acc[3 + c];
      const v1 = v[k] + ((a0 + a1) * h) / 2 + ((j0 - j1) * h2) / 12;
      const x1 = x[k] + ((v[k] + v1) * h) / 2 + ((a0 - a1) * h2) / 12;
      x[k] = x1;
      v[k] = v1;
      xp[k] = x1;
      vp[k] = v1;
      const a2 = (-6 * (a0 - a1) - h * (4 * j0 + 2 * j1)) / h2;
      const a3 = (12 * (a0 - a1) + 6 * h * (j0 + j1)) / (h2 * h);
      a2v[c] = a2 + h * a3;
      a3v[c] = a3;
      a[k] = a1;
      j[k] = j1;
    }
    a1m = Math.hypot(a[i3], a[i3 + 1], a[i3 + 2]);
    j1m = Math.hypot(j[i3], j[i3 + 1], j[i3 + 2]);
    a2m = Math.hypot(a2v[0], a2v[1], a2v[2]);
    a3m = Math.hypot(a3v[0], a3v[1], a3v[2]);
    const num = a1m * a2m + j1m * j1m;
    const den = j1m * a3m + a2m * a2m;
    let hn = den > 0 ? Math.sqrt((this.eta * num) / den) : this.dtMax;
    if (!(hn > 0) || !isFinite(hn)) hn = this.dtMax;
    return hn;
  }

  // Advance the physical clock by dtPhys seconds (sign selects direction) within a wall-clock budget.
  advance(dtPhys, budgetMs = 10) {
    if (dtPhys === 0 || this.n === 0) {
      this.stats.achievedRate = 0;
      this.stats.lagging = false;
      if (this.n === 0) this.time += dtPhys;
      return;
    }
    const want = dtPhys > 0 ? 1 : -1;
    if (want !== this.dir) this.setDirection(want);
    const deadline = performance.now() + budgetMs;
    const t0 = this.time;
    let remaining = Math.abs(dtPhys);
    this.stats.lagging = false;
    let guard = 0;
    while (remaining > 0 && guard++ < 64) {
      const target = this.tau + remaining;
      const reached = this._run(target, deadline);
      remaining -= reached;
      this.time = this.tauBase + this.dir * this.tau;
      if (this.pendingEvents.length) {
        this._resolveEvents();
        continue;
      }
      if (this.stats.lagging) break;
    }
    if (remaining > 0 && guard >= 64) this.stats.lagging = true;
    // Render-time prediction.
    this._predictRender(this.tau);
    this.time = this.tauBase + this.dir * this.tau;
    this.stats.achievedRate = Math.abs(this.time - t0);
  }

  // Integrate internal clock up to `target`; returns internal time advanced.
  _run(target, deadline) {
    const n = this.n;
    const start = this.tau;
    const { t, dt } = this;
    const acc = [0, 0, 0, 0, 0, 0];
    const active = this._active || (this._active = new Int32Array(Math.max(this.cap, 64)));
    if (active.length < this.cap) this._active = new Int32Array(this.cap);
    const act = this._active;
    let blocks = 0;
    for (;;) {
      let tmin = Infinity;
      for (let i = 0; i < n; i++) {
        const tn = t[i] + dt[i];
        if (tn < tmin) tmin = tn;
      }
      if (tmin > target) {
        this.tau = target;
        break;
      }
      let na = 0;
      for (let i = 0; i < n; i++) if (t[i] + dt[i] === tmin) act[na++] = i;
      // Predict sources and active bodies.
      const { x, v, a, j, xp, vp } = this;
      for (let m = 0; m < this.nMassive; m++) this._predict(this.massive[m], tmin, x, v, a, j, xp, vp, t);
      for (let q = 0; q < na; q++) this._predict(act[q], tmin, x, v, a, j, xp, vp, t);
      for (let q = 0; q < na; q++) {
        const i = act[q];
        this._force(i, acc);
        const h = tmin - t[i];
        this.lastStep[i] = h;
        let hn;
        if (this.iterations > 1) {
          // P(EC)^n: re-evaluate the force at the corrected state and correct again from
          // the original state. Makes Hermite nearly time-symmetric (Kokubo et al. 1998).
          const i3 = i * 3;
          const s0 = this._s0 || (this._s0 = new Float64Array(12));
          for (let c = 0; c < 3; c++) {
            s0[c] = x[i3 + c]; s0[3 + c] = v[i3 + c]; s0[6 + c] = a[i3 + c]; s0[9 + c] = j[i3 + c];
          }
          for (let it = 0; it < this.iterations; it++) {
            if (it > 0) {
              for (let c = 0; c < 3; c++) {
                x[i3 + c] = s0[c]; v[i3 + c] = s0[3 + c]; a[i3 + c] = s0[6 + c]; j[i3 + c] = s0[9 + c];
              }
              this._force(i, acc);
            }
            hn = this._correct(i, h, acc);
          }
        } else {
          hn = this._correct(i, h, acc);
        }
        hn = Math.min(hn, this.etaPair * this._pairTau);
        t[i] = tmin;
        // Block quantisation.
        let dtq = dt[i];
        if (hn < dtq) {
          while (dtq > hn && dtq > this.dtMin) dtq /= 2;
        } else if (hn >= 2 * dtq && dtq < this.dtMax) {
          const d2 = 2 * dtq;
          if (tmin % d2 === 0) dtq = d2;
        }
        dt[i] = dtq;
      }
      // Collision / tidal checks for the active set.
      if ((this.collisions && this.handlers.collision) || this.tidalDisruption) this._checkEvents(act, na, tmin);
      this.tau = tmin;
      this.stats.steps += na;
      blocks++;
      if (this.pendingEvents.length) break;
      if ((blocks & 15) === 0 && performance.now() > deadline) {
        this.stats.lagging = true;
        break;
      }
    }
    this.stats.blocks = blocks;
    return this.tau - start;
  }

  _checkEvents(act, na, tnow) {
    const { xp, vp, rad, gmArr, massive, nMassive, isDebris, rocheK } = this;
    for (let q = 0; q < na; q++) {
      const i = act[q];
      const i3 = i * 3;
      for (let m = 0; m < nMassive; m++) {
        const k = massive[m];
        if (k === i) continue;
        if (isDebris[i] && isDebris[k]) continue;
        const k3 = k * 3;
        const dx = xp[i3] - xp[k3], dy = xp[i3 + 1] - xp[k3 + 1], dz = xp[i3 + 2] - xp[k3 + 2];
        const r2 = dx * dx + dy * dy + dz * dz;
        const rs = rad[i] + rad[k];
        if (this.collisions && this.handlers.collision && !this.bodies[i].noCollide) {
          let hit = r2 < rs * rs;
          if (!hit) {
            // Swept test over the last step assuming linear relative motion.
            const du = vp[i3] - vp[k3], dv = vp[i3 + 1] - vp[k3 + 1], dw = vp[i3 + 2] - vp[k3 + 2];
            const w2 = du * du + dv * dv + dw * dw;
            if (w2 > 0) {
              const h = this.lastStep[i];
              let s = -(dx * du + dy * dv + dz * dw) / w2;
              s = Math.max(-h, Math.min(0, s));
              const ex = dx + du * s, ey = dy + dv * s, ez = dz + dw * s;
              hit = ex * ex + ey * ey + ez * ez < rs * rs;
            }
          }
          if (hit) {
            this.pendingEvents.push({ type: 'collision', a: this.bodies[i], b: this.bodies[k] });
            return;
          }
        }
        if (this.tidalDisruption && rocheK[i] > 0 && gmArr[k] > 5 * gmArr[i] && !isDebris[k]) {
          const mk = gmArr[k];
          const lim = rocheK[i] * Math.cbrt(this.bodies[k].mass);
          if (r2 < lim * lim && r2 > rs * rs && mk > 0) {
            this.pendingEvents.push({ type: 'disruption', body: this.bodies[i], by: this.bodies[k] });
            return;
          }
        }
      }
    }
  }

  _resolveEvents() {
    const events = this.pendingEvents.splice(0);
    this.sync();
    for (const ev of events) {
      if (ev.type === 'collision') {
        if (ev.a.sim && ev.b.sim && this.handlers.collision) this.handlers.collision(ev.a, ev.b);
        else if (ev.a.sim && ev.b.sim) ev.a.noCollide = ev.b.noCollide = true;
      }
      if (ev.type === 'disruption' && ev.body.sim) {
        if (this.handlers.disruption) this.handlers.disruption(ev.body, ev.by);
        if (ev.body.sim) ev.body.noDisrupt = true; // handler declined; never re-trigger
      }
    }
    this.reinit();
  }

  _predictRender(tt) {
    const { x, v, a, j, rx, rv, t } = this;
    for (let i = 0; i < this.n; i++) this._predict(i, tt, x, v, a, j, rx, rv, t);
  }

  // ---------------------------------------------------------------------------
  // Diagnostics

  totalEnergy() {
    let ke = 0, pe = 0;
    const { rx, rv, bodies, n } = this;
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b.massless) continue;
      const i3 = i * 3;
      ke += 0.5 * b.mass * (rv[i3] ** 2 + rv[i3 + 1] ** 2 + rv[i3 + 2] ** 2);
      for (let k = i + 1; k < n; k++) {
        const c = bodies[k];
        if (c.massless) continue;
        const k3 = k * 3;
        const r = Math.hypot(rx[i3] - rx[k3], rx[i3 + 1] - rx[k3 + 1], rx[i3 + 2] - rx[k3 + 2]);
        pe -= (b.gm * c.mass) / Math.max(r, 1e-9);
      }
    }
    return ke + pe;
  }

  centerOfMass() {
    let m = 0;
    const p = [0, 0, 0], v = [0, 0, 0];
    for (let i = 0; i < this.n; i++) {
      const b = this.bodies[i];
      if (b.massless) continue;
      m += b.mass;
      for (let c = 0; c < 3; c++) {
        p[c] += b.mass * this.rx[i * 3 + c];
        v[c] += b.mass * this.rv[i * 3 + c] * this.dir;
      }
    }
    if (m > 0) for (let c = 0; c < 3; c++) { p[c] /= m; v[c] /= m; }
    return { mass: m, pos: p, vel: v };
  }

  // Shift the whole system so the centre of mass is at rest at the origin.
  recenter() {
    this.sync();
    const com = this.centerOfMass();
    for (let i = 0; i < this.n; i++) {
      for (let c = 0; c < 3; c++) {
        this.x[i * 3 + c] -= com.pos[c];
        this.v[i * 3 + c] -= com.vel[c] * this.dir;
      }
    }
    this.reinit();
  }

  findById(id) {
    return this.bodies.find((b) => b.id === id) || null;
  }
}

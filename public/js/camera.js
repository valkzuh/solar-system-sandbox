// Orbit camera with smooth, logarithmic zoom and cinematic fly-to transitions spanning
// scales from metres to light-years. Positions are double precision (ecliptic km).

import * as THREE from 'three';
import { renderToEcl } from './core/vec.js';

const UP = new THREE.Vector3(0, 1, 0);

function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class CameraController {
  constructor(dom) {
    this.dom = dom;
    this.focus = null; // Body
    this.focusPoint = [0, 0, 0]; // used when focus is null (ecliptic km)
    this.panOffset = [0, 0, 0]; // ecliptic km offset from focus
    this.azimuth = 0.6;
    this.elevation = 0.35;
    this.distance = 3e8;
    this.target = { azimuth: 0.6, elevation: 0.35, distance: 3e8 };
    this.fovY = (50 * Math.PI) / 180;
    this.targetFov = this.fovY;
    this.transition = null;
    this.camPos = [0, 0, 0];
    this.quat = new THREE.Quaternion();
    this.autoRotate = 0;
    this.listeners = {};
    this.pointers = new Map();
    this.minDistanceFn = () => 1e-3;
    this.bodyScale = 1;
    this._bind();
  }

  on(ev, fn) {
    (this.listeners[ev] ||= []).push(fn);
  }

  emit(ev, ...args) {
    (this.listeners[ev] || []).forEach((f) => f(...args));
  }

  focusPos() {
    const base = this.focus && this.focus.sim ? this.focus.pos : this.focusPoint;
    return [base[0] + this.panOffset[0], base[1] + this.panOffset[1], base[2] + this.panOffset[2]];
  }

  minDistance() {
    if (!this.focus) return 1e-3;
    const b = this.focus;
    const r = (b.isStar || b.kind === 'blackhole' ? b.radius : b.radius * this.bodyScale) * (b.shape ? Math.max(...b.shape) / b.radius : 1);
    return r * 1.0008 + 0.003;
  }

  // Fly to a body. `distance` defaults to a pleasant framing.
  flyTo(body, { distance, duration } = {}) {
    const from = this.focusPos();
    const fromDist = this.distance;
    const r = body.isStar || body.kind === 'blackhole' ? body.radius : body.radius * this.bodyScale;
    let d = distance ?? Math.max(r * (body.rings ? 7 : 4.2), 0.02);
    if (body.kind === 'blackhole') d = distance ?? Math.max(r * 60, 5000);
    const toPos = body.pos;
    const travel = Math.hypot(toPos[0] - from[0], toPos[1] - from[1], toPos[2] - from[2]);
    const dur = duration ?? Math.min(4.5, 1.2 + 0.35 * Math.log10(1 + travel / Math.max(Math.min(fromDist, d), 1)));
    this.transition = {
      body,
      from,
      fromDist,
      toDist: d,
      t: 0,
      dur,
      peak: Math.max(fromDist, d, travel * 0.6),
    };
    this.focus = body;
    this.panOffset = [0, 0, 0];
    this.target.distance = d;
    this.emit('focus', body);
  }

  setFocus(body, keepDistance = true) {
    if (keepDistance && this.focus && body) {
      // Keep the camera where it is; re-anchor to the new focus.
      const cp = this.camPos;
      const bp = body.pos;
      const rel = [cp[0] - bp[0], cp[1] - bp[1], cp[2] - bp[2]];
      this._setFromOffset(rel);
    }
    this.focus = body;
    this.panOffset = [0, 0, 0];
    this.transition = null;
    this.emit('focus', body);
  }

  _setFromOffset(relEcl) {
    // Convert an ecliptic offset into spherical camera parameters (render frame).
    const r = [relEcl[0], relEcl[2], -relEcl[1]];
    const d = Math.hypot(...r);
    this.distance = this.target.distance = d;
    this.elevation = this.target.elevation = Math.asin(Math.max(-1, Math.min(1, r[1] / d)));
    this.azimuth = this.target.azimuth = Math.atan2(r[0], r[2]);
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 10);
    if (this.autoRotate) this.target.azimuth += this.autoRotate * dt;
    this.azimuth += (this.target.azimuth - this.azimuth) * k;
    this.elevation += (this.target.elevation - this.elevation) * k;
    const minD = this.minDistance();
    this.target.distance = Math.max(this.target.distance, minD);
    // Zoom in log space, so it feels uniform at every scale.
    const ld = Math.log(this.distance) + (Math.log(this.target.distance) - Math.log(this.distance)) * k;
    this.distance = Math.max(Math.exp(ld), minD);
    this.fovY += (this.targetFov - this.fovY) * k;

    let center = this.focusPos();
    let dist = this.distance;
    if (this.transition) {
      const tr = this.transition;
      tr.t += dt / tr.dur;
      const e = ease(Math.min(tr.t, 1));
      const to = tr.body.sim ? tr.body.pos : tr.from;
      center = [tr.from[0] + (to[0] - tr.from[0]) * e, tr.from[1] + (to[1] - tr.from[1]) * e, tr.from[2] + (to[2] - tr.from[2]) * e];
      // Arc outwards in log-distance so long jumps pull back to show context.
      const l0 = Math.log(tr.fromDist), l1 = Math.log(tr.toDist), lp = Math.log(tr.peak);
      const base = l0 + (l1 - l0) * e;
      const bump = Math.max(0, lp - Math.max(l0, l1)) * Math.sin(Math.PI * e) * 0.85;
      dist = Math.exp(base + bump);
      this.distance = dist;
      this.target.distance = tr.toDist;
      if (tr.t >= 1) this.transition = null;
    }

    const ce = Math.cos(this.elevation);
    const off = new THREE.Vector3(Math.sin(this.azimuth) * ce, Math.sin(this.elevation), Math.cos(this.azimuth) * ce).multiplyScalar(dist);
    const offEcl = renderToEcl([off.x, off.y, off.z]);
    this.camPos = [center[0] + offEcl[0], center[1] + offEcl[1], center[2] + offEcl[2]];
    const m = new THREE.Matrix4().lookAt(off, new THREE.Vector3(0, 0, 0), UP);
    this.quat.setFromRotationMatrix(m);
    this.center = center;
  }

  // ------------------------------------------------------------------ input
  _bind() {
    const el = this.dom;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, t: performance.now() });
      if (this.pointers.size === 2) this.pinch = this._pinchDist();
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) {
        this.emit('hover', e);
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 2) {
        const d = this._pinchDist();
        if (this.pinch) this.zoomBy(Math.pow(this.pinch / d, 1.6));
        this.pinch = d;
        return;
      }
      if (this.emitCapture?.(e, 'move')) return;
      const pan = p.button === 2 || e.shiftKey;
      if (pan) {
        this.pan(dx, dy);
      } else {
        this.target.azimuth -= dx * 0.005;
        this.target.elevation = Math.max(-1.55, Math.min(1.55, this.target.elevation + dy * 0.005));
        this.transition = null;
      }
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (!p) return;
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (this.emitCapture?.(e, 'up')) return;
      if (moved < 5 && performance.now() - p.t < 400) this.emit('click', e);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', (e) => this.emit('dblclick', e));
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
        if (e.altKey) {
          this.targetFov = Math.max(0.0005, Math.min(1.9, this.targetFov * Math.pow(1.0015, delta)));
          this.emit('fov', this.targetFov);
          return;
        }
        this.zoomBy(Math.pow(1.0018, delta));
      },
      { passive: false },
    );
  }

  _pinchDist() {
    const pts = [...this.pointers.values()];
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  zoomBy(f) {
    this.target.distance = Math.max(this.minDistance(), Math.min(this.target.distance * f, 1e14));
    if (this.transition) {
      this.transition = null;
    }
  }

  pan(dx, dy) {
    // Move the orbit centre in the camera plane.
    const s = (this.distance * Math.tan(this.fovY / 2) * 2) / this.dom.clientHeight;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quat);
    const upv = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat);
    const mv = right.multiplyScalar(-dx * s).add(upv.multiplyScalar(dy * s));
    const e = renderToEcl([mv.x, mv.y, mv.z]);
    this.panOffset = [this.panOffset[0] + e[0], this.panOffset[1] + e[1], this.panOffset[2] + e[2]];
  }
}

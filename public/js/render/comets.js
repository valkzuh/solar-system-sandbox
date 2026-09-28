// Comet comae and tails. Gas and dust are released from the sunlit nucleus at a rate that
// scales with insolation (~r^-4 beyond ~1 AU; activity switches on inside ~4 AU where water
// ice sublimates). Dust grains feel reduced gravity (1 - beta) from radiation pressure and
// curve behind the orbit; ions are swept anti-sunward by the solar wind (~400 km/s).

import * as THREE from 'three';
import { AU, DAY } from '../core/constants.js';
import { LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';

const MAX = 24000;

const VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute vec4 aColor; // rgb, size (km)
uniform float uPixelAngle;
uniform float uPixelRatio;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(-mv.z, 1.0);
  float px = aColor.w / d / uPixelAngle;
  gl_PointSize = clamp(px, 1.5, 64.0) * uPixelRatio;
  // Conserve surface brightness when a puff shrinks below a pixel.
  float dim = px < 1.5 ? (px * px) / 2.25 : 1.0;
  vColor = aColor.rgb * dim;
  ${LOGDEPTH_VERT}
}
`;

const FRAG = /* glsl */ `
precision highp float;
${LOGDEPTH_FRAG_PARS}
varying vec3 vColor;
void main() {
  ${LOGDEPTH_FRAG}
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  gl_FragColor = vec4(vColor * exp(-r2 * 3.0), 1.0);
}
`;

export class CometTails {
  constructor(scene) {
    this.pos = new Float64Array(MAX * 3); // absolute ecliptic km
    this.vel = new Float64Array(MAX * 3);
    this.age = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.type = new Uint8Array(MAX); // 0 dust, 1 ion
    this.beta = new Float32Array(MAX);
    this.src = new Float32Array(MAX); // activity at emission
    this.n = 0;
    this.gpos = new Float32Array(MAX * 3);
    this.gcol = new Float32Array(MAX * 4);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.gpos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.gcol, 4).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPixelAngle: { value: 1e-3 }, uPixelRatio: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
    this.visible = true;
    this.intensity = 1;
    this.lastTime = null;
    this.carry = new Map();
    this.comae = []; // for coma sprites drawn by the point renderer
  }

  clear() {
    this.n = 0;
    this.lastTime = null;
  }

  // Activity factor for a comet at heliocentric distance r (km).
  static activity(comet, rKm, lumSun = 1) {
    const r = rKm / AU / Math.sqrt(Math.max(lumSun, 1e-6));
    const on = 1 / (1 + Math.exp((r - 3.2) * 3));
    return (comet.activity || 1) * on / Math.pow(Math.max(r, 0.05), 2.5);
  }

  step(sim, star, simTime) {
    if (this.lastTime === null) {
      this.lastTime = simTime;
      return;
    }
    let dt = simTime - this.lastTime;
    this.lastTime = simTime;
    if (dt <= 0 || !star || !this.visible) {
      if (dt < 0) this.n = 0;
      return;
    }
    dt = Math.min(dt, 5 * DAY);
    const gm = star.gm;
    const sp = star.pos;
    // Integrate existing particles (semi-implicit Euler with a few substeps).
    const sub = Math.max(1, Math.min(8, Math.ceil(dt / (0.5 * DAY))));
    const h = dt / sub;
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] > this.life[i]) continue;
      const i3 = i * 3;
      if (this.type[i] === 0) {
        const k = (1 - this.beta[i]) * gm;
        for (let s = 0; s < sub; s++) {
          const dx = this.pos[i3] - sp[0], dy = this.pos[i3 + 1] - sp[1], dz = this.pos[i3 + 2] - sp[2];
          const r2 = dx * dx + dy * dy + dz * dz;
          const f = -k / (r2 * Math.sqrt(r2));
          this.vel[i3] += f * dx * h; this.vel[i3 + 1] += f * dy * h; this.vel[i3 + 2] += f * dz * h;
          this.pos[i3] += this.vel[i3] * h; this.pos[i3 + 1] += this.vel[i3 + 1] * h; this.pos[i3 + 2] += this.vel[i3 + 2] * h;
        }
      } else {
        this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      }
      // Compact live particles.
      if (w !== i) {
        for (let c = 0; c < 3; c++) {
          this.pos[w * 3 + c] = this.pos[i3 + c];
          this.vel[w * 3 + c] = this.vel[i3 + c];
        }
        this.age[w] = this.age[i];
        this.life[w] = this.life[i];
        this.type[w] = this.type[i];
        this.beta[w] = this.beta[i];
        this.src[w] = this.src[i];
      }
      w++;
    }
    this.n = w;
    // Emit.
    this.comae.length = 0;
    for (const b of sim.bodies) {
      if (!b.comet || !b.sim) continue;
      const dx = b.pos[0] - sp[0], dy = b.pos[1] - sp[1], dz = b.pos[2] - sp[2];
      const r = Math.hypot(dx, dy, dz);
      const act = CometTails.activity(b.comet, r, star.star?.luminosity || 1);
      if (act < 0.01) continue;
      this.comae.push({ body: b, activity: act, r });
      const rate = Math.min(act * 120, 900); // particles per simulated day
      let want = rate * (dt / DAY) + (this.carry.get(b) || 0);
      const emit = Math.floor(want);
      this.carry.set(b, want - emit);
      const ux = -dx / r, uy = -dy / r, uz = -dz / r; // toward the Sun
      const bv = b.vel;
      for (let e = 0; e < Math.min(emit, 400) && this.n < MAX; e++) {
        const i = this.n++;
        const i3 = i * 3;
        const ion = Math.random() < 0.3;
        this.type[i] = ion ? 1 : 0;
        const age0 = Math.random() * dt;
        this.age[i] = age0;
        // Outflow (~0.5-1 km/s) biased toward the Sun-facing hemisphere.
        const ox = Math.random() * 2 - 1, oy = Math.random() * 2 - 1, oz = Math.random() * 2 - 1;
        const vo = 0.4 + Math.random() * 0.6;
        if (ion) {
          const vw = 250 + Math.random() * 200;
          this.vel[i3] = -ux * vw + ox * 10;
          this.vel[i3 + 1] = -uy * vw + oy * 10;
          this.vel[i3 + 2] = -uz * vw + oz * 10;
          this.life[i] = 1.5 * DAY;
        } else {
          this.vel[i3] = bv[0] + (ux * 0.8 + ox) * vo;
          this.vel[i3 + 1] = bv[1] + (uy * 0.8 + oy) * vo;
          this.vel[i3 + 2] = bv[2] + (uz * 0.8 + oz) * vo;
          this.beta[i] = Math.pow(Math.random(), 2) * 0.9 + 0.02;
          this.life[i] = (10 + Math.random() * 25) * DAY;
        }
        this.src[i] = act;
        this.pos[i3] = b.pos[0] + this.vel[i3] * age0 * 0.2;
        this.pos[i3 + 1] = b.pos[1] + this.vel[i3 + 1] * age0 * 0.2;
        this.pos[i3 + 2] = b.pos[2] + this.vel[i3 + 2] * age0 * 0.2;
      }
    }
  }

  update(camPos, ctx) {
    this.points.visible = this.visible && this.n > 0;
    if (!this.points.visible) return;
    const k = this.intensity * ctx.exposure;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      const x = this.pos[i3] - camPos[0], y = this.pos[i3 + 1] - camPos[1], z = this.pos[i3 + 2] - camPos[2];
      this.gpos[i3] = x;
      this.gpos[i3 + 1] = z;
      this.gpos[i3 + 2] = -y;
      const f = this.age[i] / this.life[i];
      const fade = (1 - f) * (1 - f);
      const i4 = i * 4;
      if (this.type[i] === 1) {
        // CO+ ion tail: blue.
        const s = 0.05 * k * fade * Math.min(this.src[i], 10);
        this.gcol[i4] = 0.25 * s; this.gcol[i4 + 1] = 0.5 * s; this.gcol[i4 + 2] = 1.0 * s;
        this.gcol[i4 + 3] = 1.5e5 + this.age[i] * 3;
      } else {
        const s = 0.04 * k * fade * Math.min(this.src[i], 10);
        this.gcol[i4] = 1.0 * s; this.gcol[i4 + 1] = 0.92 * s; this.gcol[i4 + 2] = 0.78 * s;
        this.gcol[i4 + 3] = 4e4 + this.age[i] * 1.5;
      }
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.mat.uniforms.uPixelAngle.value = ctx.pixelAngle;
    this.mat.uniforms.uPixelRatio.value = ctx.pixelRatio;
  }
}

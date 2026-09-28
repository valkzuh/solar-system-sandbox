// Osculating orbit paths (relative to each body's primary) and motion trails.
// Vertices are stored relative to the body itself, so the line is exact near the body even
// at interplanetary distances (float32-safe), and fades behind the body like a comet trail.

import * as THREE from 'three';
import { sampleOrbit } from '../core/kepler.js';
import { eclToRender } from '../core/vec.js';
import { LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';

const N = 360;

const VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute float aFade;
varying float vFade;
varying float vDepth;
void main() {
  vFade = aFade;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;

const FRAG = /* glsl */ `
precision highp float;
${LOGDEPTH_FRAG_PARS}
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  ${LOGDEPTH_FRAG}
  float a = uOpacity * (0.12 + 0.88 * vFade);
  gl_FragColor = vec4(uColor * a, a);
}
`;

const KIND_COLORS = {
  planet: [0.45, 0.7, 1.0],
  dwarf: [0.75, 0.65, 1.0],
  moon: [0.6, 0.75, 0.8],
  asteroid: [0.75, 0.7, 0.55],
  comet: [0.5, 0.95, 0.85],
  star: [1.0, 0.8, 0.45],
  blackhole: [1.0, 0.45, 0.35],
  whitedwarf: [0.8, 0.85, 1.0],
  neutron: [0.7, 0.8, 1.0],
  debris: [0.6, 0.55, 0.5],
  probe: [0.9, 0.9, 0.9],
};

class OrbitLine {
  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3);
    this.fade = new Float32Array(N);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aFade', new THREE.BufferAttribute(this.fade, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0.6 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.line = new THREE.Line(this.geo, this.mat);
    this.line.frustumCulled = false;
    this.line.renderOrder = 1;
  }
}

export class OrbitRenderer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.lines = new Map();
    this.trails = new Map();
    this.visible = true;
    this.trailsVisible = false;
    this.opacity = 0.55;
  }

  update(bodies, camPos, ctx) {
    const seen = new Set();
    this.group.visible = this.visible || this.trailsVisible;
    for (const b of bodies) {
      if (!this.visible || !b.showOrbit || !b.orbit || !b.primary || b.kind === 'debris') continue;
      const el = b.orbit;
      // Skip absurdly tiny or unbound-far-away orbits and hide when the orbit is sub-pixel.
      const prim = b.primary;
      const dCam = Math.hypot(prim.pos[0] - camPos[0], prim.pos[1] - camPos[1], prim.pos[2] - camPos[2]);
      const size = el.e < 1 ? el.a * (1 + el.e) : el.r * 3;
      const px = size / Math.max(dCam, 1) / ctx.pixelAngle;
      if (px < 6) continue;
      if (ctx.focusBody === b && ctx.camDist < b.radius * 20) continue;
      let ol = this.lines.get(b);
      if (!ol) {
        ol = new OrbitLine();
        this.lines.set(b, ol);
        this.group.add(ol.line);
      }
      seen.add(b);
      const { pts, anomalies } = sampleOrbit(el, N, el.e >= 1 ? Math.max(el.r * 4, 1e7) : Infinity);
      const rel = el.relPos; // body relative to primary (ecliptic)
      const nuB = el.nu;
      for (let k = 0; k < N; k++) {
        const p = eclToRender([pts[k * 3] - rel[0], pts[k * 3 + 1] - rel[1], pts[k * 3 + 2] - rel[2]]);
        ol.pos[k * 3] = p[0];
        ol.pos[k * 3 + 1] = p[1];
        ol.pos[k * 3 + 2] = p[2];
        // Fade: 1 just behind the body, decreasing along the path backwards in time.
        let d = (nuB - anomalies[k]) / (2 * Math.PI);
        d = d - Math.floor(d);
        if (el.e >= 1) d = anomalies[k] <= nuB ? (nuB - anomalies[k]) / (nuB - anomalies[0] + 1e-9) : 1;
        ol.fade[k] = el.e >= 1 && anomalies[k] > nuB ? 0.35 : Math.pow(1 - d, 1.6);
      }
      ol.geo.attributes.position.needsUpdate = true;
      ol.geo.attributes.aFade.needsUpdate = true;
      const bp = eclToRender([b.pos[0] - camPos[0], b.pos[1] - camPos[1], b.pos[2] - camPos[2]]);
      ol.line.position.set(bp[0], bp[1], bp[2]);
      ol.line.updateMatrix();
      const c = b.color ? b.color : KIND_COLORS[b.kind] || [0.7, 0.7, 0.7];
      ol.mat.uniforms.uColor.value.setRGB(c[0], c[1], c[2]);
      let op = this.opacity;
      if (ctx.selected === b) op = Math.min(1, op * 1.8);
      // Fade orbits that are much larger than the view (e.g. heliocentric orbit when at a planet).
      // Orbits vastly larger than the current view (e.g. heliocentric orbits seen from a
      // planet's vicinity) become straight lines across the sky: fade them out.
      const viewPx = size / Math.max(ctx.camDist, 1);
      if (viewPx > 60) op *= Math.max(0, 1 - Math.log10(viewPx / 60) / 1.3);
      ol.mat.uniforms.uOpacity.value = op;
      ol.line.visible = op > 0.01;
    }
    for (const [b, ol] of this.lines) {
      if (!seen.has(b)) {
        ol.line.visible = false;
        if (!b.sim) {
          ol.geo.dispose();
          ol.mat.dispose();
          ol.line.removeFromParent();
          this.lines.delete(b);
        }
      }
    }
    this.updateTrails(bodies, camPos, ctx);
  }

  // Trails record positions relative to the primary at fixed simulated-time intervals.
  recordTrails(bodies, simTime) {
    if (!this.trailsVisible) return;
    for (const b of bodies) {
      if (!b.primary || b.kind === 'debris') continue;
      let tr = this.trails.get(b);
      if (!tr) {
        tr = { pts: new Float64Array(3 * 600), n: 0, head: 0, lastT: -Infinity, primary: b.primary, obj: null };
        this.trails.set(b, tr);
      }
      if (tr.primary !== b.primary) {
        tr.n = 0;
        tr.primary = b.primary;
      }
      const period = b.orbit && b.orbit.period < Infinity ? b.orbit.period : 3.15e7;
      const interval = period / 300;
      if (Math.abs(simTime - tr.lastT) < interval) continue;
      tr.lastT = simTime;
      const p = b.primary.pos;
      tr.pts[tr.head * 3] = b.pos[0] - p[0];
      tr.pts[tr.head * 3 + 1] = b.pos[1] - p[1];
      tr.pts[tr.head * 3 + 2] = b.pos[2] - p[2];
      tr.head = (tr.head + 1) % 600;
      tr.n = Math.min(tr.n + 1, 600);
    }
  }

  updateTrails(bodies, camPos, ctx) {
    for (const [b, tr] of this.trails) {
      if (!b.sim || !this.trailsVisible) {
        if (tr.obj) tr.obj.line.visible = false;
        if (!b.sim) {
          tr.obj?.line.removeFromParent();
          this.trails.delete(b);
        }
        continue;
      }
      if (!tr.obj) {
        tr.obj = new OrbitLine();
        tr.obj.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(601 * 3), 3));
        tr.obj.geo.setAttribute('aFade', new THREE.BufferAttribute(new Float32Array(601), 1));
        this.group.add(tr.obj.line);
      }
      const P = tr.obj.geo.attributes.position.array;
      const F = tr.obj.geo.attributes.aFade.array;
      const prim = tr.primary;
      const rel = [b.pos[0] - prim.pos[0], b.pos[1] - prim.pos[1], b.pos[2] - prim.pos[2]];
      let k = 0;
      for (let q = 0; q < tr.n; q++) {
        const idx = (tr.head - tr.n + q + 600) % 600;
        const p = eclToRender([tr.pts[idx * 3] - rel[0], tr.pts[idx * 3 + 1] - rel[1], tr.pts[idx * 3 + 2] - rel[2]]);
        P[k * 3] = p[0]; P[k * 3 + 1] = p[1]; P[k * 3 + 2] = p[2];
        F[k] = q / tr.n;
        k++;
      }
      P[k * 3] = 0; P[k * 3 + 1] = 0; P[k * 3 + 2] = 0; F[k] = 1; k++;
      tr.obj.geo.setDrawRange(0, k);
      tr.obj.geo.attributes.position.needsUpdate = true;
      tr.obj.geo.attributes.aFade.needsUpdate = true;
      const bp = eclToRender([b.pos[0] - camPos[0], b.pos[1] - camPos[1], b.pos[2] - camPos[2]]);
      tr.obj.line.position.set(bp[0], bp[1], bp[2]);
      tr.obj.line.updateMatrix();
      const c = [1.0, 0.75, 0.4];
      tr.obj.mat.uniforms.uColor.value.setRGB(c[0], c[1], c[2]);
      tr.obj.mat.uniforms.uOpacity.value = 0.8;
      tr.obj.line.visible = k > 2;
    }
  }

  clearTrails() {
    for (const [, tr] of this.trails) tr.obj?.line.removeFromParent();
    this.trails.clear();
  }
}

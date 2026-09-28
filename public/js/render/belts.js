// Small-body populations rendered on the GPU: each particle carries Keplerian elements and
// its position is found by solving Kepler's equation in the vertex shader. Includes the main
// belt with Kirkwood gaps, Hildas (3:2), Jupiter Trojans (L4/L5) and the Kuiper belt with
// Plutinos (3:2 with Neptune).

import * as THREE from 'three';
import { AU, DAY, DEG, GM_SUN } from '../core/constants.js';
import { rng, gaussian } from '../core/vec.js';
import { LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';

const VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute vec4 aEl0;  // a (AU), e, i, node
attribute vec4 aEl1;  // argp, M0, size, albedo
uniform float uDays;      // days since epoch
uniform float uMu;        // AU^3/day^2
uniform vec3 uCenter;     // camera-relative star position (km)
uniform vec3 uSunRender;  // same as uCenter (light source)
uniform float uPointScale;
uniform float uExposure;
uniform float uIntensity;
uniform float uPixelAngle;
varying vec3 vColor;
const float AU_KM = 149597870.7;
void main() {
  float a = aEl0.x, e = aEl0.y, inc = aEl0.z, node = aEl0.w;
  float argp = aEl1.x;
  float n = sqrt(uMu / (a * a * a));
  float M = mod(aEl1.y + n * uDays, 6.28318530718);
  float E = M + e * sin(M);
  for (int k = 0; k < 4; k++) E = E - (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float xv = a * (cos(E) - e);
  float yv = a * sqrt(1.0 - e * e) * sin(E);
  float cO = cos(node), sO = sin(node), ci = cos(inc), si = sin(inc), cw = cos(argp), sw = sin(argp);
  vec3 ecl = vec3(
    (cO * cw - sO * sw * ci) * xv + (-cO * sw - sO * cw * ci) * yv,
    (sO * cw + cO * sw * ci) * xv + (-sO * sw + cO * cw * ci) * yv,
    (sw * si) * xv + (cw * si) * yv);
  vec3 rel = vec3(ecl.x, ecl.z, -ecl.y) * AU_KM;
  vec3 wp = uCenter + rel;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  // Brightness: reflected sunlight, inverse-square from Sun and from camera, phase-dependent.
  float rs = length(rel) / AU_KM;
  float dc = max(length(wp), 1.0);
  vec3 toSun = normalize(uCenter - wp);
  float phase = 0.5 + 0.5 * dot(toSun, normalize(-wp));
  float radius = aEl1.z; // km
  float flux = aEl1.w * phase * (radius / dc) * (radius / dc) / (rs * rs);
  float energy = flux * 3.14159 / (uPixelAngle * uPixelAngle) * uExposure * uIntensity;
  gl_PointSize = uPointScale;
  vColor = vec3(1.0, 0.93, 0.85) * min(energy / (0.157 * uPointScale * uPointScale), 4.0);
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
  gl_FragColor = vec4(vColor * exp(-r2 * 5.0), 1.0);
}
`;

function kirkwoodAccept(a, rand) {
  // Mean-motion resonances with Jupiter (a_J = 5.2026 AU) clear gaps.
  const gaps = [
    [2.502, 0.03], // 3:1
    [2.825, 0.02], // 5:2
    [2.958, 0.015], // 7:3
    [3.279, 0.06], // 2:1
  ];
  for (const [g, w] of gaps) if (Math.abs(a - g) < w && rand() < 0.93) return false;
  return true;
}

export function generatePopulations(seed, jupiterLongitude, neptuneLongitude) {
  const rand = rng(seed);
  const pops = [];
  const add = (a, e, i, node, argp, M, size, albedo) => pops.push([a, e, i, node, argp, M, size, albedo]);
  const sizeDist = (min) => min * Math.pow(1 - rand() * 0.999, -1 / 1.5); // power law
  // Main belt
  for (let k = 0; k < 26000; k++) {
    let a;
    do {
      a = 2.1 + Math.pow(rand(), 0.9) * 1.25;
    } while (!kirkwoodAccept(a, rand));
    const e = Math.min(0.35, Math.abs(gaussian(rand) * 0.09) + 0.02);
    const i = Math.abs(gaussian(rand) * 7.5) * DEG;
    add(a, e, i, rand() * 2 * Math.PI, rand() * 2 * Math.PI, rand() * 2 * Math.PI, Math.min(sizeDist(3), 150), rand() < 0.75 ? 0.06 : 0.25);
  }
  // Hildas: 3:2 resonance, triangular distribution anchored to Jupiter.
  for (let k = 0; k < 1800; k++) {
    const e = 0.15 + rand() * 0.15;
    const vertex = Math.floor(rand() * 3);
    const lambda = jupiterLongitude + (vertex * 2 * Math.PI) / 3 + Math.PI / 3 + gaussian(rand) * 0.25;
    const argp = rand() * 2 * Math.PI;
    const node = rand() * 2 * Math.PI;
    // Aphelion at the triangle vertices: place mean anomaly accordingly.
    add(3.97 + gaussian(rand) * 0.03, e, Math.abs(gaussian(rand) * 8) * DEG, node, argp, lambda - node - argp + Math.PI, Math.min(sizeDist(4), 80), 0.05);
  }
  // Jupiter Trojans: co-orbital, leading (L4) and trailing (L5) by 60°.
  for (let k = 0; k < 5000; k++) {
    const l4 = rand() < 0.6;
    const lib = gaussian(rand) * 12 * DEG;
    const lambda = jupiterLongitude + (l4 ? 60 : -60) * DEG + lib;
    const node = rand() * 2 * Math.PI;
    const argp = rand() * 2 * Math.PI;
    add(5.2026 + gaussian(rand) * 0.06, Math.abs(gaussian(rand) * 0.07), Math.abs(gaussian(rand) * 12) * DEG, node, argp, lambda - node - argp, Math.min(sizeDist(5), 120), 0.05);
  }
  // Kuiper belt: classical (cold + hot) and Plutinos.
  for (let k = 0; k < 16000; k++) {
    const r = rand();
    if (r < 0.2) {
      const lambda = neptuneLongitude + Math.PI / 2 * (rand() < 0.5 ? 1 : -1) + gaussian(rand) * 0.6;
      const node = rand() * 2 * Math.PI, argp = rand() * 2 * Math.PI;
      add(39.4 + gaussian(rand) * 0.2, 0.1 + rand() * 0.2, Math.abs(gaussian(rand) * 10) * DEG, node, argp, lambda - node - argp, Math.min(sizeDist(40), 900), 0.08);
    } else {
      const cold = rand() < 0.5;
      add(42 + rand() * 5.5, Math.abs(gaussian(rand) * (cold ? 0.04 : 0.1)), Math.abs(gaussian(rand) * (cold ? 2.5 : 15)) * DEG, rand() * 2 * Math.PI, rand() * 2 * Math.PI, rand() * 2 * Math.PI, Math.min(sizeDist(40), 700), cold ? 0.15 : 0.08);
    }
  }
  return pops;
}

export class Belts {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.visible = true;
    this.intensity = 1;
    this.epochDays = 0;
  }

  build(simTime, jupiterLongitude, neptuneLongitude, seed = 7) {
    this.dispose();
    const pops = generatePopulations(seed, jupiterLongitude, neptuneLongitude);
    const n = pops.length;
    const el0 = new Float32Array(n * 4);
    const el1 = new Float32Array(n * 4);
    const pos = new Float32Array(n * 3);
    pops.forEach((p, k) => {
      el0.set([p[0], p[1], p[2], p[3]], k * 4);
      el1.set([p[4], ((p[5] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), p[6], p[7]], k * 4);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aEl0', new THREE.BufferAttribute(el0, 4));
    geo.setAttribute('aEl1', new THREE.BufferAttribute(el1, 4));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uDays: { value: 0 },
        uMu: { value: (GM_SUN * DAY * DAY) / (AU * AU * AU) },
        uCenter: { value: new THREE.Vector3() },
        uSunRender: { value: new THREE.Vector3() },
        uPointScale: { value: 2 },
        uExposure: { value: 1 },
        uIntensity: { value: 1 },
        uPixelAngle: { value: 1e-3 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Points(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    this.scene.add(this.mesh);
    this.epoch = simTime;
    this.count = n;
  }

  update(star, camPos, simTime, ctx) {
    if (!this.mesh) return;
    this.mesh.visible = this.visible && !!star;
    if (!star) return;
    const u = this.mat.uniforms;
    // Days since the population epoch; float32-safe because it is relative.
    u.uDays.value = (simTime - this.epoch) / DAY;
    u.uMu.value = (star.gm * DAY * DAY) / (AU * AU * AU);
    const c = [star.pos[0] - camPos[0], star.pos[1] - camPos[1], star.pos[2] - camPos[2]];
    u.uCenter.value.set(c[0], c[2], -c[1]);
    u.uPointScale.value = 2.2 * ctx.pixelRatio;
    u.uExposure.value = ctx.exposure;
    // The belt's real surface brightness is far below what a human eye perceives in a
    // rendering; the intensity slider provides an artistic boost (1 = physical).
    u.uIntensity.value = this.intensity * 6e4;
    u.uPixelAngle.value = ctx.pixelAngle;
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mat.dispose();
      this.mesh.removeFromParent();
      this.mesh = null;
    }
  }
}

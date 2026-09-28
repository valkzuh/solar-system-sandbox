// Background sky: Tycho-2 Milky Way cube map + Hipparcos/Tycho star catalog rendered as
// point sources with physically scaled brightness, plus optional constellation lines.

import * as THREE from 'three';
import { OBLIQUITY_J2000 } from '../core/constants.js';
import { bvToTemperature, balancedBlackbody } from '../core/stellar.js';

const cosE = Math.cos(OBLIQUITY_J2000);
const sinE = Math.sin(OBLIQUITY_J2000);

// RA/Dec (rad) -> render-space unit vector (ecliptic, Y up).
export function raDecToRender(ra, dec) {
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  // EQJ -> ecliptic
  const ey = y * cosE + z * sinE;
  const ez = -y * sinE + z * cosE;
  // ecliptic -> render (x, z, -y)
  return [x, ez, -ey];
}

const SKYBOX_FRAG = /* glsl */ `
precision highp float;
uniform samplerCube uCube;
uniform float uIntensity;
uniform mat3 uRenderToEqj;
varying vec3 vDir;
void main() {
  vec3 d = uRenderToEqj * normalize(vDir);
  // Tycho-2 cube map orientation (derived by matching the Hipparcos catalogue).
  vec3 s = texture(uCube, vec3(d.x, -d.y, d.z)).rgb;
  // Remove the baked-in stars' dominance & keep the diffuse Milky Way glow.
  s = max(s - 0.004, 0.0);
  gl_FragColor = vec4(s * uIntensity, 1.0);
}
`;

const SKYBOX_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const STAR_VERT = /* glsl */ `
attribute float aMag;
attribute vec3 aColor;
uniform float uGain;
uniform float uLimit;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vPeak;
void main() {
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
  // Pogson: flux ratio 10^(-0.4 m). Total energy spread over a Gaussian PSF.
  float flux = pow(10.0, -0.4 * (aMag - uLimit));
  float e = flux * uGain;
  // Bright stars bloom into larger discs (like the eye / a camera).
  float size = (2.2 + 1.6 * log2(1.0 + e)) * uPixelRatio;
  gl_PointSize = size;
  vPeak = e / (size * size * 0.25);
  vColor = aColor;
}
`;

const STAR_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vPeak;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 4.0);
  gl_FragColor = vec4(vColor * vPeak * g * 4.0, 1.0);
}
`;

export class Sky {
  constructor() {
    this.scene = new THREE.Scene();
    this.milkyWayIntensity = 1.0;
    this.starGain = 1.0;
    this.showConstellations = false;
    this.renderToEqj = new THREE.Matrix3();
    // render -> ecliptic -> EQJ
    const m = new THREE.Matrix3();
    // ecl = (rx, -rz, ry)
    m.set(1, 0, 0, 0, 0, -1, 0, 1, 0);
    const eclToEqj = new THREE.Matrix3().set(1, 0, 0, 0, cosE, -sinE, 0, sinE, cosE);
    this.renderToEqj.multiplyMatrices(eclToEqj, m);
  }

  async load(onProgress) {
    const loader = new THREE.CubeTextureLoader();
    const base = 'assets/sky/tycho2t3_80_';
    const cube = await new Promise((res, rej) => loader.load(['px', 'mx', 'py', 'my', 'pz', 'mz'].map((f) => `${base}${f}.jpg`), res, undefined, rej));
    cube.colorSpace = THREE.SRGBColorSpace;
    const boxMat = new THREE.ShaderMaterial({
      uniforms: { uCube: { value: cube }, uIntensity: { value: 1 }, uRenderToEqj: { value: this.renderToEqj } },
      vertexShader: SKYBOX_VERT,
      fragmentShader: SKYBOX_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    this.box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), boxMat);
    this.box.frustumCulled = false;
    this.box.renderOrder = -10;
    this.scene.add(this.box);
    onProgress?.('Milky Way');

    const buf = await (await fetch('assets/data/stars.bin')).arrayBuffer();
    const data = new Float32Array(buf);
    const n = data.length / 4;
    const pos = new Float32Array(n * 3);
    const mag = new Float32Array(n);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = raDecToRender(data[i * 4], data[i * 4 + 1]);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      mag[i] = data[i * 4 + 2];
      const bv = Math.max(-0.4, Math.min(2.0, data[i * 4 + 3]));
      const c = balancedBlackbody(bvToTemperature(bv));
      col[i * 3] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    this.starMat = new THREE.ShaderMaterial({
      uniforms: { uGain: { value: 1 }, uLimit: { value: 0 }, uPixelRatio: { value: 1 } },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -5;
    this.scene.add(this.stars);
    onProgress?.('Stars');

    try {
      const cons = await (await fetch('assets/data/constellations.json')).json();
      const pts = [];
      for (const c of cons) {
        for (const line of c.l) {
          for (let k = 0; k < line.length - 1; k++) {
            const a = raDecToRender((line[k][0] * Math.PI) / 180, (line[k][1] * Math.PI) / 180);
            const b = raDecToRender((line[k + 1][0] * Math.PI) / 180, (line[k + 1][1] * Math.PI) / 180);
            pts.push(...a, ...b);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      const m = new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0.25 } },
        vertexShader: `void main(){ vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position,1.0); gl_Position = p.xyww; }`,
        fragmentShader: `uniform float uOpacity; void main(){ gl_FragColor = vec4(vec3(0.35,0.55,0.9)*uOpacity, 1.0); }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.constellations = new THREE.LineSegments(g, m);
      this.constellations.frustumCulled = false;
      this.constellations.visible = false;
      this.scene.add(this.constellations);
      this.constellationData = cons;
    } catch (e) {
      console.warn('constellations unavailable', e);
    }
  }

  // glareDim: 0..1 suppression of faint stars when a bright object dominates the view.
  update({ pixelRatio, fovY, height, glareDim }) {
    if (!this.stars) return;
    // Magnitude scale: at the reference field of view, a magnitude-0 star has total
    // energy `gain`. Zooming in (smaller fov) concentrates the same flux on fewer pixels,
    // revealing fainter stars — like a telescope.
    const zoom = Math.max(1, (60 * Math.PI) / 180 / fovY);
    const gain = 2.4 * this.starGain * Math.sqrt(zoom) * (1 - 0.97 * glareDim);
    this.starMat.uniforms.uGain.value = gain;
    this.starMat.uniforms.uPixelRatio.value = pixelRatio;
    this.box.material.uniforms.uIntensity.value = this.milkyWayIntensity * 0.9 * (1 - 0.95 * glareDim);
    if (this.constellations) {
      this.constellations.visible = this.showConstellations;
      this.constellations.material.uniforms.uOpacity.value = 0.3 * (1 - 0.8 * glareDim);
    }
  }
}

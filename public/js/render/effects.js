// Transient astrophysical effects. Currently: core-collapse supernovae.
//
// Type II-P light curve: rise over ~2 days to ~1e9 L_sun, a ~100-day plateau while the
// hydrogen envelope recombines, a drop, then the radioactive tail powered by Co-56 decay
// (e-folding time 111.3 days). The ejecta expand at ~6,000-10,000 km/s: an opaque fireball at
// first, later a transparent filamentary nebula glowing in H-alpha and [O III].

import * as THREE from 'three';
import { DAY } from '../core/constants.js';
import { balancedBlackbody, starSurfaceRadiance } from '../core/stellar.js';
import { NOISE, LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';
import { sphereGeometry } from './bodyVisual.js';
import { eclToRender } from '../core/vec.js';

export class Supernova {
  constructor({ body, pos, vel, t0, speed = 8000, peak = 1e9 }) {
    this.kind = 'supernova';
    this.body = body; // remnant (may be deleted later)
    this.pos0 = [...pos];
    this.vel0 = [...vel];
    this.t0 = t0;
    this.speed = speed;
    this.peak = peak;
    this.seed = Math.random() * 100;
  }

  age(t) {
    return t - this.t0;
  }

  center(t) {
    const a = Math.max(0, this.age(t));
    return [this.pos0[0] + this.vel0[0] * a, this.pos0[1] + this.vel0[1] * a, this.pos0[2] + this.vel0[2] * a];
  }

  radius(t) {
    return Math.max(1e5, this.speed * Math.max(0, this.age(t)));
  }

  // Bolometric-ish luminosity in L_sun.
  luminosity(t) {
    const d = this.age(t) / DAY;
    if (d < 0) return 0;
    const rise = 1 - Math.exp(-d / 1.5);
    if (d < 100) return this.peak * rise * (1 - 0.3 * (d / 100));
    if (d < 130) return this.peak * 0.7 * Math.pow(0.03, (d - 100) / 30);
    return this.peak * 0.7 * 0.03 * Math.exp(-(d - 130) / 111.3);
  }

  temperature(t) {
    const d = this.age(t) / DAY;
    if (d < 0) return 30000;
    return 5600 + 25000 * Math.exp(-d / 6);
  }

  // Fraction of the shell still optically thick (fireball) vs. nebular.
  opacity(t) {
    const d = this.age(t) / DAY;
    return Math.exp(-Math.pow(d / 120, 2));
  }

  done(t) {
    return this.age(t) > 4000 * DAY || this.age(t) < -DAY;
  }
}

const SHELL_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * position);
  gl_Position = projectionMatrix * viewMatrix * wp;
  ${LOGDEPTH_VERT}
}
`;

const SHELL_FRAG = /* glsl */ `
precision highp float;
${LOGDEPTH_FRAG_PARS}
${NOISE}
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vLocal;
uniform vec3 uColor;
uniform float uRadiance;   // photosphere radiance * exposure
uniform float uOpacity;    // 1 = fireball, 0 = nebula
uniform float uNebula;     // nebular emission brightness * exposure
uniform float uSeed;
void main() {
  ${LOGDEPTH_FRAG}
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vPos);
  float mu = abs(dot(N, V));
  vec3 p = normalize(vLocal);
  float n1 = fbm(p * 3.0 + uSeed, 5);
  float fil = pow(1.0 - abs(snoise(p * 7.0 + n1 * 1.5 + uSeed)), 8.0);
  // Fireball: limb-darkened photosphere with convective mottling.
  vec3 fire = uColor * uRadiance * (0.45 + 0.55 * mu) * (0.85 + 0.3 * n1);
  // Nebula: limb-brightened filaments (thin shell seen edge-on is brighter).
  float limb = 1.0 / (mu + 0.15);
  vec3 halpha = vec3(1.0, 0.18, 0.28);
  vec3 oiii = vec3(0.2, 0.85, 0.8);
  vec3 neb = mix(halpha, oiii, smoothstep(-0.2, 0.4, n1)) * (fil * 1.6 + 0.05) * limb * uNebula;
  vec3 col = mix(neb, fire, uOpacity);
  gl_FragColor = vec4(min(col, vec3(80.0)), 1.0);
}
`;

export class EffectsRenderer {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map();
  }

  update(effects, camPos, t, ctx) {
    const live = new Set();
    for (const e of effects) {
      if (e.kind !== 'supernova') continue;
      live.add(e);
      let m = this.meshes.get(e);
      if (!m) {
        m = new THREE.Mesh(
          sphereGeometry(128, 64),
          new THREE.ShaderMaterial({
            uniforms: { uColor: { value: new THREE.Vector3() }, uRadiance: { value: 0 }, uOpacity: { value: 1 }, uNebula: { value: 0 }, uSeed: { value: e.seed } },
            vertexShader: SHELL_VERT,
            fragmentShader: SHELL_FRAG,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
          }),
        );
        m.frustumCulled = false;
        m.matrixAutoUpdate = false;
        this.scene.add(m);
        this.meshes.set(e, m);
      }
      const c = e.center(t);
      const R = e.radius(t);
      const rp = eclToRender([c[0] - camPos[0], c[1] - camPos[1], c[2] - camPos[2]]);
      m.matrix.compose(new THREE.Vector3(rp[0], rp[1], rp[2]), new THREE.Quaternion(), new THREE.Vector3(R, R, R));
      m.matrixWorldNeedsUpdate = true;
      const u = m.material.uniforms;
      const T = e.temperature(t);
      const col = balancedBlackbody(T);
      u.uColor.value.set(col[0], col[1], col[2]);
      // Photosphere surface radiance from L = 4 pi R^2 sigma T^4 relative to the Sun.
      u.uRadiance.value = starSurfaceRadiance(T) * ctx.exposure;
      u.uOpacity.value = e.opacity(t);
      // Nebular surface brightness falls as the ejecta thin out (~1/R^2 at fixed mass).
      u.uNebula.value = (0.6 * Math.min(ctx.exposure, 50)) / (1 + e.age(t) / (3000 * DAY));
      m.visible = e.age(t) >= 0;
    }
    for (const [e, m] of this.meshes) {
      if (!live.has(e)) {
        m.material.dispose();
        m.removeFromParent();
        this.meshes.delete(e);
      }
    }
  }
}

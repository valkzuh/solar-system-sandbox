// Overlay annuli: the circumstellar habitable zone of the selected star, and the Roche limit
// / Hill sphere of a selected planet. Drawn in the body's orbital (or ecliptic) plane.

import * as THREE from 'three';
import { habitableZoneAU } from '../core/stellar.js';
import { AU } from '../core/constants.js';
import { eclToRender } from '../core/vec.js';
import { LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';

const VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH_VERT}
}
`;
const FRAG = /* glsl */ `
precision highp float;
${LOGDEPTH_FRAG_PARS}
uniform vec2 uRadii;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vLocal;
void main() {
  ${LOGDEPTH_FRAG}
  float r = length(vLocal);
  if (r < uRadii.x || r > uRadii.y) discard;
  float w = uRadii.y - uRadii.x;
  float edge = min(r - uRadii.x, uRadii.y - r) / w;
  float a = uOpacity * (0.18 + 0.82 * (1.0 - smoothstep(0.0, 0.03, edge)));
  gl_FragColor = vec4(uColor * a, a);
}
`;

function annulus() {
  const segs = 256, rings = 8;
  const pos = [], idx = [];
  for (let r = 0; r <= rings; r++) {
    const rad = r / rings;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * rad, Math.sin(a) * rad, 0);
    }
  }
  const w = segs + 1;
  for (let r = 0; r < rings; r++) for (let i = 0; i < segs; i++) {
    const a = r * w + i;
    idx.push(a, a + 1, a + w + 1, a, a + w + 1, a + w);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export class Zones {
  constructor(scene) {
    this.geo = annulus();
    this.mk = (color) => {
      const m = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({
        uniforms: { uRadii: { value: new THREE.Vector2(0.5, 1) }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.18 } },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }));
      m.frustumCulled = false;
      m.matrixAutoUpdate = false;
      m.visible = false;
      scene.add(m);
      return m;
    };
    this.hz = this.mk(0x3ddc84);
    this.roche = this.mk(0xff6b6b);
    this.roche.material.uniforms.uOpacity.value = 0.1;
    this.hill = this.mk(0x4aa3ff);
    this.enabled = false;
  }

  _place(mesh, center, camPos, inner, outer, normal) {
    const c = eclToRender([center[0] - camPos[0], center[1] - camPos[1], center[2] - camPos[2]]);
    const n = new THREE.Vector3(...eclToRender(normal)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    mesh.matrix.compose(new THREE.Vector3(c[0], c[1], c[2]), q, new THREE.Vector3(outer, outer, outer));
    mesh.matrixWorldNeedsUpdate = true;
    mesh.material.uniforms.uRadii.value.set(inner / outer, 1);
    mesh.visible = true;
  }

  update(selected, camPos) {
    this.hz.visible = this.roche.visible = this.hill.visible = false;
    if (!this.enabled || !selected || !selected.sim) return;
    const b = selected;
    if (b.isLuminous && b.star.luminosity > 1e-6) {
      const [i, o] = habitableZoneAU(b.star.luminosity, b.star.temperature);
      this._place(this.hz, b.pos, camPos, i * AU, o * AU, [0, 0, 1]);
      return;
    }
    if (b.kind === 'blackhole' || b.isStar) return;
    const normal = b.orbit && b.orbit.hVec ? b.orbit.hVec : [0, 0, 1];
    // Hill sphere (gravitational sphere of influence) as a thin shell outline.
    if (b.orbit && b.primary && b.orbit.e < 1 && !b.massless) {
      const h = b.orbit.a * (1 - b.orbit.e) * Math.cbrt(b.mass / (3 * b.primary.mass));
      this._place(this.hill, b.pos, camPos, h * 0.985, h, normal);
    }
    // Fluid Roche limit for a typical rocky (3 g/cm^3) satellite.
    const rho = b.density;
    const roche = 2.44 * b.radius * Math.cbrt(rho / 3.0);
    if (roche > b.radius * 1.02) this._place(this.roche, b.pos, camPos, b.radius * 1.001, roche, normal);
  }
}

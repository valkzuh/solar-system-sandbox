// Point-source rendering for bodies too small to resolve: each is drawn as a Gaussian PSF
// whose integrated energy equals the physically computed flux (reflected light for planets,
// luminosity for stars), so apparent magnitudes are consistent with the resolved meshes.

import * as THREE from 'three';
import { LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';

const VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute vec3 aColor;
attribute float aSize;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize;
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
  float g = exp(-r2 * 5.0);
  gl_FragColor = vec4(vColor * g, 1.0);
}
`;

export class PointSprites {
  constructor(capacity = 4096) {
    this.cap = capacity;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.n = 0;
  }

  begin() {
    this.n = 0;
  }

  // Add a point with total energy `energy` (sum of pixel values) and linear colour.
  push(p, color, energy, pixelRatio, minSize = 2.5) {
    if (this.n >= this.cap || !(energy > 0)) return;
    const i = this.n++;
    this.pos[i * 3] = p[0];
    this.pos[i * 3 + 1] = p[1];
    this.pos[i * 3 + 2] = p[2];
    // Size grows logarithmically for very bright points (bloom handles the rest).
    const size = (minSize + 1.2 * Math.log2(1 + energy)) * pixelRatio;
    // Gaussian exp(-5 r^2) over a disc of radius size/2 integrates to ~ 0.157 * size^2.
    const peak = Math.min(energy / (0.157 * size * size), 60);
    this.size[i] = size;
    this.col[i * 3] = color[0] * peak;
    this.col[i * 3 + 1] = color[1] * peak;
    this.col[i * 3 + 2] = color[2] * peak;
  }

  end() {
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'aColor', 'aSize']) {
      const a = this.geo.attributes[k];
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.n * a.itemSize);
      a.needsUpdate = true;
    }
  }
}

// Instanced rendering of collision debris and tidal fragments: faceted rocky chunks lit by
// the dominant star, glowing with thermal emission while still hot.

import * as THREE from 'three';
import { LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';
import { thermalGlow } from '../core/stellar.js';
import { eclToRender } from '../core/vec.js';

const MAX = 1600;

const VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute vec4 aData; // albedo, glow r, glow g, glow b (already scaled)
varying vec3 vPos;
varying vec4 vData;
void main() {
  vData = aData;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  ${LOGDEPTH_VERT}
}
`;

const FRAG = /* glsl */ `
precision highp float;
${LOGDEPTH_FRAG_PARS}
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform float uExposure;
varying vec3 vPos;
varying vec4 vData;
void main() {
  ${LOGDEPTH_FRAG}
  vec3 N = normalize(cross(dFdx(vPos), dFdy(vPos)));
  vec3 L = normalize(uLightPos - vPos);
  float d = length(uLightPos - vPos) / 149597870.7;
  vec3 E = uLightColor / max(d * d, 1e-9);
  vec3 col = vec3(0.5, 0.46, 0.42) * vData.x * max(dot(N, L), 0.0) * E * uExposure + vData.yzw;
  gl_FragColor = vec4(min(col, vec3(80.0)), 1.0);
}
`;

export class DebrisRenderer {
  constructor(scene) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    // Roughen the chunks.
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.75 + 0.5 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    this.data = new Float32Array(MAX * 4);
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(this.data, 4).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uLightPos: { value: new THREE.Vector3() }, uLightColor: { value: new THREE.Vector3(1, 1, 1) }, uExposure: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.axis = new THREE.Vector3();
  }

  update(bodies, camPos, star, ctx, time) {
    let n = 0;
    for (const b of bodies) {
      if (b.kind !== 'debris' || n >= MAX) continue;
      const rel = [b.pos[0] - camPos[0], b.pos[1] - camPos[1], b.pos[2] - camPos[2]];
      const D = Math.hypot(...rel);
      const pxR = b.radius / D / ctx.pixelAngle;
      if (pxR < 0.4) continue;
      const rp = eclToRender(rel);
      this.v.set(rp[0], rp[1], rp[2]);
      this.axis.set(Math.sin(b.uid), Math.cos(b.uid * 1.7), Math.sin(b.uid * 0.3)).normalize();
      this.q.setFromAxisAngle(this.axis, (time / (3600 * (2 + (b.uid % 7)))) % (Math.PI * 2));
      this.s.setScalar(b.radius);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      const th = thermalGlow((b.tempK || 0));
      const g = th.value * ctx.exposure;
      this.data[n * 4] = b.albedo || 0.1;
      this.data[n * 4 + 1] = th.color[0] * g;
      this.data[n * 4 + 2] = th.color[1] * g;
      this.data[n * 4 + 3] = th.color[2] * g;
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.aData.needsUpdate = true;
    this.mesh.visible = n > 0;
    if (star) {
      const rp = eclToRender([star.pos[0] - camPos[0], star.pos[1] - camPos[1], star.pos[2] - camPos[2]]);
      this.mat.uniforms.uLightPos.value.set(rp[0], rp[1], rp[2]);
      this.mat.uniforms.uLightColor.value.setScalar(star.star.luminosity);
    }
    this.mat.uniforms.uExposure.value = ctx.exposure;
  }
}

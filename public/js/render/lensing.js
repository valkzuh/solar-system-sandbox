// Screen-space gravitational lensing for black holes (point-mass lens, source plane at
// infinity), descended from the original black-hole visualizer. Only pixels whose depth is
// behind the lens are deflected, so foreground objects stay undistorted.

import * as THREE from 'three';

export const MAX_LENSES = 4;

export const LensingShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uCount: { value: 0 },
    uCenter: { value: Array.from({ length: MAX_LENSES }, () => new THREE.Vector2()) }, // uv
    uEinstein: { value: new Array(MAX_LENSES).fill(0) }, // radians
    uShadow: { value: new Array(MAX_LENSES).fill(0) }, // radians
    uDist: { value: new Array(MAX_LENSES).fill(0) }, // km
    uGlow: { value: Array.from({ length: MAX_LENSES }, () => new THREE.Vector3()) },
    uRadPerUv: { value: new THREE.Vector2(1, 1) },
    uLogDepthFC: { value: 1 },
    uUseDepth: { value: false },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    #define MAXL ${MAX_LENSES}
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform int uCount;
    uniform vec2 uCenter[MAXL];
    uniform float uEinstein[MAXL];
    uniform float uShadow[MAXL];
    uniform float uDist[MAXL];
    uniform vec3 uGlow[MAXL];
    uniform vec2 uRadPerUv;
    uniform float uLogDepthFC;
    uniform bool uUseDepth;
    varying vec2 vUv;

    float viewDist(vec2 uv) {
      if (!uUseDepth) return 1e30;
      float d = texture2D(tDepth, uv).x;
      if (d >= 1.0) return 1e30;
      return exp2(d * 2.0 / uLogDepthFC) - 1.0;
    }

    void main() {
      vec2 uv = vUv;
      vec3 add = vec3(0.0);
      float shadow = 1.0;
      for (int i = 0; i < MAXL; i++) {
        if (i >= uCount) break;
        vec2 dUv = uv - uCenter[i];
        vec2 th = dUv * uRadPerUv; // angle from lens (radians)
        float r = length(th);
        if (uUseDepth && viewDist(vUv) < uDist[i] * 0.999) continue;
        float e2 = uEinstein[i] * uEinstein[i];
        if (r < uShadow[i]) { shadow = 0.0; continue; }
        // Lens equation: beta = theta - thetaE^2 / |theta| (direction preserved).
        vec2 beta = th - th * (e2 / max(r * r, 1e-20));
        uv = uCenter[i] + beta / uRadPerUv;
        // Photon ring: thin bright ring just outside the shadow.
        float ring = exp(-pow((r - uShadow[i] * 1.04) / (uShadow[i] * 0.03 + 1e-9), 2.0));
        add += uGlow[i] * ring;
      }
      vec3 col = texture2D(tDiffuse, uv).rgb * shadow + add;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

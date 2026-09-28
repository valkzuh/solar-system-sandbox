// GPU light metering: downsamples the HDR frame to a small luminance grid and reads it back
// every few frames. The app turns this into an exposure, the way a camera's matrix meter (or
// the eye's adaptation) would — so a night side lit only by cities, a crescent, or an
// eclipsed Moon are all exposed sensibly.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const W = 48;
const H = 27;

export class MeterPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false });
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 uTexel;
        varying vec2 vUv;
        void main() {
          float sum = 0.0, mx = 0.0;
          for (int y = 0; y < 5; y++) {
            for (int x = 0; x < 5; x++) {
              vec2 o = (vec2(float(x), float(y)) + 0.5) / 5.0 - 0.5;
              vec3 c = texture2D(tDiffuse, vUv + o * uTexel).rgb;
              float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
              sum += l;
              mx = max(mx, l);
            }
          }
          gl_FragColor = vec4(sum / 25.0, mx, 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
    this.buffer = new Float32Array(W * H * 4);
    this.frame = 0;
    this.interval = 3;
    this.result = null;
    this.exposureInUse = 1;
  }

  render(renderer, writeBuffer, readBuffer) {
    if (this.frame++ % this.interval !== 0) return;
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    this.quad.render(renderer);
    try {
      renderer.readRenderTargetPixels(this.rt, 0, 0, W, H, this.buffer);
      const avg = new Float32Array(W * H);
      let max = 0;
      for (let i = 0; i < W * H; i++) {
        avg[i] = this.buffer[i * 4];
        max = Math.max(max, this.buffer[i * 4 + 1]);
      }
      this.result = { avg, max, exposure: this.exposureAtRender };
    } catch (e) {
      this.result = null;
    }
    renderer.setRenderTarget(prev);
  }

  // Exposure multiplier that brings the metered subject to a mid-grey key.
  static evaluate(result) {
    if (!result) return null;
    const { avg } = result;
    let lmax = 0;
    for (const v of avg) if (v > lmax) lmax = v;
    if (!(lmax > 0)) return null;
    // "Subject" pixels: within ~6 stops of the brightest block (ignores the sky and glow).
    const thresh = lmax / 64;
    let n = 0, logSum = 0;
    const subj = [];
    for (const v of avg) {
      if (v > thresh && v > 1e-7) {
        n++;
        logSum += Math.log(v);
        subj.push(v);
      }
    }
    const frac = n / avg.length;
    if (frac < 0.004) return { frac, mult: null };
    subj.sort((a, b) => a - b);
    const p95 = subj[Math.floor(subj.length * 0.95)];
    const logAvg = Math.exp(logSum / n);
    let mult = 0.28 / logAvg;
    // Protect highlights: keep the 95th percentile of the subject below ~1 (pre tone mapping).
    mult = Math.min(mult, 1.0 / p95);
    return { frac, mult };
  }
}

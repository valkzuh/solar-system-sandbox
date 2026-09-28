// Shader materials for planets, atmospheres, rings and stars.

import * as THREE from 'three';
import { NOISE, LIGHTING, ATMOSPHERE, LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';

export function lightingUniforms() {
  return {
    uLightCount: { value: 0 },
    uLightPos: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    uLightColor: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    uLightRadius: { value: [0, 0, 0, 0] },
    uOccCount: { value: 0 },
    uOcc: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
    uOccTint: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
    uExposure: { value: 1 },
  };
}

// ---------------------------------------------------------------------------
// Planet surface

const PLANET_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
uniform vec3 uInvScale2;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * (position * uInvScale2));
  gl_Position = projectionMatrix * viewMatrix * wp;
  ${LOGDEPTH_VERT}
}
`;

const PLANET_FRAG = /* glsl */ `
precision highp float;
${LOGDEPTH_FRAG_PARS}
${NOISE}
${LIGHTING}
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vLocal;

uniform mat3 uRot;          // body frame -> world (render) rotation
uniform vec3 uCenter;       // camera-relative body centre (km)
uniform vec3 uAxes;         // ellipsoid semi-axes (km)
uniform int uMode;          // 0 generic, 1 earth, 2 venus-clouds
uniform bool uHasMap;
uniform sampler2D uMap;
uniform bool uHasBump;
uniform sampler2D uBump;
uniform float uBumpScale;
uniform float uLonOffset;
uniform float uAlbedoScale;
uniform sampler2D uNight;
uniform sampler2D uPacked;
uniform float uCloudOffset;
uniform float uTime;
uniform float uRadius;      // km (visual)
uniform float uPixelSize;   // approximate km per pixel at the body (for detail fading)

uniform int uProcType;
uniform float uSeed;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec4 uProcA;        // craters, detail, lineae, patches
uniform vec4 uProcB;        // twoTone, spots, redCap, cantaloupe
uniform vec4 uProcC;        // turbulence, bands, detailOnly, sponge
uniform float uWater;       // ocean coverage for terrestrial proc
uniform float uIce;         // ice-cap extent
uniform float uCloudCover;
uniform vec3 uThermal;      // thermal glow colour * intensity (hot surfaces)
uniform float uTempK;
uniform float uBrdfLS;      // Lommel-Seeliger weight (airless regolith)
uniform float uMinnaert;    // limb darkening exponent (gas giants)

uniform bool uHasRing;
uniform sampler2D uRingAlpha;
uniform vec3 uRingNormal;
uniform vec3 uRingCenter;
uniform vec2 uRingRadii;
uniform float uRingOpacity;

uniform bool uHasAtm;
uniform vec3 uAtmExt;       // zenith optical depth (for surface sun transmittance)

vec2 equirectUV(vec3 p) {
  float lon = atan(p.y, p.x);
  float lat = asin(clamp(p.z, -1.0, 1.0));
  return vec2(lon / (2.0 * PI) + 0.5 + uLonOffset, lat / PI + 0.5);
}

// Seam-free equirectangular sampling (picks the u-parameterisation with continuous derivatives).
vec4 sampleEq(sampler2D tex, vec2 uv) {
  vec2 uvA = vec2(fract(uv.x), uv.y);
  vec2 uvB = vec2(fract(uv.x + 0.5) - 0.5, uv.y);
  vec2 dA = vec2(dFdx(uvA.x), dFdy(uvA.x));
  vec2 dB = vec2(dFdx(uvB.x), dFdy(uvB.x));
  bool useB = dot(dB, dB) < dot(dA, dA);
  vec2 dx = vec2(useB ? dB.x : dA.x, dFdx(uv.y));
  vec2 dy = vec2(useB ? dB.y : dA.y, dFdy(uv.y));
  return textureGrad(tex, uvA, dx, dy);
}

float ringShadow(vec3 p, vec3 L) {
  if (!uHasRing) return 1.0;
  float denom = dot(L, uRingNormal);
  if (abs(denom) < 1e-5) return 1.0;
  float t = dot(uRingCenter - p, uRingNormal) / denom;
  if (t <= 0.0) return 1.0;
  float r = length(p + L * t - uRingCenter);
  if (r < uRingRadii.x || r > uRingRadii.y) return 1.0;
  float u = (r - uRingRadii.x) / (uRingRadii.y - uRingRadii.x);
  float a = texture(uRingAlpha, vec2(u, 0.5)).r * uRingOpacity;
  return 1.0 - a * 0.9;
}

// ------------------------------------------------------------------ procedural surfaces
struct Surf { vec3 albedo; float height; float spec; vec3 emit; float cloud; };

float detailFade(float featureKm) {
  // Fade out detail finer than ~2 pixels to avoid aliasing.
  return smoothstep(uPixelSize * 1.0, uPixelSize * 4.0, featureKm);
}

Surf procRocky(vec3 p) {
  Surf s;
  vec3 q = p * 2.0 + uSeed;
  float base = fbm(q * 1.5, 6);
  float mare = smoothstep(0.1, 0.35, fbm(q * 0.6 + 4.0, 4)) * uProcA.w;
  float c = 0.0;
  float f = 4.0;
  for (int i = 0; i < 4; i++) {
    float fade = detailFade(uRadius * 2.0 / f);
    if (fade > 0.0) c += craters(p * f + uSeed * 3.1 + float(i) * 17.0, uProcA.x * (0.35 + 0.15 * float(i))) * fade;
    f *= 2.7;
  }
  float h = base * 0.4 + c * 1.2;
  if (uProcC.w > 0.5) h += craters(p * 26.0 + uSeed, 0.9) * 0.8; // spongy
  float t = clamp(0.5 + base * 0.6 + c * 0.4, 0.0, 1.0);
  vec3 col = mix(uC2, uC1, t);
  col = mix(col, uC2 * 0.8, mare * 0.7);
  // Bright ray/ejecta speckles
  float spk = smoothstep(0.72, 0.9, snoise(p * 40.0 + uSeed)) * detailFade(uRadius / 20.0);
  col = mix(col, uC3, spk * 0.5);
  if (uProcB.x > 0.5) {
    // Iapetus-like two tone: dark leading hemisphere (+y in body frame = direction of motion)
    float lead = smoothstep(-0.25, 0.35, p.y + 0.15 * fbm(p * 3.0, 3));
    col = mix(uC1, uC2, lead);
  }
  if (uProcB.y > 0.0) {
    float sp = smoothstep(0.995, 0.999, dot(normalize(p), normalize(vec3(0.3, 0.6, 0.35))));
    col = mix(col, uC3, sp * uProcB.y);
  }
  if (uProcB.z > 0.5) {
    float cap = smoothstep(0.65, 0.9, p.z + 0.1 * fbm(p * 4.0, 3));
    col = mix(col, vec3(0.45, 0.25, 0.18), cap * 0.8);
  }
  s.albedo = col;
  s.height = h;
  s.spec = 0.0;
  s.emit = vec3(0.0);
  s.cloud = 0.0;
  return s;
}

Surf procIcy(vec3 p) {
  Surf s;
  vec3 q = p * 2.0 + uSeed;
  float base = fbm(q, 5);
  float lines = 0.0;
  for (int i = 0; i < 3; i++) {
    float r = ridged(q * (2.0 + float(i) * 2.5) + float(i) * 11.0, 4);
    lines = max(lines, smoothstep(0.82, 0.97, r) * (1.0 - float(i) * 0.2));
  }
  lines *= uProcA.z;
  float patches = smoothstep(-0.05, 0.25, fbm(q * 0.7 + 7.0, 4)) * uProcA.w;
  float c = craters(p * 6.0 + uSeed, uProcA.x * 0.5) * detailFade(uRadius / 3.0) + craters(p * 17.0 + uSeed, uProcA.x * 0.6) * detailFade(uRadius / 8.0);
  vec3 col = mix(uC1, uC3, clamp(0.5 + base * 0.5, 0.0, 1.0));
  col = mix(col, uC2 * 1.1, patches * 0.75);
  col = mix(col, uC2, lines);
  if (uProcB.w > 0.5) {
    // Triton cantaloupe terrain + pinkish south polar cap
    float cell = craters(p * 12.0 + uSeed, 0.95);
    col *= 0.92 + 0.12 * cell;
    col = mix(col, vec3(0.95, 0.82, 0.78), (1.0 - smoothstep(-0.5, -0.2, p.z)));
  }
  s.albedo = col;
  s.height = c * 0.8 - lines * 0.15 + base * 0.1;
  s.spec = 0.05;
  s.emit = vec3(0.0);
  s.cloud = 0.0;
  return s;
}

Surf procVolcanic(vec3 p) {
  Surf s;
  vec3 q = p * 2.0 + uSeed;
  float base = fbm(q * 1.3, 6);
  float sulfur = smoothstep(-0.3, 0.4, base);
  vec3 col = mix(uC2, uC1, sulfur);
  float frost = smoothstep(0.35, 0.6, fbm(q * 2.3 + 3.0, 4));
  col = mix(col, uC3, frost * 0.6);
  // Paterae: dark calderas with red deposits
  float v = 0.0;
  vec3 cell = floor(q * 3.0);
  vec3 f = fract(q * 3.0);
  float glow = 0.0;
  for (int k = 0; k < 27; k++) {
    vec3 o = vec3(float(k % 3), float((k / 3) % 3), float(k / 9)) - 1.0;
    vec3 rnd = hash33(cell + o);
    if (rnd.z > 0.35) continue;
    float d = length(f - o - rnd);
    float r = 0.08 + 0.1 * rnd.x;
    v = max(v, 1.0 - smoothstep(r * 0.6, r, d));
    col = mix(col, vec3(0.55, 0.18, 0.08), (1.0 - smoothstep(r, r * 2.6, d)) * 0.5);
    glow = max(glow, 1.0 - smoothstep(0.0, r * 0.35, d));
  }
  col = mix(col, vec3(0.06, 0.05, 0.04), v);
  float polar = smoothstep(0.6, 0.95, abs(p.z));
  col = mix(col, col * vec3(0.7, 0.65, 0.6), polar);
  s.albedo = col;
  s.height = base * 0.3 - v * 0.2;
  s.spec = 0.0;
  s.emit = vec3(1.0, 0.35, 0.08) * glow * 0.02; // hot lava lakes, visible on the night side
  s.cloud = 0.0;
  return s;
}

Surf procTerrestrial(vec3 p) {
  Surf s;
  vec3 q = p * 1.6 + uSeed;
  float cont = fbm(q, 7) + 0.25 * ridged(q * 2.0, 5) - 0.1;
  float sea = mix(-0.6, 0.35, uWater);
  float land = smoothstep(sea - 0.01, sea + 0.01, cont);
  float elev = max(cont - sea, 0.0);
  float lat = abs(p.z);
  float temp = uTempK - 40.0 * lat * lat - elev * 60.0;
  float moist = fbm(q * 2.5 + 20.0, 4);
  vec3 forest = vec3(0.05, 0.13, 0.04);
  vec3 grass = vec3(0.16, 0.2, 0.07);
  vec3 desert = vec3(0.52, 0.42, 0.28);
  vec3 tundra = vec3(0.3, 0.29, 0.24);
  vec3 rock = vec3(0.32, 0.29, 0.26);
  vec3 lc = mix(desert, mix(grass, forest, smoothstep(0.0, 0.3, moist)), smoothstep(-0.2, 0.2, moist) * smoothstep(250.0, 285.0, temp) * (1.0 - smoothstep(305.0, 330.0, temp)));
  lc = mix(lc, tundra, 1.0 - smoothstep(255.0, 272.0, temp));
  lc = mix(lc, rock, smoothstep(0.35, 0.6, elev));
  if (temp > 330.0) lc = mix(desert, rock, 0.4);
  vec3 ocean = mix(vec3(0.01, 0.04, 0.09), vec3(0.02, 0.09, 0.14), smoothstep(sea - 0.3, sea, cont));
  vec3 col = mix(ocean, lc, land);
  // Ice
  float iceLine = 1.0 - uIce;
  float ice = smoothstep(iceLine, iceLine + 0.05, lat + 0.08 * fbm(q * 3.0, 3)) + (1.0 - smoothstep(245.0, 262.0, temp)) * land;
  col = mix(col, vec3(0.8, 0.83, 0.86), clamp(ice, 0.0, 1.0));
  // Clouds (animated)
  vec3 cq = p * 2.2 + vec3(uTime * 0.002, 0.0, uSeed);
  float cl = fbm(cq + fbm(cq * 1.7, 3) * 0.6, 6);
  float cloud = smoothstep(0.55 - uCloudCover, 0.95 - uCloudCover, cl + 0.3 * (1.0 - abs(sin(p.z * 3.0))));
  s.albedo = col;
  s.height = elev * land * 1.5;
  s.spec = (1.0 - land) * (1.0 - clamp(ice, 0.0, 1.0));
  s.emit = vec3(0.0);
  s.cloud = cloud * uCloudCover * 1.3;
  return s;
}

Surf procGas(vec3 p, bool iceGiant) {
  Surf s;
  float lat = p.z;
  float t = uTime * 1e-5;
  vec3 q = p * 3.0 + uSeed;
  float warp = fbm(q * vec3(1.0, 1.0, 3.0) + vec3(t, 0.0, 0.0), 5) * uProcC.x;
  float bands = sin((lat + warp * 0.12) * (iceGiant ? 10.0 : 22.0) + uSeed) * 0.5 + 0.5;
  float fine = fbm(vec3(p.xy * 6.0, lat * 60.0) + uSeed + warp, 4);
  vec3 col = mix(uC1, uC2, bands);
  col = mix(col, uC3, smoothstep(0.2, 0.6, fine) * 0.35);
  // Storms
  float storm = 0.0;
  vec3 cell = floor(q * 2.0);
  for (int k = 0; k < 8; k++) {
    vec3 o = vec3(float(k % 2), float((k / 2) % 2), float(k / 4));
    vec3 rnd = hash33(cell + o + 3.0);
    if (rnd.z > 0.25) continue;
    float d = length(fract(q * 2.0) - o - rnd * 0.8);
    storm = max(storm, 1.0 - smoothstep(0.05, 0.12 + rnd.x * 0.1, d));
  }
  col = mix(col, uC3 * 1.1, storm * 0.6);
  s.albedo = col;
  s.height = 0.0;
  s.spec = 0.0;
  s.emit = vec3(0.0);
  s.cloud = 0.0;
  return s;
}

Surf procHaze(vec3 p) {
  Surf s;
  float t = uTime * 2e-6;
  vec3 q = p * 2.0 + uSeed;
  float w = fbm(q + vec3(t, 0.0, 0.0), 5);
  float bands = sin(p.z * 6.0 + w * 2.0) * 0.5 + 0.5;
  vec3 col = mix(uC1, uC2, bands * uProcC.y);
  // Venus-like Y features: streaks
  float streak = fbm(vec3(atan(p.y, p.x) * 2.0, p.z * 8.0, 0.0) + w + uSeed, 4);
  col = mix(col, uC3, smoothstep(0.1, 0.5, streak) * 0.35);
  s.albedo = col;
  s.height = 0.0;
  s.spec = 0.0;
  s.emit = vec3(0.0);
  s.cloud = 0.0;
  return s;
}

Surf procLava(vec3 p) {
  Surf s;
  vec3 q = p * 2.5 + uSeed;
  float base = fbm(q, 6);
  float cracks = smoothstep(0.88, 0.98, ridged(q * 2.0, 5));
  float pools = smoothstep(0.25, 0.4, fbm(q * 0.8 + 5.0, 4));
  float molten = max(cracks, pools);
  vec3 crust = mix(vec3(0.05, 0.045, 0.04), vec3(0.14, 0.11, 0.09), base * 0.5 + 0.5);
  s.albedo = mix(crust, vec3(0.08, 0.03, 0.01), molten);
  s.height = base * 0.4 - molten * 0.2;
  s.spec = molten * 0.3;
  float hot = smoothstep(700.0, 1500.0, uTempK + 800.0);
  s.emit = vec3(1.0, 0.32, 0.05) * molten * (0.3 + 2.0 * hot) * (0.8 + 0.2 * snoise(q * 4.0 + uTime * 0.001));
  s.cloud = 0.0;
  return s;
}

Surf procSurface(vec3 p) {
  if (uProcType == 2) return procIcy(p);
  if (uProcType == 3) return procVolcanic(p);
  if (uProcType == 4) return procTerrestrial(p);
  if (uProcType == 5) return procGas(p, false);
  if (uProcType == 6) return procGas(p, true);
  if (uProcType == 7) return procLava(p);
  if (uProcType == 8) return procHaze(p);
  return procRocky(p);
}

// Surface height in unit-sphere units (1.0 = body radius). Crater depth scales with crater
// size (depth/diameter ~ 0.2), so every octave contributes comparable slopes.
float craterOctaves(vec3 p, float density, float f0, int n, float seedOff) {
  float h = 0.0, f = f0;
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float fade = detailFade(uRadius * 2.0 / f);
    if (fade > 0.0) h += craters(p * f + uSeed * 3.1 + seedOff + float(i) * 17.0, density * (0.35 + 0.12 * float(i))) * fade * (0.5 / f);
    f *= 2.7;
  }
  return h;
}

float surfHeight(vec3 p) {
  if (uProcType == 1 || uProcType == 10) {
    float h = fbm((p * 2.0 + uSeed) * 1.5, 5) * 0.006 + craterOctaves(p, uProcA.x, 4.0, 8, 0.0);
    if (uProcC.w > 0.5) h += craters(p * 26.0 + uSeed, 0.9) * (0.4 / 26.0);
    return h;
  }
  if (uProcType == 2) return craterOctaves(p, uProcA.x * 0.5, 6.0, 4, 5.0) + fbm(p * 2.0 + uSeed, 4) * 0.002;
  if (uProcType == 3 || uProcType == 7 || uProcType == 4) return fbm(p * 3.0 + uSeed, 5) * 0.004;
  return 0.0;
}

// Fine crater detail layered over low-resolution maps (only octaves near pixel scale).
float detailHeight(vec3 p) {
  return craterOctaves(p, uProcA.x * 0.7 + 0.15, 60.0, 7, 11.0);
}

vec3 perturbNormalWith(vec3 nLocal, float strength, bool detailOnly) {
  vec3 t1 = normalize(cross(abs(nLocal.z) < 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0), nLocal));
  vec3 t2 = cross(nLocal, t1);
  // Differentiate at roughly the pixel footprint so slopes stay stable at every range.
  float e = clamp(uPixelSize / max(uRadius, 1e-3), 2e-6, 0.002);
  float h0 = detailOnly ? detailHeight(nLocal) : surfHeight(nLocal);
  float h1 = detailOnly ? detailHeight(normalize(nLocal + t1 * e)) : surfHeight(normalize(nLocal + t1 * e));
  float h2 = detailOnly ? detailHeight(normalize(nLocal + t2 * e)) : surfHeight(normalize(nLocal + t2 * e));
  vec3 g = (t1 * (h1 - h0) + t2 * (h2 - h0)) / e;
  return normalize(nLocal - g * strength);
}

vec3 perturbNormal(vec3 nLocal, float strength) {
  return perturbNormalWith(nLocal, strength, false);
}

vec3 bumpFromMap(vec3 nLocal, vec2 uv, sampler2D tex, float strength, int channel) {
  vec2 texel = vec2(1.0) / vec2(textureSize(tex, 0));
  vec4 c0 = sampleEq(tex, uv);
  vec4 cx = sampleEq(tex, uv + vec2(texel.x, 0.0));
  vec4 cy = sampleEq(tex, uv + vec2(0.0, texel.y));
  float h0 = channel == 0 ? c0.r : c0.g;
  float hx = channel == 0 ? cx.r : cx.g;
  float hy = channel == 0 ? cy.r : cy.g;
  vec3 east = normalize(cross(vec3(0.0, 0.0, 1.0), nLocal) + vec3(1e-6, 0.0, 0.0));
  vec3 north = cross(nLocal, east);
  float cl = max(sqrt(1.0 - nLocal.z * nLocal.z), 0.05);
  vec3 g = east * (hx - h0) / (texel.x * 2.0 * PI * cl) + north * (hy - h0) / (texel.y * PI);
  return normalize(nLocal - g * strength * 0.02);
}

void main() {
  ${LOGDEPTH_FRAG}
  // Exact ray/ellipsoid intersection. The mesh is a slightly inflated proxy; each fragment
  // finds the true surface point, so limbs and horizons are perfectly smooth at any range.
  // Starting from the proxy point keeps the quadratic well conditioned at large distances.
  vec3 rdir = normalize(vPos);
  mat3 RT = transpose(uRot);
  vec3 os = (RT * (vPos - uCenter)) / uAxes;
  vec3 ds = (RT * rdir) / uAxes;
  float qa = dot(ds, ds), qb = dot(os, ds), qc = dot(os, os) - 1.0;
  float disc = qb * qb - qa * qc;
  if (disc < 0.0) discard;
  float sq = sqrt(disc);
  float tn = (-qb - sq) / qa;
  float tf = (-qb + sq) / qa;
  float tcam = length(vPos);
  float th = (tcam + tn > 0.0) ? tn : tf;
  if (tcam + th <= 0.0) discard;
  vec3 P = vPos + rdir * th;
  vec3 nLocal = normalize(os + ds * th);
  vec3 N = normalize(uRot * (nLocal / uAxes));
  #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
    float viewZ = -(viewMatrix * vec4(P, 1.0)).z;
    gl_FragDepth = log2(max(1.0 + viewZ, 1e-6)) * logDepthBufFC * 0.5;
  #endif
  vec3 V = normalize(-P);
  vec3 albedo = vec3(0.5);
  vec3 emit = vec3(0.0);
  float spec = 0.0;
  float roughness = 0.6;
  float cloud = 0.0;
  vec3 nPert = nLocal;
  vec2 uv = equirectUV(nLocal);
  vec3 nightLights = vec3(0.0);
  float cloudShadowOffset = 0.0;

  if (uMode == 1) {
    // Earth
    albedo = sampleEq(uMap, uv).rgb;
    vec4 pk = sampleEq(uPacked, uv);
    float rough = pk.g;
    float ocean = (1.0 - smoothstep(0.35, 0.55, rough));
    spec = ocean;
    roughness = mix(0.9, 0.12, ocean);
    nPert = bumpFromMap(nLocal, uv, uPacked, 3.0 * (1.0 - ocean), 0);
    vec2 cuv = vec2(uv.x + uCloudOffset, uv.y);
    cloud = sampleEq(uPacked, cuv).b;
    // Sub-texel detail when close: break up the soft cloud map and add terrain texture.
    float cfade = detailFade(uRadius / 400.0);
    if (cfade > 0.0) {
      vec3 cq = nLocal * 180.0 + vec3(uCloudOffset * 40.0, 0.0, 0.0);
      float cn = fbm(cq, 5);
      cloud = clamp(cloud + (cn * 0.55) * cloud * (1.0 - cloud) * 2.5 * cfade, 0.0, 1.0);
      float land = 1.0 - ocean;
      albedo *= 1.0 + land * cfade * 0.35 * fbm(nLocal * 900.0, 5);
    }
    cloud = smoothstep(0.08, 0.9, cloud);
    vec3 night = sampleEq(uNight, uv).rgb;
    float lum = dot(night, vec3(0.299, 0.587, 0.114));
    nightLights = vec3(1.0, 0.78, 0.52) * smoothstep(0.015, 0.3, lum) * 0.01 * (1.0 - cloud * 0.85);
  } else if (uHasMap) {
    if (uProcType == 5 || uProcType == 6) {
      // Zonal flow turbulence: domain-warp the map along latitude bands so the coarse texture
      // resolves into eddies and streaks when viewed up close.
      float gf = detailFade(uRadius / 120.0);
      if (gf > 0.0) {
        vec3 q = vec3(nLocal.xy * 18.0, nLocal.z * 70.0) + uSeed + vec3(uTime * 2e-6, 0.0, 0.0);
        float w1 = fbm(q, 5);
        float w2 = fbm(q * 2.3 + 7.0, 4);
        uv.x += (w1 * 0.006 + w2 * 0.002) * gf * uProcC.x * 2.0;
        uv.y += (w2 * 0.0025) * gf * uProcC.x * 2.0;
      }
    }
    vec3 tex = sampleEq(uMap, uv).rgb;
    albedo = tex * uAlbedoScale;
    if (uProcType == 5 || uProcType == 6) {
      float sf = detailFade(uRadius / 600.0);
      if (sf > 0.0) {
        float streak = fbm(vec3(nLocal.xy * 60.0, nLocal.z * 900.0) + uSeed, 4);
        albedo *= 1.0 + streak * 0.12 * sf;
      }
    }
    if (uHasBump) nPert = bumpFromMap(nLocal, uv, uBump, uBumpScale, 0);
    if (uProcType > 0 && uProcC.z > 0.5) {
      // Fine procedural detail layered on top of low-resolution maps. Dark, smooth plains
      // (lunar maria, young lava) receive far fewer craters than bright highlands.
      float lum = dot(tex, vec3(0.2126, 0.7152, 0.0722));
      float highland = smoothstep(0.12, 0.35, lum);
      float fine = fbm(nLocal * 40.0 + uSeed, 4);
      float fade = detailFade(uRadius / 25.0);
      albedo *= 1.0 + fine * 0.18 * fade;
      if (uProcType == 1) {
        float c = 0.0;
        float f1 = detailFade(uRadius / 60.0), f2 = detailFade(uRadius / 190.0), f3 = detailFade(uRadius / 600.0);
        if (f1 > 0.0) c += craters(nLocal * 60.0 + uSeed, uProcA.x) * f1;
        if (f2 > 0.0) c += craters(nLocal * 190.0 + uSeed * 1.7, 0.5) * f2 * 0.6;
        if (f3 > 0.0) c += craters(nLocal * 600.0 + uSeed * 2.3, 0.45) * f3 * 0.35;
        albedo *= 1.0 + c * 0.4 + fbm(nLocal * 2000.0, 3) * 0.15 * detailFade(uRadius / 2000.0);
        nPert = normalize(nPert + (perturbNormalWith(nLocal, 1.2, true) - nLocal) * mix(0.5, 1.0, highland));
      }
    }
    if (uMode == 2) {
      Surf s = procHaze(nLocal);
      albedo = s.albedo;
      nPert = nLocal;
    }
  } else {
    Surf s = procSurface(nLocal);
    albedo = s.albedo;
    emit = s.emit;
    spec = s.spec;
    roughness = mix(0.9, 0.15, spec);
    cloud = s.cloud;
    if (uProcType != 5 && uProcType != 6 && uProcType != 8) nPert = perturbNormal(nLocal, 1.2 + uProcA.y);
  }

  vec3 Np = normalize(uRot * nPert);
  vec3 color = vec3(0.0);
  for (int li = 0; li < MAX_LIGHTS; li++) {
    if (li >= uLightCount) break;
    vec3 L = normalize(uLightPos[li] - P);
    float mu0g = dot(N, L);
    float mu0 = dot(Np, L);
    float mu = max(dot(Np, V), 0.0);
    // Self-shadowing at the geometric terminator stays smooth.
    float term = smoothstep(-0.02, 0.06, mu0g);
    vec3 E = lightIrradiance(P, li) * lightVisibility(P, li, 0.0) * ringShadow(P, L) * term;
    if (uHasAtm) {
      float cz = max(mu0g, 0.0);
      float airmass = 1.0 / (cz + 0.15 * pow(max(93.885 - degrees(acos(cz)), 0.1), -1.253));
      E *= exp(-uAtmExt * min(airmass, 40.0));
    }
    float m0 = max(mu0, 0.0);
    // Lambert blended with Lommel-Seeliger (regolith) and Minnaert (gas giant limb darkening).
    float lam = m0;
    float ls = 2.0 * m0 / (m0 + mu + 1e-4) * 0.5;
    float brdf = mix(lam, ls, uBrdfLS);
    if (uMinnaert > 0.0) brdf = pow(m0, uMinnaert) * pow(max(mu, 0.02), uMinnaert - 1.0);
    vec3 surf = albedo * brdf * E;
    if (spec > 0.0) {
      vec3 H = normalize(L + V);
      float nh = max(dot(Np, H), 0.0);
      float a2 = roughness * roughness * roughness * roughness;
      float d = nh * nh * (a2 - 1.0) + 1.0;
      float D = a2 / (PI * d * d);
      float F = 0.02 + 0.98 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
      surf += vec3(D * F * m0 * 0.25 * spec) * E / max(mu, 0.1);
    }
    if (cloud > 0.0) {
      // Clouds: bright forward-scattering layer casting a soft shadow on the ground.
      float cmu = max(mu0g, 0.0);
      vec3 cl = vec3(0.95) * mix(cmu, 2.0 * cmu / (cmu + mu + 1e-3) * 0.5, 0.4) * E;
      surf = mix(surf * (1.0 - cloud * 0.6), cl, cloud);
    }
    color += surf;
  }
  // Night-side emission: city lights, lava, thermal glow (not affected by sunlight).
  float night = 1.0;
  if (uLightCount > 0) {
    vec3 L0 = normalize(uLightPos[0] - P);
    night = (1.0 - smoothstep(-0.15, 0.1, dot(N, L0)));
  }
  color += nightLights * night;
  color += emit;
  if (uThermal.r > 0.0) {
    // Molten / hot surface: a darker chilled crust broken by brighter glowing cracks.
    vec3 q = nLocal * 3.0 + uSeed;
    float cracks = smoothstep(0.8, 0.97, ridged(q * 2.0 + vec3(uTime * 2e-6), 5));
    float crust = smoothstep(-0.2, 0.5, fbm(q + vec3(0.0, uTime * 1e-6, 0.0), 5));
    color += uThermal * mix(1.0, 0.25 + 1.6 * cracks, crust * 0.85);
  }
  gl_FragColor = vec4(min(color * uExposure, vec3(80.0)), 1.0);
}
`;

export function createPlanetMaterial() {
  const blank = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  blank.needsUpdate = true;
  const uniforms = {
    ...lightingUniforms(),
    uInvScale2: { value: new THREE.Vector3(1, 1, 1) },
    uRot: { value: new THREE.Matrix3() },
    uCenter: { value: new THREE.Vector3() },
    uAxes: { value: new THREE.Vector3(1, 1, 1) },
    uMode: { value: 0 },
    uHasMap: { value: false },
    uMap: { value: blank },
    uHasBump: { value: false },
    uBump: { value: blank },
    uBumpScale: { value: 1 },
    uLonOffset: { value: 0 },
    uAlbedoScale: { value: 1 },
    uNight: { value: blank },
    uPacked: { value: blank },
    uCloudOffset: { value: 0 },
    uTime: { value: 0 },
    uRadius: { value: 1000 },
    uPixelSize: { value: 1 },
    uProcType: { value: 1 },
    uSeed: { value: 1 },
    uC1: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    uC2: { value: new THREE.Vector3(0.3, 0.3, 0.3) },
    uC3: { value: new THREE.Vector3(0.7, 0.7, 0.7) },
    uProcA: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
    uProcB: { value: new THREE.Vector4(0, 0, 0, 0) },
    uProcC: { value: new THREE.Vector4(0.3, 0.3, 0, 0) },
    uWater: { value: 0.6 },
    uIce: { value: 0.1 },
    uCloudCover: { value: 0.4 },
    uThermal: { value: new THREE.Vector3() },
    uTempK: { value: 288 },
    uBrdfLS: { value: 0 },
    uMinnaert: { value: 0 },
    uHasRing: { value: false },
    uRingAlpha: { value: blank },
    uRingNormal: { value: new THREE.Vector3(0, 1, 0) },
    uRingCenter: { value: new THREE.Vector3() },
    uRingRadii: { value: new THREE.Vector2(1, 2) },
    uRingOpacity: { value: 1 },
    uHasAtm: { value: false },
    uAtmExt: { value: new THREE.Vector3() },
  };
  return new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG });
}

// ---------------------------------------------------------------------------
// Atmosphere shell (ray-marched single scattering, premultiplied over the surface)

const ATM_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
varying vec3 vPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  ${LOGDEPTH_VERT}
}
`;

const ATM_FRAG = /* glsl */ `
precision highp float;
${LOGDEPTH_FRAG_PARS}
${LIGHTING}
${ATMOSPHERE}
varying vec3 vPos;
uniform int uSteps;
void main() {
  ${LOGDEPTH_FRAG}
  vec3 rd = normalize(vPos);
  // Camera sits at the origin; work relative to the planet centre in stretched space.
  vec3 ros = toS(-uAtmCenter);
  vec3 rds = toS(rd);
  vec2 ta = rayS(ros, rds, uAtmRadius);
  if (ta.y <= 0.0) discard;
  float t0 = max(ta.x, 0.0);
  float t1 = ta.y;
  vec2 tp = rayS(ros, rds, uPlanetRadius);
  if (tp.x > 0.0) t1 = min(t1, tp.x);
  float len = t1 - t0;
  if (len <= 0.0) discard;
  int N = uSteps;
  float ds = len / float(N);
  vec3 odView = vec3(0.0);
  vec3 inscatter = vec3(0.0);
  for (int li = 0; li < MAX_LIGHTS; li++) {
    if (li >= uLightCount) break;
    vec3 L = normalize(uLightPos[li] - uAtmCenter);
    float mu = dot(rd, L);
    float pR = phaseR(mu), pM = phaseM(mu, uMieG);
    vec3 Ei = lightIrradiance(uAtmCenter, li);
    vec3 accR = vec3(0.0), accM = vec3(0.0);
    vec3 od = vec3(0.0);
    for (int i = 0; i < 48; i++) {
      if (i >= N) break;
      float t = t0 + ds * (float(i) + 0.5);
      vec3 ps = ros + rds * t;
      vec3 pw = rd * t; // camera-relative world position
      vec3 d = densitiesS(ps) * ds;
      od += d;
      vec3 Lp = normalize(uLightPos[li] - pw);
      vec3 Ls = toS(Lp);
      // Planet shadow on the atmosphere (night side).
      vec2 sh = rayS(ps, Ls, uPlanetRadius * 0.998);
      if (sh.x > 0.0) continue;
      vec3 odL = lightDepthS(ps, Ls);
      vec3 T = exp(-extinction(od + odL));
      vec3 vis = lightVisibility(pw, li, 0.0);
      accR += d.x * T * vis;
      accM += d.y * T * vis;
    }
    inscatter += Ei * (accR * uBetaR * pR + accM * uBetaM * pM) * uAtmScale;
    if (li == 0) odView = od;
  }
  vec3 Tview = exp(-extinction(odView));
  float alpha = dot(Tview, vec3(0.3333));
  gl_FragColor = vec4(inscatter * 4.0 * PI * uExposure, alpha);
}
`;

export function createAtmosphereMaterial() {
  const uniforms = {
    ...lightingUniforms(),
    uAtmCenter: { value: new THREE.Vector3() },
    uPlanetRadius: { value: 6371 },
    uAtmRadius: { value: 6471 },
    uBetaR: { value: new THREE.Vector3() },
    uHR: { value: 8 },
    uBetaM: { value: new THREE.Vector3() },
    uBetaMExt: { value: 0 },
    uHM: { value: 1.2 },
    uMieG: { value: 0.76 },
    uBetaA: { value: new THREE.Vector3() },
    uHA: { value: 25 },
    uAtmScale: { value: 1 },
    uPole: { value: new THREE.Vector3(0, 1, 0) },
    uStretch: { value: 1 },
    uSteps: { value: 16 },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: ATM_VERT,
    fragmentShader: ATM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.SrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    side: THREE.FrontSide,
  });
}

// ---------------------------------------------------------------------------
// Planetary rings

const RING_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
varying vec3 vPos;
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  ${LOGDEPTH_VERT}
}
`;

const RING_FRAG = /* glsl */ `
precision highp float;
${LOGDEPTH_FRAG_PARS}
${NOISE}
${LIGHTING}
varying vec3 vPos;
varying vec2 vLocal;
uniform sampler2D uColor;
uniform sampler2D uAlpha;
uniform vec2 uRadii;
uniform float uOpacity;
uniform vec3 uNormal;
uniform vec3 uPlanetCenter;
uniform float uPlanetRadius;
uniform float uPixelSize;
uniform bool uProcedural;
uniform vec3 uTint;
uniform float uSeed;
uniform float uAlbedo;

void main() {
  ${LOGDEPTH_FRAG}
  float r = length(vLocal);
  if (r < uRadii.x || r > uRadii.y) discard;
  float u = (r - uRadii.x) / (uRadii.y - uRadii.x);
  vec3 col;
  float a;
  if (uProcedural) {
    float n = fbm(vec3(u * 40.0, uSeed, 0.0), 5) * 0.5 + 0.5;
    float gaps = smoothstep(0.02, 0.05, abs(fract(u * 3.0 + n * 0.2) - 0.5));
    a = clamp(n * gaps * smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.85, 1.0, u)), 0.0, 1.0);
    col = uTint * (0.7 + 0.3 * n);
  } else {
    col = texture(uColor, vec2(u, 0.5)).rgb;
    a = texture(uAlpha, vec2(u, 0.5)).r;
    // Sub-pixel ringlet structure when close.
    float fine = snoise(vec3(r * 0.02, 0.0, 0.0)) * 0.5 + snoise(vec3(r * 0.2, 1.0, 0.0)) * 0.25;
    float fade = (1.0 - smoothstep(uPixelSize * 5.0, uPixelSize * 50.0, 20.0));
    a = clamp(a * (1.0 + fine * 0.35 * fade), 0.0, 1.0);
  }
  a *= uOpacity;
  if (a < 0.003) discard;
  vec3 V = normalize(-vPos);
  vec3 color = vec3(0.0);
  for (int li = 0; li < MAX_LIGHTS; li++) {
    if (li >= uLightCount) break;
    vec3 L = normalize(uLightPos[li] - vPos);
    vec3 E = lightIrradiance(vPos, li) * lightVisibility(vPos, li, 0.0);
    // Planet shadow on the rings.
    vec3 oc = vPos - uPlanetCenter;
    float b = dot(oc, L);
    float c = dot(oc, oc) - uPlanetRadius * uPlanetRadius;
    float h = b * b - c;
    if (h > 0.0 && -b - sqrt(h) > 0.0) E *= 0.0;
    float nl = dot(uNormal, L);
    float nv = dot(uNormal, V);
    float phase = dot(-L, V); // forward scattering when looking toward the light
    float lit;
    if (nl * nv > 0.0) {
      // Viewing the sunlit face: diffuse reflection off ring particles.
      lit = abs(nl) * 0.9 + 0.1;
      lit *= 1.0 + 0.6 * pow(max(-phase, 0.0), 8.0); // opposition surge
    } else {
      // Viewing the unlit face: light diffusely transmitted through the ring layer.
      lit = abs(nl) * (1.0 - a) * 1.4 + 0.02;
      lit *= 1.0 + 2.0 * pow(max(phase, 0.0), 6.0);
    }
    color += col * uAlbedo * E * lit;
  }
  gl_FragColor = vec4(color * uExposure * a, a);
}
`;

export function createRingMaterial() {
  const blank = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1);
  blank.needsUpdate = true;
  const uniforms = {
    ...lightingUniforms(),
    uColor: { value: blank },
    uAlpha: { value: blank },
    uRadii: { value: new THREE.Vector2(1, 2) },
    uOpacity: { value: 1 },
    uNormal: { value: new THREE.Vector3(0, 1, 0) },
    uPlanetCenter: { value: new THREE.Vector3() },
    uPlanetRadius: { value: 1 },
    uPixelSize: { value: 1 },
    uProcedural: { value: false },
    uTint: { value: new THREE.Vector3(0.8, 0.75, 0.65) },
    uSeed: { value: 1 },
    uAlbedo: { value: 1 },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

// ---------------------------------------------------------------------------
// Stars: photosphere with granulation, limb darkening, sunspots

const STAR_FRAG = /* glsl */ `
precision highp float;
${LOGDEPTH_FRAG_PARS}
${NOISE}
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vLocal;
uniform vec3 uColor;
uniform float uBrightness;
uniform float uTime;
uniform float uSeed;
uniform float uPixelSize;
uniform float uRadius;
uniform float uTemp;
uniform bool uCompact; // white dwarf / neutron star: smooth surface
void main() {
  ${LOGDEPTH_FRAG}
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  vec3 p = normalize(vLocal);
  float t = uTime;
  float gran = 0.0;
  float spots = 1.0;
  if (!uCompact) {
    // Supergranulation + granulation cells (animated), fading when unresolved.
    float g1 = fbm(p * 18.0 + vec3(0.0, 0.0, t * 3e-5) + uSeed, 3);
    float g2 = 1.0 - abs(snoise(p * 90.0 + vec3(t * 2e-4, 0.0, 0.0) + uSeed));
    float g3 = 1.0 - abs(snoise(p * 260.0 + vec3(0.0, t * 5e-4, 0.0)));
    float f2 = smoothstep(uPixelSize * 1.0, uPixelSize * 6.0, uRadius / 90.0);
    float f3 = smoothstep(uPixelSize * 1.0, uPixelSize * 6.0, uRadius / 260.0);
    gran = g1 * 0.08 + (g2 - 0.5) * 0.12 * f2 + (g3 - 0.5) * 0.1 * f3;
    // Active-region sunspots at mid latitudes.
    float lat = abs(p.z);
    float band = smoothstep(0.1, 0.25, lat) * (1.0 - smoothstep(0.35, 0.55, lat));
    float s = fbm(p * 7.0 + vec3(t * 1e-6, 0.0, 0.0) + uSeed * 2.0, 4);
    float umbra = smoothstep(0.58, 0.66, s) * band;
    float penumbra = smoothstep(0.5, 0.58, s) * band;
    spots = 1.0 - penumbra * 0.45 - umbra * 0.45;
    // Faculae: bright patches near the limb around active regions.
    gran += smoothstep(0.42, 0.55, s) * band * (1.0 - mu) * 0.25;
  }
  // Wavelength-dependent limb darkening (quadratic law, redder toward the limb).
  vec3 u1 = vec3(0.39, 0.55, 0.72);
  vec3 u2 = vec3(0.25, 0.2, 0.12);
  vec3 limb = 1.0 - u1 * (1.0 - mu) - u2 * (1.0 - mu) * (1.0 - mu);
  vec3 col = uColor * limb * (1.0 + gran) * spots;
  // Clamp to keep bloom sane; saturated discs still read as blinding white.
  gl_FragColor = vec4(min(col * uBrightness, vec3(80.0)), 1.0);
}
`;

export function createStarMaterial() {
  const uniforms = {
    uInvScale2: { value: new THREE.Vector3(1, 1, 1) },
    uColor: { value: new THREE.Vector3(1, 1, 1) },
    uBrightness: { value: 10 },
    uTime: { value: 0 },
    uSeed: { value: 0 },
    uPixelSize: { value: 1 },
    uRadius: { value: 695700 },
    uTemp: { value: 5772 },
    uCompact: { value: false },
  };
  return new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VERT, fragmentShader: STAR_FRAG });
}

// ---------------------------------------------------------------------------
// Star glow: corona + glare billboard (additive), sized in screen space.

const GLOW_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
uniform vec3 uCenter;
uniform float uSize; // world-space half size
varying vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 mv = viewMatrix * vec4(uCenter, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;

const GLOW_FRAG = /* glsl */ `
precision highp float;
${LOGDEPTH_FRAG_PARS}
${NOISE}
varying vec2 vUv;
uniform vec3 uColor;
uniform float uCoreFrac;   // stellar radius as a fraction of the quad half-size
uniform float uGlare;      // glare intensity (scaled by visible fraction of the disk)
uniform float uCorona;     // corona intensity
uniform float uSpikes;
uniform float uTime;
uniform float uSeed;
void main() {
  ${LOGDEPTH_FRAG}
  float r = length(vUv);
  if (r > 1.0) discard;
  float rs = r / max(uCoreFrac, 1e-6); // in stellar radii
  float edge = (1.0 - smoothstep(0.7, 1.0, r));
  float ang = atan(vUv.y, vUv.x);
  // K-corona falloff with streamers.
  float streamers = 0.6 + 0.4 * fbm(vec3(cos(ang) * 2.0, sin(ang) * 2.0, uSeed + uTime * 1e-7), 4);
  float corona = rs > 1.0 ? pow(rs, -3.0) * streamers : 0.0;
  // Glare: veiling glare of the eye/camera, independent of the stellar size.
  float glare = exp(-r * 9.0) * 0.6 + exp(-r * 30.0) * 1.5 + pow(max(1.0 - r, 0.0), 4.0) * 0.08;
  float spikes = 0.0;
  if (uSpikes > 0.0) {
    float s = pow(abs(cos(ang * 2.0)), 400.0) + pow(abs(cos(ang * 2.0 + 0.785)), 800.0) * 0.4;
    spikes = s * exp(-r * 4.0) * uSpikes;
  }
  vec3 col = uColor * (corona * uCorona + (glare + spikes) * uGlare) * edge;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createGlowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: new THREE.Vector3() },
      uSize: { value: 1 },
      uColor: { value: new THREE.Vector3(1, 1, 1) },
      uCoreFrac: { value: 0.1 },
      uGlare: { value: 1 },
      uCorona: { value: 1 },
      uSpikes: { value: 0 },
      uTime: { value: 0 },
      uSeed: { value: 0 },
    },
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
}

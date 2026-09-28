// Shared GLSL snippets.

// 3D simplex noise: Ashima Arts / Stefan Gustavson (MIT License).
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p, int oct) {
  float f = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    f += a * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return f;
}

float ridged(vec3 p, int oct) {
  float f = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(snoise(p));
    f += a * n * n;
    p = p * 2.1 + vec3(3.3, 1.1, 7.7);
    a *= 0.5;
  }
  return f;
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// Crater field: height contribution (bowl + raised rim) from a jittered cell grid. Crater
// radius is bounded (<= 0.35 cell) so only the 2x2x2 nearest cells need checking.
float craters(vec3 p, float density) {
  vec3 cell = floor(p);
  vec3 f = fract(p);
  vec3 dirv = step(0.5, f) * 2.0 - 1.0; // toward the nearer neighbours
  float h = 0.0;
  for (int k = 0; k < 8; k++) {
    vec3 o = vec3(float(k & 1), float((k >> 1) & 1), float(k >> 2)) * dirv;
    vec3 rnd = hash33(cell + o);
    if (rnd.z > density) continue;
    vec3 c = o + 0.25 + rnd * 0.5;
    float r = 0.1 + 0.25 * fract(rnd.x * 7.13);
    float d = length(f - c) / r;
    if (d < 1.6) {
      float bowl = d < 1.0 ? (d * d - 1.0) : 0.0;
      float rim = exp(-pow((d - 1.0) * 4.0, 2.0)) * 0.35;
      h += (bowl * 0.6 + rim) * r * 1.6;
    }
  }
  return h;
}
`;

// Lighting helpers: eclipse penumbra (circle overlap), multi-star irradiance, ring shadows.
export const LIGHTING = /* glsl */ `
#define MAX_LIGHTS 4
#define MAX_OCC 6
uniform int uLightCount;
uniform vec3 uLightPos[MAX_LIGHTS];     // camera-relative, km
uniform vec3 uLightColor[MAX_LIGHTS];   // colour * luminosity (L_sun)
uniform float uLightRadius[MAX_LIGHTS]; // km
uniform int uOccCount;
uniform vec4 uOcc[MAX_OCC];             // camera-relative centre (km) + radius
uniform vec3 uOccTint[MAX_OCC];         // refracted-light tint for occluders with atmospheres
uniform float uExposure;

const float AU_KM = 149597870.7;
const float PI = 3.14159265359;

float circleOverlap(float r1, float r2, float d) {
  // Area of intersection of two circles.
  if (d >= r1 + r2) return 0.0;
  if (d <= abs(r1 - r2)) { float r = min(r1, r2); return PI * r * r; }
  float a = r1 * r1 * acos(clamp((d * d + r1 * r1 - r2 * r2) / (2.0 * d * r1), -1.0, 1.0));
  float b = r2 * r2 * acos(clamp((d * d + r2 * r2 - r1 * r1) / (2.0 * d * r2), -1.0, 1.0));
  float c = 0.5 * sqrt(max((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2), 0.0));
  return a + b - c;
}

// Fraction of light source i visible from point p (1 = fully lit), with refracted tint.
vec3 lightVisibility(vec3 p, int li, float selfIndex) {
  vec3 toL = uLightPos[li] - p;
  float dL = length(toL);
  vec3 dirL = toL / dL;
  float aS = asin(clamp(uLightRadius[li] / dL, 0.0, 1.0));
  vec3 vis = vec3(1.0);
  for (int k = 0; k < MAX_OCC; k++) {
    if (k >= uOccCount) break;
    vec3 toO = uOcc[k].xyz - p;
    float dO = length(toO);
    float along = dot(toO, dirL);
    if (along <= 0.0 || dO > dL || dO < uOcc[k].w * 1.001) continue;
    float aO = asin(clamp(uOcc[k].w / dO, 0.0, 1.0));
    vec3 oDir = toO / dO;
    float sep = atan(length(cross(oDir, dirL)), dot(oDir, dirL));
    if (sep >= aS + aO) continue;
    float frac = circleOverlap(aS, aO, sep) / (PI * aS * aS);
    float lit = clamp(1.0 - frac, 0.0, 1.0);
    // Light refracted through the occluder's atmosphere (e.g. the red Moon in a lunar eclipse).
    vec3 tint = uOccTint[k] * (1.0 - lit);
    vis *= vec3(lit) + tint;
  }
  return vis;
}

// Irradiance relative to the Sun at 1 AU.
vec3 lightIrradiance(vec3 p, int li) {
  vec3 toL = uLightPos[li] - p;
  float d = length(toL) / AU_KM;
  return uLightColor[li] / max(d * d, 1e-12);
}
`;

// Physically based single-scattering atmosphere (Rayleigh + Mie + absorption), after
// Nishita 1993 / Bruneton 2008 simplified to a direct ray march.
export const ATMOSPHERE = /* glsl */ `
uniform vec3 uAtmCenter;
uniform float uPlanetRadius;  // equatorial
uniform float uAtmRadius;
uniform vec3 uBetaR;
uniform float uHR;
uniform vec3 uBetaM;
uniform float uBetaMExt; // Mie extinction (grey); scattering may be coloured -> absorption
uniform float uHM;
uniform float uMieG;
uniform vec3 uBetaA;
uniform float uHA;
uniform float uAtmScale; // visual scale factor (planet scale exaggeration)
uniform vec3 uPole;      // planet spin axis (render space)
uniform float uStretch;  // equatorial / polar radius (oblateness)

// Map planet-centred coordinates into a space where the oblate planet is a sphere.
vec3 toS(vec3 v) { return v + (uStretch - 1.0) * dot(v, uPole) * uPole; }

// Ray/sphere (centred at origin) with a non-normalised direction; t is in the ray's units.
vec2 rayS(vec3 o, vec3 d, float r) {
  float a = dot(d, d);
  float b = dot(o, d);
  float c = dot(o, o) - r * r;
  float h = b * b - a * c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2((-b - h) / a, (-b + h) / a);
}

vec2 raySphere(vec3 ro, vec3 rd, vec3 c, float r) {
  return rayS(toS(ro - c), toS(rd), r);
}

vec3 densitiesS(vec3 ps) {
  float h = max(length(ps) - uPlanetRadius, 0.0) / uAtmScale;
  float ozone = max(0.0, 1.0 - abs(h - uHA) / 15.0);
  return vec3(exp(-h / uHR), exp(-h / uHM), ozone);
}

vec3 extinction(vec3 d) {
  return (uBetaR * d.x + vec3(uBetaMExt) * d.y + uBetaA * d.z) * uAtmScale;
}

// Optical depth from stretched point ps toward stretched direction ls (real-length units).
vec3 lightDepthS(vec3 ps, vec3 ls) {
  vec2 t = rayS(ps, ls, uAtmRadius);
  float len = max(t.y, 0.0);
  const int M = 6;
  float ds = len / float(M);
  vec3 od = vec3(0.0);
  for (int i = 0; i < M; i++) {
    od += densitiesS(ps + ls * (ds * (float(i) + 0.5))) * ds;
  }
  return od;
}

float phaseR(float mu) { return 3.0 / (16.0 * PI) * (1.0 + mu * mu); }
float phaseM(float mu, float g) {
  float g2 = g * g;
  return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
}
`;

// Log-depth support snippets for custom ShaderMaterials.
export const LOGDEPTH_VERT_PARS = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
`;
export const LOGDEPTH_VERT = /* glsl */ `
#include <logdepthbuf_vertex>
`;
export const LOGDEPTH_FRAG_PARS = /* glsl */ `
#include <logdepthbuf_pars_fragment>
`;
export const LOGDEPTH_FRAG = /* glsl */ `
#include <logdepthbuf_fragment>
`;

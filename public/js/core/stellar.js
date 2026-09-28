// Stellar astrophysics helpers: main-sequence relations, blackbody colour,
// compact objects, and planetary equilibrium temperature.

import { MSUN, RSUN, LSUN, TSUN, G, C_KMS, SIGMA_SB, AU } from './constants.js';

// Main-sequence mass-luminosity relation (piecewise, Duric 2004 / Salaris & Cassisi).
export function msLuminosity(massSun) {
  const m = massSun;
  if (m < 0.43) return 0.23 * Math.pow(m, 2.3);
  if (m < 2) return Math.pow(m, 4);
  if (m < 55) return 1.4 * Math.pow(m, 3.5);
  return 32000 * m;
}

// Main-sequence mass-radius relation.
export function msRadius(massSun) {
  const m = massSun;
  if (m < 0.1) return 0.1; // brown dwarfs / late M dwarfs all ~Jupiter-sized
  if (m <= 1) return Math.pow(m, 0.8);
  return Math.pow(m, 0.57);
}

// Effective temperature from luminosity and radius (both solar units).
export function effectiveTemperature(lSun, rSun) {
  return TSUN * Math.pow(lSun / (rSun * rSun), 0.25);
}

export function luminosityFromRT(rSun, tK) {
  return rSun * rSun * Math.pow(tK / TSUN, 4);
}

export function schwarzschildRadiusKm(massKg) {
  return (2 * G * massKg) / (C_KMS * C_KMS);
}

// Spectral class label from effective temperature.
export function spectralClass(t) {
  const table = [
    [30000, 'O'], [10000, 'B'], [7500, 'A'], [6000, 'F'], [5200, 'G'], [3700, 'K'], [2400, 'M'], [1300, 'L'], [550, 'T'], [0, 'Y'],
  ];
  for (let k = 0; k < table.length; k++) {
    const [lo, cls] = table[k];
    if (t >= lo) {
      const hi = k === 0 ? 60000 : table[k - 1][0];
      const sub = Math.max(0, Math.min(9, Math.floor(10 * (1 - (t - lo) / (hi - lo)))));
      return `${cls}${sub}`;
    }
  }
  return 'Y';
}

// Linear sRGB colour of a blackbody at temperature T, normalised so max channel = 1.
// Uses the CIE 1931 colour matching functions (multi-lobe Gaussian fit, Wyman et al. 2013)
// integrated against Planck's law, then XYZ -> linear sRGB (D65).
const cache = new Map();
export function blackbodyRGB(tK) {
  const key = Math.round(Math.max(500, Math.min(tK, 60000)) / 10) * 10;
  if (cache.has(key)) return cache.get(key);
  const T = key;
  let X = 0, Y = 0, Z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const l = nm * 1e-9;
    const planck = 1 / (Math.pow(l, 5) * (Math.exp(0.0143877735 / (l * T)) - 1));
    const t1 = (nm - 442.0) * (nm < 442.0 ? 0.0624 : 0.0374);
    const t2 = (nm - 599.8) * (nm < 599.8 ? 0.0264 : 0.0323);
    const t3 = (nm - 501.1) * (nm < 501.1 ? 0.049 : 0.0382);
    const x = 0.362 * Math.exp(-0.5 * t1 * t1) + 1.056 * Math.exp(-0.5 * t2 * t2) - 0.065 * Math.exp(-0.5 * t3 * t3);
    const u1 = (nm - 568.8) * (nm < 568.8 ? 0.0213 : 0.0247);
    const u2 = (nm - 530.9) * (nm < 530.9 ? 0.0613 : 0.0322);
    const y = 0.821 * Math.exp(-0.5 * u1 * u1) + 0.286 * Math.exp(-0.5 * u2 * u2);
    const w1 = (nm - 437.0) * (nm < 437.0 ? 0.0845 : 0.0278);
    const w2 = (nm - 459.0) * (nm < 459.0 ? 0.0385 : 0.0725);
    const z = 1.217 * Math.exp(-0.5 * w1 * w1) + 0.681 * Math.exp(-0.5 * w2 * w2);
    X += planck * x;
    Y += planck * y;
    Z += planck * z;
  }
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  r = Math.max(r, 0);
  g = Math.max(g, 0);
  b = Math.max(b, 0);
  const m = Math.max(r, g, b) || 1;
  // White-balance so the Sun (5772 K) renders as neutral white, like the human eye adapts.
  const out = [r / m, g / m, b / m];
  cache.set(key, out);
  return out;
}

let sunBalance = null;
export function balancedBlackbody(tK) {
  if (!sunBalance) sunBalance = blackbodyRGB(TSUN);
  const c = blackbodyRGB(tK);
  const r = c[0] / sunBalance[0], g = c[1] / sunBalance[1], b = c[2] / sunBalance[2];
  const m = Math.max(r, g, b);
  return [r / m, g / m, b / m];
}

// Colour index B-V -> effective temperature (Ballesteros 2012).
export function bvToTemperature(bv) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

// Equilibrium temperature of a rapidly rotating body at distance d (km) from a star of luminosity L (W).
export function equilibriumTemperatureK(lumW, dKm, bondAlbedo) {
  const dm = dKm * 1000;
  return Math.pow((lumW * (1 - bondAlbedo)) / (16 * Math.PI * SIGMA_SB * dm * dm), 0.25);
}

// Conservative habitable zone (Kopparapu et al. 2013), returns [inner, outer] in AU.
export function habitableZoneAU(lSun, teff) {
  const ts = teff - 5780;
  const seff = (s0, a, b, c, d) => s0 + a * ts + b * ts * ts + c * ts ** 3 + d * ts ** 4;
  const inner = seff(1.0146, 8.1884e-5, 1.9394e-9, -4.3618e-12, -6.8260e-16);
  const outer = seff(0.3507, 5.9578e-5, 1.6707e-9, -3.0058e-12, -5.1925e-16);
  return [Math.sqrt(lSun / inner), Math.sqrt(lSun / outer)];
}

// Planetary mass-radius relation, mass in Earth masses -> radius in Earth radii.
// Piecewise power law in the spirit of Chen & Kipping (2017), tuned to match the
// solar system planets (rocky ~M^0.28, volatile-rich ~M^0.55, degenerate giants ~flat).
export function planetRadiusFromMass(mEarth) {
  if (mEarth < 2) return Math.pow(mEarth, 0.28);
  if (mEarth < 130) return 1.214 * Math.pow(mEarth / 2, 0.55);
  // Jovian regime: electron degeneracy keeps radius ~1 R_J (11.2 R_E), slowly shrinking with mass.
  return 11.2 * Math.pow(mEarth / 318, -0.04);
}

export const units = { MSUN, RSUN, LSUN, AU };

// Visible-band thermal radiance of a blackbody surface at T, expressed in the renderer's
// radiance units (1.0 = a white Lambertian surface lit by the Sun at 1 AU), plus its colour.
// Integrates Planck's law over 400-700 nm.
function planckVisible(T) {
  let s = 0;
  for (let nm = 400; nm <= 700; nm += 10) {
    const l = nm * 1e-9;
    s += 1 / (Math.pow(l, 5) * (Math.exp(0.0143877735 / (l * T)) - 1));
  }
  return s;
}
const SUN_VIS = planckVisible(5772) * 2.1647e-5; // (R_sun / AU)^2 dilution
// Visible-band surface radiance of a star (renderer units): the Sun's disc is ~46,000x a white
// Lambertian surface lit by the Sun at 1 AU (= 1 / dilution factor).
export function starSurfaceRadiance(tK) {
  return (planckVisible(tK) / planckVisible(5772)) / 2.1647e-5;
}

export function thermalGlow(tK) {
  if (tK < 600) return { value: 0, color: [1, 0.3, 0.05] };
  return { value: planckVisible(tK) / SUN_VIS, color: blackbodyRGB(tK) };
}

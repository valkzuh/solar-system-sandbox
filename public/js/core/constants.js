// Physical constants and unit conventions.
//
// Simulation units: kilometres, seconds, kilograms.
// Frame: barycentric ecliptic J2000 (x toward the March equinox, z toward ecliptic north).
// Rendering maps ecliptic (x, y, z) -> three.js (x, z, -y) so +Y is ecliptic north.

export const G = 6.6743e-20; // km^3 kg^-1 s^-2
export const AU = 149597870.7; // km
export const C_KMS = 299792.458; // km/s
export const LIGHT_YEAR = 9460730472580.8; // km
export const PARSEC = 30856775814913.67; // km

export const SECOND = 1;
export const MINUTE = 60;
export const HOUR = 3600;
export const DAY = 86400;
export const YEAR = 365.25 * DAY;

export const MSUN = 1.988409870698051e30; // kg (GM_sun / G)
export const MEARTH = 5.972167867791379e24;
export const MJUP = 1.8981245973360505e27;
export const MMOON = 7.345789170645e22;
export const RSUN = 695700; // km
export const REARTH = 6371.0084;
export const RJUP = 69911;
export const LSUN = 3.828e26; // W
export const TSUN = 5772; // K
export const SIGMA_SB = 5.670374419e-8; // W m^-2 K^-4

export const GM_SUN = 132712440041.279419; // km^3/s^2 (DE440)

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const TAU = Math.PI * 2;

export const OBLIQUITY_J2000 = 23.4392911 * DEG;

// J2000.0 epoch as a JS timestamp (2000-01-01T12:00:00 TT, treated as UTC here;
// the ~64 s TT-UTC offset is irrelevant at sandbox scales and handled by the ephemeris library).
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

export function dateToSimTime(date) {
  return (date.getTime() - J2000_MS) / 1000;
}

export function simTimeToDate(t) {
  return new Date(J2000_MS + t * 1000);
}

// Number formatting helpers for astronomical quantities.

import { AU, LIGHT_YEAR, MEARTH, MJUP, MSUN, REARTH, RJUP, RSUN, DAY, YEAR, HOUR, MINUTE, C_KMS } from '../core/constants.js';

export function sig(x, n = 3) {
  if (!isFinite(x)) return x > 0 ? '∞' : '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e6 || a < 1e-3) {
    const e = Math.floor(Math.log10(a));
    const m = x / Math.pow(10, e);
    return `${m.toFixed(Math.max(0, n - 1))}×10${sup(e)}`;
  }
  return Number(x.toPrecision(n)).toLocaleString('en-US', { maximumFractionDigits: 6 });
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function sup(e) {
  return String(e).split('').map((c) => SUP[c] ?? c).join('');
}

export function fmtDistance(km) {
  const a = Math.abs(km);
  if (!isFinite(a)) return '∞';
  if (a < 1) return `${sig(km * 1000, 3)} m`;
  if (a < 1e6) return `${sig(km, 4)} km`;
  if (a < 0.1 * LIGHT_YEAR) {
    const au = km / AU;
    return a < 0.05 * AU ? `${sig(km / 1e6, 3)} million km` : `${sig(au, 4)} AU`;
  }
  return `${sig(km / LIGHT_YEAR, 3)} ly`;
}

export function fmtMass(kg) {
  if (kg >= 0.08 * MSUN) return `${sig(kg / MSUN, 4)} M☉`;
  if (kg >= 0.1 * MJUP) return `${sig(kg / MJUP, 3)} M♃`;
  if (kg >= 1e-4 * MEARTH) return `${sig(kg / MEARTH, 3)} M⊕`;
  return `${sig(kg, 3)} kg`;
}

export function fmtRadius(km) {
  if (km >= 0.1 * RSUN) return `${sig(km / RSUN, 3)} R☉`;
  if (km >= 2 * REARTH * 3) return `${sig(km / RJUP, 3)} R♃ (${sig(km, 4)} km)`;
  if (km >= 1000) return `${sig(km, 4)} km (${sig(km / REARTH, 3)} R⊕)`;
  if (km >= 1) return `${sig(km, 3)} km`;
  return `${sig(km * 1000, 3)} m`;
}

export function fmtDuration(s) {
  const a = Math.abs(s);
  if (!isFinite(a)) return '∞';
  if (a < MINUTE) return `${sig(s, 3)} s`;
  if (a < HOUR) return `${sig(s / MINUTE, 3)} min`;
  if (a < 2 * DAY) return `${sig(s / HOUR, 3)} h`;
  if (a < YEAR) return `${sig(s / DAY, 4)} d`;
  if (a < 1e6 * YEAR) return `${sig(s / YEAR, 4)} yr`;
  if (a < 1e9 * YEAR) return `${sig(s / YEAR / 1e6, 3)} Myr`;
  return `${sig(s / YEAR / 1e9, 3)} Gyr`;
}

export function fmtRate(secPerSec) {
  const a = Math.abs(secPerSec);
  const sign = secPerSec < 0 ? '−' : '';
  if (a === 0) return 'paused';
  if (a < 1.5 && a > 0.75) return `${sign}real time`;
  if (a < 1) return `${sign}${sig(a, 2)}×`;
  const units = [
    [YEAR, 'yr'], [30.4375 * DAY, 'mo'], [7 * DAY, 'wk'], [DAY, 'day'], [HOUR, 'hr'], [MINUTE, 'min'], [1, 's'],
  ];
  for (const [u, n] of units) {
    if (a >= u) return `${sign}${sig(a / u, 3)} ${n}/s`;
  }
  return `${sign}${sig(a, 3)}×`;
}

export function fmtSpeed(kms) {
  if (Math.abs(kms) < 1) return `${sig(kms * 1000, 3)} m/s`;
  if (Math.abs(kms) > 0.01 * C_KMS) return `${sig(kms, 4)} km/s (${sig(kms / C_KMS, 3)} c)`;
  return `${sig(kms, 4)} km/s`;
}

export function fmtTemp(k) {
  if (!isFinite(k) || k <= 0) return '—';
  return `${Math.round(k).toLocaleString('en-US')} K (${Math.round(k - 273.15).toLocaleString('en-US')} °C)`;
}

export function fmtAngle(rad) {
  return `${sig((rad * 180) / Math.PI, 4)}°`;
}

export function fmtDate(d) {
  if (!d || isNaN(d.getTime())) return { date: '—', time: '' };
  const y = d.getUTCFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yStr = y <= 0 ? `${1 - y} BCE` : y > 9999 ? y.toLocaleString('en-US') : `${y}`;
  const date = `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${yStr}`;
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')} UTC`;
  return { date, time };
}

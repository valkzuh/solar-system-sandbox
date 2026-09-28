// A simulated body. Dynamical state lives in the Simulation's typed arrays;
// the body keeps its index and all physical / presentation properties.

import { G, MSUN, RSUN, LSUN, MEARTH, REARTH } from '../core/constants.js';
import {
  msLuminosity, msRadius, effectiveTemperature, schwarzschildRadiusKm, luminosityFromRT,
} from '../core/stellar.js';

let nextUid = 1;

export class Body {
  constructor(spec) {
    this.uid = nextUid++;
    this.id = spec.id || `body${this.uid}`;
    this.name = spec.name || this.id;
    this.kind = spec.kind || 'planet';
    this.mass = spec.mass !== undefined ? spec.mass : (spec.gm || 0) / G;
    this.radius = spec.radius || 1000;
    this.flattening = spec.flattening || 0;
    this.shape = spec.shape || null;
    this.j2 = spec.j2 || 0; // zonal gravity harmonic (oblateness)
    this.j2Radius = spec.j2Radius || this.radius || 0;
    this.pole = spec.pole ? [...spec.pole] : null; // spin axis, ecliptic unit vector // triaxial radii for small irregular bodies
    this.albedo = spec.albedo ?? 0.3;
    this.geoAlbedo = spec.geoAlbedo ?? this.albedo;
    this.greenhouse = spec.greenhouse || 0;
    this.star = spec.star ? { ...spec.star } : null; // { temperature, luminosity (L_sun) }
    this.rotation = spec.rotation ? { ...spec.rotation } : { periodH: 24, poleRA: 0, poleDec: 90, W0: 0 };
    this.appearance = spec.appearance ? structuredClone(spec.appearance) : null;
    this.atmosphere = spec.atmosphere || null;
    this.rings = spec.rings ? { ...spec.rings } : null;
    this.info = spec.info || '';
    this.parentHint = spec.parent || null;
    this.comet = spec.comet ? { ...spec.comet } : null;
    this.massless = !!spec.massless; // does not source gravity (debris, comets, probes)
    this.heat = spec.heat || 0; // extra surface temperature from impacts (K)
    this.tempK = 0;
    this.accretion = 0; // black-hole accretion glow (arbitrary units, decays)
    this.createdAt = spec.createdAt ?? 0;
    this.showOrbit = spec.showOrbit ?? true;
    this.showLabel = spec.showLabel ?? true;
    this.color = spec.color || null;
    this.userCreated = !!spec.userCreated;
    this.index = -1;
    this.sim = null;
    this.primary = null; // dominant attractor (computed by hierarchy)
    this.orbit = null; // osculating elements relative to primary
    this.spinAngle0 = spec.spinAngle0 ?? null;
    this.template = spec.template || null;
    if (this.kind === 'blackhole') this.radius = schwarzschildRadiusKm(this.mass);
  }

  get gm() {
    return G * this.mass;
  }

  get isStar() {
    return this.kind === 'star' || this.kind === 'whitedwarf' || this.kind === 'neutron';
  }

  get isLuminous() {
    return !!this.star && this.star.luminosity > 0;
  }

  get density() {
    // g/cm^3
    const vol = (4 / 3) * Math.PI * Math.pow(this.radius * 1e5, 3);
    return (this.mass * 1000) / vol;
  }

  get pos() {
    return this.sim.bodyPos(this.index);
  }

  get vel() {
    return this.sim.bodyVel(this.index);
  }

  // Luminosity in watts.
  get luminosityW() {
    return this.star ? this.star.luminosity * LSUN : 0;
  }

  // Recompute stellar parameters from mass using main-sequence relations.
  updateStellarFromMass() {
    const m = this.mass / MSUN;
    if (this.kind === 'star') {
      const l = msLuminosity(m);
      const r = msRadius(m);
      this.radius = r * RSUN;
      this.star = { luminosity: l, temperature: effectiveTemperature(l, r) };
    } else if (this.kind === 'blackhole') {
      this.radius = schwarzschildRadiusKm(this.mass);
    } else if (this.kind === 'whitedwarf') {
      // Chandrasekhar-ish mass-radius: R ~ 0.0126 R_sun (M/0.6)^(-1/3)
      this.radius = 0.0126 * RSUN * Math.pow(Math.max(m, 0.05) / 0.6, -1 / 3);
      const t = this.star?.temperature || 20000;
      this.star = { temperature: t, luminosity: luminosityFromRT(this.radius / RSUN, t) };
    }
  }

  surfaceGravity() {
    return (this.gm / (this.radius * this.radius)) * 1000; // m/s^2
  }

  escapeVelocity() {
    return Math.sqrt((2 * this.gm) / this.radius); // km/s
  }

  toJSON() {
    const out = {
      id: this.id, name: this.name, kind: this.kind, mass: this.mass, radius: this.radius,
      flattening: this.flattening, shape: this.shape, albedo: this.albedo, geoAlbedo: this.geoAlbedo,
      greenhouse: this.greenhouse, star: this.star, rotation: this.rotation, appearance: this.appearance,
      atmosphere: this.atmosphere, rings: this.rings, info: this.info, parent: this.parentHint,
      comet: this.comet, massless: this.massless, heat: this.heat, showOrbit: this.showOrbit,
      showLabel: this.showLabel, color: this.color, userCreated: this.userCreated, template: this.template,
      spinAngle0: this.spinAngle0, j2: this.j2, j2Radius: this.j2Radius, pole: this.pole,
    };
    if (this.sim) {
      out.pos = Array.from(this.pos);
      out.vel = Array.from(this.vel);
    }
    return out;
  }
}

export const massUnits = { MSUN, MEARTH, REARTH, RSUN };

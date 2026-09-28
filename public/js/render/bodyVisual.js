// Per-body renderable: surface mesh, atmosphere shell, rings, stellar glow.

import * as THREE from 'three';
import { createPlanetMaterial, createAtmosphereMaterial, createRingMaterial, createStarMaterial, createGlowMaterial } from './materials.js';
import { ATMOSPHERES, PROC } from '../data/catalog.js';
import { balancedBlackbody, thermalGlow } from '../core/stellar.js';
import { iauAxis, basisFromPoleSpin, poleFromRaDec, eclToEqj } from '../sim/ephemeris.js';
import { eclToRender, cross, norm, hashString } from '../core/vec.js';
import { DEG, TAU, HOUR } from '../core/constants.js';

// ---------------------------------------------------------------------------
// Shared resources

const geoCache = new Map();
export function sphereGeometry(segLon, segLat) {
  const key = `${segLon}x${segLat}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const pos = [];
  const idx = [];
  for (let r = 0; r <= segLat; r++) {
    const lat = -Math.PI / 2 + (Math.PI * r) / segLat;
    for (let c = 0; c <= segLon; c++) {
      const lon = -Math.PI + (TAU * c) / segLon;
      pos.push(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
    }
  }
  const w = segLon + 1;
  for (let r = 0; r < segLat; r++) {
    for (let c = 0; c < segLon; c++) {
      const a = r * w + c, b = a + 1, d = a + w, e = d + 1;
      idx.push(a, b, e, a, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  geoCache.set(key, g);
  return g;
}

let ringGeo = null;
function ringGeometry() {
  if (ringGeo) return ringGeo;
  // Unit annulus from r=0 to 1 in the local XY plane; the shader discards by radius.
  const segs = 256;
  const pos = [0, 0, 0];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * TAU;
    pos.push(Math.cos(a), Math.sin(a), 0);
    if (i > 0) idx.push(0, i, i + 1);
  }
  ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ringGeo.setIndex(idx);
  // Build a finer annulus to avoid huge fan triangles (better depth interpolation).
  const pos2 = [];
  const idx2 = [];
  const rings = 24;
  for (let r = 0; r <= rings; r++) {
    const rad = 0.3 + (0.72 * r) / rings;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * TAU;
      pos2.push(Math.cos(a) * rad, Math.sin(a) * rad, 0);
    }
  }
  const w = segs + 1;
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < segs; i++) {
      const a = r * w + i;
      idx2.push(a, a + 1, a + w + 1, a, a + w + 1, a + w);
    }
  }
  ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos2, 3));
  ringGeo.setIndex(idx2);
  return ringGeo;
}

const quadGeo = new THREE.PlaneGeometry(2, 2);

export class TextureCache {
  constructor(renderer) {
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.means = new Map();
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
  }

  get(url, { srgb = true } = {}) {
    const key = `${url}|${srgb}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const tex = this.loader.load(url, (t) => {
      this._measure(url, t.image);
    });
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = Math.min(8, this.maxAniso);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.cache.set(key, tex);
    return tex;
  }

  // Mean linear reflectance of a texture, used to normalise brightness to the body's albedo.
  _measure(url, img) {
    try {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 32;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 64, 32);
      const d = ctx.getImageData(0, 0, 64, 32).data;
      let s = 0, wsum = 0;
      for (let y = 0; y < 32; y++) {
        const w = Math.cos(((y + 0.5) / 32 - 0.5) * Math.PI); // area weight
        for (let x = 0; x < 64; x++) {
          const i = (y * 64 + x) * 4;
          const lin = (v) => Math.pow(v / 255, 2.2);
          s += w * (0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
          wsum += w;
        }
      }
      this.means.set(url, s / wsum);
    } catch (e) {
      this.means.set(url, 0.3);
    }
  }

  mean(url) {
    return this.means.get(url);
  }
}

// ---------------------------------------------------------------------------

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();

export class BodyVisual {
  constructor(body, ctx) {
    this.body = body;
    this.ctx = ctx;
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = false;
    this.kind = body.kind;
    this.build();
  }

  build() {
    const b = this.body;
    const tex = this.ctx.textures;
    const quality = this.ctx.quality;
    const seg = quality === 'high' ? 1 : quality === 'low' ? 0.5 : 0.75;
    this.dispose(false);
    this.group.clear();
    this.mesh = null;
    this.atm = null;
    this.ring = null;
    this.glow = null;
    this.seed = (hashString(b.id) % 1000) / 10;

    if (b.kind === 'blackhole') {
      // Event horizon: perfectly black sphere; lensing handled in post-processing.
      const m = new THREE.MeshBasicMaterial({ color: 0x000000 });
      m.onBeforeCompile = () => {};
      this.mesh = new THREE.Mesh(sphereGeometry(64, 32), m);
      this.mesh.matrixAutoUpdate = false;
      this.group.add(this.mesh);
      // Accretion glow billboard
      this.glowMat = createGlowMaterial();
      this.glow = new THREE.Mesh(quadGeo, this.glowMat);
      this.glow.frustumCulled = false;
      this.group.add(this.glow);
      this.buildVersion = this.ctx.version;
      return;
    }

    if (b.isStar) {
      this.mat = createStarMaterial();
      this.mesh = new THREE.Mesh(sphereGeometry(Math.round(160 * seg), Math.round(80 * seg)), this.mat);
      this.mesh.matrixAutoUpdate = false;
      this.mesh.frustumCulled = false;
      this.group.add(this.mesh);
      this.glowMat = createGlowMaterial();
      this.glow = new THREE.Mesh(quadGeo, this.glowMat);
      this.glow.frustumCulled = false;
      this.glow.renderOrder = 5;
      this.group.add(this.glow);
      this.mat.uniforms.uSeed.value = this.seed;
      this.mat.uniforms.uCompact.value = b.kind !== 'star';
      this.buildVersion = this.ctx.version;
      return;
    }

    const small = b.radius < 300;
    const segLon = Math.round((small ? 96 : 256) * seg);
    this.mat = createPlanetMaterial();
    const u = this.mat.uniforms;
    this.mesh = new THREE.Mesh(sphereGeometry(segLon, segLon / 2), this.mat);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    const ap = b.appearance || {};
    const proc = ap.proc || null;
    u.uSeed.value = proc?.seed ?? this.seed;
    u.uLonOffset.value = ap.lonOffset || 0;
    u.uBrdfLS.value = 0;
    u.uMinnaert.value = 0;
    if (ap.special === 'earth') {
      u.uMode.value = 1;
      u.uMap.value = tex.get(ap.map);
      u.uNight.value = tex.get(ap.night);
      u.uPacked.value = tex.get(ap.packed, { srgb: false });
      u.uHasMap.value = true;
    } else if (ap.map) {
      u.uHasMap.value = true;
      u.uMap.value = tex.get(ap.map);
      this.mapUrl = ap.map;
      if (ap.bump) {
        u.uHasBump.value = true;
        u.uBump.value = tex.get(ap.bump, { srgb: false });
        u.uBumpScale.value = ap.bumpScale ?? 1;
      }
      if (ap.clouds === 'venus') u.uMode.value = 2;
    }
    if (proc) {
      u.uProcType.value = proc.type ?? PROC.ROCKY;
      if (proc.c1) u.uC1.value.set(...proc.c1);
      if (proc.c2) u.uC2.value.set(...proc.c2);
      if (proc.c3) u.uC3.value.set(...proc.c3);
      u.uProcA.value.set(proc.craters ?? 0.5, proc.detail ?? 0.5, proc.lineae ?? 0, proc.patches ?? proc.maria ?? 0);
      u.uProcB.value.set(proc.twoTone ?? 0, proc.spots ?? 0, proc.redCap ?? 0, proc.cantaloupe ?? 0);
      u.uProcC.value.set(proc.turbulence ?? 0.3, proc.bands ?? 0.3, proc.detailOnly ? 1 : 0, proc.sponge ?? 0);
      u.uWater.value = proc.water ?? 0.6;
      u.uIce.value = proc.ice ?? 0.1;
      u.uCloudCover.value = proc.clouds ?? 0.4;
    } else if (!ap.map && !ap.special) {
      u.uProcType.value = PROC.ROCKY;
    }
    const type = u.uProcType.value;
    const airless = !b.atmosphere && (type === PROC.ROCKY || type === PROC.ICY || type === PROC.VOLCANIC || type === PROC.NUCLEUS);
    if (airless) u.uBrdfLS.value = 0.75;
    if (type === PROC.GAS || type === PROC.ICE_GIANT) u.uMinnaert.value = 0.85;

    // Atmosphere shell
    const atmSpec = typeof b.atmosphere === 'string' ? ATMOSPHERES[b.atmosphere] : b.atmosphere;
    if (atmSpec && this.ctx.atmospheres) {
      this.atmSpec = atmSpec;
      this.atmMat = createAtmosphereMaterial();
      this.atm = new THREE.Mesh(sphereGeometry(128, 64), this.atmMat);
      this.atm.matrixAutoUpdate = false;
      this.atm.frustumCulled = false;
      this.atm.renderOrder = 2;
      this.group.add(this.atm);
      const a = this.atmMat.uniforms;
      a.uBetaR.value.set(...atmSpec.rayleigh);
      a.uHR.value = atmSpec.rayleighH;
      const mc = atmSpec.mieColor || [1, 1, 1];
      a.uBetaM.value.set(atmSpec.mie * mc[0], atmSpec.mie * mc[1], atmSpec.mie * mc[2]);
      a.uBetaMExt.value = atmSpec.mie * 1.1;
      a.uHM.value = atmSpec.mieH;
      a.uMieG.value = atmSpec.mieG;
      a.uBetaA.value.set(...(atmSpec.absorb || [0, 0, 0]));
      a.uHA.value = atmSpec.absorbH || 25;
      a.uSteps.value = quality === 'low' ? 8 : quality === 'high' ? 24 : 14;
      u.uHasAtm.value = true;
      u.uAtmExt.value.set(
        atmSpec.rayleigh[0] * atmSpec.rayleighH + atmSpec.mie * 1.1 * atmSpec.mieH,
        atmSpec.rayleigh[1] * atmSpec.rayleighH + atmSpec.mie * 1.1 * atmSpec.mieH,
        atmSpec.rayleigh[2] * atmSpec.rayleighH + atmSpec.mie * 1.1 * atmSpec.mieH,
      );
    }

    // Rings
    if (b.rings) {
      this.ringMat = createRingMaterial();
      const r = this.ringMat.uniforms;
      if (b.rings.color) {
        r.uColor.value = tex.get(b.rings.color);
        r.uAlpha.value = tex.get(b.rings.alpha, { srgb: false });
        r.uColor.value.wrapS = r.uAlpha.value.wrapS = THREE.ClampToEdgeWrapping;
        u.uRingAlpha.value = r.uAlpha.value;
      } else {
        r.uProcedural.value = true;
        r.uTint.value.set(...(b.rings.tint || [0.75, 0.7, 0.62]));
        r.uSeed.value = this.seed;
      }
      r.uOpacity.value = b.rings.opacity ?? 1;
      this.ring = new THREE.Mesh(ringGeometry(), this.ringMat);
      this.ring.matrixAutoUpdate = false;
      this.ring.frustumCulled = false;
      this.ring.renderOrder = 3;
      this.group.add(this.ring);
      u.uHasRing.value = !!b.rings.color;
      u.uRingOpacity.value = b.rings.opacity ?? 1;
    }
    this.buildVersion = this.ctx.version;
  }

  // Orientation basis (ecliptic unit vectors) for the body at the current time.
  basis(date, t) {
    const b = this.body;
    const rot = b.rotation || {};
    if (rot.iau) {
      const ax = iauAxis(rot.iau, date);
      return basisFromPoleSpin(ax.poleEqj, ax.spin);
    }
    const prim = b.primary;
    if (rot.locked && prim && prim.sim) {
      const r = [prim.pos[0] - b.pos[0], prim.pos[1] - b.pos[1], prim.pos[2] - b.pos[2]];
      const v = [b.vel[0] - prim.vel[0], b.vel[1] - prim.vel[1], b.vel[2] - prim.vel[2]];
      let z = norm(cross(r, [-v[0], -v[1], -v[2]]));
      z = norm(cross([-r[0], -r[1], -r[2]], v));
      if (!isFinite(z[0])) z = [0, 0, 1];
      const x0 = norm(r);
      const y = norm(cross(z, x0));
      const x = cross(y, z);
      return { x, y, z };
    }
    let poleEqj;
    if (b.pole && rot.poleRA === undefined) poleEqj = eclToEqj(b.pole);
    else poleEqj = poleFromRaDec(rot.poleRA ?? 0, rot.poleDec ?? 90);
    const periodS = (rot.periodH || 24) * HOUR;
    const w = (rot.W0 || 0) * DEG + (TAU * t) / periodS;
    return basisFromPoleSpin(poleEqj, w);
  }

  dispose(all = true) {
    for (const m of [this.mat, this.atmMat, this.ringMat, this.glowMat]) m?.dispose();
    if (all) this.group.removeFromParent();
  }
}

export { tmpM, tmpV, balancedBlackbody, thermalGlow, eclToRender };

// Scene orchestration: camera-relative rendering of all bodies, lighting/eclipse setup,
// exposure, post-processing (lensing, bloom, tone mapping).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BodyVisual, TextureCache } from './bodyVisual.js';
import { Sky } from './sky.js';
import { PointSprites } from './points.js';
import { OrbitRenderer } from './orbits.js';
import { Belts } from './belts.js';
import { CometTails } from './comets.js';
import { LensingShader, MAX_LENSES } from './lensing.js';
import { MeterPass } from './meter.js';
import { DebrisRenderer } from './debris.js';
import { Zones } from './zones.js';
import { EffectsRenderer } from './effects.js';
import { balancedBlackbody, thermalGlow, blackbodyRGB, starSurfaceRadiance } from '../core/stellar.js';
import { eclToRender } from '../core/vec.js';
import { AU, RSUN } from '../core/constants.js';
import { ATMOSPHERES } from '../data/catalog.js';

const OCC_TINT = {
  earth: [1.0, 0.33, 0.1],
  venus: [1.0, 0.7, 0.3],
  mars: [1.0, 0.5, 0.3],
  titan: [1.0, 0.5, 0.2],
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.gl.toneMapping = THREE.AgXToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.autoClear = false;
    this.scene = new THREE.Scene();
    // Non-physical overlays (orbit lines, placement preview) are rendered after light
    // metering so they never influence exposure; they still depth-test against bodies.
    this.overlay = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 1e-4, 1e14);
    this.textures = new TextureCache(this.gl);
    this.sky = new Sky();
    this.points = new PointSprites();
    this.scene.add(this.points.points);
    this.orbits = new OrbitRenderer(this.overlay);
    this.belts = new Belts(this.scene);
    this.comets = new CometTails(this.scene);
    this.debris = new DebrisRenderer(this.scene);
    this.zones = new Zones(this.overlay);
    this.effects = new EffectsRenderer(this.scene);
    this.visuals = new Map();
    this.settings = {
      quality: 'medium',
      bodyScale: 1,
      atmospheres: true,
      bloom: true,
      bloomStrength: 0.85,
      spikes: false,
      lensing: true,
      realisticBrightness: true,
      exposureBias: 0,
    };
    this.version = 0;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.lenses = [];
    this.stats = { drawCalls: 0 };
    this._initComposer();
  }

  async init(onProgress) {
    await this.sky.load(onProgress);
  }

  _initComposer() {
    const size = this.gl.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(size.x, 1), Math.max(size.y, 1), { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.gl, rt);
    this.skyPass = new RenderPass(this.sky.scene, this.camera);
    this.skyPass.clear = true;
    this.mainPass = new RenderPass(this.scene, this.camera);
    this.mainPass.clear = false;
    this.mainPass.clearDepth = true;
    this.lensPass = new ShaderPass(LensingShader);
    this.lensPass.enabled = false;
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 1.4);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.skyPass);
    this.composer.addPass(this.mainPass);
    this.meter = new MeterPass();
    this.composer.addPass(this.meter);
    this.overlayPass = new RenderPass(this.overlay, this.camera);
    this.overlayPass.clear = false;
    this.overlayPass.clearDepth = false;
    this.composer.addPass(this.overlayPass);
    this.composer.addPass(this.lensPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    const q = this.settings.quality;
    const pr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'low' ? 1 : 1.5);
    this.pixelRatio = pr;
    this.gl.setPixelRatio(pr);
    this.gl.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setQuality(q) {
    this.settings.quality = q;
    this.version++;
    this.resize(this.width, this.height);
  }

  invalidateVisuals() {
    this.version++;
  }

  visualFor(body) {
    let v = this.visuals.get(body);
    if (!v || v.buildVersion !== this.version) {
      if (v) v.dispose();
      v = new BodyVisual(body, { textures: this.textures, quality: this.settings.quality, atmospheres: this.settings.atmospheres, version: this.version });
      this.visuals.set(body, v);
      this.scene.add(v.group);
    }
    return v;
  }

  rebuildBody(body) {
    const v = this.visuals.get(body);
    if (v) {
      v.dispose();
      this.visuals.delete(body);
    }
  }

  /**
   * frame: { sim, date, camPos (ecliptic km), camQuat (THREE.Quaternion), fovY (rad),
   *          exposure, focusBody, selected, camDist, time (real seconds) }
   */
  render(frame) {
    const { sim, camPos } = frame;
    const cam = this.camera;
    cam.fov = (frame.fovY * 180) / Math.PI;
    cam.quaternion.copy(frame.camQuat);
    cam.position.set(0, 0, 0);
    cam.near = Math.max(frame.near || 1e-3, 1e-5);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const heightPx = this.height * this.pixelRatio;
    const pixelAngle = frame.fovY / heightPx;
    const exposure = frame.exposure;
    const bodies = sim.bodies;
    const scale = this.settings.bodyScale;

    // Remove visuals for bodies that no longer exist.
    for (const [b, v] of this.visuals) {
      if (!b.sim) {
        v.dispose();
        this.visuals.delete(b);
      }
    }

    // Light sources.
    const stars = [];
    for (const b of bodies) {
      if (b.isLuminous) {
        const rp = eclToRender([b.pos[0] - camPos[0], b.pos[1] - camPos[1], b.pos[2] - camPos[2]]);
        stars.push({ body: b, rp, lum: b.star.luminosity, color: balancedBlackbody(b.star.temperature) });
      }
    }

    // Transient light sources (supernova fireballs) illuminate everything like stars.
    for (const e of frame.effects || []) {
      const L = e.luminosity(frame.simTime);
      if (!(L > 0)) continue;
      const c = e.center(frame.simTime);
      const T = e.temperature(frame.simTime);
      const pseudo = { pos: c, radius: e.radius(frame.simTime), star: { luminosity: L, temperature: T }, isStar: true, kind: 'effect' };
      stars.push({ body: pseudo, rp: eclToRender([c[0] - camPos[0], c[1] - camPos[1], c[2] - camPos[2]]), lum: L, color: balancedBlackbody(T) });
    }

    this.points.begin();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const ctx = { pixelAngle, pixelRatio: this.pixelRatio, exposure, camDist: frame.camDist, focusBody: frame.focusBody, selected: frame.selected, heightPx };
    const tmpSphere = new THREE.Sphere();
    this.lenses.length = 0;
    const dateObj = frame.date;
    // Calibration shared with the sky's star catalog: energy of a point of flux F (relative to
    // the Sun at 1 AU). A magnitude-0 star has F = 2.0e-11.
    const zoom = Math.max(1, (60 * Math.PI) / 180 / frame.fovY);
    const starCal = (2.4 * this.sky.starGain * Math.sqrt(zoom)) / 2.0e-11;
    let glareDim = 0;

    for (const b of bodies) {
      const rel = [b.pos[0] - camPos[0], b.pos[1] - camPos[1], b.pos[2] - camPos[2]];
      const D = Math.hypot(rel[0], rel[1], rel[2]);
      const rp = eclToRender(rel);
      const visR = b.isStar || b.kind === 'blackhole' ? b.radius : b.radius * scale;
      const angR = visR / Math.max(D, 1e-6);
      const pxR = angR / pixelAngle;
      tmpSphere.center.set(rp[0], rp[1], rp[2]);
      tmpSphere.radius = b.isStar ? visR * 40 : visR * 1.3 + (b.rings ? b.rings.outer * scale : 0);
      const inView = frustum.intersectsSphere(tmpSphere);

      // Brightness of the unresolved point source.
      if (b.kind === 'blackhole') {
        if (inView) this._lensFor(b, rp, D, pixelAngle);
      }
      if (b.isLuminous) {
        const flux = (b.star.luminosity * (AU * AU)) / (D * D); // relative to Sun at 1 AU
        const c = balancedBlackbody(b.star.temperature);
        if (pxR < 1.5 && inView) this.points.push(rp, c, Math.min(flux * starCal, 400) * (1 - pxR / 1.5), this.pixelRatio, 3);
        // Sky glare suppression when a star is near the view centre.
        if (inView) {
          const v = new THREE.Vector3(rp[0], rp[1], rp[2]).normalize();
          const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
          const ang = Math.acos(Math.min(1, v.dot(fwd)));
          const g = Math.min(1, Math.log10(1 + flux * 1e3) / 3) * Math.max(0, 1 - ang / (frame.fovY * 0.9));
          glareDim = Math.max(glareDim, g);
        }
      } else if (b.kind !== 'blackhole' && inView && pxR < 2.0) {
        let E = 0;
        let phaseAvg = 0;
        for (const s of stars) {
          const d2 = (b.pos[0] - s.body.pos[0]) ** 2 + (b.pos[1] - s.body.pos[1]) ** 2 + (b.pos[2] - s.body.pos[2]) ** 2;
          const e = (s.lum * AU * AU) / d2;
          // Phase: angle star-body-camera.
          const sb = [s.body.pos[0] - b.pos[0], s.body.pos[1] - b.pos[1], s.body.pos[2] - b.pos[2]];
          const cosA = -(sb[0] * rel[0] + sb[1] * rel[1] + sb[2] * rel[2]) / (Math.sqrt(d2) * D);
          const alpha = Math.acos(Math.max(-1, Math.min(1, cosA)));
          // Lambert sphere phase function.
          const ph = (Math.sin(alpha) + (Math.PI - alpha) * Math.cos(alpha)) / Math.PI;
          E += e;
          phaseAvg += e * ph;
        }
        if (E > 0) phaseAvg /= E;
        // Reflected flux at the camera (relative to the Sun at 1 AU). Rendered at least as
        // bright as a catalog star of the same apparent magnitude (dark-adapted eye), or at the
        // camera exposure if that is brighter.
        const reflFlux = E * (b.geoAlbedo || 0.3) * phaseAvg * angR * angR;
        let energy = Math.max((Math.PI * reflFlux) / (pixelAngle * pixelAngle) * exposure, Math.min(reflFlux * starCal, 6));
        // Thermal self-emission of hot bodies.
        if (b.tempK > 800) energy += (Math.PI * thermalGlow(b.tempK).value * angR * angR) / (pixelAngle * pixelAngle) * exposure;
        if (b.comet && this.comets.visible) {
          const coma = this.comets.comae.find((c) => c.body === b);
          if (coma) {
            const comaR = 4e4 * Math.sqrt(coma.activity);
            energy += (0.02 * coma.activity * Math.PI * (comaR / D) ** 2) / (pixelAngle * pixelAngle) * exposure * E;
          }
        }
        const fade = pxR < 1 ? 1 : 1 - (pxR - 1);
        const col = b.tempK > 1200 ? blackbodyRGB(b.tempK) : [1, 0.97, 0.92];
        if (fade > 0) this.points.push(rp, col, energy * fade, this.pixelRatio, 2.2);
      }

      // Resolved mesh.
      const hide = b.kind === 'debris' || (pxR < 0.35 && !b.isStar) || (!inView && !(b.isStar && pxR > 0.05));
      let v = this.visuals.get(b);
      if (hide) {
        if (v) v.group.visible = false;
        continue;
      }
      v = this.visualFor(b);
      v.group.visible = true;
      this._updateVisual(v, b, rp, D, visR, pxR, stars, camPos, dateObj, frame, ctx);
    }

    // Comet comae as soft glows (drawn through the point renderer).
    this.sky.update({ pixelRatio: this.pixelRatio, fovY: frame.fovY, height: heightPx, glareDim });
    this.points.end();
    this.orbits.update(bodies, camPos, ctx);
    const realStars = stars.filter((s) => s.body.kind !== 'effect');
    const mainStar = realStars.length ? realStars.reduce((a, s) => (s.body.mass > a.body.mass ? s : a)).body : null;
    this.belts.update(mainStar, camPos, sim.time, ctx);
    this.comets.update(camPos, ctx);
    this.debris.update(bodies, camPos, mainStar, ctx, frame.simTime);
    this.zones.update(frame.selected, camPos);
    this.effects.update(frame.effects || [], camPos, frame.simTime, ctx);

    // Post-processing configuration.
    this.lensPass.enabled = this.settings.lensing && this.lenses.length > 0;
    if (this.lensPass.enabled) this._configureLensing(pixelAngle);
    this.bloomPass.enabled = this.settings.bloom;
    this.bloomPass.strength = this.settings.bloomStrength;
    this.meter.exposureAtRender = exposure;
    this.composer.render();
  }

  _lensFor(b, rp, D, pixelAngle) {
    if (this.lenses.length >= MAX_LENSES) return;
    const rs = b.radius; // Schwarzschild radius (km)
    const einstein = Math.sqrt((2 * rs) / Math.max(D, rs * 3));
    const shadow = Math.min((2.598 * rs) / Math.max(D, rs), 1.2);
    if (einstein / pixelAngle < 0.5) return;
    const v = new THREE.Vector3(rp[0], rp[1], rp[2]).project(this.camera);
    if (v.z > 1) return;
    this.lenses.push({ uv: new THREE.Vector2(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5), einstein, shadow, D, glow: b.accretion });
  }

  _configureLensing(pixelAngle) {
    const u = this.lensPass.uniforms;
    u.uCount.value = this.lenses.length;
    this.lenses.forEach((l, i) => {
      u.uCenter.value[i].copy(l.uv);
      u.uEinstein.value[i] = l.einstein;
      u.uShadow.value[i] = l.shadow;
      u.uDist.value[i] = l.D;
      const g = Math.min(l.glow, 50);
      u.uGlow.value[i].set(1.0 * g + 0.02, 0.6 * g + 0.015, 0.3 * g + 0.01);
    });
    const h = this.height * this.pixelRatio, w = this.width * this.pixelRatio;
    u.uRadPerUv.value.set(pixelAngle * w, pixelAngle * h);
    u.tDepth.value = null;
    u.uUseDepth.value = false;
  }

  _updateVisual(v, b, rp, D, visR, pxR, stars, camPos, date, frame, ctx) {
    const g = v.group;
    g.matrix.makeTranslation(rp[0], rp[1], rp[2]);
    g.matrixWorldNeedsUpdate = true;
    const basis = v.basis(date, frame.simTime);
    const bx = eclToRender(basis.x), by = eclToRender(basis.y), bz = eclToRender(basis.z);
    let sx = visR, sy = visR, sz = visR;
    if (b.shape) {
      const k = b.isStar ? 1 : this.settings.bodyScale;
      [sx, sy, sz] = [b.shape[0] * k, b.shape[1] * k, b.shape[2] * k];
    } else if (b.flattening) {
      const eq = visR / Math.cbrt(1 - b.flattening);
      sx = sy = eq;
      sz = eq * (1 - b.flattening);
    }
    const R = new THREE.Matrix4().makeBasis(new THREE.Vector3(...bx), new THREE.Vector3(...by), new THREE.Vector3(...bz));
    const M = R.clone().multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
    v.mesh.matrix.copy(M);
    v.mesh.matrixWorldNeedsUpdate = true;
    const pixelSize = D * ctx.pixelAngle; // km per pixel at the body
    const exposure = ctx.exposure;

    if (b.kind === 'blackhole') {
      const glow = v.glow;
      const gm = v.glowMat.uniforms;
      gm.uCenter.value.set(rp[0], rp[1], rp[2]);
      const size = Math.max(visR * 30, 40 * pixelSize);
      gm.uSize.value = size;
      gm.uCoreFrac.value = visR / size;
      gm.uColor.value.set(1.0, 0.55, 0.25);
      gm.uGlare.value = Math.min(b.accretion, 20) * 0.5;
      gm.uCorona.value = 0;
      glow.visible = b.accretion > 0.01;
      return;
    }

    if (b.isStar) {
      const u = v.mat.uniforms;
      const col = balancedBlackbody(b.star.temperature);
      u.uColor.value.set(col[0], col[1], col[2]);
      u.uTime.value = frame.simTime;
      u.uPixelSize.value = pixelSize;
      u.uRadius.value = visR;
      u.uInvScale2.value.set(1 / (sx * sx), 1 / (sy * sy), 1 / (sz * sz));
      // Physical surface radiance scaled by the camera exposure (the metering loop lowers the
      // exposure when a large, bright disc fills the frame, revealing granulation).
      const radiance = starSurfaceRadiance(b.star.temperature) * (b.kind === 'neutron' ? 0.2 : 1);
      u.uBrightness.value = radiance * exposure;
      // Glow billboard: corona (physical, ~1e-6 of the disc) + veiling glare of the camera/eye
      // (proportional to the flux reaching the sensor and the visible fraction of the disc).
      const gmU = v.glowMat.uniforms;
      gmU.uCenter.value.set(rp[0], rp[1], rp[2]);
      const flux = (b.star.luminosity * AU * AU) / (D * D);
      const glarePx = Math.min(Math.max(pxR * 6, 30 + 60 * Math.log10(1 + flux * exposure * 10)), ctx.heightPx * 0.8);
      const size = Math.max(glarePx * pixelSize, visR * 12);
      gmU.uSize.value = size;
      gmU.uCoreFrac.value = visR / size;
      gmU.uColor.value.set(col[0], col[1], col[2]);
      const vis = this._starVisibility(b, rp, visR, D, frame);
      gmU.uGlare.value = Math.min(flux * exposure * 0.6, 30) * vis;
      gmU.uCorona.value = b.kind === 'star' ? Math.min(2.5e-6 * radiance * exposure, 50) : 0;
      gmU.uSpikes.value = this.settings.spikes ? 1.5 : 0;
      gmU.uTime.value = frame.simTime;
      gmU.uSeed.value = v.seed;
      return;
    }

    const u = v.mat.uniforms;
    u.uRot.value.setFromMatrix4(R);
    u.uInvScale2.value.set(1 / (sx * sx), 1 / (sy * sy), 1 / (sz * sz));
    u.uExposure.value = exposure;
    u.uTime.value = frame.simTime;
    u.uRadius.value = visR;
    u.uPixelSize.value = pixelSize;
    u.uCloudOffset.value = ((frame.simTime / 86400) * 0.004) % 1;
    u.uTempK.value = b.tempK || 250;
    if (v.mapUrl) {
      const mean = this.textures.mean(v.mapUrl);
      if (mean) u.uAlbedoScale.value = Math.min(4, (b.geoAlbedo || 0.3) / mean) * 0.8;
    }
    const th = thermalGlow((b.tempK || 0));
    u.uThermal.value.set(th.color[0] * th.value * exposure, th.color[1] * th.value * exposure, th.color[2] * th.value * exposure);

    // Lights: brightest stars at this body.
    const lights = stars
      .map((s) => {
        const d2 = (b.pos[0] - s.body.pos[0]) ** 2 + (b.pos[1] - s.body.pos[1]) ** 2 + (b.pos[2] - s.body.pos[2]) ** 2;
        return { s, e: s.lum / d2 };
      })
      .sort((a, c) => c.e - a.e)
      .slice(0, 4);
    const occ = this._occluders(b, frame);
    const setLights = (U) => {
      U.uLightCount.value = lights.length;
      lights.forEach(({ s }, i) => {
        U.uLightPos.value[i].set(s.rp[0], s.rp[1], s.rp[2]);
        U.uLightColor.value[i].set(s.color[0] * s.lum, s.color[1] * s.lum, s.color[2] * s.lum);
        U.uLightRadius.value[i] = s.body.radius;
      });
      U.uOccCount.value = occ.length;
      occ.forEach((o, i) => {
        const p = eclToRender([o.pos[0] - camPos[0], o.pos[1] - camPos[1], o.pos[2] - camPos[2]]);
        U.uOcc.value[i].set(p[0], p[1], p[2], o.radius * (o.isStar ? 1 : this.settings.bodyScale));
        const t = OCC_TINT[typeof o.atmosphere === 'string' ? o.atmosphere : ''] || [0, 0, 0];
        U.uOccTint.value[i].set(t[0] * 0.0025, t[1] * 0.0025, t[2] * 0.0025);
      });
      U.uExposure.value = exposure;
    };
    setLights(u);

    // Atmosphere
    if (v.atm) {
      const a = v.atmMat.uniforms;
      setLights(a);
      const atmH = v.atmSpec.height * this.settings.bodyScale;
      const Rp = sx; // equatorial radius
      const stretch = sx / sz;
      const Ra = Rp + atmH;
      a.uAtmCenter.value.set(rp[0], rp[1], rp[2]);
      a.uPlanetRadius.value = Rp;
      a.uAtmRadius.value = Ra;
      a.uAtmScale.value = this.settings.bodyScale;
      a.uPole.value.set(bz[0], bz[1], bz[2]);
      a.uStretch.value = stretch;
      v.atm.matrix.copy(R.clone().multiply(new THREE.Matrix4().makeScale(Ra * 1.002, Ra * 1.002, (Ra * 1.002) / stretch)));
      v.atm.matrixWorldNeedsUpdate = true;
      const inside = D < Ra * 1.002;
      v.atmMat.side = inside ? THREE.BackSide : THREE.FrontSide;
      // Skip when the shell is sub-pixel.
      v.atm.visible = atmH / pixelSize > 0.05 || pxR > 20;
    }

    // Rings
    if (v.ring) {
      const r = v.ringMat.uniforms;
      setLights(r);
      const outer = b.rings.outer * this.settings.bodyScale;
      const inner = b.rings.inner * this.settings.bodyScale;
      v.ring.matrix.copy(R.clone().multiply(new THREE.Matrix4().makeScale(outer, outer, outer)));
      v.ring.matrixWorldNeedsUpdate = true;
      r.uRadii.value.set(inner / outer, 1.0);
      r.uNormal.value.set(bz[0], bz[1], bz[2]);
      r.uPlanetCenter.value.set(rp[0], rp[1], rp[2]);
      r.uPlanetRadius.value = visR;
      r.uPixelSize.value = pixelSize / outer;
      u.uRingNormal.value.set(bz[0], bz[1], bz[2]);
      u.uRingCenter.value.set(rp[0], rp[1], rp[2]);
      u.uRingRadii.value.set(inner, outer);
    }
  }

  // Bodies that may cast shadows on `b`: largest angular size as seen from b.
  _occluders(b, frame) {
    const cands = [];
    for (const o of frame.sim.bodies) {
      if (o === b || o.isLuminous || o.kind === 'debris' || o.kind === 'blackhole') continue;
      const d = Math.hypot(o.pos[0] - b.pos[0], o.pos[1] - b.pos[1], o.pos[2] - b.pos[2]);
      const ang = o.radius / d;
      if (ang < 1e-4) continue;
      cands.push({ o, ang });
    }
    cands.sort((a, c) => c.ang - a.ang);
    return cands.slice(0, 6).map((c) => c.o);
  }

  // Fraction of a star's disc visible from the camera (occultation by planets).
  _starVisibility(star, rp, R, D, frame) {
    let vis = 1;
    const aS = Math.asin(Math.min(1, R / D));
    const sDir = [rp[0] / D, rp[1] / D, rp[2] / D];
    const camPos = frame.camPos;
    for (const o of frame.sim.bodies) {
      if (o === star || o.isLuminous || o.kind === 'debris') continue;
      const rel = eclToRender([o.pos[0] - camPos[0], o.pos[1] - camPos[1], o.pos[2] - camPos[2]]);
      const dO = Math.hypot(...rel);
      if (dO > D) continue;
      const oR = o.radius * this.settings.bodyScale;
      if (dO < oR) return 0;
      const aO = Math.asin(Math.min(1, oR / dO));
      const oDir = [rel[0] / dO, rel[1] / dO, rel[2] / dO];
      const c = [oDir[1] * sDir[2] - oDir[2] * sDir[1], oDir[2] * sDir[0] - oDir[0] * sDir[2], oDir[0] * sDir[1] - oDir[1] * sDir[0]];
      const sep = Math.atan2(Math.hypot(...c), oDir[0] * sDir[0] + oDir[1] * sDir[1] + oDir[2] * sDir[2]);
      if (sep >= aS + aO) continue;
      vis *= 1 - circleOverlap(aS, aO, sep) / (Math.PI * aS * aS);
    }
    return Math.max(0, vis);
  }
}

export function circleOverlap(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) {
    const r = Math.min(r1, r2);
    return Math.PI * r * r;
  }
  const a = r1 * r1 * Math.acos(Math.max(-1, Math.min(1, (d * d + r1 * r1 - r2 * r2) / (2 * d * r1))));
  const b = r2 * r2 * Math.acos(Math.max(-1, Math.min(1, (d * d + r2 * r2 - r1 * r1) / (2 * d * r2))));
  const c = 0.5 * Math.sqrt(Math.max((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2), 0));
  return a + b - c;
}

export { RSUN, ATMOSPHERES };

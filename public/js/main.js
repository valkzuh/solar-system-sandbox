// Solar System Sandbox — application entry point.

import * as THREE from 'three';
import { Simulation } from './sim/simulation.js';
import { updateHierarchy, circularVelocity, relElements } from './sim/hierarchy.js';
import { installEventHandlers } from './sim/events.js';
import { Renderer } from './render/renderer.js';
import { Labels } from './render/labels.js';
import { MeterPass } from './render/meter.js';
import { Supernova } from './render/effects.js';
import { CameraController } from './camera.js';
import { SCENARIOS, SCENARIO_BY_ID } from './data/scenarios.js';
import { UI } from './ui/ui.js';
import { AU, DAY, HOUR, J2000_MS, dateToSimTime, simTimeToDate, YEAR } from './core/constants.js';
import { equilibriumTemperatureK } from './core/stellar.js';
import { eclToRender, renderToEcl } from './core/vec.js';

const WARP_STEPS = [1, 10, 60, 300, 1800, HOUR, 6 * HOUR, DAY, 7 * DAY, 30 * DAY, 0.25 * YEAR, YEAR, 5 * YEAR, 25 * YEAR, 100 * YEAR];
const MAX_DATE_S = 2.5e5 * YEAR; // JS Date range limit (~±273k years)

class App {
  constructor() {
    this.canvas = document.getElementById('view');
    this.sim = new Simulation();
    installEventHandlers(this.sim, this);
    this.renderer = new Renderer(this.canvas);
    this.camera = new CameraController(this.canvas);
    this.labels = new Labels(document.getElementById('labels'));
    this.selected = null;
    this.warp = HOUR;
    this.paused = false;
    this.exposure = 1;
    this.autoExposure = true;
    this.exposureEV = 0;
    this.budget = 10;
    this.lastFrame = performance.now();
    this.hierarchyTimer = 0;
    this.tempTimer = 0;
    this.frameMs = 16;
    this.stepsPerFrame = 0;
    this.scenarioId = null;
    this.placing = null; // template id when placing
    this.snapExposure = 0;
    this.effects = [];
    this.lightTime = false;
  }

  async start() {
    const setLoading = (t) => (document.getElementById('loadingText').textContent = t);
    try {
      this.renderer.resize(window.innerWidth, window.innerHeight);
      setLoading('Loading sky…');
      await this.renderer.init((what) => setLoading(`Loaded ${what}…`));
    } catch (e) {
      console.error(e);
      setLoading(`Failed to initialise WebGL2: ${e.message || e}`);
      return;
    }
    this.ui = new UI(this);
    window.addEventListener('resize', () => this.renderer.resize(window.innerWidth, window.innerHeight));
    this.camera.on('click', (e) => this.onClick(e));
    this.camera.on('dblclick', (e) => {
      const b = this.pick(e.clientX, e.clientY);
      if (b) this.flyTo(b);
    });
    this.camera.on('hover', (e) => this.ui.onHover(e));
    this.camera.emitCapture = (e, phase) => this.ui.placementCapture(e, phase);
    this.labels.onClick = (b) => this.select(b);
    this.labels.onDblClick = (b) => this.flyTo(b);
    const params = new URLSearchParams(location.search);
    const scen = params.get('scenario') || 'solar-now';
    setLoading('Computing ephemerides…');
    this.loadScenario(SCENARIO_BY_ID[scen] ? scen : 'solar-now', params.get('date') ? new Date(params.get('date')) : new Date());
    document.getElementById('loading').classList.add('hidden');
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------------ scenarios
  loadScenario(id, date = new Date()) {
    const sc = SCENARIO_BY_ID[id];
    if (!sc) return;
    this.sim.clear();
    this.sim.dir = 1;
    this.sim.time = dateToSimTime(date);
    this.sim.tauBase = this.sim.time;
    this.renderer.orbits.clearTrails();
    this.renderer.comets.clear();
    this.labels.clear();
    this.effects = [];
    this.select(null);
    const opts = sc.build(this, date) || {};
    this.scenarioId = id;
    this.afterLoad(opts);
    this.ui?.toast(`<b>${sc.name}</b><br>${sc.desc}`, 'info', 7000);
  }

  afterLoad(opts = {}) {
    this.sim.stats.energy0 = null;
    updateHierarchy(this.sim);
    this.updateTemperatures(0);
    // Belts are generated around the dominant star with resonances anchored to the real giants.
    const jup = this.sim.findById('jupiter');
    const nep = this.sim.findById('neptune');
    const sun = this.sim.findById('sun');
    const lon = (b) => (b && sun ? Math.atan2(b.pos[1] - sun.pos[1], b.pos[0] - sun.pos[0]) : 0);
    if (opts.belts || (jup && sun)) {
      this.renderer.belts.build(this.sim.time, lon(jup), lon(nep));
    } else {
      this.renderer.belts.dispose();
    }
    this.warp = opts.warp ?? HOUR;
    this.paused = false;
    const focus = (opts.focus && this.sim.findById(opts.focus)) || this.sim.bodies[0];
    this.camera.focus = focus;
    this.camera.panOffset = [0, 0, 0];
    this.camera.transition = null;
    const d = opts.distance ?? (focus ? focus.radius * 5 : AU);
    this.camera.distance = this.camera.target.distance = d;
    this.camera.elevation = this.camera.target.elevation = opts.elevation ?? 0.3;
    // Default azimuth: view the focus from its lit side at ~45 degrees.
    const star = this.mainStar();
    if (focus && star && focus !== star) {
      const r = eclToRender([star.pos[0] - focus.pos[0], star.pos[1] - focus.pos[1], star.pos[2] - focus.pos[2]]);
      this.camera.azimuth = this.camera.target.azimuth = Math.atan2(r[0], r[2]) + 0.8;
    }
    // On small screens keep the view uncluttered: don't open the inspector automatically.
    this.select(focus && !focus.isStar && window.innerWidth > 900 ? focus : null);
    this.snapExposure = 12;
    this.ui?.refreshAll();
  }

  addEffect(spec) {
    if (spec.kind === 'supernova') this.effects.push(new Supernova(spec));
  }

  // Every light source: luminous bodies plus transient effects. { pos, luminosityW, temperature }
  lightSources() {
    const out = [];
    for (const b of this.sim.bodies) if (b.isLuminous) out.push({ pos: b.pos, lum: b.star.luminosity, body: b });
    for (const e of this.effects) {
      const L = e.luminosity(this.sim.time);
      if (L > 0) out.push({ pos: e.center(this.sim.time), lum: L, body: null });
    }
    return out;
  }

  mainStar() {
    let best = null;
    for (const b of this.sim.bodies) if (b.isLuminous && (!best || b.mass > best.mass)) best = b;
    return best;
  }

  // ------------------------------------------------------------------ selection / camera
  select(body) {
    this.selected = body;
    this.ui?.inspect(body);
  }

  flyTo(body, opts) {
    if (!body) return;
    this.select(body);
    this.camera.bodyScale = this.renderer.settings.bodyScale;
    this.camera.flyTo(body, opts);
  }

  pick(clientX, clientY) {
    const cam = this.renderer.camera;
    const camPos = this.camera.camPos;
    const v = new THREE.Vector3();
    let best = null;
    let bestScore = Infinity;
    const pixelAngle = this.camera.fovY / window.innerHeight;
    for (const b of this.sim.bodies) {
      if (b.kind === 'debris') continue;
      const rel = [b.pos[0] - camPos[0], b.pos[1] - camPos[1], b.pos[2] - camPos[2]];
      const rp = eclToRender(rel);
      v.set(rp[0], rp[1], rp[2]).project(cam);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      const D = Math.hypot(...rel);
      const scale = b.isStar || b.kind === 'blackhole' ? 1 : this.renderer.settings.bodyScale;
      const pxR = (b.radius * scale) / D / pixelAngle;
      const d = Math.hypot(x - clientX, y - clientY);
      const tol = Math.max(pxR, 10);
      if (d < tol) {
        const score = d / tol + D * 1e-12;
        if (score < bestScore) {
          bestScore = score;
          best = b;
        }
      }
    }
    return best;
  }

  onClick(e) {
    if (this.placing) return;
    const b = this.pick(e.clientX, e.clientY);
    this.select(b);
  }

  // ------------------------------------------------------------------ physics helpers
  updateTemperatures(dtSim) {
    const stars = this.lightSources();
    for (const b of this.sim.bodies) {
      if (b.isStar || b.kind === 'blackhole') continue;
      let t4 = 0;
      for (const s of stars) {
        const d = Math.hypot(b.pos[0] - s.pos[0], b.pos[1] - s.pos[1], b.pos[2] - s.pos[2]);
        const t = equilibriumTemperatureK(s.lum * 3.828e26, d, b.albedo);
        t4 += t ** 4;
      }
      const teq = Math.pow(t4, 0.25);
      // Impact heat decays: small bodies cool fast, planets retain magma oceans longer.
      if (b.heat > 0 && dtSim > 0) {
        const tau = Math.max(3 * DAY, 300 * YEAR * Math.sqrt(b.mass / 5.97e24));
        b.heat *= Math.exp(-dtSim / tau);
        if (b.heat < 1) b.heat = 0;
      }
      const base = teq + (b.greenhouse || 0) * Math.min(1, teq / 150);
      b.tempK = Math.pow(base ** 4 + (b.heat > 0 ? (base + b.heat) ** 4 - base ** 4 : 0), 0.25);
    }
    for (const b of this.sim.bodies) {
      if (b.kind === 'blackhole' && b.accretion > 0) b.accretion *= Math.exp(-Math.abs(dtSim) / (30 * DAY));
    }
  }

  // Auto exposure. A physical estimate (irradiance at the focus, like metering a sunlit
  // subject) bounds a GPU light-meter reading of the actual frame, which adapts to night
  // sides, crescents, eclipses and glare the way a camera or the eye would.
  computeExposure(dt) {
    let phys = 1;
    const f = this.camera.focus;
    const stars = this.lightSources();
    if (f && !f.isLuminous && stars.length) {
      let E = 0;
      for (const s of stars) {
        const d2 = (f.pos[0] - s.pos[0]) ** 2 + (f.pos[1] - s.pos[1]) ** 2 + (f.pos[2] - s.pos[2]) ** 2;
        E += (s.lum * AU * AU) / Math.max(d2, 1);
      }
      const alb = Math.max(f.geoAlbedo || 0.3, 0.05);
      phys = Math.min(Math.max(0.55 / Math.max(E * Math.pow(alb, 0.6), 1e-9), 0.02), 3e5);
    }
    let target = phys;
    if (this.autoExposure) {
      const m = MeterPass.evaluate(this.renderer.meter.result);
      if (m && m.mult) target = Math.min(Math.max(this.renderer.meter.result.exposure * m.mult, phys * 1e-6), phys * 5000);
    }
    target *= Math.pow(2, this.exposureEV);
    if (this.snapExposure > 0) {
      // After loads / jumps: converge immediately (the meter needs a couple of frames).
      this.snapExposure--;
      this.exposure = target;
      return;
    }
    const k = 1 - Math.exp(-dt * 2.5);
    this.exposure = Math.exp(Math.log(this.exposure) + (Math.log(target) - Math.log(this.exposure)) * k);
  }

  // Adaptive fidelity: tiny moons (< 1e-4 of their planet's mass) that would cover more than
  // ~1/4 orbit per second of real time are propagated analytically. Their gravitational
  // influence is negligible; this frees the integrator for everything else. Hysteresis
  // avoids flapping when the warp hovers near the threshold.
  updateRails() {
    const w = this.paused ? 0 : Math.abs(this.warp);
    const list = [];
    for (const b of this.sim.bodies) {
      const p = b.primary;
      if (!p || !b.orbit || b.massless || b.kind === 'debris' || !(b.orbit.e < 0.9)) continue;
      if (b.mass > 1e-4 * p.mass || p.massless) continue;
      const P = b.orbit.period;
      const railed = this.sim.railSet.has(b);
      if (w > (railed ? 2 : 4) * P) list.push(b);
    }
    this.sim.setRails(list);
  }

  setWarp(w) {
    this.warp = w;
    this.paused = false;
  }

  warpFaster(dir = 1) {
    const a = Math.abs(this.warp);
    const sign = this.warp < 0 ? -1 : 1;
    let idx = WARP_STEPS.findIndex((s) => s >= a * 0.999);
    if (idx < 0) idx = WARP_STEPS.length - 1;
    idx = Math.max(0, Math.min(WARP_STEPS.length - 1, idx + dir));
    this.setWarp(sign * WARP_STEPS[idx]);
  }

  // ------------------------------------------------------------------ main loop
  frame(now) {
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    const t0 = performance.now();

    // Physics (always on true, geometric positions)
    this.sim.apparent = false;
    let simDt = this.paused ? 0 : this.warp * dt;
    if (Math.abs(this.sim.time + simDt) > MAX_DATE_S) simDt = 0;
    const tBefore = this.sim.time;
    if (simDt !== 0) {
      this.sim.stats.steps = 0;
      this.sim.advance(simDt, this.budget);
      this.stepsPerFrame = this.sim.stats.steps;
    } else {
      this.sim.stats.achievedRate = 0;
      this.sim.stats.lagging = false;
    }
    const simStep = this.sim.time - tBefore;
    this.achievedWarp = dt > 0 ? simStep / dt : 0;

    this.railTimer = (this.railTimer || 0) - dt;
    if (this.railTimer <= 0) {
      this.updateRails();
      this.railTimer = 0.5;
    }

    this.hierarchyTimer -= dt;
    if (this.hierarchyTimer <= 0) {
      updateHierarchy(this.sim);
      this.hierarchyTimer = 0.2;
    } else {
      // Keep orbit elements fresh for orbit lines (cheap).
      for (const b of this.sim.bodies) if (b.primary && b.primary.sim && b.kind !== 'debris') b.orbit = relElements(b, b.primary);
    }
    this.tempTimer += Math.abs(simStep);
    if (this.tempTimer > 0 || this.paused) {
      this.updateTemperatures(this.tempTimer);
      this.tempTimer = 0;
    }
    const star = this.mainStar();
    this.renderer.comets.step(this.sim, star, this.sim.time);
    this.renderer.orbits.recordTrails(this.sim.bodies, this.sim.time);
    if (this.sim.stats.energy0 === null && this.sim.n > 0) this.sim.stats.energy0 = this.sim.totalEnergy();

    // Light-time correction: from here on (camera, rendering, labels, picking) bodies appear
    // where they were when their light left them.
    if (this.lightTime) {
      this.sim.computeApparent(this.camera.camPos);
      this.sim.apparent = true;
    }

    // Camera
    this.camera.bodyScale = this.renderer.settings.bodyScale;
    if (this.camera.focus && !this.camera.focus.sim) {
      this.camera.focusPoint = Array.from(this.camera.center || [0, 0, 0]);
      this.camera.focus = this.camera.replacement || null;
    }
    this.camera.update(dt);
    this.computeExposure(dt);

    const date = simTimeToDate(Math.max(-MAX_DATE_S, Math.min(MAX_DATE_S, this.sim.time)));
    const camDist = this.camera.distance;
    const near = Math.max(1e-4, Math.min(camDist - this.camera.minDistance() + 1e-4, camDist * 0.5) * 0.3);
    this.renderer.render({
      sim: this.sim,
      date,
      simTime: this.sim.time,
      camPos: this.camera.camPos,
      camQuat: this.camera.quat,
      fovY: this.camera.fovY,
      exposure: this.exposure,
      focusBody: this.camera.focus,
      selected: this.selected,
      camDist,
      near,
      effects: this.effects,
    });
    this.effects = this.effects.filter((e) => !e.done(this.sim.time));
    this.labels.update(this.sim.bodies, this.renderer.camera, this.camera.camPos, {
      pixelAngle: this.camera.fovY / (this.renderer.height * this.renderer.pixelRatio),
      pixelRatio: this.renderer.pixelRatio,
      bodyScale: this.renderer.settings.bodyScale,
      selected: this.selected,
      focus: this.camera.focus,
    });
    this.ui.update(dt, date);
    this.frameMs = this.frameMs * 0.9 + (performance.now() - t0) * 0.1;
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------------ callbacks from physics
  onEvent(ev) {
    this.ui?.onPhysicsEvent(ev);
  }

  onBodyRemoved(body, replacement) {
    if (this.selected === body) this.select(replacement && replacement.sim ? replacement : null);
    if (this.camera.focus === body) {
      this.camera.replacement = replacement && replacement.sim ? replacement : null;
      if (this.camera.replacement) this.camera.setFocus(this.camera.replacement, true);
    }
    this.renderer.rebuildBody(body);
  }

  onBodyChanged(body) {
    this.renderer.rebuildBody(body);
    if (this.selected === body) this.ui?.inspect(body);
  }

  // ------------------------------------------------------------------ persistence
  serialize() {
    this.sim.sync();
    return {
      format: 'solar-system-sandbox',
      version: 1,
      time: this.sim.time,
      warp: this.warp,
      scenario: this.scenarioId,
      settings: { relativity: this.sim.relativity, collisions: this.sim.collisions, tidal: this.sim.tidalDisruption, eta: this.sim.eta },
      camera: { focus: this.camera.focus?.id ?? null, distance: this.camera.distance, azimuth: this.camera.azimuth, elevation: this.camera.elevation },
      bodies: this.sim.bodies.filter((b) => b.kind !== 'debris' || this.sim.bodies.length < 600).map((b) => b.toJSON()),
    };
  }

  async deserialize(data) {
    const { Body } = await import('./sim/body.js');
    if (!data || data.format !== 'solar-system-sandbox') throw new Error('Not a Solar System Sandbox file');
    this.sim.clear();
    this.sim.dir = 1;
    this.sim.time = data.time;
    this.sim.tauBase = data.time;
    if (data.settings) {
      this.sim.relativity = !!data.settings.relativity;
      this.sim.collisions = !!data.settings.collisions;
      this.sim.tidalDisruption = !!data.settings.tidal;
      if (data.settings.eta) this.sim.eta = data.settings.eta;
    }
    this.renderer.orbits.clearTrails();
    this.renderer.comets.clear();
    this.labels.clear();
    const items = data.bodies.map((s) => ({ body: new Body(s), pos: s.pos, vel: s.vel }));
    this.sim.addMany(items);
    this.scenarioId = data.scenario;
    this.afterLoad({ focus: data.camera?.focus, warp: data.warp, distance: data.camera?.distance, elevation: data.camera?.elevation, belts: true });
    if (data.camera?.azimuth !== undefined) this.camera.azimuth = this.camera.target.azimuth = data.camera.azimuth;
  }
}

const app = new App();
window.sandbox = app; // handy for the console
app.start();

export { App, WARP_STEPS, circularVelocity, renderToEcl, J2000_MS };

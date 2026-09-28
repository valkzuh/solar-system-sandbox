// User interface: panels, inspector, time controls, body creation, persistence.

import * as THREE from 'three';
import { SCENARIOS } from '../data/scenarios.js';
import { TEMPLATES, TEMPLATE_BY_ID, starSpec } from '../data/templates.js';
import { KIND_LABEL } from '../data/catalog.js';
import { Body } from '../sim/body.js';
import { circularVelocity, relElements } from '../sim/hierarchy.js';
import { supernova } from '../sim/events.js';
import { sampleOrbit, stateToElements } from '../core/kepler.js';
import { eclToRender, renderToEcl, cross, norm, hashString } from '../core/vec.js';
import { G, AU, DAY, HOUR, MSUN, RSUN, YEAR, C_KMS, dateToSimTime, simTimeToDate, LIGHT_YEAR } from '../core/constants.js';
import { spectralClass, schwarzschildRadiusKm, habitableZoneAU } from '../core/stellar.js';
import { fmtDistance, fmtMass, fmtRadius, fmtDuration, fmtRate, fmtSpeed, fmtTemp, fmtAngle, fmtDate, sig } from './format.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(app) {
    this.app = app;
    this.inspectTimer = 0;
    this.diagTimer = 0;
    this.activeTab = null;
    this.template = null;
    this.createFactor = 1;
    this.drag = null;
    this._buildTabs();
    this._buildScenarios();
    this._buildCreate();
    this._buildView();
    this._buildPhysics();
    this._buildSave();
    this._buildInspector();
    this._buildTimebar();
    this._buildSearch();
    this._buildKeyboard();
    this._buildPlacementPreview();
    $('helpBtn').onclick = () => $('help').classList.toggle('hidden');
    $('helpClose').onclick = () => $('help').classList.add('hidden');
    $('help').onclick = (e) => {
      if (e.target === $('help')) $('help').classList.add('hidden');
    };
  }

  refreshAll() {
    this._syncScenarioCards();
    this.inspect(this.app.selected);
  }

  // ------------------------------------------------------------------ tabs / drawer
  _buildTabs() {
    const titles = { scenarios: 'Scenarios', create: 'Create', view: 'View', physics: 'Physics', save: 'Save & load' };
    this.titles = titles;
    document.querySelectorAll('#tabs button[data-tab]').forEach((btn) => {
      btn.onclick = () => this.openTab(this.activeTab === btn.dataset.tab ? null : btn.dataset.tab);
    });
    $('drawerClose').onclick = () => this.openTab(null);
  }

  openTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('drawer').classList.toggle('hidden', !tab);
    document.body.classList.toggle('drawer-open', !!tab);
    if (!tab) {
      if (this.app.placing) this.cancelPlacing();
      return;
    }
    $('drawerTitle').textContent = this.titles[tab];
    document.querySelectorAll('section[data-pane]').forEach((s) => s.classList.toggle('active', s.dataset.pane === tab));
    if (tab === 'save') this._refreshServerList();
    if (tab !== 'create' && this.app.placing) this.cancelPlacing();
  }

  // ------------------------------------------------------------------ scenarios
  _buildScenarios() {
    const list = $('scenarioList');
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    $('scenarioDate').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    for (const sc of SCENARIOS) {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.id = sc.id;
      card.innerHTML = `<h4>${sc.name}</h4><p>${sc.desc}</p>`;
      card.onclick = () => {
        const v = $('scenarioDate').value;
        const date = v ? new Date(v) : new Date();
        this.app.loadScenario(sc.id, isNaN(date.getTime()) ? new Date() : date);
      };
      list.appendChild(card);
    }
  }

  _syncScenarioCards() {
    document.querySelectorAll('#scenarioList .card').forEach((c) => c.classList.toggle('active', c.dataset.id === this.app.scenarioId));
  }

  // ------------------------------------------------------------------ create
  _buildCreate() {
    const list = $('templateList');
    let group = null;
    for (const t of TEMPLATES) {
      if (t.group !== group) {
        group = t.group;
        const g = document.createElement('div');
        g.className = 'tgroup';
        g.textContent = group;
        list.appendChild(g);
      }
      const el = document.createElement('div');
      el.className = 'tpl';
      el.dataset.id = t.id;
      el.title = t.desc;
      el.innerHTML = `<span class="ic">${t.icon}</span><span>${t.name}</span>`;
      el.onclick = () => this.startPlacing(t.id);
      list.appendChild(el);
    }
    const massSlider = $('createMass');
    massSlider.value = 500;
    massSlider.oninput = () => {
      this.createFactor = Math.pow(10, (massSlider.value - 500) / 250);
      this._updateCreateMass();
    };
    $('cancelPlace').onclick = () => this.cancelPlacing();
    this._updateCreateMass();
  }

  _templateSpec(id, seed = 1) {
    const t = TEMPLATE_BY_ID[id];
    const base = t.make(seed);
    const f = this.createFactor;
    if (f !== 1) {
      const m = base.mass * f;
      if (base.kind === 'star' && !base.fixedStar) Object.assign(base, starSpec(m / MSUN));
      else if (base.kind === 'blackhole') {
        base.mass = m;
        base.radius = schwarzschildRadiusKm(m);
      } else {
        base.mass = m;
        if (base.kind !== 'neutron' && base.kind !== 'whitedwarf') {
          // Keep density: radius scales as mass^(1/3) (roughly right for rocky bodies).
          const k = Math.cbrt(f);
          base.radius *= k;
          if (base.shape) base.shape = base.shape.map((x) => x * k);
          if (base.rings) {
            base.rings.inner *= k;
            base.rings.outer *= k;
          }
        }
      }
    }
    return base;
  }

  _updateCreateMass() {
    const id = this.template || 'terran';
    const spec = this._templateSpec(id);
    $('createMassVal').textContent = fmtMass(spec.mass);
  }

  startPlacing(id) {
    this.template = id;
    this.app.placing = id;
    document.body.classList.add('placing');
    document.querySelectorAll('.tpl').forEach((e) => e.classList.toggle('active', e.dataset.id === id));
    this._updateCreateMass();
    this.toast(`Click in the scene to place a <b>${TEMPLATE_BY_ID[id].name}</b>. Drag to give it velocity.`, 'info', 4000);
  }

  cancelPlacing() {
    this.app.placing = null;
    this.drag = null;
    document.body.classList.remove('placing');
    document.querySelectorAll('.tpl').forEach((e) => e.classList.remove('active'));
    this.preview.group.visible = false;
    $('placeHint').classList.add('hidden');
  }

  _buildPlacementPreview() {
    const g = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: 0x46d7c6, transparent: true, opacity: 0.85, depthTest: false });
    const orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(512 * 3), 3));
    const orbit = new THREE.Line(orbitGeo, lineMat);
    orbit.frustumCulled = false;
    const arrowGeo = new THREE.BufferGeometry();
    arrowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const arrow = new THREE.Line(arrowGeo, new THREE.LineBasicMaterial({ color: 0xf7b059, depthTest: false }));
    arrow.frustumCulled = false;
    const ghost = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color: 0x46d7c6, wireframe: true, transparent: true, opacity: 0.6, depthTest: false }));
    ghost.frustumCulled = false;
    g.add(orbit, arrow, ghost);
    g.visible = false;
    g.renderOrder = 10;
    this.app.renderer.overlay.add(g);
    this.preview = { group: g, orbit, arrow, ghost };
    this.app.canvas.addEventListener('pointerdown', (e) => {
      if (!this.app.placing || e.button !== 0) return;
      const P = this._planePoint(e.clientX, e.clientY);
      if (P) this.drag = { start: P, cur: P, x: e.clientX, y: e.clientY };
    });
  }

  // Reference plane for placement.
  _plane() {
    const app = this.app;
    const focus = app.camera.focus;
    const origin = focus && focus.sim ? Array.from(focus.pos) : app.camera.center || [0, 0, 0];
    let normal = [0, 0, 1];
    const mode = $('createPlane').value;
    if (mode === 'primary' && focus && focus.orbit && focus.orbit.hVec) normal = norm(focus.orbit.hVec);
    if (mode === 'primary' && focus && focus.isStar) normal = [0, 0, 1];
    if (mode === 'view') {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(app.camera.quat);
      normal = renderToEcl([fwd.x, fwd.y, fwd.z]);
    }
    return { origin, normal };
  }

  _rayDir(clientX, clientY) {
    const cam = this.app.renderer.camera;
    const v = new THREE.Vector3((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1, 0.5).unproject(cam);
    v.normalize();
    return renderToEcl([v.x, v.y, v.z]);
  }

  _planePoint(clientX, clientY) {
    const { origin, normal } = this._plane();
    const d = this._rayDir(clientX, clientY);
    const c = this.app.camera.camPos;
    const denom = d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2];
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((origin[0] - c[0]) * normal[0] + (origin[1] - c[1]) * normal[1] + (origin[2] - c[2]) * normal[2]) / denom;
    if (t <= 0) return null;
    return [c[0] + d[0] * t, c[1] + d[1] * t, c[2] + d[2] * t];
  }

  // Dominant attractor at a point: smallest Hill sphere containing it, else strongest pull.
  _dominantAt(P, mass) {
    let best = null, bestHill = Infinity, strongest = null, sAcc = 0;
    for (const b of this.app.sim.bodies) {
      if (b.massless || b.mass <= mass || b.kind === 'debris') continue;
      const r = Math.hypot(P[0] - b.pos[0], P[1] - b.pos[1], P[2] - b.pos[2]);
      const acc = b.mass / (r * r);
      if (acc > sAcc) {
        sAcc = acc;
        strongest = b;
      }
      if (b.orbit && b.primary && b.orbit.e < 1) {
        const h = b.orbit.a * (1 - b.orbit.e) * Math.cbrt(b.mass / (3 * b.primary.mass));
        if (r < h * 0.8 && h < bestHill) {
          best = b;
          bestHill = h;
        }
      }
    }
    return best || strongest;
  }

  _placementState(P, dragVec) {
    const spec = this._templateSpec(this.template, 1);
    const prim = this._dominantAt(P, spec.mass);
    const { normal } = this._plane();
    let vel = [0, 0, 0];
    const mode = $('createOrbit').value;
    if (prim) {
      if (mode === 'rest') vel = [...prim.vel];
      else {
        const n = mode === 'retro' ? normal.map((x) => -x) : normal;
        vel = circularVelocity(prim, P, spec.massless ? 0 : spec.mass, n);
      }
      if (dragVec) {
        const r = Math.hypot(P[0] - prim.pos[0], P[1] - prim.pos[1], P[2] - prim.pos[2]);
        const vc = Math.sqrt((G * prim.mass) / r);
        const k = (1.5 * vc) / r;
        vel = [vel[0] + dragVec[0] * k, vel[1] + dragVec[1] * k, vel[2] + dragVec[2] * k];
      }
    }
    return { spec, prim, vel };
  }

  placementCapture(e, phase) {
    if (!this.app.placing) return false;
    if (phase === 'move' && this.drag) {
      const P = this._planePoint(e.clientX, e.clientY);
      if (P) this.drag.cur = P;
      this._updatePreview(this.drag.start, [this.drag.cur[0] - this.drag.start[0], this.drag.cur[1] - this.drag.start[1], this.drag.cur[2] - this.drag.start[2]], e);
      return true;
    }
    if (phase === 'up' && this.drag) {
      const dv = [this.drag.cur[0] - this.drag.start[0], this.drag.cur[1] - this.drag.start[1], this.drag.cur[2] - this.drag.start[2]];
      const moved = Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 6;
      this._place(this.drag.start, moved ? dv : null);
      this.drag = null;
      return true;
    }
    return false;
  }

  onHover(e) {
    if (!this.app.placing || this.drag) return;
    const P = this._planePoint(e.clientX, e.clientY);
    if (P) this._updatePreview(P, null, e);
  }

  _updatePreview(P, dragVec, e) {
    const app = this.app;
    const { spec, prim, vel } = this._placementState(P, dragVec);
    const cam = app.camera.camPos;
    const pv = this.preview;
    pv.group.visible = true;
    const rp = eclToRender([P[0] - cam[0], P[1] - cam[1], P[2] - cam[2]]);
    const D = Math.hypot(...rp);
    const pxAngle = app.camera.fovY / window.innerHeight;
    const r = Math.max(spec.radius * app.renderer.settings.bodyScale, D * pxAngle * 6);
    pv.ghost.position.set(rp[0], rp[1], rp[2]);
    pv.ghost.scale.setScalar(r);
    // Velocity arrow (1 hour of motion relative to primary, scaled for visibility).
    const rel = prim ? [vel[0] - prim.vel[0], vel[1] - prim.vel[1], vel[2] - prim.vel[2]] : vel;
    const vl = Math.hypot(...rel) || 1;
    const len = D * 0.15;
    const tip = eclToRender([P[0] - cam[0] + (rel[0] / vl) * len, P[1] - cam[1] + (rel[1] / vl) * len, P[2] - cam[2] + (rel[2] / vl) * len]);
    const ap = pv.arrow.geometry.attributes.position;
    ap.setXYZ(0, rp[0], rp[1], rp[2]);
    ap.setXYZ(1, tip[0], tip[1], tip[2]);
    ap.needsUpdate = true;
    // Predicted conic.
    let hint = '';
    if (prim) {
      const mu = G * (prim.mass + (spec.massless ? 0 : spec.mass));
      const rr = [P[0] - prim.pos[0], P[1] - prim.pos[1], P[2] - prim.pos[2]];
      const el = stateToElements(mu, rr, rel);
      el.mu = mu;
      const { pts } = sampleOrbit(el, 512, el.e >= 1 ? Math.hypot(...rr) * 5 : Infinity);
      const op = pv.orbit.geometry.attributes.position;
      for (let k = 0; k < 512; k++) {
        const q = eclToRender([prim.pos[0] + pts[k * 3] - cam[0], prim.pos[1] + pts[k * 3 + 1] - cam[1], prim.pos[2] + pts[k * 3 + 2] - cam[2]]);
        op.setXYZ(k, q[0], q[1], q[2]);
      }
      op.needsUpdate = true;
      pv.orbit.visible = true;
      hint = `${TEMPLATE_BY_ID[this.template].name} · ${fmtMass(spec.mass)}<br>around ${prim.name} at ${fmtDistance(Math.hypot(...rr))}<br>v = ${fmtSpeed(vl)} · ${el.e < 1 ? `e = ${el.e.toFixed(3)}, P = ${fmtDuration(el.period)}` : `escape (e = ${el.e.toFixed(2)})`}`;
    }
    const h = $('placeHint');
    h.classList.remove('hidden');
    h.innerHTML = hint;
    h.style.left = `${e.clientX}px`;
    h.style.top = `${e.clientY}px`;
  }

  _place(P, dragVec) {
    const app = this.app;
    const seed = Math.floor(Math.random() * 1e6);
    const { prim, vel } = this._placementState(P, dragVec);
    const spec = this._templateSpec(this.template, seed);
    const t = TEMPLATE_BY_ID[this.template];
    const count = app.sim.bodies.filter((b) => b.template === t.id).length + 1;
    const body = new Body({
      ...spec,
      id: `${t.id}-${seed}`,
      name: `${t.name} ${count}`,
      template: t.id,
      userCreated: true,
      parent: prim?.id,
      pole: spec.pole || [0, 0, 1],
      rotation: spec.rotation || { periodH: 10 + (seed % 30), W0: 0 },
      info: t.desc,
    });
    if (body.rotation.poleRA === undefined) {
      // Spin axis roughly aligned with the orbit normal, with a random tilt.
      const tilt = (Math.random() * 30 * Math.PI) / 180;
      body.pole = norm([Math.sin(tilt) * Math.cos(seed), Math.sin(tilt) * Math.sin(seed), Math.cos(tilt)]);
    }
    app.sim.add(body, P, vel);
    app.select(body);
    this.toast(`Created <b>${body.name}</b> (${fmtMass(body.mass)})${prim ? ` orbiting ${prim.name}` : ''}.`, 'info', 3000);
    this.preview.group.visible = false;
    $('placeHint').classList.add('hidden');
  }

  // ------------------------------------------------------------------ view settings
  _buildView() {
    const app = this.app;
    const r = app.renderer;
    const bind = (id, fn) => ($(id).onchange = (e) => fn(e.target.checked, e));
    bind('optOrbits', (v) => (r.orbits.visible = v));
    bind('optLabels', (v) => (app.labels.visible = v));
    bind('optMarkers', (v) => (app.labels.markers = v));
    bind('optTrails', (v) => {
      r.orbits.trailsVisible = v;
      if (!v) r.orbits.clearTrails();
    });
    bind('optBelts', (v) => (r.belts.visible = v));
    bind('optComets', (v) => (r.comets.visible = v));
    bind('optConstellations', (v) => (r.sky.showConstellations = v));
    bind('optZones', (v) => (r.zones.enabled = v));
    bind('optAtmos', (v) => {
      r.settings.atmospheres = v;
      r.invalidateVisuals();
    });
    bind('optAutoExp', (v) => (app.autoExposure = v));
    bind('optSpikes', (v) => (r.settings.spikes = v));
    bind('optAutoRotate', (v) => (app.camera.autoRotate = v ? 0.05 : 0));
    const range = (id, fn, fmt) => {
      const el = $(id);
      const upd = () => {
        const v = parseFloat(el.value);
        fn(v);
        if (fmt) $(`${id}Val`).textContent = fmt(v);
      };
      el.oninput = upd;
      upd();
    };
    range('optScale', (v) => (r.settings.bodyScale = Math.pow(10, v)), (v) => `${sig(Math.pow(10, v), 3)}×`);
    range('optExposure', (v) => (app.exposureEV = v), (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`);
    range('optFov', (v) => (app.camera.targetFov = (v * Math.PI) / 180), (v) => `${v}°`);
    range('optStars', (v) => (r.sky.starGain = v));
    range('optMilkyWay', (v) => (r.sky.milkyWayIntensity = v));
    range('optBeltInt', (v) => (r.belts.intensity = v));
    range('optBloom', (v) => {
      r.settings.bloomStrength = v;
      r.settings.bloom = v > 0.01;
    });
    $('optQuality').onchange = (e) => r.setQuality(e.target.value);
    app.camera.on('fov', (f) => {
      $('optFov').value = Math.round((f * 180) / Math.PI);
      $('optFovVal').textContent = `${sig((f * 180) / Math.PI, 3)}°`;
    });
  }

  // ------------------------------------------------------------------ physics settings
  _buildPhysics() {
    const sim = this.app.sim;
    $('optAccuracy').onchange = (e) => {
      sim.eta = parseFloat(e.target.value);
      sim.touch();
    };
    $('optGR').onchange = (e) => {
      sim.relativity = e.target.checked;
      sim.touch();
    };
    $('optCollisions').onchange = (e) => {
      sim.collisions = e.target.checked;
      sim.touch();
    };
    $('optRoche').onchange = (e) => {
      sim.tidalDisruption = e.target.checked;
      sim.touch();
    };
    const b = $('optBudget');
    b.oninput = () => {
      this.app.budget = parseFloat(b.value);
      $('optBudgetVal').textContent = `${b.value} ms`;
    };
    $('resetEnergy').onclick = () => (sim.stats.energy0 = sim.totalEnergy());
    $('recenter').onclick = () => sim.recenter();
  }

  // ------------------------------------------------------------------ save / load
  _buildSave() {
    const app = this.app;
    $('quickSave').onclick = () => {
      try {
        localStorage.setItem('sss-quicksave', JSON.stringify(app.serialize()));
        this.toast('Saved to this browser.', 'info');
      } catch (e) {
        this.toast(`Save failed: ${e.message}`);
      }
    };
    $('quickLoad').onclick = async () => {
      try {
        const s = localStorage.getItem('sss-quicksave');
        if (!s) return this.toast('No quick save found.');
        await app.deserialize(JSON.parse(s));
        this.toast('Loaded quick save.', 'info');
      } catch (e) {
        this.toast(`Load failed: ${e.message}`);
      }
    };
    $('exportBtn').onclick = () => {
      const blob = new Blob([JSON.stringify(app.serialize(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `solar-system-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('importFile').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        await app.deserialize(JSON.parse(await f.text()));
        this.toast(`Loaded ${f.name}.`, 'info');
      } catch (err) {
        this.toast(`Import failed: ${err.message}`);
      }
      e.target.value = '';
    };
    $('serverSave').onclick = async () => {
      const name = $('serverName').value.trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/.test(name)) return this.toast('Use letters, digits, space, - or _ (max 64).');
      try {
        const r = await fetch(`api/scenarios/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(app.serialize()) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        this.toast(`Saved “${name}” on the server.`, 'info');
        this._refreshServerList();
      } catch (e) {
        this.toast(`Server save failed: ${e.message}`);
      }
    };
  }

  async _refreshServerList() {
    const box = $('serverList');
    try {
      const r = await fetch('api/scenarios');
      if (!r.ok) throw new Error();
      const list = await r.json();
      $('serverGroup').classList.remove('hidden');
      box.innerHTML = list.length ? '' : '<p class="hint">No saved scenarios yet.</p>';
      for (const s of list) {
        const row = document.createElement('div');
        const name = document.createElement('span');
        name.textContent = s.name;
        name.onclick = async () => {
          try {
            const d = await (await fetch(`api/scenarios/${encodeURIComponent(s.name)}`)).json();
            await this.app.deserialize(d);
            this.toast(`Loaded “${s.name}”.`, 'info');
          } catch (e) {
            this.toast(`Load failed: ${e.message}`);
          }
        };
        const del = document.createElement('button');
        del.className = 'icon';
        del.textContent = '🗑';
        del.title = 'Delete';
        del.onclick = async () => {
          await fetch(`api/scenarios/${encodeURIComponent(s.name)}`, { method: 'DELETE' });
          this._refreshServerList();
        };
        row.append(name, del);
        box.appendChild(row);
      }
    } catch {
      $('serverGroup').classList.add('hidden');
    }
  }

  // ------------------------------------------------------------------ inspector
  _buildInspector() {
    const app = this.app;
    $('insClose').onclick = () => app.select(null);
    $('insFocus').onclick = () => app.flyTo(app.selected);
    $('insFollow').onclick = () => app.selected && app.camera.setFocus(app.selected, true);
    $('insDelete').onclick = () => this.deleteSelected();
    $('insName').onchange = (e) => {
      if (app.selected) app.selected.name = e.target.value || app.selected.name;
    };
    $('insShowOrbit').onchange = (e) => app.selected && (app.selected.showOrbit = e.target.checked);
    $('insOrbitLock').onchange = (e) => {
      if (!app.selected) return;
      if (e.target.checked && app.camera.focus !== app.selected) app.flyTo(app.selected);
      app.camera.orbitLock = e.target.checked;
    };
    $('insShowLabel').onchange = (e) => app.selected && (app.selected.showLabel = e.target.checked);
    $('insMass').oninput = (e) => {
      const b = app.selected;
      if (!b) return;
      const m = this.baseMass * Math.pow(10, parseFloat(e.target.value));
      b.mass = m;
      if (b.kind === 'star' || b.kind === 'blackhole' || b.kind === 'whitedwarf') b.updateStellarFromMass();
      app.sim.touch();
      app.renderer.rebuildBody(b);
      $('insMassVal').textContent = fmtMass(m);
    };
    $('insRadius').oninput = (e) => {
      const b = app.selected;
      if (!b) return;
      const f = Math.pow(10, parseFloat(e.target.value));
      const r = this.baseRadius * f;
      const k = r / b.radius;
      b.radius = r;
      if (b.shape) b.shape = b.shape.map((x) => x * k);
      if (b.rings) {
        b.rings.inner *= k;
        b.rings.outer *= k;
      }
      if (b.j2Radius) b.j2Radius *= k;
      app.sim.touch();
      $('insRadiusVal').textContent = fmtRadius(r);
    };
    const dv = (fn) => () => {
      const b = app.selected;
      if (!b || !b.primary) return;
      const p = b.primary;
      const rel = [b.vel[0] - p.vel[0], b.vel[1] - p.vel[1], b.vel[2] - p.vel[2]];
      const nv = fn(rel, b, p);
      app.sim.setState(b, Array.from(b.pos), [p.vel[0] + nv[0], p.vel[1] + nv[1], p.vel[2] + nv[2]]);
    };
    $('insBoost').onclick = dv((v) => v.map((x) => x * 1.1));
    $('insBrake').onclick = dv((v) => v.map((x) => x * 0.9));
    $('insStop').onclick = dv(() => [0, 0, 0]);
    $('insReverse').onclick = dv((v) => v.map((x) => -x));
    $('insCircularize').onclick = dv((v, b, p) => {
      const r = [b.pos[0] - p.pos[0], b.pos[1] - p.pos[1], b.pos[2] - p.pos[2]];
      let n = norm(cross(r, v));
      if (!isFinite(n[0])) n = [0, 0, 1];
      const c = circularVelocity(p, b.pos, b.massless ? 0 : b.mass, n);
      return [c[0] - p.vel[0], c[1] - p.vel[1], c[2] - p.vel[2]];
    });
    $('insCollapse').onclick = () => {
      const b = app.selected;
      if (!b) return;
      b.kind = 'blackhole';
      b.star = null;
      b.appearance = null;
      b.atmosphere = null;
      b.rings = null;
      b.shape = null;
      b.j2 = 0;
      b.massless = false;
      b.updateStellarFromMass();
      app.sim.touch();
      app.renderer.rebuildBody(b);
      this.toast(`<b>${b.name}</b> collapsed into a black hole with event horizon radius ${fmtRadius(b.radius)}.`);
      this.inspect(b);
    };
    $('insIgnite').onclick = () => {
      const b = app.selected;
      if (!b) return;
      const spec = starSpec(b.mass / MSUN);
      b.kind = 'star';
      Object.assign(b, { radius: spec.radius, star: spec.star, appearance: null, atmosphere: null, rings: null, shape: null, j2: 0, massless: false });
      app.sim.touch();
      app.renderer.rebuildBody(b);
      const note = b.mass < 0.075 * MSUN ? ' (below the hydrogen-burning limit of 0.075 M☉ — really a brown dwarf)' : '';
      this.toast(`<b>${b.name}</b> is now a ${spectralClass(b.star.temperature)} star${note}.`);
      this.inspect(b);
    };
    $('insSupernova').onclick = () => {
      const b = app.selected;
      if (!b) return;
      if (b.kind !== 'star' || b.mass < 8 * MSUN) {
        this.toast('Core-collapse supernovae need a star of at least 8 M☉. Try raising its mass first.');
        return;
      }
      supernova(app.sim, b, app);
      this.inspect(b);
    };
  }

  deleteSelected() {
    const b = this.app.selected;
    if (!b) return;
    this.app.sim.remove(b);
    this.app.onBodyRemoved(b, null);
    this.app.select(null);
    this.toast(`Deleted <b>${b.name}</b>.`, 'info', 2000);
  }

  inspect(b) {
    const app = this.app;
    const panel = $('inspector');
    if (!b || !b.sim) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    this.baseMass = b.mass;
    this.baseRadius = b.radius;
    $('insMass').value = 0;
    $('insRadius').value = 0;
    $('insMassVal').textContent = fmtMass(b.mass);
    $('insRadiusVal').textContent = fmtRadius(b.radius);
    $('insRadiusRow').classList.toggle('hidden', b.kind === 'blackhole' || b.kind === 'star');
    $('insName').value = b.name;
    $('insInfo').textContent = b.info || '';
    $('insShowOrbit').checked = b.showOrbit;
    $('insOrbitLock').checked = app.camera.orbitLock && app.camera.focus === b;
    $('insShowLabel').checked = b.showLabel;
    $('insSupernova').classList.toggle('hidden', b.kind !== 'star');
    $('insIgnite').classList.toggle('hidden', b.kind === 'star');
    $('insCollapse').classList.toggle('hidden', b.kind === 'blackhole');
    this._updateInspector(b);
  }

  _updateInspector(b) {
    if (!b || !b.sim) return;
    const kind = KIND_LABEL[b.kind] || b.kind;
    const extra = b.star ? ` · ${spectralClass(b.star.temperature)}` : '';
    $('insKind').textContent = `${kind}${extra}${b.userCreated ? ' · user-created' : ''}`;
    const rows = [];
    const add = (k, v) => rows.push(`<div class="metric"><span>${k}</span><span>${v}</span></div>`);
    add('Mass', fmtMass(b.mass));
    if (b.kind === 'blackhole') {
      add('Event horizon (r<sub>s</sub>)', fmtRadius(b.radius));
      add('Photon sphere', fmtRadius(1.5 * b.radius));
      add('Shadow radius', fmtRadius(2.598 * b.radius));
      add('ISCO', fmtRadius(3 * b.radius));
    } else {
      add('Radius', fmtRadius(b.radius));
      add('Density', `${sig(b.density, 3)} g/cm³`);
      add('Surface gravity', `${sig(b.surfaceGravity(), 3)} m/s² (${sig(b.surfaceGravity() / 9.80665, 3)} g)`);
      add('Escape velocity', fmtSpeed(b.escapeVelocity()));
    }
    if (b.star) {
      add('Luminosity', `${sig(b.star.luminosity, 3)} L☉`);
      add('Surface temperature', `${Math.round(b.star.temperature).toLocaleString('en-US')} K`);
      if (b.star.luminosity > 1e-5) {
        const hz = habitableZoneAU(b.star.luminosity, b.star.temperature);
        add('Habitable zone', `${sig(hz[0], 3)} – ${sig(hz[1], 3)} AU`);
      }
    } else if (b.kind !== 'blackhole') {
      add('Temperature', fmtTemp(b.tempK));
      if (b.heat > 5) add('Impact heating', `+${Math.round(b.heat)} K`);
      add('Albedo (Bond)', sig(b.albedo, 2));
    }
    const rot = b.rotation || {};
    if (rot.locked) add('Rotation', 'tidally locked');
    else if (rot.periodH) add('Rotation period', fmtDuration(rot.periodH * HOUR));
    $('insPhysical').innerHTML = rows.join('');

    const o = [];
    const addo = (k, v) => o.push(`<div class="metric"><span>${k}</span><span>${v}</span></div>`);
    const el = b.orbit;
    $('insPrimary').textContent = b.primary ? `around ${b.primary.name}` : '';
    if (el && b.primary) {
      addo('Distance', fmtDistance(el.r));
      addo('Relative speed', fmtSpeed(el.speed));
      if (el.e < 1) {
        addo('Semi-major axis', fmtDistance(el.a));
        addo('Period', fmtDuration(el.period));
        addo('Periapsis / apoapsis', `${fmtDistance(el.periapsis)} / ${fmtDistance(el.apoapsis)}`);
      } else {
        addo('Trajectory', 'unbound (escaping)');
        addo('Periapsis', fmtDistance(el.periapsis));
        addo('Excess speed v∞', fmtSpeed(Math.sqrt(Math.max(0, 2 * el.energy))));
      }
      addo('Eccentricity', sig(el.e, 4));
      addo('Inclination (ecliptic)', fmtAngle(el.i));
      if (b.primary.mass > 0 && el.e < 1) {
        const hill = el.a * (1 - el.e) * Math.cbrt(b.mass / (3 * b.primary.mass));
        if (!b.massless && b.kind !== 'star') addo('Hill sphere', fmtDistance(hill));
      }
    } else {
      addo('Orbit', 'free-floating');
    }
    const cam = this.app.camera.camPos;
    const dc = Math.hypot(b.pos[0] - cam[0], b.pos[1] - cam[1], b.pos[2] - cam[2]);
    addo('Distance from camera', fmtDistance(dc));
    addo('Light travel time', fmtDuration(dc / C_KMS));
    $('insOrbit').innerHTML = o.join('');
  }

  // ------------------------------------------------------------------ time bar
  _buildTimebar() {
    const app = this.app;
    $('tPause').onclick = () => {
      app.paused = !app.paused;
    };
    $('tFaster').onclick = () => app.warpFaster(app.warp < 0 ? -1 : 1);
    $('tSlower').onclick = () => app.warpFaster(app.warp < 0 ? 1 : -1);
    $('tReverse').onclick = () => {
      app.warp = -app.warp;
      app.paused = false;
    };
    $('tNow').onclick = () => app.setWarp(1);
  }

  update(dt, date) {
    const app = this.app;
    const { date: ds, time: ts } = fmtDate(date);
    $('dateText').textContent = ds;
    $('timeText').textContent = ts;
    $('warpText').textContent = app.paused ? 'paused' : fmtRate(app.warp);
    const lag = !app.paused && app.sim.stats.lagging && Math.abs(app.achievedWarp) < 0.9 * Math.abs(app.warp);
    const rt = $('rateText');
    rt.textContent = app.paused ? '' : lag ? `actual ${fmtRate(app.achievedWarp)} (CPU-limited)` : '';
    rt.classList.toggle('lag', lag);
    $('tPause').textContent = app.paused ? '▶' : '⏸';
    $('tReverse').classList.toggle('active', app.warp < 0);

    this.inspectTimer -= dt;
    if (this.inspectTimer <= 0) {
      this.inspectTimer = 0.25;
      if (app.selected && !app.selected.sim) app.select(null);
      if (app.selected) this._updateInspector(app.selected);
    }
    this.diagTimer -= dt;
    if (this.diagTimer <= 0 && this.activeTab === 'physics') {
      this.diagTimer = 0.5;
      const n = app.sim.n;
      const nd = app.sim.bodies.filter((b) => b.kind === 'debris').length;
      $('diagBodies').textContent = `${n}${nd ? ` (${nd} debris)` : ''}`;
      $('diagSteps').textContent = app.stepsPerFrame.toLocaleString('en-US');
      const e0 = app.sim.stats.energy0;
      if (e0) $('diagEnergy').textContent = sig((app.sim.totalEnergy() - e0) / Math.abs(e0), 2);
      $('diagFrame').textContent = `${app.frameMs.toFixed(1)} ms`;
    }
  }

  // ------------------------------------------------------------------ search
  _buildSearch() {
    const input = $('search');
    const box = $('searchResults');
    let results = [];
    let active = 0;
    const render = () => {
      box.innerHTML = '';
      results.forEach((b, i) => {
        const d = document.createElement('div');
        d.className = i === active ? 'active' : '';
        d.innerHTML = `${b.name}<span>${KIND_LABEL[b.kind] || b.kind}</span>`;
        d.onmousedown = (e) => {
          e.preventDefault();
          this.app.flyTo(b);
          input.value = '';
          box.classList.add('hidden');
          input.blur();
        };
        box.appendChild(d);
      });
      box.classList.toggle('hidden', results.length === 0);
    };
    input.oninput = () => {
      const q = input.value.trim().toLowerCase();
      active = 0;
      results = q ? this.app.sim.bodies.filter((b) => b.kind !== 'debris' && b.name.toLowerCase().includes(q)).sort((a, b) => a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q)).slice(0, 12) : [];
      render();
    };
    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') {
        active = Math.min(results.length - 1, active + 1);
        render();
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        active = Math.max(0, active - 1);
        render();
        e.preventDefault();
      } else if (e.key === 'Enter' && results[active]) {
        this.app.flyTo(results[active]);
        input.value = '';
        results = [];
        render();
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = '';
        results = [];
        render();
        input.blur();
      }
      e.stopPropagation();
    };
    input.onblur = () => setTimeout(() => box.classList.add('hidden'), 150);
  }

  // ------------------------------------------------------------------ keyboard
  _buildKeyboard() {
    const app = this.app;
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key;
      if (k === ' ') {
        app.paused = !app.paused;
        e.preventDefault();
      } else if (k === '.' || k === '>') app.warpFaster(app.warp < 0 ? -1 : 1);
      else if (k === ',' || k === '<') app.warpFaster(app.warp < 0 ? 1 : -1);
      else if (k === 'r' || k === 'R') app.warp = -app.warp;
      else if (k === 'f' || k === 'F') app.selected && app.flyTo(app.selected);
      else if (k === 'Delete' || k === 'Backspace') this.deleteSelected();
      else if (k === 'o' || k === 'O') this._toggle('optOrbits');
      else if (k === 'l' || k === 'L') this._toggle('optLabels');
      else if (k === 't' || k === 'T') this._toggle('optTrails');
      else if (k === 'c' || k === 'C') this._toggle('optConstellations');
      else if (k === 'h' || k === 'H') document.body.classList.toggle('hide-ui');
      else if (k === '/') {
        $('search').focus();
        e.preventDefault();
      } else if (k === '?') $('help').classList.toggle('hidden');
      else if (k >= '1' && k <= '5') {
        const tab = ['scenarios', 'create', 'view', 'physics', 'save'][parseInt(k, 10) - 1];
        this.openTab(this.activeTab === tab ? null : tab);
      } else if (k === 'Escape') {
        if (app.placing) this.cancelPlacing();
        else if (!$('help').classList.contains('hidden')) $('help').classList.add('hidden');
        else if (this.activeTab) this.openTab(null);
        else app.select(null);
      }
    });
  }

  _toggle(id) {
    const el = $(id);
    el.checked = !el.checked;
    el.dispatchEvent(new Event('change'));
  }

  // ------------------------------------------------------------------ events & toasts
  onPhysicsEvent(ev) {
    if (ev.type === 'collision') {
      const e = ev.energyJ;
      const tnt = e / 4.184e15; // megatons... (1 Mt = 4.184e15 J)
      const energy = tnt > 1e6 ? `${sig(e, 2)} J` : `${sig(tnt, 2)} Mt TNT`;
      this.toast(`<b>${ev.outcome[0].toUpperCase() + ev.outcome.slice(1)}:</b> ${ev.b} hit ${ev.a} at ${fmtSpeed(ev.vrel)} — ${energy}.`, 'warn', 6000);
    } else if (ev.type === 'disruption') {
      this.toast(`<b>Tidal disruption:</b> ${ev.a} was ${ev.outcome}.`, 'warn', 6000);
    } else if (ev.type === 'supernova') {
      this.toast(`<b>Supernova!</b> ${ev.a}: ${ev.outcome}.`, 'warn', 8000);
    }
  }

  toast(html, kind = 'warn', ms = 5000) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = html;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
    setTimeout(() => {
      el.style.transition = 'opacity 0.4s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    }, ms);
  }
}

export { hashString, relElements, LIGHT_YEAR, YEAR, DAY, AU, RSUN, simTimeToDate, dateToSimTime };

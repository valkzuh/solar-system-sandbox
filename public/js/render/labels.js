// HTML labels and markers with priority-based decluttering.

import * as THREE from 'three';
import { eclToRender } from '../core/vec.js';

const PRIORITY = { star: 0, blackhole: 0, whitedwarf: 0, neutron: 0, planet: 1, dwarf: 2, moon: 3, asteroid: 4, comet: 4, probe: 5, debris: 9 };

export class Labels {
  constructor(container) {
    this.root = container;
    this.items = new Map();
    this.visible = true;
    this.markers = true;
    this.onClick = null;
    this.v = new THREE.Vector3();
  }

  _item(b) {
    let it = this.items.get(b);
    if (!it) {
      const el = document.createElement('div');
      el.className = `label kind-${b.kind}`;
      el.innerHTML = '<span class="ring"></span><span class="txt"></span>';
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onClick?.(b, e);
      });
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.onDblClick?.(b, e);
      });
      this.root.appendChild(el);
      it = { el, txt: el.querySelector('.txt'), ring: el.querySelector('.ring'), name: '', shown: false };
      this.items.set(b, it);
    }
    if (it.name !== b.name) {
      it.txt.textContent = b.name;
      it.name = b.name;
    }
    return it;
  }

  update(bodies, camera, camPos, ctx) {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    const placed = [];
    const list = [];
    for (const b of bodies) {
      if (!b.showLabel || b.kind === 'debris') continue;
      const rel = [b.pos[0] - camPos[0], b.pos[1] - camPos[1], b.pos[2] - camPos[2]];
      const rp = eclToRender(rel);
      this.v.set(rp[0], rp[1], rp[2]).project(camera);
      if (this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) continue;
      const D = Math.hypot(...rel);
      // Hide labels of bodies hidden behind the focused body.
      const occ = ctx.focus;
      if (occ && occ !== b && occ.sim) {
        const o = [occ.pos[0] - camPos[0], occ.pos[1] - camPos[1], occ.pos[2] - camPos[2]];
        const dO = Math.hypot(...o);
        if (dO < D) {
          const cosSep = (o[0] * rel[0] + o[1] * rel[1] + o[2] * rel[2]) / (dO * D);
          const aO = Math.asin(Math.min(1, (occ.radius * (occ.isStar ? 1 : ctx.bodyScale)) / dO));
          if (Math.acos(Math.min(1, cosSep)) < aO) continue;
        }
      }
      const scale = b.isStar || b.kind === 'blackhole' ? 1 : ctx.bodyScale;
      const pxR = (b.radius * scale) / D / ctx.pixelAngle / ctx.pixelRatio;
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      // Moons crowd their planet: require separation from the primary on screen.
      let pr = PRIORITY[b.kind] ?? 5;
      if (b === ctx.selected || b === ctx.focus) pr = -1;
      list.push({ b, x, y, pxR, pr, D });
    }
    list.sort((a, c) => a.pr - c.pr || c.pxR - a.pxR);
    const seen = new Set();
    for (const L of list) {
      if (!this.visible && L.pr >= 0) continue;
      const it = this._item(L.b);
      const tw = L.b.name.length * 7 + 18;
      const offset = Math.max(L.pxR, 4) + 6;
      const rect = { x0: L.x + offset - 4, x1: L.x + offset + tw, y0: L.y - 9, y1: L.y + 9 };
      let clash = false;
      for (const r of placed) {
        if (rect.x0 < r.x1 && rect.x1 > r.x0 && rect.y0 < r.y1 && rect.y1 > r.y0) {
          clash = true;
          break;
        }
      }
      // Hide the label when zoomed far into the body itself.
      if (L.pxR > h * 0.35) clash = true;
      if (clash && L.pr >= 0) continue;
      placed.push(rect);
      seen.add(L.b);
      it.el.style.transform = `translate(${L.x.toFixed(1)}px, ${L.y.toFixed(1)}px)`;
      it.txt.style.transform = `translate(${offset.toFixed(1)}px, -50%)`;
      const showRing = this.markers && L.pxR < 7;
      it.ring.style.display = showRing ? 'block' : 'none';
      it.el.classList.toggle('selected', L.b === ctx.selected);
      if (!it.shown) {
        it.el.style.display = 'block';
        it.shown = true;
      }
    }
    for (const [b, it] of this.items) {
      if (!b.sim) {
        it.el.remove();
        this.items.delete(b);
        continue;
      }
      if (!seen.has(b) && it.shown) {
        it.el.style.display = 'none';
        it.shown = false;
      }
    }
  }

  clear() {
    for (const [, it] of this.items) it.el.remove();
    this.items.clear();
  }
}

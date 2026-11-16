// Procedural low-poly dinosaur models. Every model faces +Z with its feet at y=0.
import * as THREE from 'three';
import { DETAILED, PALETTES2 } from './models2.js';

export const PALETTES = {
  trex: { main: 0x5f9a3a, belly: 0xe2d99a, dark: 0x3d6425, accent: 0x3d6425 },
  trike: { main: 0xd0914d, belly: 0xf3deb0, dark: 0x8a5a2b, accent: 0xe4572e },
  raptor: { main: 0x2f8fd0, belly: 0xd8ecf7, dark: 0x1b5e8c, accent: 0xff7043 },
  ptera: { main: 0xa25bd6, belly: 0xead7f7, dark: 0x6b3a94, accent: 0xffc93c },
  queen: { main: 0x8e24aa, belly: 0xf3d9fa, dark: 0x4a148c, accent: 0xffd700 },
  threehorn: { main: 0x7d8088, belly: 0xd2d5da, dark: 0x4b4d52, accent: 0x2a9d8f },
  kingrex: { main: 0xb23030, belly: 0xf2c57c, dark: 0x5c1010, accent: 0x5c1010 },
};

const IVORY = 0xfff6dc;
const mats = new Map();
function M(color) {
  let m = mats.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true }); mats.set(color, m); }
  return m;
}
const geos = new Map();
function geo(key, make) {
  let g = geos.get(key);
  if (!g) { g = make(); geos.set(key, g); }
  return g;
}
function B(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), M(color));
  m.position.set(x, y, z);
  return m;
}
function C(r, h, color, x, y, z, rx = 0, seg = 6) {
  const m = new THREE.Mesh(geo(`c${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), M(color));
  m.position.set(x, y, z);
  m.rotation.x = rx;
  return m;
}
function S(r, color, x, y, z) {
  const m = new THREE.Mesh(geo(`s${r}`, () => new THREE.SphereGeometry(r, 8, 6)), M(color));
  m.position.set(x, y, z);
  return m;
}
function P(x, y, z, ...kids) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  for (const k of kids) g.add(k);
  return g;
}
function addEyes(parent, x, y, z, r) {
  for (const sx of [-1, 1]) {
    parent.add(S(r, 0xffffff, sx * x, y, z));
    parent.add(S(r * 0.55, 0x111111, sx * (x + r * 0.55), y, z + r * 0.35));
  }
}
// 0 -> 1 -> 0 bump while an attack animation plays (a.attack runs 1 -> 0)
const bump = (v) => (v > 0 ? Math.sin(Math.PI * (1 - v)) : 0);

function trex(p) {
  const g = new THREE.Group();
  const body = P(0, 2.5, 0,
    B(1.5, 1.7, 3.0, p.main, 0, 0.1, 0.3),
    B(1.3, 0.5, 2.6, p.belly, 0, -0.75, 0.3),
    B(0.3, 0.25, 2.4, p.dark, 0, 1.0, 0.2));
  const tail2 = P(0, 0, -1.5, B(0.55, 0.55, 1.5, p.main, 0, 0, -0.75), C(0.3, 1.0, p.main, 0, 0, -1.9, -Math.PI / 2));
  const tail = P(0, 0.2, -1.1, B(1.0, 1.0, 1.6, p.main, 0, 0, -0.8), tail2);
  const jaw = P(0, 0.1, 0.3, B(1.0, 0.3, 1.5, p.belly, 0, -0.2, 0.8), B(0.85, 0.12, 1.2, 0xffffff, 0, 0.0, 0.9));
  const head = P(0, 0.9, 1.6,
    B(0.8, 0.9, 0.9, p.main, 0, 0.1, 0.2),
    B(1.2, 0.9, 1.9, p.main, 0, 0.6, 1.0),
    B(1.05, 0.14, 1.3, 0xffffff, 0, 0.1, 1.25),
    jaw);
  addEyes(head, 0.6, 0.8, 1.2, 0.15);
  const arms = [-1, 1].map((sx) => { const a = B(0.16, 0.55, 0.16, p.dark, sx * 0.78, -0.55, 1.5); a.rotation.x = -0.6; return a; });
  body.add(tail, head, ...arms);
  const legs = [-1, 1].map((sx) => P(sx * 0.72, 2.3, 0,
    B(0.6, 1.4, 0.9, p.main, 0, -0.6, 0),
    B(0.35, 1.1, 0.35, p.dark, 0, -1.6, -0.1),
    B(0.6, 0.25, 1.1, p.dark, 0, -2.17, 0.3)));
  g.add(body, ...legs);
  return {
    group: g,
    animate(a) {
      const m = Math.min(1, a.move);
      const sw = Math.sin(a.phase) * 0.65 * m;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      body.position.y = 2.5 + Math.abs(Math.cos(a.phase)) * 0.14 * m;
      body.rotation.z = Math.sin(a.phase) * 0.04 * m;
      tail.rotation.y = Math.sin(a.t * 1.7) * 0.12 + Math.sin(a.phase) * 0.12 * m;
      tail2.rotation.y = Math.sin(a.t * 1.7 - 0.8) * 0.18;
      const s = bump(a.attack), r = bump(a.special);
      head.rotation.x = s * 0.4 - r * 0.45;
      jaw.rotation.x = 0.04 + Math.sin(a.t * 2) * 0.02 + s * 0.8 + r * 0.9;
    },
  };
}

function trike(p) {
  const g = new THREE.Group();
  const body = P(0, 2.05, 0,
    B(2.0, 1.7, 3.6, p.main, 0, 0, 0),
    B(1.8, 0.4, 3.2, p.belly, 0, -0.85, 0),
    B(0.5, 0.2, 3.0, p.dark, 0, 0.9, 0));
  const tail = P(0, 0.1, -1.7, C(0.55, 2.2, p.main, 0, -0.1, -1.0, -Math.PI / 2));
  const frill = new THREE.Mesh(geo('frill', () => new THREE.CylinderGeometry(1.7, 1.7, 0.25, 10)), M(p.main));
  frill.position.set(0, 0.75, 0.0); frill.rotation.x = Math.PI / 2 - 0.45;
  const frillIn = new THREE.Mesh(geo('frillIn', () => new THREE.CylinderGeometry(1.25, 1.25, 0.1, 10)), M(p.accent));
  frillIn.position.set(0, 0.82, 0.14); frillIn.rotation.x = Math.PI / 2 - 0.45;
  const head = P(0, 0.1, 1.8,
    B(1.3, 1.2, 1.5, p.main, 0, 0, 0.7),
    B(0.7, 0.7, 0.6, p.dark, 0, -0.25, 1.7),
    frill, frillIn,
    C(0.16, 1.5, IVORY, -0.42, 0.95, 1.3, 1.0),
    C(0.16, 1.5, IVORY, 0.42, 0.95, 1.3, 1.0),
    C(0.14, 0.6, IVORY, 0, 0.5, 1.75, 0.6));
  addEyes(head, 0.66, 0.15, 1.05, 0.13);
  body.add(tail, head);
  const legs = [];
  for (const sz of [1, -1]) for (const sx of [-1, 1]) {
    legs.push(P(sx * 0.75, 1.45, sz * 1.25,
      B(0.6, 1.45, 0.65, p.main, 0, -0.72, 0),
      B(0.68, 0.2, 0.78, p.dark, 0, -1.35, 0.03)));
  }
  g.add(body, ...legs);
  return {
    group: g,
    animate(a) {
      const m = Math.min(1, a.move);
      const sw = Math.sin(a.phase) * 0.55 * m;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      legs[2].rotation.x = -sw; legs[3].rotation.x = sw;
      body.position.y = 2.05 + Math.abs(Math.cos(a.phase)) * 0.08 * m;
      tail.rotation.y = Math.sin(a.t * 2) * 0.2;
      const s = bump(a.attack), r = a.special > 0 ? 1 : 0;
      head.rotation.x = -s * 0.5 + r * 0.25 + Math.sin(a.t * 1.3) * 0.03;
      body.position.z = s * 0.7;
    },
  };
}

function raptor(p) {
  const g = new THREE.Group();
  const body = P(0, 1.15, 0,
    B(0.5, 0.6, 1.3, p.main, 0, 0, 0.15),
    B(0.4, 0.2, 1.1, p.belly, 0, -0.3, 0.15),
    B(0.12, 0.12, 1.0, p.dark, 0, 0.33, 0.1));
  const tail2 = P(0, 0, -0.9, B(0.16, 0.16, 0.9, p.dark, 0, 0, -0.45));
  const tail = P(0, 0.1, -0.45, B(0.26, 0.26, 0.9, p.main, 0, 0, -0.45), tail2);
  const jaw = P(0, 0.6, 0.1, B(0.28, 0.1, 0.62, p.belly, 0, -0.06, 0.33));
  const head = P(0, 0.2, 0.75,
    B(0.26, 0.7, 0.3, p.main, 0, 0.3, 0.05),
    B(0.36, 0.32, 0.8, p.main, 0, 0.75, 0.4),
    B(0.08, 0.3, 0.6, p.accent, 0, 1.0, 0.15),
    jaw);
  addEyes(head, 0.19, 0.8, 0.5, 0.07);
  const arms = [-1, 1].map((sx) => { const a = B(0.1, 0.1, 0.45, p.dark, sx * 0.3, -0.15, 0.7); a.rotation.x = 0.5; return a; });
  body.add(tail, head, ...arms);
  const legs = [-1, 1].map((sx) => P(sx * 0.24, 1.1, 0.05,
    B(0.22, 0.6, 0.36, p.main, 0, -0.3, 0),
    B(0.13, 0.5, 0.13, p.dark, 0, -0.8, -0.05),
    B(0.2, 0.1, 0.45, p.dark, 0, -1.05, 0.12)));
  g.add(body, ...legs);
  return {
    group: g,
    animate(a) {
      const m = Math.min(1, a.move);
      const air = a.special > 0 ? 1 : 0;
      const sw = Math.sin(a.phase) * 0.9 * m;
      legs[0].rotation.x = air ? -0.9 : sw; legs[1].rotation.x = air ? -0.9 : -sw;
      body.rotation.x = 0.18 * m - air * 0.35;
      body.position.y = 1.15 + Math.abs(Math.cos(a.phase)) * 0.06 * m;
      tail.rotation.y = Math.sin(a.t * 3) * 0.15 + Math.sin(a.phase) * 0.2 * m;
      tail2.rotation.y = Math.sin(a.t * 3 - 0.7) * 0.25;
      const s = bump(a.attack);
      head.rotation.x = s * 0.5;
      jaw.rotation.x = s * 0.7 + air * 0.6;
      arms[0].rotation.x = 0.5 - s * 1.2 - air; arms[1].rotation.x = 0.5 - s * 1.2 - air;
    },
  };
}

function ptera(p) {
  const g = new THREE.Group();
  const body = P(0, 0.95, 0,
    B(0.5, 0.45, 1.2, p.main, 0, 0, 0),
    B(0.4, 0.15, 1.0, p.belly, 0, -0.25, 0));
  const head = P(0, 0.15, 0.6,
    B(0.22, 0.4, 0.25, p.main, 0, 0.15, 0.05),
    B(0.3, 0.3, 0.5, p.main, 0, 0.4, 0.25),
    C(0.11, 1.3, p.accent, 0, 0.36, 1.1, Math.PI / 2, 5),
    C(0.12, 1.1, p.accent, 0, 0.7, -0.35, -1.15, 5));
  addEyes(head, 0.16, 0.45, 0.35, 0.06);
  const wings = [], tips = [];
  for (const sx of [-1, 1]) {
    const tip = P(sx * 1.6, 0, 0, B(1.5, 0.05, 0.6, p.dark, sx * 0.75, 0, -0.1));
    const wing = P(sx * 0.25, 0.15, 0.1, B(1.6, 0.06, 1.0, p.main, sx * 0.8, 0, 0), tip);
    wing.userData.sx = sx;
    wings.push(wing); tips.push(tip);
  }
  body.add(head, ...wings);
  const legs = [-1, 1].map((sx) => P(sx * 0.15, 0.7, -0.2, B(0.09, 0.7, 0.09, p.dark, 0, -0.35, 0)));
  g.add(body, ...legs);
  return {
    group: g,
    animate(a) {
      const m = Math.min(1, a.move);
      const s = bump(a.attack);
      head.rotation.x = s * 0.6;
      for (let i = 0; i < 2; i++) {
        const sx = wings[i].userData.sx;
        if (a.flying) {
          if (a.special > 0) { // diving: wings swept back
            wings[i].rotation.set(0, -sx * 0.7, sx * 0.35);
            tips[i].rotation.z = 0;
          } else {
            const flap = Math.sin(a.t * 9);
            wings[i].rotation.set(0, 0, sx * flap * 0.55);
            tips[i].rotation.z = sx * (flap * 0.45 - 0.1);
          }
          legs[i].rotation.x = 1.3;
        } else {
          wings[i].rotation.set(0, 0, sx * 1.15);
          tips[i].rotation.z = -sx * 2.2;
          legs[i].rotation.x = Math.sin(a.phase + i * Math.PI) * 0.7 * m;
        }
      }
      body.position.y = 0.95 + (a.flying ? Math.sin(a.t * 9 + 1.5) * 0.1 : 0);
    },
  };
}

const BUILDERS = { trex, trike, raptor, ptera };
Object.assign(PALETTES, PALETTES2);

export function buildDino(key, paletteName) {
  const pal = paletteName || key;
  if (DETAILED[key]) return DETAILED[key](PALETTES[pal], `${key}:${pal}:`);
  return BUILDERS[key](PALETTES[pal]);
}

// Detailed models for the newer animals: smooth tapered bodies with belly
// shading, skin patterns, armour, teeth and claws. Each moving part is one
// merged mesh, so a detailed animal still costs only ~20 draw calls.
// Every model faces +Z with its feet (or, for the Mosasaurus, its swimming
// level) at y = 0.
import * as THREE from 'three';
import { Kit, skin } from './geom.js';

export const PALETTES2 = {
  anky: { main: 0x7d6b4c, belly: 0xcdb98e, dark: 0x4b3d2a, accent: 0xbba57c },
  pachy: { main: 0x9a7444, belly: 0xe6d6ae, dark: 0x5a3e22, accent: 0x3e2a18, dome: 0xd8c49a },
  brachio: { main: 0x87907a, belly: 0xd2cdb3, dark: 0x5c6550, accent: 0x6f6a58 },
  quetz: { main: 0xe7e0d2, belly: 0xf6f2ea, dark: 0x8d7f70, accent: 0xc0392b, beak: 0xd6ad45, wing: 0x7a6656 },
  mosa: { main: 0x3c5568, belly: 0xe9e5d8, dark: 0x22323f, accent: 0x2a3c4c },
};

const SKIN = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
const MEMBRANE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
const IVORY = 0xf1e8cf, CLAW = 0x2b241d;

// geometry is built once per species + palette + part and shared by every copy
const cache = new Map();
function part(key, build, mat = SKIN) {
  let g = cache.get(key);
  if (!g) { const k = new Kit(); build(k); g = k.geometry(); cache.set(key, g); }
  return new THREE.Mesh(g, mat);
}
function J(x, y, z, ...kids) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  for (const k of kids) g.add(k);
  return g;
}
const bump = (v) => (v > 0 ? Math.sin(Math.PI * (1 - v)) : 0);

function eyes(k, x, y, z, r, iris = 0x3a2208) {
  for (const sx of [-1, 1]) {
    k.blob(r, r, r, iris, [sx * x, y, z]);
    k.blob(r * 0.55, r * 0.55, r * 0.55, 0x050505, [sx * (x + r * 0.5), y, z + r * 0.3]);
    k.blob(r * 0.18, r * 0.18, r * 0.18, 0xffffff, [sx * (x + r * 0.85), y + r * 0.3, z + r * 0.35]);
  }
}

/** Interpolated cross-section of a tube path at depth z: [cy, rx, ry]. */
function sectionAt(pts, z) {
  const ps = [...pts].sort((a, b) => a[2] - b[2]);
  if (z <= ps[0][2]) return [ps[0][1], ps[0][3], ps[0][4]];
  for (let i = 0; i < ps.length - 1; i++) {
    const a = ps[i], b = ps[i + 1];
    if (z <= b[2]) {
      const t = (z - a[2]) / (b[2] - a[2]);
      return [a[1] + (b[1] - a[1]) * t, a[3] + (b[3] - a[3]) * t, a[4] + (b[4] - a[4]) * t];
    }
  }
  const l = ps[ps.length - 1];
  return [l[1], l[3], l[4]];
}

/** A flat triangle fan (wing membrane) from a list of [x, y, z, colorHex] corners. */
function membrane(k, corners) {
  const pos = [], col = [], c = new THREE.Color();
  for (let i = 1; i < corners.length - 1; i++) {
    for (const v of [corners[0], corners[i], corners[i + 1]]) {
      pos.push(v[0], v[1], v[2]);
      c.setHex(v[3]); col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  k.add(g, null);
  g.dispose();
}

// ---------------------------------------------------------------------------
function anky(p, id) {
  const g = new THREE.Group();
  const sk = skin(p.main, p.belly, p.dark, { mottle: 0.35 });
  const bodyPts = [[0, 0.0, -2.3, 0.45, 0.42], [0, 0.2, -1.4, 1.15, 0.78], [0, 0.3, 0, 1.38, 0.9], [0, 0.22, 1.35, 1.15, 0.74], [0, 0.05, 2.25, 0.55, 0.45]];
  const body = J(0, 1.3, 0, part(id + 'body', (k) => {
    k.tube(bodyPts, { color: sk, radial: 18, steps: 5 });
    // rows of bony studs (osteoderms) across the back
    let row = 0;
    for (let z = -1.75; z <= 1.95; z += 0.4, row++) {
      const [cy, rx, ry] = sectionAt(bodyPts, z);
      const big = row % 2 === 0;
      for (const f of [-0.82, -0.55, -0.27, 0, 0.27, 0.55, 0.82]) {
        if (rx < 0.7 && Math.abs(f) > 0.5) continue;
        const x = rx * f, y = cy + ry * Math.sqrt(Math.max(0, 1 - f * f)) - 0.04;
        const rad = big ? 0.15 : 0.11;
        k.spike(rad, big ? 0.24 : 0.16, p.accent, [x, y, z + (f * 7 % 2) * 0.05], [0, 0, -f * 1.0]);
      }
    }
    // spikes sticking out of the flanks, swept back
    for (let z = -1.5; z <= 1.6; z += 0.5) {
      const [cy, rx] = sectionAt(bodyPts, z);
      const len = z > 1.0 ? 0.8 : 0.5;
      for (const sx of [-1, 1]) k.spike(0.13, len, p.accent, [sx * rx * 0.93, cy - 0.05, z], [0, sx * 0.4, -sx * 1.4]);
    }
  }));
  const head = J(0, 0.08, 2.25, part(id + 'head', (k) => {
    k.tube([[0, 0.05, -0.15, 0.5, 0.38], [0, 0.07, 0.35, 0.58, 0.36], [0, -0.04, 0.82, 0.38, 0.25], [0, -0.13, 1.08, 0.2, 0.14]],
      { color: sk, radial: 14 });
    for (const sx of [-1, 1]) {
      k.spike(0.12, 0.45, p.accent, [sx * 0.46, 0.2, 0.05], [0, sx * 0.6, -sx * 1.9]);  // horns at the back corners
      k.spike(0.09, 0.3, p.accent, [sx * 0.45, -0.12, 0.3], [0, sx * 0.2, -sx * 2.3]); // cheek horns
    }
    for (const [x, z] of [[0, 0.2], [-0.22, 0.35], [0.22, 0.35], [-0.15, 0.62], [0.15, 0.62], [0, 0.55]]) {
      k.blob(0.12, 0.06, 0.12, p.accent, [x, 0.36 - z * 0.12, z]);
    }
    k.blob(0.19, 0.11, 0.12, p.dark, [0, -0.15, 1.1]); // beak
    eyes(k, 0.5, 0.14, 0.48, 0.075);
  }));
  const club = J(0, -0.02, -1.4, part(id + 'club', (k) => {
    k.blob(0.32, 0.28, 0.52, p.accent, [0, 0, -0.25]);
    for (const sx of [-1, 1]) k.blob(0.38, 0.3, 0.42, p.accent, [sx * 0.3, 0, -0.32]);
    k.blob(0.2, 0.18, 0.2, p.accent, [0, 0, -0.75]);
  }));
  const t2 = J(0, -0.03, -1.6, part(id + 't2', (k) => {
    k.tube([[0, 0, 0.15, 0.27, 0.24], [0, -0.01, -0.7, 0.22, 0.19], [0, -0.02, -1.45, 0.15, 0.13]], { color: sk });
    for (const z of [-0.2, -0.6, -1.0]) for (const sx of [-1, 1]) k.spike(0.07, 0.22, p.accent, [sx * 0.2, 0, z], [0, sx * 0.4, -sx * 1.45]);
  }), club);
  const t1 = J(0, 0.0, -2.15, part(id + 't1', (k) => {
    k.tube([[0, 0, 0.25, 0.41, 0.37], [0, -0.03, -0.8, 0.37, 0.32], [0, -0.03, -1.65, 0.3, 0.27]], { color: sk });
    for (const z of [-0.2, -0.7, -1.2]) for (const sx of [-1, 1]) k.spike(0.09, 0.3, p.accent, [sx * 0.33, 0, z], [0, sx * 0.4, -sx * 1.45]);
    for (const z of [0, -0.5, -1.0, -1.4]) k.spike(0.09, 0.14, p.accent, [0, 0.33 - z * 0.04, z], [0, 0, 0]);
  }), t2);
  body.add(head, t1);
  const legs = [], knees = [];
  for (const [sz, z] of [[1, 1.25], [-1, -1.15]]) for (const sx of [-1, 1]) {
    const lower = J(0, -0.55, 0.02, part(id + 'lower', (k) => {
      k.blob(0.28, 0.28, 0.28, p.main, [0, 0, 0]);
      k.tube([[0, 0.05, 0, 0.25, 0.25], [0, -0.28, 0.02, 0.23, 0.23], [0, -0.5, 0, 0.23, 0.23]], { color: p.main, radial: 10 });
      k.blob(0.32, 0.13, 0.37, p.dark, [0, -0.52, 0.1]);
      for (const tx of [-0.15, 0, 0.15]) k.blob(0.07, 0.06, 0.09, CLAW, [tx, -0.57, 0.43]);
    }));
    const leg = J(sx * 0.88, 1.15, z, part(id + 'upper', (k) => {
      k.tube([[0, 0.2, 0, 0.4, 0.42], [0, -0.25, 0, 0.34, 0.35], [0, -0.57, 0, 0.29, 0.29]], { color: p.main, radial: 10 });
    }), lower);
    leg.userData.sx = sx;
    legs.push(leg); knees.push(lower);
  }
  g.add(body, ...legs);
  return {
    group: g,
    animate(a) {
      const m = Math.min(1, a.move), sw = Math.sin(a.phase) * 0.45 * m;
      const armor = a.special > 0 ? 1 : 0;
      const swings = [sw, -sw, -sw, sw];
      legs.forEach((l, i) => {
        l.rotation.x = swings[i];
        l.rotation.z = l.userData.sx * armor * 0.3;
        knees[i].rotation.x = Math.max(0, -swings[i]) * 0.7;
      });
      body.position.y = 1.3 + Math.abs(Math.cos(a.phase)) * 0.05 * m - armor * 0.3;
      body.rotation.z = Math.sin(a.phase) * 0.03 * m;
      const s = bump(a.attack);
      t1.rotation.y = Math.sin(a.t * 1.5) * 0.12 + Math.sin(a.phase) * 0.1 * m + s * 1.2;
      t2.rotation.y = Math.sin(a.t * 1.5 - 0.7) * 0.15 + s * 0.7;
      club.rotation.y = s * 0.4;
      head.rotation.x = Math.sin(a.t * 1.1) * 0.05 + armor * 0.35;
    },
  };
}

// ---------------------------------------------------------------------------
function pachy(p, id) {
  const g = new THREE.Group();
  const sk = skin(p.main, p.belly, p.dark, { bands: 5, bandK: 0.5 });
  const body = J(0, 1.75, 0, part(id + 'body', (k) => {
    k.tube([[0, -0.05, -1.0, 0.3, 0.32], [0, 0.05, -0.35, 0.52, 0.58], [0, 0.0, 0.35, 0.48, 0.55], [0, 0.18, 0.88, 0.3, 0.33], [0, 0.5, 1.18, 0.22, 0.22]],
      { color: sk, radial: 14, steps: 5 });
    for (const sx of [-1, 1]) {
      k.tube([[sx * 0.3, -0.12, 0.62, 0.075, 0.075], [sx * 0.34, -0.32, 0.72, 0.06, 0.06], [sx * 0.33, -0.42, 0.86, 0.045, 0.045]], { color: p.main, radial: 8 });
      for (const f of [-0.04, 0.04]) k.spike(0.022, 0.1, CLAW, [sx * 0.33 + f, -0.42, 0.88], [1.6, 0, 0]);
    }
  }));
  const head = J(0, 0.6, 1.25, part(id + 'head', (k) => {
    k.tube([[0, -0.02, -0.18, 0.24, 0.24], [0, 0.0, 0.18, 0.27, 0.28], [0, -0.1, 0.5, 0.17, 0.17], [0, -0.16, 0.7, 0.09, 0.09]],
      { color: sk, radial: 14 });
    k.blob(0.29, 0.27, 0.33, p.dome, [0, 0.2, -0.03]);          // thick domed skull
    for (let i = 0; i < 12; i++) {                              // ring of bony knobs round the dome
      const th = i / 12 * Math.PI * 2, x = Math.cos(th) * 0.29, z = Math.sin(th) * 0.32 - 0.04;
      k.spike(0.045, z < -0.1 ? 0.17 : 0.1, p.accent, [x, 0.08, z], [z * 1.5, 0, -x * 2.2]);
    }
    for (const [x, z] of [[0, 0.5], [-0.07, 0.42], [0.07, 0.42]]) k.spike(0.03, 0.07, p.accent, [x, -0.02, z], [0.4, 0, 0]);
    k.blob(0.06, 0.04, 0.05, p.dark, [0, -0.18, 0.72]);         // beak tip
    eyes(k, 0.21, 0.07, 0.28, 0.05);
  }));
  const t2 = J(0, 0.02, -1.4, part(id + 't2', (k) => {
    k.tube([[0, 0, 0.05, 0.16, 0.16], [0, 0, -0.7, 0.1, 0.1], [0, 0, -1.35, 0.03, 0.03]], { color: sk });
  }));
  const t1 = J(0, 0, -0.95, part(id + 't1', (k) => {
    k.tube([[0, 0, 0.15, 0.3, 0.31], [0, 0.02, -0.7, 0.22, 0.22], [0, 0.02, -1.42, 0.16, 0.16]], { color: sk });
  }), t2);
  body.add(head, t1);
  const legs = [], shins = [];
  for (const sx of [-1, 1]) {
    const shin = J(0, -0.75, 0.12, part(id + 'shin', (k) => {
      k.blob(0.16, 0.16, 0.16, p.main, [0, 0, 0]);
      k.tube([[0, 0.05, 0, 0.15, 0.15], [0, -0.5, -0.18, 0.1, 0.1]], { color: p.main, radial: 8 });
      k.tube([[0, -0.5, -0.18, 0.09, 0.09], [0, -0.92, -0.12, 0.07, 0.07]], { color: p.dark, radial: 8 });
      for (const tx of [-0.07, 0, 0.07]) k.blob(0.045, 0.04, 0.17, p.dark, [tx, -0.95, 0.02]);
      for (const tx of [-0.07, 0, 0.07]) k.spike(0.03, 0.08, CLAW, [tx, -0.96, 0.18], [1.57, 0, 0]);
    }));
    const leg = J(sx * 0.33, 1.75, 0, part(id + 'thigh', (k) => {
      k.tube([[0, 0.15, 0, 0.26, 0.3], [0, -0.35, 0.08, 0.22, 0.24], [0, -0.78, 0.12, 0.15, 0.15]], { color: p.main, radial: 10 });
    }), shin);
    legs.push(leg); shins.push(shin);
  }
  g.add(body, ...legs);
  return {
    group: g,
    animate(a) {
      const m = Math.min(1, a.move);
      const sw = Math.sin(a.phase) * 0.75 * m;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      shins[0].rotation.x = Math.max(0, Math.sin(a.phase + 1.2)) * 0.6 * m;
      shins[1].rotation.x = Math.max(0, -Math.sin(a.phase + 1.2)) * 0.6 * m;
      const s = bump(a.attack), ram = a.special > 0 ? 1 : 0;
      body.rotation.x = 0.1 * m + s * 0.3 + ram * 0.3;
      body.position.y = 1.75 + Math.abs(Math.cos(a.phase)) * 0.06 * m;
      head.rotation.x = s * 0.6 + ram * 0.55 + Math.sin(a.t * 1.7) * 0.03;
      t1.rotation.y = Math.sin(a.t * 2.2) * 0.1 + Math.sin(a.phase) * 0.12 * m;
      t2.rotation.y = Math.sin(a.t * 2.2 - 0.7) * 0.18;
    },
  };
}

// ---------------------------------------------------------------------------
function brachio(p, id) {
  const g = new THREE.Group();
  const sk = skin(p.main, p.belly, p.dark, { mottle: 0.5 });
  const body = J(0, 5.0, 0, part(id + 'body', (k) => {
    k.tube([[0, -0.5, -2.9, 0.75, 0.8], [0, 0, -1.7, 1.45, 1.5], [0, 0.35, -0.2, 1.62, 1.72], [0, 0.8, 1.4, 1.42, 1.55], [0, 1.15, 2.5, 0.9, 1.0], [0, 1.4, 2.95, 0.72, 0.76]],
      { color: sk, radial: 20, steps: 5 });
  }));
  const jaw = J(0, -0.12, 0.08, part(id + 'jaw', (k) => {
    k.tube([[0, 0, 0, 0.22, 0.1], [0, -0.04, 0.45, 0.2, 0.08], [0, -0.03, 0.82, 0.14, 0.06]], { color: p.belly, radial: 10 });
  }));
  const head = J(0, 1.9, 0.5, part(id + 'head', (k) => {
    k.tube([[0, 0.05, -0.2, 0.3, 0.33], [0, 0.12, 0.25, 0.34, 0.38], [0, 0.0, 0.65, 0.26, 0.24], [0, -0.08, 0.95, 0.18, 0.13]], { color: sk, radial: 14 });
    k.blob(0.2, 0.25, 0.32, p.main, [0, 0.42, 0.18]);  // the bony arch over the nose
    k.blob(0.08, 0.05, 0.08, p.dark, [-0.09, 0.5, 0.36]); k.blob(0.08, 0.05, 0.08, p.dark, [0.09, 0.5, 0.36]); // nostrils
    for (let i = 0; i < 6; i++) k.spike(0.025, 0.07, IVORY, [(i - 2.5) * 0.06, -0.14, 0.86 - Math.abs(i - 2.5) * 0.04], [Math.PI, 0, 0]);
    eyes(k, 0.28, 0.2, 0.12, 0.07);
  }), jaw);
  const n3 = J(0, 2.3, 0.55, part(id + 'n3', (k) => {
    k.blob(0.43, 0.43, 0.43, p.main, [0, 0, 0]);
    k.tube([[0, -0.1, -0.05, 0.42, 0.44], [0, 1.0, 0.25, 0.34, 0.37], [0, 1.95, 0.5, 0.28, 0.3]], { color: sk, radial: 14 });
  }), head);
  const n2 = J(0, 2.4, 0.8, part(id + 'n2', (k) => {
    k.blob(0.58, 0.58, 0.58, p.main, [0, 0, 0]);
    k.tube([[0, -0.1, -0.05, 0.56, 0.59], [0, 1.15, 0.3, 0.48, 0.5], [0, 2.35, 0.55, 0.41, 0.43]], { color: sk, radial: 16 });
  }), n3);
  const n1 = J(0, 1.2, 2.65, part(id + 'n1', (k) => {
    k.tube([[0, -0.55, -0.55, 0.8, 0.85], [0, -0.1, -0.05, 0.74, 0.77], [0, 1.2, 0.45, 0.63, 0.67], [0, 2.45, 0.8, 0.56, 0.59]], { color: sk, radial: 16 });
  }), n2);
  const t3 = J(0, -0.55, -2.3, part(id + 't3', (k) => {
    k.tube([[0, 0, 0.1, 0.19, 0.19], [0, -0.15, -1.2, 0.12, 0.12], [0, -0.2, -2.2, 0.04, 0.04]], { color: sk });
  }));
  const t2 = J(0, -0.75, -2.3, part(id + 't2', (k) => {
    k.tube([[0, 0, 0.1, 0.39, 0.41], [0, -0.35, -1.2, 0.3, 0.31], [0, -0.55, -2.32, 0.2, 0.2]], { color: sk });
  }), t3);
  const t1 = J(0, -0.45, -2.85, part(id + 't1', (k) => {
    k.tube([[0, 0, 0.2, 0.74, 0.77], [0, -0.45, -1.2, 0.55, 0.58], [0, -0.75, -2.32, 0.42, 0.44]], { color: sk });
  }), t2);
  body.add(n1, t1);
  const legs = [], knees = [];
  const legSpec = [
    { x: 1.1, y: 5.55, z: 1.75, up: [[0, 0.3, 0, 0.55, 0.6], [0, -1.3, 0.05, 0.48, 0.5], [0, -2.6, 0.1, 0.42, 0.44]], knee: [0, -2.6, 0.1], low: [[0, 0.05, 0, 0.42, 0.44], [0, -1.3, -0.03, 0.36, 0.37], [0, -2.6, -0.05, 0.36, 0.36]], foot: -2.7, name: 'f' },
    { x: 1.05, y: 4.6, z: -1.75, up: [[0, 0.3, 0, 0.7, 0.75], [0, -1.1, -0.1, 0.58, 0.6], [0, -2.15, 0, 0.45, 0.47]], knee: [0, -2.15, 0], low: [[0, 0.05, 0, 0.45, 0.47], [0, -1.1, 0.08, 0.38, 0.4], [0, -2.05, 0.05, 0.37, 0.37]], foot: -2.2, name: 'r' },
  ];
  for (const L of legSpec) for (const sx of [-1, 1]) {
    const lower = J(...L.knee, part(id + 'low' + L.name, (k) => {
      k.blob(L.low[0][3] * 1.08, L.low[0][3] * 1.08, L.low[0][3] * 1.08, p.main, [0, 0, 0]);
      k.tube(L.low, { color: p.main, radial: 12 });
      k.blob(0.5, 0.22, 0.55, p.dark, [0, L.foot, 0.1]);
      for (const tx of [-0.25, 0, 0.25]) k.blob(0.1, 0.09, 0.12, CLAW, [tx, L.foot - 0.08, 0.6]);
    }));
    const leg = J(sx * L.x, L.y, L.z, part(id + 'up' + L.name, (k) => k.tube(L.up, { color: p.main, radial: 12 })), lower);
    legs.push(leg); knees.push(lower);
  }
  g.add(body, ...legs);
  return {
    group: g,
    animate(a) {
      const m = Math.min(1, a.move), sw = Math.sin(a.phase) * 0.3 * m;
      const s = bump(a.attack), rear = bump(a.special);
      const swings = [sw, -sw, -sw, sw];
      legs.forEach((l, i) => {
        let r = swings[i];
        if (i < 2) r -= s * 0.5 + rear * 0.8;            // front legs lift to stomp / rear up
        l.rotation.x = r;
        knees[i].rotation.x = Math.max(0, -swings[i]) * 0.4 + (i < 2 ? (s * 0.6 + rear * 0.9) : 0);
      });
      body.rotation.x = -s * 0.1 - rear * 0.35;
      body.position.y = 5.0 + Math.abs(Math.cos(a.phase)) * 0.08 * m + rear * 0.7;
      n1.rotation.x = Math.sin(a.t * 0.6) * 0.04 + rear * 0.25;
      n2.rotation.x = Math.sin(a.t * 0.6 - 0.5) * 0.04;
      n2.rotation.y = Math.sin(a.t * 0.45) * 0.08;
      n3.rotation.y = Math.sin(a.t * 0.45 - 0.6) * 0.1;
      head.rotation.x = 0.15 + Math.sin(a.t * 0.9) * 0.05;
      jaw.rotation.x = Math.max(0, Math.sin(a.t * 1.3)) * 0.06 + s * 0.3;
      t1.rotation.y = Math.sin(a.t * 0.8) * 0.08 + Math.sin(a.phase) * 0.06 * m;
      t2.rotation.y = Math.sin(a.t * 0.8 - 0.6) * 0.12;
      t3.rotation.y = Math.sin(a.t * 0.8 - 1.2) * 0.18;
    },
  };
}

// ---------------------------------------------------------------------------
function quetz(p, id) {
  const g = new THREE.Group();
  const fur = skin(p.main, p.belly, p.dark, { mottle: 0.25 });
  const body = J(0, 2.35, 0, part(id + 'body', (k) => {
    k.tube([[0, -0.1, -0.62, 0.2, 0.2], [0, 0, -0.15, 0.42, 0.46], [0, 0.12, 0.35, 0.4, 0.44], [0, 0.32, 0.72, 0.24, 0.24]], { color: fur, radial: 14 });
  }));
  const beakColor = (u, a, out) => {
    out.setHex(u < 0.22 ? p.main : p.beak);
    if (u > 0.85) out.lerp(new THREE.Color(p.dark), (u - 0.85) / 0.15);
    return out;
  };
  const jaw = J(0, -0.1, 0.25, part(id + 'jaw', (k) => {
    k.tube([[0, 0, 0, 0.1, 0.06], [0, -0.03, 0.9, 0.06, 0.04], [0, -0.07, 1.68, 0.012, 0.012]], { color: beakColor, radial: 8 });
  }));
  const head = J(0, 1.0, 0.55, part(id + 'head', (k) => {
    k.blob(0.15, 0.15, 0.15, p.main, [0, 0, -0.05]);
    k.tube([[0, 0.05, -0.25, 0.13, 0.16], [0, 0.06, 0.1, 0.17, 0.22], [0, 0.0, 0.5, 0.12, 0.16], [0, -0.04, 1.2, 0.07, 0.09], [0, -0.1, 1.95, 0.015, 0.02]],
      { color: beakColor, radial: 10, steps: 5 });
    k.blob(0.03, 0.17, 0.42, p.accent, [0, 0.27, -0.2], [0.35, 0, 0]); // crest
    eyes(k, 0.15, 0.12, 0.04, 0.045, 0x5a3a0a);
  }), jaw);
  const n2 = J(0, 1.45, 0.4, part(id + 'n2', (k) => {
    k.blob(0.16, 0.16, 0.16, p.main, [0, 0, 0]);
    k.tube([[0, -0.05, -0.03, 0.15, 0.15], [0, 0.55, 0.25, 0.13, 0.13], [0, 1.02, 0.55, 0.13, 0.13]], { color: fur, radial: 10 });
  }), head);
  const n1 = J(0, 0.35, 0.75, part(id + 'n1', (k) => {
    k.tube([[0, -0.1, -0.05, 0.21, 0.21], [0, 0.75, 0.25, 0.16, 0.16], [0, 1.47, 0.4, 0.14, 0.14]], { color: fur, radial: 10 });
  }), n2);
  body.add(n1);
  const arms = [], hands = [], webs = [];
  for (const sx of [-1, 1]) {
    const outerWeb = part(id + 'webO' + sx, (k) => membrane(k, [
      [0, 0, 0.02, p.wing], [sx * 1.4, 0, -0.13, p.wing], [sx * 2.9, 0, -0.4, p.wing], [sx * 1.2, 0, -0.85, p.dark], [0, 0, -1.0, p.dark],
    ]), MEMBRANE);
    const hand = J(sx * 2.4, 0, 0.05, part(id + 'finger' + sx, (k) => {
      k.tube([[0, 0, 0, 0.08, 0.08], [sx * 1.4, 0, -0.15, 0.06, 0.06], [sx * 2.9, 0, -0.4, 0.02, 0.02]], { color: p.dark, radial: 8 });
      for (const f of [-0.06, 0, 0.06]) k.spike(0.025, 0.14, CLAW, [0, f, 0.05], [1.57, 0, 0]);
    }), outerWeb);
    const innerWeb = part(id + 'webI' + sx, (k) => membrane(k, [
      [0, 0, 0.1, p.wing], [sx * 1.2, 0, -0.02, p.wing], [sx * 2.4, 0, 0.05, p.wing], [sx * 2.4, 0, -0.95, p.dark], [sx * 1.0, 0, -1.25, p.dark], [0, 0, -1.0, p.dark],
    ]), MEMBRANE);
    const arm = J(sx * 0.32, 0.12, 0.45, part(id + 'arm' + sx, (k) => {
      k.tube([[0, 0, 0, 0.14, 0.14], [sx * 1.2, 0, -0.1, 0.1, 0.1], [sx * 2.4, 0, 0.05, 0.08, 0.08]], { color: p.dark, radial: 8 });
    }), innerWeb, hand);
    arm.userData.sx = sx;
    body.add(arm);
    arms.push(arm); hands.push(hand); webs.push(innerWeb, outerWeb);
  }
  const legs = [], shins = [];
  for (const sx of [-1, 1]) {
    const shin = J(0, -0.95, 0.12, part(id + 'shin', (k) => {
      k.tube([[0, 0.03, 0, 0.08, 0.08], [0, -0.95, -0.05, 0.05, 0.05]], { color: p.dark, radial: 8 });
      k.blob(0.08, 0.04, 0.17, p.dark, [0, -1.0, 0.08]);
    }));
    const leg = J(sx * 0.22, 2.05, -0.35, part(id + 'thigh', (k) => {
      k.tube([[0, 0.12, 0, 0.13, 0.15], [0, -0.95, 0.12, 0.09, 0.09]], { color: p.main, radial: 8 });
    }), shin);
    legs.push(leg); shins.push(shin);
  }
  g.add(body, ...legs);
  return {
    group: g,
    animate(a) {
      const m = Math.min(1, a.move), s = bump(a.attack), gust = bump(a.special);
      const air = a.flying || gust > 0;
      for (const w of webs) w.visible = air;
      for (let i = 0; i < 2; i++) {
        const sx = arms[i].userData.sx;
        if (air) {
          const flap = a.flying ? Math.sin(a.t * 4.5) * 0.45 : 0;
          const big = gust * Math.sin(a.t * 20) * 0.6;
          arms[i].rotation.set(0, 0, sx * (flap + big + 0.05));
          hands[i].rotation.set(0, -sx * 0.05, sx * (flap * 0.5 - 0.05));
          legs[i].rotation.x = a.flying ? 1.25 : 0;
          shins[i].rotation.x = a.flying ? 0.3 : 0;
        } else {
          const sw = Math.sin(a.phase + i * Math.PI) * 0.4 * m;
          arms[i].rotation.set(-0.2 + sw, 0, -sx * 1.47);
          hands[i].rotation.set(0, sx * 2.9, 0);
          legs[i].rotation.x = -sw;
          shins[i].rotation.x = Math.max(0, sw) * 0.5;
        }
      }
      body.rotation.x = a.flying ? -0.05 : 0.1;
      body.position.y = 2.35 + (a.flying ? Math.sin(a.t * 4.5 + 1.5) * 0.12 : 0);
      n1.rotation.x = (a.flying ? 1.05 : 0) + s * 0.35;
      n2.rotation.x = (a.flying ? 0.3 : 0) + s * 0.45 + Math.sin(a.t * 1.3) * 0.04;
      head.rotation.x = a.flying ? -1.25 : 0.25;
      jaw.rotation.x = s * 0.45 + gust * 0.3;
    },
  };
}

// ---------------------------------------------------------------------------
function mosa(p, id) {
  const g = new THREE.Group();
  const sk = skin(p.main, p.belly, p.dark, { mottle: 0.45 });
  const body = J(0, 0.85, 0, part(id + 'body', (k) => {
    k.tube([[0, 0, -1.75, 0.72, 0.68], [0, 0.05, -0.3, 0.95, 0.88], [0, 0.05, 1.2, 0.85, 0.78], [0, 0.05, 2.3, 0.58, 0.54], [0, 0.08, 2.8, 0.5, 0.46]],
      { color: sk, radial: 18, steps: 5 });
  }));
  const upper = [[0, 0.05, 0, 0.5, 0.42], [0, 0.08, 0.8, 0.44, 0.34], [0, 0.02, 1.7, 0.28, 0.22], [0, -0.05, 2.45, 0.11, 0.1]];
  const lower = [[0, 0, 0, 0.42, 0.2], [0, -0.03, 0.9, 0.36, 0.15], [0, 0, 1.8, 0.2, 0.08], [0, 0.02, 2.28, 0.08, 0.05]];
  const jaw = J(0, -0.2, 0.15, part(id + 'jaw', (k) => {
    k.tube(lower, { color: skin(p.belly, p.belly, p.dark, {}), radial: 12 });
    for (let z = 0.5; z <= 2.15; z += 0.16) {
      const [cy, rx] = sectionAt(lower, z);
      for (const sx of [-1, 1]) k.spike(0.04, 0.16, IVORY, [sx * rx * 0.8, cy + 0.08, z], [0, 0, 0]);
    }
  }));
  const head = J(0, 0.12, 2.7, part(id + 'head', (k) => {
    k.tube(upper, { color: sk, radial: 14 });
    for (let z = 0.6; z <= 2.3; z += 0.16) {
      const [cy, rx, ry] = sectionAt(upper, z);
      for (const sx of [-1, 1]) k.spike(0.04, 0.17, IVORY, [sx * rx * 0.78, cy - ry * 0.65, z], [Math.PI, 0, 0]);
    }
    k.blob(0.06, 0.04, 0.06, 0x111111, [-0.08, 0.14, 2.2]); k.blob(0.06, 0.04, 0.06, 0x111111, [0.08, 0.14, 2.2]);
    eyes(k, 0.36, 0.25, 0.75, 0.07, 0x6a5a10);
  }), jaw);
  const fluke = (k) => {
    k.blob(0.07, 0.95, 0.36, p.dark, [0, -0.85, -1.75], [-0.6, 0, 0]);  // big lower lobe
    k.blob(0.06, 0.5, 0.26, p.dark, [0, 0.2, -1.75], [0.75, 0, 0]);     // small upper lobe
  };
  const t3 = J(0, -0.05, -2.0, part(id + 't3', (k) => {
    k.tube([[0, 0, 0.05, 0.22, 0.24], [0, -0.1, -0.9, 0.13, 0.15], [0, -0.25, -1.65, 0.06, 0.07]], { color: sk });
    fluke(k);
  }));
  const t2 = J(0, -0.05, -2.0, part(id + 't2', (k) => {
    k.tube([[0, 0, 0.05, 0.45, 0.44], [0, -0.03, -1.0, 0.33, 0.35], [0, -0.05, -2.02, 0.22, 0.24]], { color: sk });
  }), t3);
  const t1 = J(0, 0, -1.65, part(id + 't1', (k) => {
    k.tube([[0, 0, 0.15, 0.7, 0.66], [0, -0.02, -1.0, 0.58, 0.55], [0, -0.05, -2.02, 0.45, 0.44]], { color: sk });
  }), t2);
  const fins = [];
  for (const [z, len, w, name] of [[1.4, 0.85, 0.32, 'f'], [-1.3, 0.6, 0.25, 'r']]) for (const sx of [-1, 1]) {
    const fin = J(sx * 0.78, -0.42, z, part(id + 'fin' + name + sx, (k) => {
      k.blob(len, 0.07, w, p.dark, [sx * len * 0.85, 0, -0.1], [0, sx * 0.45, 0]);
    }));
    fin.userData.sx = sx;
    fins.push(fin);
  }
  body.add(head, t1, ...fins);
  g.add(body);
  return {
    group: g,
    animate(a) {
      const m = Math.min(1, a.move), w = a.phase;
      t1.rotation.y = Math.sin(w) * 0.13 * m + Math.sin(a.t * 1.2) * 0.05;
      t2.rotation.y = Math.sin(w - 0.9) * 0.22 * m + Math.sin(a.t * 1.2 - 0.6) * 0.08;
      t3.rotation.y = Math.sin(w - 1.8) * 0.32 * m + Math.sin(a.t * 1.2 - 1.2) * 0.12;
      body.rotation.y = -Math.sin(w) * 0.04 * m;
      fins.forEach((f, i) => { f.rotation.z = f.userData.sx * Math.sin(a.t * 2 + i) * 0.15; f.rotation.y = Math.sin(a.t * 2 + i) * 0.15; });
      const s = bump(a.attack), leap = a.special > 0 ? 1 : 0;
      jaw.rotation.x = 0.03 + s * 0.75 + leap * 0.5;
      head.rotation.x = -s * 0.2;
      body.rotation.x = -leap * 0.35;
    },
  };
}

export const DETAILED = { anky, pachy, brachio, quetz, mosa };

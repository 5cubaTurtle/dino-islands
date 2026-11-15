// The island: heightmap terrain, water, scenery, food sources and nests.
import * as THREE from 'three';

export const ISLAND_R = 300;
export const ZONES = {
  jungle: { x: 140, z: 90, r: 100 },
  plains: { x: -120, z: 110, r: 100 },
  lake: { x: 30, z: -20, r: 38 },
  canyon: { x: -160, z: -70, r: 80 },
  volcano: { x: 20, z: -195, r: 75 },
};
export const NESTS = [
  { x: 0, z: 35 }, { x: 85, z: 55 }, { x: -70, z: 75 }, { x: -105, z: -35 }, { x: -30, z: -60 },
];
const RIVER = { x1: 30, z1: -20, x2: 310, z2: -70 };

// ---- noise -----------------------------------------------------------------
function hash(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7 + 13.37) * 43758.5453;
  return n - Math.floor(n);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); a *= 0.5; f *= 2; }
  return s / 0.9375;
}
// smooth 0..1 as x goes from e0 to e1 (works with e0 > e1 too)
function sstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
const lerp = (a, b, t) => a + (b - a) * t;
function zoneW(name, x, z, inner = 0.55) {
  const c = ZONES[name];
  return sstep(c.r, c.r * inner, Math.hypot(x - c.x, z - c.z));
}
function riverDist(x, z) {
  const vx = RIVER.x2 - RIVER.x1, vz = RIVER.z2 - RIVER.z1;
  const t = Math.min(1, Math.max(0, ((x - RIVER.x1) * vx + (z - RIVER.z1) * vz) / (vx * vx + vz * vz)));
  const wig = Math.sin(t * 14) * 9;
  return Math.hypot(x - (RIVER.x1 + vx * t), z - (RIVER.z1 + vz * t) - wig);
}

function rawHeight(x, z) {
  const d = Math.hypot(x, z);
  let h = 3 + fbm(x * 0.012 + 5, z * 0.012 + 9) * 14 + fbm(x * 0.05, z * 0.05) * 2.5;
  const pw = zoneW('plains', x, z);
  h = lerp(h, 6 + (h - 6) * 0.25, pw);
  const cw = zoneW('canyon', x, z);
  h += cw * Math.abs(fbm(x * 0.05 + 40, z * 0.05) - 0.5) * 16;
  const v = ZONES.volcano, dv = Math.hypot(x - v.x, z - v.z);
  let vh = Math.max(0, 1 - dv / v.r) * 70;
  if (dv < 16) vh = 70 * (1 - 16 / v.r) - (16 - dv) * 0.8;
  h += vh;
  h = lerp(h, -1.4, sstep(10, 4, riverDist(x, z)));
  h = lerp(h, -3, zoneW('lake', x, z, 0.45));
  h = lerp(-6, h, sstep(295, 225, d));
  return h;
}

// ---- height grid (matches the rendered mesh) -------------------------------
const SIZE = 720, SEG = 240, CELL = SIZE / SEG, NV = SEG + 1;
const grid = new Float32Array(NV * NV);
let gridReady = false;
function buildGrid() {
  for (let iz = 0; iz < NV; iz++) for (let ix = 0; ix < NV; ix++) {
    grid[iz * NV + ix] = rawHeight(-SIZE / 2 + ix * CELL, -SIZE / 2 + iz * CELL);
  }
  gridReady = true;
}
export function getHeight(x, z) {
  if (!gridReady) buildGrid();
  const fx = (x + SIZE / 2) / CELL, fz = (z + SIZE / 2) / CELL;
  if (fx < 0 || fz < 0 || fx >= SEG || fz >= SEG) return -6;
  const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz;
  const i = iz * NV + ix;
  const a = grid[i], b = grid[i + 1], c = grid[i + NV], d = grid[i + NV + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function zoneAt(x, z) {
  for (const name of ['volcano', 'lake', 'canyon', 'jungle', 'plains']) {
    const c = ZONES[name];
    if (Math.hypot(x - c.x, z - c.z) < c.r) return name;
  }
  return 'grass';
}
/** Lowest ground height around a point: used to detect a shoreline to drink from. */
export function waterNear(x, z, r) {
  let m = getHeight(x, z);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    m = Math.min(m, getHeight(x + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  return m < 0.15;
}

// ---- solid obstacles (trees, rocks, nests) ---------------------------------
// Each is an upright cylinder: { x, z, r, top }. Stored in a coarse grid so a
// dinosaur only tests the few obstacles around it.
const CCELL = 8;
const colliders = new Map();
const ckey = (cx, cz) => cx * 4096 + cz;
function addCollider(x, z, r, top) {
  const k = ckey(Math.floor(x / CCELL), Math.floor(z / CCELL));
  let list = colliders.get(k);
  if (!list) colliders.set(k, list = []);
  list.push({ x, z, r, top });
}
/** Push a position (feet at pos.y) out of any obstacle it overlaps. Returns true on contact. */
export function collide(pos, radius) {
  const cx = Math.floor(pos.x / CCELL), cz = Math.floor(pos.z / CCELL);
  let hit = false;
  for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
    const list = colliders.get(ckey(ix, iz));
    if (!list) continue;
    for (const c of list) {
      if (pos.y >= c.top) continue; // above it: fly or jump over
      const dx = pos.x - c.x, dz = pos.z - c.z, min = c.r + radius;
      if (Math.abs(dx) >= min || Math.abs(dz) >= min) continue;
      const d = Math.hypot(dx, dz);
      if (d >= min) continue;
      if (d < 1e-3) { pos.x += min; hit = true; continue; }
      pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min;
      hit = true;
    }
  }
  return hit;
}

function mulberry(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COL = {
  sand: new THREE.Color(0xecd9a0), grass: new THREE.Color(0x86cf58), jungle: new THREE.Color(0x3f9b4b),
  plains: new THREE.Color(0xb5d76a), canyon: new THREE.Color(0xc0915f), rock: new THREE.Color(0x5b5552),
  lava: new THREE.Color(0xc0452a), bed: new THREE.Color(0xc9bb86),
};
function groundColor(x, z, h, out) {
  if (h < 0) return out.copy(COL.bed);
  out.copy(COL.grass);
  out.lerp(COL.jungle, zoneW('jungle', x, z, 0.6));
  out.lerp(COL.plains, zoneW('plains', x, z, 0.6));
  out.lerp(COL.canyon, zoneW('canyon', x, z, 0.6));
  const v = ZONES.volcano, dv = Math.hypot(x - v.x, z - v.z);
  out.lerp(COL.rock, sstep(v.r, v.r * 0.7, dv));
  out.lerp(COL.lava, sstep(26, 14, dv));
  out.lerp(COL.sand, sstep(2.0, 0.6, h));
  const n = 0.92 + hash(Math.floor(x / 3), Math.floor(z / 3)) * 0.16;
  out.multiplyScalar(n);
  return out;
}

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

export class World {
  constructor(scene) {
    this.scene = scene;
    if (!gridReady) buildGrid();
    const rnd = mulberry(20261115);
    this.rnd = rnd;

    // terrain
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const ix = Math.round((x + SIZE / 2) / CELL), iz = Math.round((z + SIZE / 2) / CELL);
      const h = grid[iz * NV + ix];
      pos.setY(i, h);
      groundColor(x, z, h, c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

    // water
    const water = new THREE.Mesh(new THREE.CircleGeometry(1800, 48),
      new THREE.MeshLambertMaterial({ color: 0x35a5e6, transparent: true, opacity: 0.78 }));
    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    this.water = water;

    // lava pool in the crater
    const v = ZONES.volcano;
    this.lava = new THREE.Mesh(new THREE.CircleGeometry(15, 20), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
    this.lava.rotation.x = -Math.PI / 2;
    this.lava.position.set(v.x, getHeight(v.x, v.z) + 2.5, v.z);
    scene.add(this.lava);

    this.buildTrees(rnd);
    this.buildRocks(rnd);
    this.buildClouds(rnd);
    this.buildNests();
    this.buildBushes(rnd);
    this.buildFish(rnd);
  }

  /** Random dry-land spot inside a disc, or null if none found. */
  landSpot(rnd, cx, cz, r, minH = 1.5) {
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.hypot(x, z) < 270 && getHeight(x, z) > minH) return { x, z };
    }
    return null;
  }

  buildTrees(rnd) {
    const spots = [];
    const ok = (s) => s && !['volcano', 'lake'].includes(zoneAt(s.x, s.z))
      && Math.hypot(s.x - 150, s.z - 100) > 24
      && NESTS.every((n) => Math.hypot(s.x - n.x, s.z - n.z) > 9);
    const j = ZONES.jungle;
    for (let i = 0; i < 380; i++) { const s = this.landSpot(rnd, j.x, j.z, j.r); if (ok(s)) spots.push(s); }
    for (let i = 0; i < 170; i++) {
      const s = this.landSpot(rnd, 0, 0, 260);
      if (ok(s) && !['plains', 'canyon'].includes(zoneAt(s.x, s.z))) spots.push(s);
    }
    for (let i = 0; i < 14; i++) { const s = this.landSpot(rnd, ZONES.plains.x, ZONES.plains.z, 95); if (ok(s)) spots.push(s); }

    const trunkG = new THREE.CylinderGeometry(0.3, 0.5, 5, 6); trunkG.translate(0, 2.5, 0);
    const leafG = new THREE.ConeGeometry(2.8, 6.5, 7); leafG.translate(0, 7.2, 0);
    const trunks = new THREE.InstancedMesh(trunkG, lam(0x8b5a2b), spots.length);
    const leaves = new THREE.InstancedMesh(leafG, lam(0xffffff), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    spots.forEach((s, i) => {
      const k = 0.8 + rnd() * 0.9;
      p.set(s.x, getHeight(s.x, s.z) - 0.3, s.z);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 6.28);
      sc.set(k, k * (0.85 + rnd() * 0.4), k);
      m.compose(p, q, sc);
      addCollider(s.x, s.z, 0.6 * k, p.y + 10.4 * sc.y);
      trunks.setMatrixAt(i, m); leaves.setMatrixAt(i, m);
      col.setHSL(0.28 + rnd() * 0.1, 0.55, 0.28 + rnd() * 0.12);
      leaves.setColorAt(i, col);
    });
    this.scene.add(trunks, leaves);
  }

  buildRocks(rnd) {
    const spots = [];
    const cz = ZONES.canyon;
    for (let i = 0; i < 110; i++) { const s = this.landSpot(rnd, cz.x, cz.z, cz.r, 1); if (s) spots.push(s); }
    for (let i = 0; i < 50; i++) { const s = this.landSpot(rnd, ZONES.volcano.x, ZONES.volcano.z, 95, 1); if (s) spots.push(s); }
    for (let i = 0; i < 50; i++) { const s = this.landSpot(rnd, 0, 0, 265, 0.8); if (s) spots.push(s); }
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), lam(0xffffff), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    spots.forEach((s, i) => {
      const k = 0.5 + rnd() * rnd() * 3.2;
      p.set(s.x, getHeight(s.x, s.z) + k * 0.2, s.z);
      e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
      sc.set(k, k * (0.6 + rnd() * 0.6), k);
      m.compose(p, q, sc);
      if (k >= 0.8) addCollider(s.x, s.z, k * 0.8, p.y + k * 0.7); // pebbles are stepped over
      rocks.setMatrixAt(i, m);
      const gray = 0.42 + rnd() * 0.2;
      col.setRGB(gray * 1.05, gray, gray * 0.92);
      rocks.setColorAt(i, col);
    });
    this.scene.add(rocks);
  }

  buildClouds(rnd) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
    const geo = new THREE.SphereGeometry(1, 8, 6);
    this.clouds = [];
    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(geo, mat);
        s.position.set((k - 1.5) * 11 + rnd() * 5, rnd() * 4, rnd() * 8);
        s.scale.set(12 + rnd() * 8, 5 + rnd() * 3, 9 + rnd() * 5);
        cloud.add(s);
      }
      cloud.position.set((rnd() - 0.5) * 1100, 130 + rnd() * 50, (rnd() - 0.5) * 1100);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  buildNests() {
    const ringG = new THREE.TorusGeometry(2.2, 0.6, 6, 12);
    const eggG = new THREE.SphereGeometry(0.5, 8, 6);
    for (const n of NESTS) {
      const y = getHeight(n.x, n.z);
      n.y = y;
      addCollider(n.x, n.z, 2.8, y + 0.9);
      const ring = new THREE.Mesh(ringG, lam(0x9c6b3c));
      ring.rotation.x = Math.PI / 2; ring.position.set(n.x, y + 0.3, n.z);
      this.scene.add(ring);
      for (let i = 0; i < 3; i++) {
        const egg = new THREE.Mesh(eggG, lam(0xfdf6e3));
        egg.scale.y = 1.3;
        egg.position.set(n.x + Math.cos(i * 2.1) * 0.7, y + 0.6, n.z + Math.sin(i * 2.1) * 0.7);
        this.scene.add(egg);
      }
    }
  }

  buildBushes(rnd) {
    this.bushes = [];
    const leafG = new THREE.SphereGeometry(1.2, 7, 5), berryG = new THREE.SphereGeometry(0.22, 6, 4);
    const leafM = lam(0x2e8b57), berryM = lam(0xe63946);
    const place = (cx, cz, r, count) => {
      for (let i = 0; i < count; i++) {
        const s = this.landSpot(rnd, cx, cz, r, 1.8);
        if (!s || zoneAt(s.x, s.z) === 'volcano') continue;
        const grp = new THREE.Group();
        const leaf = new THREE.Mesh(leafG, leafM); leaf.scale.y = 0.75; leaf.position.y = 0.7;
        const berries = new THREE.Group();
        for (let k = 0; k < 7; k++) {
          const b = new THREE.Mesh(berryG, berryM);
          const a = k * 0.9, e = 0.3 + (k % 3) * 0.3;
          b.position.set(Math.cos(a) * Math.cos(e) * 1.15, 0.7 + Math.sin(e) * 0.85, Math.sin(a) * Math.cos(e) * 1.15);
          berries.add(b);
        }
        grp.add(leaf, berries);
        grp.position.set(s.x, getHeight(s.x, s.z), s.z);
        this.scene.add(grp);
        this.bushes.push({ x: s.x, z: s.z, y: grp.position.y, group: grp, berries, ready: true, regrow: 0 });
      }
    };
    place(ZONES.plains.x, ZONES.plains.z, 95, 18);
    place(ZONES.jungle.x, ZONES.jungle.z, 95, 10);
    place(0, 0, 250, 26);
  }

  buildFish(rnd) {
    this.fish = [];
    const bodyG = new THREE.SphereGeometry(0.45, 7, 5), tailG = new THREE.ConeGeometry(0.35, 0.6, 4);
    const mat = lam(0xff8c42);
    const add = (x, z) => {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(bodyG, mat); body.scale.set(0.5, 0.8, 1.5);
      const tail = new THREE.Mesh(tailG, mat); tail.rotation.x = Math.PI / 2; tail.position.z = -0.85;
      grp.add(body, tail);
      grp.position.set(x, -1, z);
      this.scene.add(grp);
      this.fish.push({ x, z, group: grp, phase: rnd() * 6.28, ready: true, regrow: 0 });
    };
    const l = ZONES.lake;
    for (let i = 0; i < 10; i++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * l.r * 0.55;
      add(l.x + Math.cos(a) * d, l.z + Math.sin(a) * d);
    }
    for (let i = 0; i < 12; i++) { // around the coast
      const a = i / 12 * 6.28 + rnd() * 0.3;
      add(Math.cos(a) * 292, Math.sin(a) * 292);
    }
  }

  update(dt, t) {
    for (const f of this.fish) {
      if (!f.ready) { f.regrow -= dt; if (f.regrow <= 0) { f.ready = true; f.group.visible = true; } continue; }
      const s = Math.sin(t * 1.4 + f.phase);
      f.group.position.y = -0.6 + Math.max(0, s) * 2.4;
      f.group.rotation.x = -Math.cos(t * 1.4 + f.phase) * 0.9;
      f.group.rotation.y = f.phase;
    }
    for (const b of this.bushes) {
      if (!b.ready) { b.regrow -= dt; if (b.regrow <= 0) { b.ready = true; b.berries.visible = true; } }
    }
    for (const c of this.clouds) { c.position.x += dt * 2; if (c.position.x > 600) c.position.x = -600; }
    const pulse = 0.85 + Math.sin(t * 2) * 0.15;
    this.lava.material.color.setRGB(1 * pulse, 0.45 * pulse, 0.1);
  }
}

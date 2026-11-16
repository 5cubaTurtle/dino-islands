// The islands: heightmap terrain, water, scenery, food sources and nests.
import * as THREE from 'three';
import { Kit } from './geom.js';

export const ISLAND_R = 300;
// Dino Island is the original island in the middle. Fern Island (big, to the
// east) is home to Ankylosaurus, Pachycephalosaurus and Brachiosaurus; Sky Rock
// (small, to the north) is where the Quetzalcoatlus roost.
export const ISLANDS = {
  main: { name: 'Dino Island', x: 0, z: 0, r: 300 },
  fern: { name: 'Fern Island', x: 600, z: -21, r: 210 },
  sky: { name: 'Sky Rock', x: -60, z: 432, r: 80 },
};
export const ZONES = {
  jungle: { x: 140, z: 90, r: 100 },
  plains: { x: -120, z: 110, r: 100 },
  lake: { x: 30, z: -20, r: 38 },
  canyon: { x: -160, z: -70, r: 80 },
  volcano: { x: 20, z: -195, r: 75 },
  fernLake: { x: 560, z: 30, r: 30 },
  forest: { x: 665, z: -75, r: 105 },
};
// Nests: where you start and wake up. Index 0 is the original starting nest.
export const NESTS = [
  { x: 0, z: 35 }, { x: 85, z: 55 }, { x: -70, z: 75 }, { x: -105, z: -35 }, { x: -30, z: -60 },
  { x: 520, z: -60, island: 'fern' }, { x: 640, z: 90, island: 'fern' }, { x: -60, z: 440, island: 'sky' },
];
// Open-sea spots where a Mosasaurus starts and wakes up.
export const SEA_SPAWNS = [{ x: 360, z: 40 }, { x: -20, z: 315 }, { x: -320, z: -90 }, { x: 130, z: -320 }, { x: 600, z: 230 }];

// The world map: a grid of CELL-metre squares covering every island.
const X0 = -360, X1 = 870, Z0 = -360, Z1 = 570;
export const WORLD_BOUNDS = { x0: X0, x1: X1, z0: Z0, z1: Z1 };
/** Which island a point is on (or near), or null out at sea. */
export function islandAt(x, z) {
  for (const id of ['main', 'fern', 'sky']) {
    const I = ISLANDS[id];
    if (Math.hypot(x - I.x, z - I.z) < I.r - (id === 'main' ? 40 : 30)) return id;
  }
  return null;
}
/** Keep a position inside the world map. */
export function clampToWorld(p) {
  p.x = Math.min(X1 - 15, Math.max(X0 + 15, p.x));
  p.z = Math.min(Z1 - 15, Math.max(Z0 + 15, p.z));
}
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

function mainHeight(x, z) {
  const d = Math.hypot(x, z);
  if (d > 296) return -6;
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

function fernHeight(x, z) {
  const I = ISLANDS.fern, d = Math.hypot(x - I.x, z - I.z);
  if (d > I.r + 26) return -6;
  let h = 3 + fbm(x * 0.011 + 31, z * 0.011 - 7) * 13 + fbm(x * 0.05 + 3, z * 0.05) * 2;
  const L = ZONES.fernLake, dl = Math.hypot(x - L.x, z - L.z);
  h = lerp(h, 3.5, sstep(L.r * 2.4, L.r * 1.25, dl)); // gentle slopes down to the lake
  h = lerp(h, -3, sstep(L.r, L.r * 0.35, dl));
  return lerp(-6, h, sstep(I.r + 25, I.r - 50, d));
}

function skyHeight(x, z) {
  const I = ISLANDS.sky, d = Math.hypot(x - I.x, z - I.z);
  if (d > I.r + 21) return -6;
  const h = 2 + 24 * sstep(I.r - 8, 10, d) + (fbm(x * 0.07 + 11, z * 0.07 - 4) - 0.5) * 3;
  return lerp(-6, h, sstep(I.r + 20, I.r - 25, d));
}

function rawHeight(x, z) {
  return Math.max(mainHeight(x, z), fernHeight(x, z), skyHeight(x, z));
}

// ---- height grid (matches the rendered mesh) -------------------------------
const CELL = 3, NX = (X1 - X0) / CELL, NZ = (Z1 - Z0) / CELL, NV = NX + 1;
const grid = new Float32Array(NV * (NZ + 1));
let gridReady = false;
function buildGrid() {
  for (let iz = 0; iz <= NZ; iz++) for (let ix = 0; ix <= NX; ix++) {
    grid[iz * NV + ix] = rawHeight(X0 + ix * CELL, Z0 + iz * CELL);
  }
  gridReady = true;
}
export function getHeight(x, z) {
  if (!gridReady) buildGrid();
  const fx = (x - X0) / CELL, fz = (z - Z0) / CELL;
  if (fx < 0 || fz < 0 || fx >= NX || fz >= NZ) return -6;
  const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz;
  const i = iz * NV + ix;
  const a = grid[i], b = grid[i + 1], c = grid[i + NV], d = grid[i + NV + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function zoneAt(x, z) {
  for (const name of ['volcano', 'lake', 'canyon', 'jungle', 'plains', 'fernLake', 'forest']) {
    const c = ZONES[name];
    if (Math.hypot(x - c.x, z - c.z) < c.r) return name;
  }
  const isl = islandAt(x, z);
  return isl === 'fern' ? 'fern' : isl === 'sky' ? 'sky' : 'grass';
}
// The lava surface sits this far above the lowest point of the crater. The
// crater floor rises about 0.8 m per metre, so 8 gives a pool ~10 m in radius.
const LAVA_DEPTH = 8;
const lavaLevel = () => getHeight(ZONES.volcano.x, ZONES.volcano.z) + LAVA_DEPTH;
/** True when a dinosaur's feet are below the surface of the volcano's lava pool. */
export function inLava(pos) {
  const v = ZONES.volcano;
  return Math.hypot(pos.x - v.x, pos.z - v.z) < 15 && pos.y < lavaLevel();
}
/** How steep the ground is at a point: metres of rise per metre (1 = 45 degrees). */
export function slopeAt(x, z, out) {
  const e = 0.6;
  const gx = (getHeight(x + e, z) - getHeight(x - e, z)) / (2 * e);
  const gz = (getHeight(x, z + e) - getHeight(x, z - e)) / (2 * e);
  if (out) { out.x = gx; out.z = gz; }
  return Math.hypot(gx, gz);
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
/**
 * What kind of water is within reach: 'salt' (the sea), 'fresh' (lake or river) or null.
 * The sea only starts beyond 225 m from the middle of the island; the river stays
 * fresh all the way to its mouth. Fresh water wins when both are in reach.
 */
export function waterKind(x, z, r) {
  let kind = null;
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI / 3, k = i < 6 ? r : 0;
    const sx = x + Math.cos(a) * k, sz = z + Math.sin(a) * k;
    if (getHeight(sx, sz) >= 0.15) continue;
    const L = ZONES.fernLake;
    if (Math.hypot(sx, sz) <= 225 || riverDist(sx, sz) < 12 || Math.hypot(sx - L.x, sz - L.z) < L.r + 6) return 'fresh';
    kind = 'salt';
  }
  return kind;
}

const TREE_HITS = 4; // horn hits it takes to break a tree

// ---- log bridges -----------------------------------------------------------
// A tree that falls across water stays where it lands as a bridge. Each is a
// straight walkway: starts at (x, z), runs `len` metres along (fx, fz), its top
// is at height y there and rises `rise` metres per metre. Only light dinosaurs
// are held up by it (see entity.js).
const BRIDGE_HALF_WIDTH = 1.1;
const bridges = [];
/** Height of the top of a log bridge under (x, z), or -Infinity if there is none. */
export function bridgeAt(x, z) {
  let top = -Infinity;
  for (const b of bridges) {
    const dx = x - b.x, dz = z - b.z;
    const s = dx * b.fx + dz * b.fz;
    if (s < -0.5 || s > b.len) continue;
    if (Math.abs(dx * b.fz - dz * b.fx) > BRIDGE_HALF_WIDTH) continue;
    top = Math.max(top, b.y + s * b.rise);
  }
  return top;
}
const treeM = new THREE.Matrix4(), treeQ = new THREE.Quaternion(), treeS = new THREE.Vector3(), treeAxis = new THREE.Vector3();

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
  const c = { x, z, r, top };
  list.push(c);
  return c;
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
  fern: new THREE.Color(0x5aa844), forest: new THREE.Color(0x3e8a3a), cliff: new THREE.Color(0x8a8172),
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
  const F = ISLANDS.fern, S = ISLANDS.sky;
  if (Math.hypot(x - F.x, z - F.z) < F.r + 30) {
    out.lerp(COL.fern, 0.7);
    out.lerp(COL.forest, zoneW('forest', x, z, 0.5));
  }
  if (Math.hypot(x - S.x, z - S.z) < S.r + 25) out.lerp(COL.cliff, sstep(5, 14, h) * 0.8);
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
    // The new islands use their own random stream so Dino Island stays exactly as it was.
    const rnd2 = mulberry(5150);

    // terrain: one mesh per island (the open sea floor between them is a flat plane)
    const ground = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const [x0, x1, z0, z1] of [[-360, 360, -360, 360], [360, 840, -261, 219], [-168, 48, 360, 540]]) {
      scene.add(new THREE.Mesh(this.terrainPatch(x0, x1, z0, z1), ground));
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: COL.bed }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(250, -6.05, 100);
    scene.add(floor);

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
    this.lava.position.set(v.x, lavaLevel(), v.z);
    scene.add(this.lava);

    this.buildTrees(rnd, rnd2);
    this.buildRocks(rnd, rnd2);
    this.buildClouds(rnd);
    this.buildNests();
    this.buildBushes(rnd, rnd2);
    this.buildFish(rnd, rnd2);
    this.buildTallTrees(rnd2);
    this.buildFerns(rnd2);
  }

  /** Terrain mesh for the grid squares inside x0..x1, z0..z1 (multiples of CELL). */
  terrainPatch(x0, x1, z0, z1) {
    const w = x1 - x0, d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d, w / CELL, d / CELL);
    g.rotateX(-Math.PI / 2);
    g.translate(x0 + w / 2, 0, z0 + d / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const ix = Math.round((x - X0) / CELL), iz = Math.round((z - Z0) / CELL);
      const h = grid[iz * NV + ix];
      pos.setY(i, h);
      groundColor(x, z, h, c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }

  /** Random dry-land spot inside a disc, or null if none found. */
  landSpot(rnd, cx, cz, r, minH = 1.5) {
    const F = ISLANDS.fern, S = ISLANDS.sky;
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const inside = Math.hypot(x, z) < 270 || Math.hypot(x - F.x, z - F.z) < F.r - 30 || Math.hypot(x - S.x, z - S.z) < S.r - 12;
      if (inside && getHeight(x, z) > minH) return { x, z };
    }
    return null;
  }

  buildTrees(rnd, rnd2) {
    this.trees = [];
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
    // Fern Island: woods everywhere except the lake shore and the nests
    const F = ISLANDS.fern, extra = [];
    const ok2 = (s) => s && zoneAt(s.x, s.z) !== 'fernLake' && NESTS.every((n) => Math.hypot(s.x - n.x, s.z - n.z) > 10);
    for (let i = 0; i < 240; i++) { const s = this.landSpot(rnd2, F.x, F.z, F.r - 40); if (ok2(s)) extra.push(s); }
    // Tall trees along the river banks, mostly on the jungle (north) side, close
    // enough to the water that a Triceratops can knock them across as bridges.
    const rnd3 = mulberry(4242), bank = [];
    const vx = RIVER.x2 - RIVER.x1, vz = RIVER.z2 - RIVER.z1, vl = Math.hypot(vx, vz);
    const nx = -vz / vl, nz = vx / vl; // points north, toward the jungle
    const taken = (s) => [...spots, ...bank].some((o) => Math.hypot(o.x - s.x, o.z - s.z) < 5)
      || NESTS.some((n) => Math.hypot(s.x - n.x, s.z - n.z) < 10);
    for (let i = 0; i < 160 && bank.length < 26; i++) {
      const t = 0.12 + rnd3() * 0.62;
      const side = rnd3() < 0.75 ? 1 : -1, off = 6.5 + rnd3() * 2;
      const cx = RIVER.x1 + vx * t, cz = RIVER.z1 + vz * t + Math.sin(t * 14) * 9; // centre of the winding river
      const s = { x: cx + nx * off * side, z: cz + nz * off * side };
      if (getHeight(s.x, s.z) > 1 && Math.hypot(s.x, s.z) < 255 && riverDist(s.x, s.z) > 6 && !taken(s)) bank.push(s);
    }

    const trunkG = new THREE.CylinderGeometry(0.3, 0.5, 5, 6); trunkG.translate(0, 2.5, 0);
    const leafG = new THREE.ConeGeometry(2.8, 6.5, 7); leafG.translate(0, 7.2, 0);
    const total = spots.length + extra.length + bank.length;
    const trunks = new THREE.InstancedMesh(trunkG, lam(0x8b5a2b), total);
    const leaves = new THREE.InstancedMesh(leafG, lam(0xffffff), total);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    const place = (s, i, rnd, minK = 0.8) => {
      const k = minK + rnd() * (1.7 - minK);
      p.set(s.x, getHeight(s.x, s.z) - 0.3, s.z);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 6.28);
      sc.set(k, k * (0.85 + rnd() * 0.4), k);
      m.compose(p, q, sc);
      const collider = addCollider(s.x, s.z, 0.6 * k, p.y + 10.4 * sc.y);
      this.trees.push({
        i, x: s.x, z: s.z, r: 0.6 * k, collider, pos: p.clone(), quat: q.clone(), scale: sc.clone(),
        hits: 0, lean: 0, leanTo: 0, fx: 0, fz: 1, state: 'up', t: 0,
      });
      trunks.setMatrixAt(i, m); leaves.setMatrixAt(i, m);
      col.setHSL(0.28 + rnd() * 0.1, 0.55, 0.28 + rnd() * 0.12);
      leaves.setColorAt(i, col);
    };
    spots.forEach((s, i) => place(s, i, rnd));
    extra.forEach((s, j) => place(s, spots.length + j, rnd2));
    bank.forEach((s, j) => place(s, spots.length + extra.length + j, rnd3, 1.4)); // tall enough to span the river
    this.scene.add(trunks, leaves);
    this.treeMeshes = [trunks, leaves];
  }

  /**
   * Horns hit the nearest standing tree in front of (x, z) facing (fx, fz).
   * Each hit makes it lean; the TREE_HITS-th breaks it. Returns the tree
   * (with tree.state === 'falling' if this hit broke it) or null.
   */
  hitTree(x, z, fx, fz, reach, skip) {
    let best = null, bd = Infinity;
    for (const tr of this.trees) {
      if (tr.state !== 'up' || (skip && skip.has(tr))) continue;
      const dx = tr.x - x, dz = tr.z - z;
      if (Math.abs(dx) > reach + tr.r || Math.abs(dz) > reach + tr.r) continue;
      const d = Math.hypot(dx, dz);
      if (d > reach + tr.r || d >= bd) continue;
      if (d > 0.5 && (dx * fx + dz * fz) / d < 0.3) continue;
      best = tr; bd = d;
    }
    if (!best) return null;
    const dx = best.x - x, dz = best.z - z, d = Math.hypot(dx, dz) || 1;
    best.fx = dx / d; best.fz = dz / d; // it leans, then falls, away from the hit
    best.hits++;
    if (best.hits >= TREE_HITS) {
      best.state = 'falling'; best.t = 0;
      best.collider.top = -Infinity; // no longer solid
      // Work out how it comes to rest: lying on the ground (or the water) along
      // its length, and whether any of it is over water, which makes it a bridge.
      const len = 9.5 * best.scale.y;
      let tilt = -0.55;
      best.bridge = false;
      for (let s = 2; s <= len; s += 1) {
        const h = getHeight(best.x + best.fx * s, best.z + best.fz * s);
        if (h < 0) best.bridge = true;
        tilt = Math.max(tilt, Math.asin(Math.max(-0.55, Math.min(0.55, (Math.max(h, 0) - best.pos.y) / s))));
      }
      best.len = len;
      best.leanEnd = Math.PI / 2 - tilt;
    } else best.leanTo = best.hits * 0.09;
    return best;
  }

  updateTrees(dt) {
    let dirty = false;
    for (const tr of this.trees) {
      let s = 1;
      if (tr.state === 'up') {
        if (tr.lean === tr.leanTo) continue;
        tr.lean = Math.min(tr.leanTo, tr.lean + dt * 0.8);
      } else if (tr.state === 'falling') {
        tr.t += dt;
        if (tr.lean >= tr.leanEnd) {
          if (tr.bridge) { // across water: it stays as a bridge
            const sin = Math.sin(tr.leanEnd), cos = Math.cos(tr.leanEnd);
            bridges.push({ x: tr.x, z: tr.z, fx: tr.fx, fz: tr.fz, len: tr.len * sin, y: tr.pos.y + 0.4 * tr.scale.x, rise: cos / sin });
            tr.state = 'bridge';
          } else if (tr.t > 8) { tr.state = 'fading'; tr.t = 0; } // on dry land it fades away after a while
          continue;
        }
        tr.lean = Math.min(tr.leanEnd, tr.lean + (0.6 + tr.t * 5) * dt); // speeds up as it goes over
      } else if (tr.state === 'fading') {
        tr.t += dt;
        s = Math.max(0, 1 - tr.t / 0.6);
        if (s === 0) tr.state = 'gone';
      } else continue;
      treeAxis.set(tr.fz, 0, -tr.fx);
      treeQ.setFromAxisAngle(treeAxis, tr.lean).multiply(tr.quat);
      treeS.copy(tr.scale).multiplyScalar(s);
      treeM.compose(tr.pos, treeQ, treeS);
      for (const mesh of this.treeMeshes) mesh.setMatrixAt(tr.i, treeM);
      dirty = true;
    }
    if (dirty) for (const mesh of this.treeMeshes) mesh.instanceMatrix.needsUpdate = true;
  }

  buildRocks(rnd, rnd2) {
    const spots = [];
    const cz = ZONES.canyon;
    for (let i = 0; i < 110; i++) { const s = this.landSpot(rnd, cz.x, cz.z, cz.r, 1); if (s) spots.push(s); }
    for (let i = 0; i < 50; i++) { const s = this.landSpot(rnd, ZONES.volcano.x, ZONES.volcano.z, 95, 1); if (s) spots.push(s); }
    for (let i = 0; i < 50; i++) { const s = this.landSpot(rnd, 0, 0, 265, 0.8); if (s) spots.push(s); }
    const extra = [];
    const S = ISLANDS.sky, F = ISLANDS.fern;
    const clear = (s) => s && NESTS.every((n) => Math.hypot(s.x - n.x, s.z - n.z) > 8);
    for (let i = 0; i < 45; i++) { const s = this.landSpot(rnd2, S.x, S.z, S.r - 12, 1); if (clear(s)) extra.push(s); }
    for (let i = 0; i < 30; i++) { const s = this.landSpot(rnd2, F.x, F.z, F.r - 30, 0.8); if (clear(s)) extra.push(s); }
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), lam(0xffffff), spots.length + extra.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    const place = (s, i, rnd) => {
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
    };
    spots.forEach((s, i) => place(s, i, rnd));
    extra.forEach((s, j) => place(s, spots.length + j, rnd2));
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

  buildBushes(rnd, rnd2) {
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
    // Fern Island meadows (a separate random stream keeps Dino Island unchanged)
    const F = ISLANDS.fern;
    rnd = rnd2;
    place(F.x - 40, F.z + 40, 110, 16);
    place(F.x, F.z, F.r - 40, 14);
  }

  buildFish(rnd, rnd2) {
    this.fish = [];
    const fishGeo = (color, fin) => {
      const k = new Kit();
      k.blob(0.23, 0.36, 0.68, color, [0, 0, 0]);
      k.add(new THREE.ConeGeometry(0.35, 0.6, 4), color, { p: [0, 0, -0.85], r: [-Math.PI / 2, 0, 0], s: [0.3, 1, 1] });
      k.add(new THREE.ConeGeometry(0.2, 0.4, 4), fin, { p: [0, 0.35, -0.1], s: [0.2, 1, 1] });
      k.blob(0.05, 0.05, 0.05, 0x111111, [0.17, 0.08, 0.42]); k.blob(0.05, 0.05, 0.05, 0x111111, [-0.17, 0.08, 0.42]);
      return k.geometry();
    };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const lakeG = fishGeo(0xff8c42, 0xe0602a), seaG = fishGeo(0x9fbfd2, 0x56788f);
    const add = (x, z, geo, swim = null, r = rnd) => {
      const grp = new THREE.Mesh(geo, mat);
      grp.position.set(x, -1, z);
      this.scene.add(grp);
      this.fish.push({ x, z, group: grp, phase: r() * 6.28, ready: true, regrow: 0, swim });
    };
    const l = ZONES.lake;
    for (let i = 0; i < 10; i++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * l.r * 0.55;
      add(l.x + Math.cos(a) * d, l.z + Math.sin(a) * d, lakeG);
    }
    for (let i = 0; i < 12; i++) { // around the coast
      const a = i / 12 * 6.28 + rnd() * 0.3;
      add(Math.cos(a) * 292, Math.sin(a) * 292, seaG);
    }
    // More fish out at sea for the Mosasaurus: small schools swimming in circles
    const school = (cx, cz, n) => {
      for (let i = 0; i < n; i++) {
        const x = cx + (rnd2() - 0.5) * 8, z = cz + (rnd2() - 0.5) * 8;
        if (getHeight(x, z) > -2.5) continue;
        const swim = { cx: x, cz: z, r: 2 + rnd2() * 4, w: (0.25 + rnd2() * 0.3) * (rnd2() < 0.5 ? -1 : 1), a: rnd2() * 6.28 };
        add(x, z, seaG, swim, rnd2);
      }
    };
    const ring = (I, d, count) => {
      for (let i = 0; i < count; i++) {
        const a = i / count * 6.28 + rnd2() * 0.4;
        school(I.x + Math.cos(a) * d, I.z + Math.sin(a) * d, 3);
      }
    };
    ring(ISLANDS.main, 312, 12);
    ring(ISLANDS.fern, ISLANDS.fern.r + 12, 12);
    ring(ISLANDS.sky, ISLANDS.sky.r + 14, 6);
    for (let i = 0; i < 14; i++) { // in the open sea between the islands
      const x = X0 + 30 + rnd2() * (X1 - X0 - 60), z = Z0 + 30 + rnd2() * (Z1 - Z0 - 60);
      if (getHeight(x, z) < -5.5) school(x, z, 3);
    }
    const L = ZONES.fernLake; // a few in Fern Island's lake too
    for (let i = 0; i < 6; i++) {
      const a = rnd2() * 6.28, d = Math.sqrt(rnd2()) * L.r * 0.5;
      add(L.x + Math.cos(a) * d, L.z + Math.sin(a) * d, lakeG, null, rnd2);
    }
  }

  /** Tall trees with leaves high up: food for a Brachiosaurus. */
  buildTallTrees(rnd) {
    this.tallTrees = [];
    const spots = [];
    const free = (s) => s && this.trees.every((t) => Math.abs(t.x - s.x) > 4 || Math.abs(t.z - s.z) > 4)
      && NESTS.every((n) => Math.hypot(s.x - n.x, s.z - n.z) > 12)
      && spots.every((o) => Math.hypot(o.x - s.x, o.z - s.z) > 9)
      && !['fernLake', 'lake', 'volcano'].includes(zoneAt(s.x, s.z));
    const F = ZONES.forest;
    for (let i = 0; i < 120 && spots.length < 34; i++) { const s = this.landSpot(rnd, F.x, F.z, F.r, 2); if (free(s)) spots.push(s); }
    const I = ISLANDS.fern;
    for (let i = 0; i < 60 && spots.length < 46; i++) { const s = this.landSpot(rnd, I.x, I.z, I.r - 45, 2); if (free(s)) spots.push(s); }
    for (const [cx, cz] of [[-120, 110], [-60, 20], [60, 120], [-150, -10]]) { // a few groves on Dino Island
      for (let i = 0; i < 10; i++) { const s = this.landSpot(rnd, cx, cz, 22, 2); if (free(s)) spots.push(s); }
    }

    const trunk = new Kit();
    trunk.add(new THREE.CylinderGeometry(0.35, 0.75, 18, 8), 0x6d4a2c, { p: [0, 9, 0] });
    for (let i = 0; i < 5; i++) { // bare branch stubs low on the trunk
      const a = i * 2.4;
      trunk.add(new THREE.CylinderGeometry(0.08, 0.14, 2.2, 5), 0x6d4a2c, { p: [Math.cos(a) * 0.9, 8 + i * 0.9, Math.sin(a) * 0.9], r: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1] });
    }
    const crown = new Kit(); // layered, umbrella-shaped crown like a monkey-puzzle tree
    for (const [y, r, h] of [[12.2, 4.8, 1.8], [14.2, 4.2, 1.8], [16.0, 3.4, 1.7], [17.6, 2.4, 1.6], [18.9, 1.3, 1.6]]) {
      crown.add(new THREE.ConeGeometry(r, h, 9), 0xffffff, { p: [0, y, 0] });
      crown.add(new THREE.SphereGeometry(r * 0.92, 9, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xbbbbbb, { p: [0, y - h / 2 + 0.05, 0], s: [1, 0.25, 1] });
    }
    const trunks = new THREE.InstancedMesh(trunk.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), spots.length);
    const crowns = new THREE.InstancedMesh(crown.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    spots.forEach((s, i) => {
      const k = 0.85 + rnd() * 0.35;
      p.set(s.x, getHeight(s.x, s.z) - 0.3, s.z);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 6.28);
      sc.set(k, k, k);
      m.compose(p, q, sc);
      trunks.setMatrixAt(i, m); crowns.setMatrixAt(i, m);
      col.setHSL(0.27 + rnd() * 0.06, 0.5, 0.22 + rnd() * 0.06);
      crowns.setColorAt(i, col);
      addCollider(s.x, s.z, 0.75 * k, p.y + 20 * k);
      this.tallTrees.push({ i, x: s.x, z: s.z, y: p.y, k, ready: true, regrow: 0, pos: p.clone(), quat: q.clone() });
    });
    this.scene.add(trunks, crowns);
    this.tallCrowns = crowns;
  }

  /** A Brachiosaurus ate the leaves: the crown shrinks back and regrows later. */
  eatTallTree(tr) {
    tr.ready = false; tr.regrow = 50;
    this.setCrown(tr, 0.45);
  }
  setCrown(tr, f) {
    const m = new THREE.Matrix4();
    m.compose(tr.pos, tr.quat, new THREE.Vector3(tr.k * f, tr.k, tr.k * f));
    this.tallCrowns.setMatrixAt(tr.i, m);
    this.tallCrowns.instanceMatrix.needsUpdate = true;
  }

  /** Clumps of ferns covering Fern Island (scenery only). */
  buildFerns(rnd) {
    const k = new Kit();
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      k.add(new THREE.ConeGeometry(0.28, 2.0, 4), i % 2 ? 0x4c8f35 : 0x5fa443, { p: [Math.cos(a) * 0.75, 0.55, Math.sin(a) * 0.75], r: [Math.sin(a) * 1.05, 0, -Math.cos(a) * 1.05], s: [1, 1, 0.35] });
    }
    const I = ISLANDS.fern, spots = [];
    for (let i = 0; i < 400; i++) { const s = this.landSpot(rnd, I.x, I.z, I.r - 35, 1.2); if (s && zoneAt(s.x, s.z) !== 'fernLake') spots.push(s); }
    const ferns = new THREE.InstancedMesh(k.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    spots.forEach((s, i) => {
      const sz = 0.7 + rnd() * 0.8;
      p.set(s.x, getHeight(s.x, s.z) - 0.1, s.z);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 6.28);
      m.compose(p, q, sc.set(sz, sz, sz));
      ferns.setMatrixAt(i, m);
    });
    this.scene.add(ferns);
  }

  update(dt, t) {
    this.updateTrees(dt);
    for (const f of this.fish) {
      if (!f.ready) { f.regrow -= dt; if (f.regrow <= 0) { f.ready = true; f.group.visible = true; } continue; }
      if (f.swim) { // sea fish swim round in circles and jump now and then
        const w = f.swim;
        w.a += w.w * dt;
        f.group.position.x = w.cx + Math.cos(w.a) * w.r;
        f.group.position.z = w.cz + Math.sin(w.a) * w.r;
        f.group.rotation.y = -w.a + (w.w > 0 ? 0 : Math.PI);
        const s = Math.sin(t * 0.9 + f.phase);
        f.group.position.y = -0.7 + Math.max(0, s - 0.6) * 4.5;
        f.group.rotation.x = s > 0.6 ? -Math.cos(t * 0.9 + f.phase) * 1.2 : 0;
        continue;
      }
      const s = Math.sin(t * 1.4 + f.phase);
      f.group.position.y = -0.6 + Math.max(0, s) * 2.4;
      f.group.rotation.x = -Math.cos(t * 1.4 + f.phase) * 0.9;
      f.group.rotation.y = f.phase;
    }
    for (const tr of this.tallTrees) {
      if (!tr.ready) { tr.regrow -= dt; if (tr.regrow <= 0) { tr.ready = true; this.setCrown(tr, 1); } }
    }
    for (const b of this.bushes) {
      if (!b.ready) { b.regrow -= dt; if (b.regrow <= 0) { b.ready = true; b.berries.visible = true; } }
    }
    for (const c of this.clouds) { c.position.x += dt * 2; if (c.position.x > 1100) c.position.x = -700; }
    const pulse = 0.85 + Math.sin(t * 2) * 0.15;
    this.lava.material.color.setRGB(1 * pulse, 0.2 * pulse, 0.02);
  }
}

// A dinosaur in the world: shared by the player and every wild dinosaur.
import * as THREE from 'three';
import { SPECIES } from './species.js';
import { buildDino } from './dinoModels.js';
import { getHeight, collide, slopeAt, bridgeAt, clampToWorld } from './world.js';

const shadowGeo = new THREE.CircleGeometry(1, 16);
shadowGeo.rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

export const SWIM_Y = -1.2;
export const groundAt = (x, z) => Math.max(getHeight(x, z), SWIM_Y);
const SHORE_Y = 0.5;      // ground this low is a beach or bank: always walkable
const SLIDE_SPEED = 7;    // how fast a dinosaur slips down ground too steep for it
const grad = { x: 0, z: 0 };
const LIGHT = new Set(['raptor', 'ptera']); // light enough to walk on a log bridge
const SWIM_DEPTH = -0.8; // a swimmer (Mosasaurus) needs water deeper than this
const deepEnough = (x, z) => getHeight(x, z) < SWIM_DEPTH;

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

export class Dino {
  constructor(scene, key, opts = {}) {
    this.scene = scene;
    this.key = key;
    this.spec = SPECIES[key];
    this.scale = opts.scale || 1;
    this.isPlayer = !!opts.isPlayer;
    this.radius = this.spec.radius * this.scale;
    this.light = LIGHT.has(key) && this.scale <= 1.2;
    this.swimmer = !!this.spec.swim; // lives in the water and cannot go on land
    this.onBridge = false;
    this.climb = this.spec.climb ?? 0.8; // steepest slope it can walk up (rise per metre)
    this.maxHp = this.hp = opts.hp || this.spec.hp;

    this.model = buildDino(key, opts.palette);
    this.model.group.scale.setScalar(this.scale);
    this.group = new THREE.Group();
    this.group.add(this.model.group);
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    scene.add(this.group, this.shadow);
    this.shadow.visible = !this.swimmer; // no shadow on the water

    this.pos = new THREE.Vector3();
    this.prev = new THREE.Vector3();
    this.vel = new THREE.Vector3();   // intended horizontal velocity for this frame
    this.kb = new THREE.Vector3();    // knockback, decays over time
    this.vy = 0;
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
    this.steep = false;               // standing on ground too steep for this species
    this.fallTop = 0;                 // highest point of the current fall
    this.fallDrop = 0;                // height of the last landing; read and cleared by the game
    this.hover = false;               // true = no gravity (flying)
    this.ko = false; this.koT = 0;
    this.invuln = 0; this.lastHit = -99;
    this.attackAnim = 0; this.attackDur = 0.3;
    this.specialAnim = 0;
    this.phase = Math.random() * 6; this.moveSpeed = 0;
  }

  place(x, z, y) {
    this.pos.set(x, y ?? groundAt(x, z), z);
    this.prev.copy(this.pos);
    this.vy = 0; this.kb.set(0, 0, 0);
    this.fallTop = this.pos.y; this.fallDrop = 0; this.steep = false;
  }

  /** True if stepping from ground height g0 to (x, z) means walking up a slope that is too steep. */
  tooSteepAt(x, z, g0) {
    const g = groundAt(x, z);
    return g > g0 && g > SHORE_Y && this.pos.y - g < 0.3 && slopeAt(x, z) > this.climb;
  }

  physics(dt) {
    const p = this.pos;
    const wasGround = this.onGround;
    const ox = p.x, oz = p.z;
    p.x += (this.vel.x + this.kb.x) * dt;
    p.z += (this.vel.z + this.kb.z) * dt;
    this.kb.multiplyScalar(Math.exp(-5 * dt));
    if (!this.hover) this.vy -= 30 * dt;
    p.y += this.vy * dt;
    collide(p, this.radius * 0.7); // trees, rocks and nests are solid
    if (this.swimmer) {
      // The water ends at the shore: a swimmer can't climb out, but can always head for deeper water.
      if (!deepEnough(p.x, p.z) && getHeight(p.x, p.z) > getHeight(ox, oz)) {
        if (deepEnough(p.x, oz)) p.z = oz;
        else if (deepEnough(ox, p.z)) p.x = ox;
        else { p.x = ox; p.z = oz; }
      }
    } else if (!this.hover && !this.onBridge) {
      // Too steep to walk up: stop, or slip sideways along the hill instead.
      const g0 = groundAt(ox, oz);
      if (this.tooSteepAt(p.x, p.z, g0)) {
        if (!this.tooSteepAt(p.x, oz, g0)) p.z = oz;
        else if (!this.tooSteepAt(ox, p.z, g0)) p.x = ox;
        else { p.x = ox; p.z = oz; }
      }
    }
    let g = groundAt(p.x, p.z);
    this.onBridge = false;
    if (this.light) {
      // A log bridge holds a light dinosaur that is on it or stepping up onto it.
      const deck = bridgeAt(p.x, p.z);
      if (deck > g && p.y >= deck - 1.2) { g = deck; this.onBridge = true; }
    }
    if (p.y <= g || (wasGround && this.vy <= 0 && p.y - g < 0.7)) {
      p.y = g;
      if (this.vy < 0) this.vy = 0;
      // landing on land after a fall (water is a soft landing, and flyers land gently)
      if (!wasGround && !this.hover && g > SWIM_Y) this.fallDrop = Math.max(0, this.fallTop - g);
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    if (this.onGround || this.hover) this.fallTop = p.y;
    else this.fallTop = Math.max(this.fallTop, p.y);

    // Standing on ground that is too steep: slide back down it.
    this.steep = false;
    if (this.onGround && !this.hover && !this.onBridge && !this.swimmer && g > SHORE_Y) {
      const m = slopeAt(p.x, p.z, grad);
      if (m > this.climb) {
        this.steep = true;
        p.x -= grad.x / m * SLIDE_SPEED * dt;
        p.z -= grad.z / m * SLIDE_SPEED * dt;
        p.y = Math.min(p.y, groundAt(p.x, p.z));
      }
    }
    clampToWorld(p); // keep everyone on the map
  }

  /** Push model + shadow to match the simulation and advance animations. */
  sync(dt, t) {
    const sp = Math.hypot(this.pos.x - this.prev.x, this.pos.z - this.prev.z) / Math.max(dt, 1e-4);
    this.moveSpeed += (sp - this.moveSpeed) * Math.min(1, dt * 10);
    this.prev.copy(this.pos);
    this.phase += dt * this.moveSpeed * this.spec.stride / this.scale;
    if (this.attackAnim > 0) this.attackAnim = Math.max(0, this.attackAnim - dt / this.attackDur);

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    const mg = this.model.group;
    let roll = 0, s = this.scale;
    if (this.ko) {
      const el = this.koDur - this.koT;
      roll = Math.min(1, el / 0.35) * Math.PI / 2;
      if (!this.isPlayer && this.koT < 0.4) s *= Math.max(0.01, this.koT / 0.4);
    }
    mg.rotation.set(this.ko ? 0 : this.pitch, 0, roll);
    mg.position.y = this.ko ? this.radius * 0.35 * Math.min(1, roll) : 0;
    mg.scale.setScalar(s);

    const flying = !this.onGround && (this.hover || !!this.spec.fly);
    this.model.animate({
      t, phase: this.phase, move: this.ko ? 0 : this.moveSpeed / 3,
      attack: this.attackAnim, special: this.specialAnim, flying,
    });

    const g = groundAt(this.pos.x, this.pos.z);
    const alt = Math.max(0, this.pos.y - g);
    const k = this.radius * 1.15 * Math.max(0.35, 1 - alt / 60);
    this.shadow.position.set(this.pos.x, Math.max(g, 0) + 0.12, this.pos.z);
    this.shadow.scale.setScalar(k);
  }

  startAttackAnim(dur = 0.3) { this.attackAnim = 1; this.attackDur = dur; }

  setVisible(v) { this.group.visible = v; this.shadow.visible = v && !this.swimmer; }

  dispose() { this.scene.remove(this.group, this.shadow); }
}

// A dinosaur in the world: shared by the player and every wild dinosaur.
import * as THREE from 'three';
import { SPECIES } from './species.js';
import { buildDino } from './dinoModels.js';
import { getHeight, collide } from './world.js';

const shadowGeo = new THREE.CircleGeometry(1, 16);
shadowGeo.rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

export const SWIM_Y = -1.2;
export const groundAt = (x, z) => Math.max(getHeight(x, z), SWIM_Y);

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
    this.maxHp = this.hp = opts.hp || this.spec.hp;

    this.model = buildDino(key, opts.palette);
    this.model.group.scale.setScalar(this.scale);
    this.group = new THREE.Group();
    this.group.add(this.model.group);
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    scene.add(this.group, this.shadow);

    this.pos = new THREE.Vector3();
    this.prev = new THREE.Vector3();
    this.vel = new THREE.Vector3();   // intended horizontal velocity for this frame
    this.kb = new THREE.Vector3();    // knockback, decays over time
    this.vy = 0;
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
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
  }

  physics(dt) {
    const p = this.pos;
    const wasGround = this.onGround;
    p.x += (this.vel.x + this.kb.x) * dt;
    p.z += (this.vel.z + this.kb.z) * dt;
    this.kb.multiplyScalar(Math.exp(-5 * dt));
    if (!this.hover) this.vy -= 30 * dt;
    p.y += this.vy * dt;
    collide(p, this.radius * 0.7); // trees, rocks and nests are solid
    const g = groundAt(p.x, p.z);
    if (p.y <= g || (wasGround && this.vy <= 0 && p.y - g < 0.7)) {
      p.y = g;
      if (this.vy < 0) this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    // keep everyone on (or near) the island
    const d = Math.hypot(p.x, p.z);
    if (d > 335) { p.x *= 335 / d; p.z *= 335 / d; }
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

    const flying = !this.onGround && (this.hover || this.key === 'ptera');
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

  setVisible(v) { this.group.visible = v; this.shadow.visible = v; }

  dispose() { this.scene.remove(this.group, this.shadow); }
}

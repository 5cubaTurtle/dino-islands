// Damage, knock-outs and the cartoon effects that go with them.
import * as THREE from 'three';

const texCache = new Map();
function textTexture(text, fill) {
  const key = text + fill;
  let tex = texCache.get(key);
  if (tex) return tex;
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d');
  c.font = '900 84px system-ui, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = 16; c.strokeStyle = '#3a2a10';
  c.strokeText(text, 128, 68);
  c.fillStyle = fill;
  c.fillText(text, 128, 68);
  tex = new THREE.CanvasTexture(cv);
  texCache.set(key, tex);
  return tex;
}

const puffGeo = new THREE.SphereGeometry(1, 7, 5);
const ringGeo = new THREE.RingGeometry(0.9, 1, 40);
ringGeo.rotateX(-Math.PI / 2);
const WORDS = ['POW!', 'BONK!', 'WHAM!', 'BAM!'];

export class Effects {
  constructor(scene) { this.scene = scene; this.list = []; }

  add(obj, life, update) {
    this.scene.add(obj);
    this.list.push({ obj, life, t: 0, update });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.t += dt;
      const k = Math.min(1, e.t / e.life);
      e.update(k, dt);
      if (k >= 1) {
        this.scene.remove(e.obj);
        e.obj.traverse((o) => { if (o.material && o.material.userData.own) o.material.dispose(); });
        this.list.splice(i, 1);
      }
    }
  }

  word(pos, text, color = '#ffd23f', size = 3) {
    const mat = new THREE.SpriteMaterial({ map: textTexture(text, color), transparent: true, depthTest: false });
    mat.userData.own = true;
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.renderOrder = 10;
    const tilt = (Math.random() - 0.5) * 0.5;
    mat.rotation = tilt;
    this.add(s, 0.6, (k) => {
      const sc = size * (0.5 + Math.min(1, k * 4) * 0.7);
      s.scale.set(sc * 2, sc, 1);
      s.position.y += 0.02;
      mat.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    });
  }

  pow(pos, size = 3) { this.word(pos, WORDS[Math.floor(Math.random() * WORDS.length)], '#ffd23f', size); }

  dust(pos, size = 1.5, color = 0xf5efe0) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    mat.userData.own = true;
    const g = new THREE.Group();
    const dirs = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(puffGeo, mat);
      const a = i / 7 * Math.PI * 2;
      dirs.push([Math.cos(a), 0.3 + Math.random() * 0.6, Math.sin(a)]);
      g.add(m);
    }
    g.position.copy(pos);
    this.add(g, 0.7, (k) => {
      g.children.forEach((m, i) => {
        m.position.set(dirs[i][0] * k * size * 1.6, 0.3 + dirs[i][1] * k * size, dirs[i][2] * k * size * 1.6);
        m.scale.setScalar(size * (0.25 + k * 0.45));
      });
      mat.opacity = 0.9 * (1 - k);
    });
  }

  /** Flat ring on the ground growing to maxR over `life` seconds. */
  ring(pos, maxR, life, color = 0xffffff) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    mat.userData.own = true;
    const m = new THREE.Mesh(ringGeo, mat);
    m.position.set(pos.x, Math.max(pos.y, 0) + 0.5, pos.z);
    this.add(m, life, (k) => {
      m.scale.setScalar(Math.max(0.01, maxR * k));
      mat.opacity = 0.85 * (1 - k * k);
    });
  }

  /** Dizzy stars circling a dinosaur's head. */
  stars(ent, life) {
    const g = new THREE.Group();
    const mat = new THREE.SpriteMaterial({ map: textTexture('★', '#ffe14d'), transparent: true, depthTest: false });
    mat.userData.own = true;
    for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(mat); s.scale.set(1.6, 0.8, 1); g.add(s); }
    const r = ent.radius * 0.8 + 0.4;
    this.add(g, life, (k) => {
      g.position.set(ent.pos.x, ent.pos.y + (ent.ko ? ent.radius + 1 : ent.spec.headH * ent.scale + 0.4), ent.pos.z);
      g.children.forEach((s, i) => {
        const a = k * life * 5 + i * 2.094;
        s.position.set(Math.cos(a) * r, Math.sin(a * 2) * 0.15, Math.sin(a) * r);
      });
      g.visible = ent.group.visible;
      mat.opacity = k > 0.85 ? (1 - k) / 0.15 : 1;
    });
  }
}

/**
 * Hurt `target`. `from` is the attacker's position (for knockback direction).
 * Returns true if the hit landed.
 */
export function damage(game, target, amount, from, knock = 8) {
  if (target.ko || target.gone || target.invuln > 0) return false;
  if (target.armorT > 0) { // Ankylosaurus armour: the hit just bounces off
    const head = target.pos.clone(); head.y += target.spec.headH * target.scale;
    game.effects.word(head, 'CLANG!', '#d9d9d9', 2.2);
    game.sfx.bonk();
    target.invuln = 0.4;
    return false;
  }
  target.hp -= amount;
  target.lastHit = game.time;
  let dx = target.pos.x - from.x, dz = target.pos.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  const heavy = target.boss ? 0.25 : 1;
  target.kb.x += dx / d * knock * heavy;
  target.kb.z += dz / d * knock * heavy;
  if (!target.hover && !target.boss) target.vy = Math.max(target.vy, 3 + knock * 0.25);

  const head = target.pos.clone();
  head.y += target.spec.headH * target.scale * 0.8;
  game.effects.pow(head, target.isPlayer ? 2.2 : 1.6 + target.radius);
  if (target.isPlayer) {
    target.invuln = 0.5;
    game.sfx.ouch();
    game.shake = Math.max(game.shake, 0.25);
  } else {
    game.sfx.bonk();
    target.angryT = 12;
    target.fleeT = 0;
    for (const n of game.npcs) { // friends nearby get angry too
      if (n !== target && !n.boss && n.key === target.key && n.pos.distanceTo(target.pos) < 30) n.angryT = 12;
    }
    if (target.updateBar) target.updateBar();
  }
  if (target.hp <= 0) {
    target.hp = 0;
    knockOut(game, target);
  }
  return true;
}

const BODY_TIME = 20; // seconds a knocked-out wild dinosaur stays lying there

export function knockOut(game, e) {
  e.ko = true;
  e.koDur = e.koT = e.isPlayer ? 2.8 : BODY_TIME;
  e.hover = false;
  e.vel.set(0, 0, 0);
  e.pitch = 0;
  e.specialAnim = 0;
  game.effects.stars(e, Math.min(e.koDur, 3));
  game.sfx.ko();
  if (e.isPlayer) game.onPlayerKO();
  else game.onNpcKO(e);
}

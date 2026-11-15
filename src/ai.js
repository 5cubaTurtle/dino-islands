// Wild dinosaurs: spawning, a small state machine, and respawning.
import * as THREE from 'three';
import { Dino, angleLerp, groundAt } from './entity.js';
import { getHeight } from './world.js';
import { damage } from './combat.js';
import { updateBoss } from './bosses.js';

function addHealthBar(n) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 10;
  const c = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  const w = 1.6 + n.radius;
  sprite.scale.set(w, w * 0.16, 1);
  sprite.position.y = n.spec.headH * n.scale + 0.9;
  sprite.visible = false;
  sprite.renderOrder = 9;
  n.group.add(sprite);
  n.bar = sprite;
  n.updateBar = () => {
    c.fillStyle = '#3a2a10'; c.fillRect(0, 0, 64, 10);
    c.fillStyle = '#5a4a30'; c.fillRect(2, 2, 60, 6);
    c.fillStyle = '#ff5d5d'; c.fillRect(2, 2, 60 * Math.max(0, n.hp / n.maxHp), 6);
    tex.needsUpdate = true;
    sprite.visible = n.hp < n.maxHp && n.hp > 0;
  };
}

export function spawnNpc(game, key, hx, hz, opts = {}) {
  const n = new Dino(game.scene, key, opts);
  n.maxHp = n.hp = opts.hp || n.spec.npc.hp;
  n.dmg = opts.dmg || n.spec.npc.dmg;
  n.range = n.spec.range * n.scale * 0.8;
  n.walk = n.spec.speed * 0.4;
  n.run = n.spec.sprint * 0.8;
  n.atkEvery = 1.5;
  n.home = { x: hx, z: hz };
  n.boss = opts.boss || null;
  n.summon = !!opts.summon;
  n.atkCd = 0; n.windup = 0; n.angryT = opts.angry || 0; n.fleeT = 0; n.stun = 0;
  n.wanderT = 0; n.target = null; n.idle = false;
  n.gone = false; n.respawnT = 0;
  n.yaw = Math.random() * 6.28;
  const spot = game.world.landSpot(Math.random, hx, hz, opts.spread ?? 10) || n.home;
  n.place(spot.x, spot.z);
  if (key === 'ptera' && !n.boss) {
    n.air = { mode: 'circle', ang: Math.random() * 6.28, r: 22 + Math.random() * 18, alt: 16 + Math.random() * 10, dir: Math.random() < 0.5 ? 1 : -1, swoopT: 6 + Math.random() * 10, t: 0 };
    n.hover = true;
    n.pos.y += n.air.alt;
    n.onGround = false;
  }
  if (!n.boss) addHealthBar(n);
  game.npcs.push(n);
  return n;
}

export function spawnWildlife(game) {
  const group = (key, homes, count) => {
    for (const [x, z] of homes) for (let i = 0; i < count; i++) spawnNpc(game, key, x, z);
  };
  group('trike', [[-150, 70], [-80, 160], [-60, 20]], 3);
  group('raptor', [[150, 40], [190, 110], [110, 150], [-60, -140]], 3);
  group('trex', [[-160, -70], [-190, -20], [-130, -110]], 1);
  group('ptera', [[30, -20], [0, 120], [-200, 60], [200, 0], [20, -195], [100, -120]], 1);
}

/** Walk/run toward a point, turning smoothly. */
export function steer(n, tx, tz, speed, dt, turn = 6) {
  const want = Math.atan2(tx - n.pos.x, tz - n.pos.z);
  n.yaw = angleLerp(n.yaw, want, dt * turn);
  n.vel.set(Math.sin(n.yaw) * speed, 0, Math.cos(n.yaw) * speed);
}
export function face(n, tx, tz, dt) {
  n.yaw = angleLerp(n.yaw, Math.atan2(tx - n.pos.x, tz - n.pos.z), dt * 8);
}

function fly(n, tx, ty, tz, speed, dt) {
  const dx = tx - n.pos.x, dy = ty - n.pos.y, dz = tz - n.pos.z;
  const d = Math.hypot(dx, dy, dz) || 1;
  n.yaw = angleLerp(n.yaw, Math.atan2(dx, dz), dt * 4);
  const h = Math.hypot(dx, dz) / d;
  n.vel.set(Math.sin(n.yaw) * speed * h, 0, Math.cos(n.yaw) * speed * h);
  n.vy = dy / d * speed;
  n.pitch = -n.vy * 0.03;
  return d;
}

function thinkPtera(game, n, dt, active, d) {
  const p = game.player, a = n.air;
  n.hover = true;
  a.t += dt;
  const circle = () => {
    a.ang += dt * 0.3 * a.dir;
    const tx = n.home.x + Math.cos(a.ang) * a.r, tz = n.home.z + Math.sin(a.ang) * a.r;
    return fly(n, tx, Math.max(getHeight(tx, tz), 0) + a.alt, tz, 11, dt);
  };
  if (a.mode === 'circle') {
    circle();
    a.swoopT -= dt;
    if (n.angryT > 0) a.swoopT -= dt * 4;
    if (active && a.swoopT <= 0 && d < 55) { a.mode = 'swoop'; a.t = 0; }
  } else if (a.mode === 'swoop') {
    const dist = fly(n, p.pos.x, p.pos.y + p.spec.headH * 0.6, p.pos.z, 18, dt);
    if (!active || a.t > 7) { a.mode = 'climb'; a.t = 0; }
    else if (dist < p.radius + 2.2) {
      n.startAttackAnim(0.3);
      damage(game, p, n.dmg, n.pos, 5);
      a.mode = 'climb'; a.t = 0;
    }
  } else {
    const g = Math.max(getHeight(n.pos.x, n.pos.z), 0);
    circle();
    if (n.pos.y - g > a.alt - 4 || a.t > 5) { a.mode = 'circle'; a.swoopT = 9 + Math.random() * 9; }
  }
}

function think(game, n, dt, active) {
  const p = game.player;
  const dx = p.pos.x - n.pos.x, dz = p.pos.z - n.pos.z;
  const d = Math.hypot(dx, dz);
  n.atkCd -= dt; n.angryT -= dt;
  n.vel.set(0, 0, 0);
  if (n.boss && d < 55) game.activeBoss = n;
  if (n.stun > 0) { n.stun -= dt; n.windup = 0; if (n.hover) n.vy = 0; return; }
  if (n.fleeT > 0) {
    n.fleeT -= dt;
    steer(n, n.pos.x - dx, n.pos.z - dz, n.run, dt);
    if (n.hover) n.vy = 0;
    return;
  }
  if (n.air) return thinkPtera(game, n, dt, active, d);
  if (n.boss && active && updateBoss(game, n, dt, d)) return;

  const hd = Math.hypot(n.pos.x - n.home.x, n.pos.z - n.home.z);
  const reachableY = p.pos.y - n.pos.y < 5 + n.radius;
  let aggro = false;
  if (active && reachableY) {
    const angry = n.angryT > 0 && d < 45;
    if (n.boss) aggro = d < 45 && hd < 80;
    else if (n.summon) aggro = d < 60;
    else if (n.key === 'raptor') aggro = (d < 26 && hd < 70) || angry;
    else if (n.key === 'trex') aggro = (d < 30 && hd < 70) || angry;
    else aggro = angry;
  }

  if (n.windup > 0) {
    n.windup -= dt;
    face(n, p.pos.x, p.pos.z, dt);
    if (n.windup <= 0 && active && d < n.range + p.radius + 1.2 && Math.abs(p.pos.y - n.pos.y) < 3 + n.radius) {
      damage(game, p, n.dmg, n.pos, n.boss ? 10 : 6);
    }
    return;
  }
  if (aggro) {
    // keep closing in while out of reach, including up or down a steep bank
    const tooSteep = Math.abs(p.pos.y - n.pos.y) >= 3 + n.radius && d > 1;
    if (d > n.range + p.radius || tooSteep) steer(n, p.pos.x, p.pos.z, n.run, dt);
    else {
      face(n, p.pos.x, p.pos.z, dt);
      if (n.atkCd <= 0) { n.windup = 0.45; n.startAttackAnim(0.5); n.atkCd = n.atkEvery; }
    }
    return;
  }

  // wander around home
  n.wanderT -= dt;
  if (n.wanderT <= 0 || !n.target) {
    n.wanderT = 3 + Math.random() * 6;
    n.idle = Math.random() < 0.35 && hd < 40;
    n.target = n.home;
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * 6.28, r = 5 + Math.random() * 24;
      const tx = n.home.x + Math.cos(a) * r, tz = n.home.z + Math.sin(a) * r;
      if (getHeight(tx, tz) > 0.5) { n.target = { x: tx, z: tz }; break; }
    }
  }
  if (!n.idle && Math.hypot(n.target.x - n.pos.x, n.target.z - n.pos.z) > 2.5) {
    steer(n, n.target.x, n.target.z, hd > 60 ? n.run : n.walk, dt, 3);
  }
}

function respawn(game, n) {
  const spot = game.world.landSpot(Math.random, n.home.x, n.home.z, 12) || n.home;
  // don't pop in right next to the player
  if (Math.hypot(spot.x - game.player.pos.x, spot.z - game.player.pos.z) < 45) { n.respawnT = 5; return; }
  n.hp = n.maxHp; n.ko = false; n.gone = false;
  n.angryT = 0; n.fleeT = 0; n.stun = 0; n.windup = 0;
  n.place(spot.x, spot.z);
  if (n.air) { n.pos.y += n.air.alt; n.air.mode = 'circle'; n.hover = true; n.onGround = false; }
  n.setVisible(true);
  n.updateBar();
}

export function updateNpcs(game, dt) {
  const p = game.player;
  const active = game.state === 'playing' && !p.ko;
  for (let i = game.npcs.length - 1; i >= 0; i--) {
    const n = game.npcs[i];
    if (n.gone) {
      if (n.respawnT > 0) { n.respawnT -= dt; if (n.respawnT <= 0) respawn(game, n); }
      continue;
    }
    if (n.ko) {
      n.koT -= dt;
      n.vel.set(0, 0, 0);
      n.physics(dt);
      n.sync(dt, game.time);
      if (n.koT <= 0) {
        game.effects.dust(n.pos, 1 + n.radius);
        n.gone = true;
        n.setVisible(false);
        if (n.boss || n.summon) { n.dispose(); game.npcs.splice(i, 1); }
        else n.respawnT = 40;
      }
      continue;
    }
    think(game, n, dt, active);
    n.physics(dt);
    n.sync(dt, game.time);
  }

  // keep dinosaurs from standing inside each other
  const all = [p];
  for (const n of game.npcs) if (!n.gone && !n.ko) all.push(n);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
    const min = (a.radius + b.radius) * 0.8;
    if (Math.abs(dx) > min || Math.abs(dz) > min || Math.abs(a.pos.y - b.pos.y) > 3) continue;
    const d = Math.hypot(dx, dz);
    if (d >= min || d < 1e-3) continue;
    const push = (min - d) * 0.5, wa = b.radius / (a.radius + b.radius);
    a.pos.x -= dx / d * push * wa * 2; a.pos.z -= dz / d * push * wa * 2;
    b.pos.x += dx / d * push * (1 - wa) * 2; b.pos.z += dz / d * push * (1 - wa) * 2;
  }
}

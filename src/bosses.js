// The three bosses and their telegraphed special moves.
import { spawnNpc, steer, face } from './ai.js';
import { damage } from './combat.js';
import { groundAt } from './entity.js';

export const BOSSES = {
  queen: { id: 'queen', key: 'raptor', name: 'Raptor Queen', x: 150, z: 100, scale: 1.9, hp: 400, dmg: 8, palette: 'queen' },
  threehorn: { id: 'threehorn', key: 'trike', name: 'Old Three-Horn', x: -130, z: 120, scale: 1.55, hp: 600, dmg: 12, palette: 'threehorn' },
  kingrex: { id: 'kingrex', key: 'trex', name: 'King Rex', x: 15, z: -105, scale: 1.7, hp: 800, dmg: 16, palette: 'kingrex' },
};
export const BOSS_ORDER = ['queen', 'threehorn', 'kingrex'];

export function spawnBosses(game) {
  for (const id of BOSS_ORDER) {
    if (game.save.crowns[id]) continue;
    const b = BOSSES[id];
    const n = spawnNpc(game, b.key, b.x, b.z, { scale: b.scale, hp: b.hp, dmg: b.dmg, palette: b.palette, boss: b, spread: 3 });
    n.spT = 4; n.sp = null; n.summoned = 0;
    n.atkEvery = 1.3;
  }
}

function headPos(n) {
  const h = n.pos.clone();
  h.y += n.spec.headH * n.scale + 1.5;
  return h;
}

/** Returns true when the boss is busy with its special move this frame. */
export function updateBoss(game, n, dt, d) {
  const p = game.player, id = n.boss.id;
  if (d < 55) game.activeBoss = n;

  if (id === 'queen') {
    const f = n.hp / n.maxHp;
    const want = f < 0.33 ? 2 : f < 0.66 ? 1 : 0;
    if (n.summoned < want) {
      n.summoned++;
      game.sfx.roar(0.6);
      game.hud.toast('The Queen calls her pack!');
      game.effects.word(headPos(n), '!!', '#ff4d4d', 3);
      for (let i = 0; i < 3; i++) {
        const s = spawnNpc(game, 'raptor', n.pos.x, n.pos.z, { summon: true, angry: 60, spread: 9 });
        game.effects.dust(s.pos, 1.5);
      }
    }
    return false;
  }

  n.spT -= dt;
  if (!n.sp) {
    if (n.spT > 0 || d > 40 || d < 3 || n.windup > 0) return false;
    n.sp = { phase: 'tele', t: id === 'threehorn' ? 1.1 : 1.0, hit: false };
    game.sfx.alarm();
    game.effects.word(headPos(n), '!!', '#ff4d4d', 4);
    game.hud.toast(id === 'threehorn' ? 'He is going to charge! Dodge!' : 'Stomp coming! Jump!', 1.4);
  }
  const sp = n.sp;
  sp.t -= dt;

  if (id === 'threehorn') {
    if (sp.phase === 'tele') {
      face(n, p.pos.x, p.pos.z, dt);
      n.specialAnim = 1;
      n.pitch = Math.sin(game.time * 45) * 0.04;
      if (sp.t <= 0) {
        const dx = p.pos.x - n.pos.x, dz = p.pos.z - n.pos.z, l = Math.hypot(dx, dz) || 1;
        sp.phase = 'run'; sp.t = 1.3; sp.dx = dx / l; sp.dz = dz / l;
        n.pitch = 0;
        game.sfx.whoosh();
      }
    } else {
      n.yaw = Math.atan2(sp.dx, sp.dz);
      n.vel.set(sp.dx * 27, 0, sp.dz * 27);
      if (Math.random() < dt * 14) game.effects.dust(n.pos, 1.2);
      if (!sp.hit && d < n.radius + p.radius + 0.4 && Math.abs(p.pos.y - n.pos.y) < 4) {
        sp.hit = true;
        if (damage(game, p, 25, n.pos, 22)) game.shake = 0.5;
      }
      if (sp.t <= 0) {
        n.sp = null; n.spT = 7; n.specialAnim = 0;
        n.stun = 2.2;
        game.effects.stars(n, 2.2);
      }
    }
    return true;
  }

  // King Rex: rear up, then stomp out a shockwave
  face(n, p.pos.x, p.pos.z, dt);
  n.pitch = -0.28 * Math.min(1, (1.0 - sp.t) * 3);
  if (sp.t <= 0) {
    n.pitch = 0;
    n.sp = null; n.spT = 8;
    n.stun = 0.9;
    game.sfx.stomp(); game.sfx.roar(1.4);
    game.shake = 0.7;
    game.effects.ring(n.pos, 34, 2.0, 0xffa040);
    game.effects.dust(n.pos, 3);
    game.waves.push({ x: n.pos.x, z: n.pos.z, r: 0, speed: 17, max: 34, dmg: 22, hit: false });
  }
  return true;
}

/** Expanding shockwaves hurt the player unless they are in the air. */
export function updateWaves(game, dt) {
  const p = game.player;
  for (let i = game.waves.length - 1; i >= 0; i--) {
    const w = game.waves[i];
    w.r += w.speed * dt;
    const d = Math.hypot(p.pos.x - w.x, p.pos.z - w.z);
    const alt = p.pos.y - groundAt(p.pos.x, p.pos.z);
    if (!w.hit && !p.ko && Math.abs(d - w.r) < 1.0 && alt < 0.3) {
      w.hit = true;
      damage(game, p, w.dmg, { x: w.x, z: w.z }, 12);
    }
    if (w.r > w.max) game.waves.splice(i, 1);
  }
}

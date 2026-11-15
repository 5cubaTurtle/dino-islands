// Player control: movement, flying, attacks and each species' special move.
import { damage } from './combat.js';
import { angleLerp, groundAt } from './entity.js';
import { bridgeAt } from './world.js';

const alive = (n) => !n.ko && !n.gone;

function nearest(game, p, maxD, yaw = null, minDot = -1) {
  let best = null, bd = maxD;
  for (const n of game.npcs) {
    if (!alive(n)) continue;
    const dx = n.pos.x - p.pos.x, dz = n.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz) - n.radius;
    if (d > bd || Math.abs(n.pos.y - p.pos.y) > 5 + n.radius) continue;
    if (yaw !== null && d > 0.5 && (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / (d + n.radius) < minDot) continue;
    best = n; bd = d;
  }
  return best;
}

function melee(game, p, range, dmg, knock) {
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  let any = false;
  for (const n of game.npcs) {
    if (!alive(n)) continue;
    const dx = n.pos.x - p.pos.x, dz = n.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > range + n.radius + p.radius * 0.5) continue;
    if (Math.abs(n.pos.y - p.pos.y) > 3 + n.radius + p.radius) continue;
    if (d > p.radius && (dx * fx + dz * fz) / d < 0.3) continue;
    if (damage(game, n, dmg, p.pos, knock)) any = true;
  }
  return any;
}

/** Triceratops horns knock a tree: it leans a bit more each time and breaks on the last hit. */
function hornTree(game, p, reach, skip) {
  const tr = game.world.hitTree(p.pos.x, p.pos.z, Math.sin(p.yaw), Math.cos(p.yaw), reach, skip);
  if (!tr) return null;
  const at = p.pos.clone(); at.x = tr.x; at.z = tr.z;
  game.effects.dust(at, 1.4);
  if (tr.state === 'falling') {
    at.y += 4;
    if (tr.bridge) game.hud.toast('The tree made a bridge! Only light dinosaurs can walk on it.', 4);
    game.effects.word(at, 'CRACK!', '#ffd23f', 3);
    game.sfx.stomp();
    game.shake = Math.max(game.shake, 0.35);
  } else {
    game.sfx.bonk();
    game.shake = Math.max(game.shake, 0.12);
  }
  return tr;
}

function touching(p, n, pad) {
  return Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z) < p.radius + n.radius + pad
    && Math.abs(n.pos.y - p.pos.y) < 3 + n.radius;
}

function endSpecial(p) {
  p.charge = p.pounce = p.dive = null;
  p.specialAnim = 0;
  p.pitch = 0;
}

export function resetPlayerState(p) {
  endSpecial(p);
  p.attackCd = 0; p.specialCd = 0; p.roarT = 0;
  p.hover = false;
}

export function updatePlayer(game, dt) {
  const p = game.player, s = p.spec, inp = game.input, fx = game.effects;
  p.invuln -= dt; p.attackCd -= dt; p.specialCd -= dt;
  if (p.ko) { p.vel.set(0, 0, 0); p.physics(dt); return; }

  const cy = game.cam.yaw;
  const f = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
  const r = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
  let mx = Math.sin(cy) * f - Math.cos(cy) * r, mz = Math.cos(cy) * f + Math.sin(cy) * r;
  const ml = Math.hypot(mx, mz);
  const moving = ml > 0;
  if (moving) { mx /= ml; mz /= ml; }
  const aimYaw = moving ? Math.atan2(mx, mz) : cy;
  const shift = inp.down('ShiftLeft') || inp.down('ShiftRight');
  const canFly = !!s.fly;
  let speed = shift ? s.sprint : s.speed;
  if (canFly && !p.onGround) speed = s.fly;
  if (p.pos.y < -0.7) speed *= 0.6; // swimming

  if (p.roarT > 0) { p.roarT -= dt; p.specialAnim = Math.max(0, p.roarT / 0.9); }

  if (p.charge) {
    const c = p.charge;
    c.t -= dt;
    if (moving) { // a little steering
      const y = angleLerp(Math.atan2(c.dx, c.dz), aimYaw, dt * 1.5);
      c.dx = Math.sin(y); c.dz = Math.cos(y);
    }
    p.yaw = Math.atan2(c.dx, c.dz);
    p.vel.set(c.dx * 28, 0, c.dz * 28);
    if (Math.random() < dt * 16) fx.dust(p.pos, 1.1);
    for (const n of game.npcs) {
      if (!alive(n) || c.hit.has(n) || !touching(p, n, 0.8)) continue;
      c.hit.add(n);
      if (damage(game, n, 45, p.pos, 24)) game.shake = 0.3;
    }
    // charging into a tree counts as one horn hit on it
    const tr = hornTree(game, p, p.radius + 1.2, c.hit);
    if (tr) c.hit.add(tr);
    if (c.t <= 0) endSpecial(p);
  } else if (p.pounce) {
    const c = p.pounce;
    c.t += dt;
    p.vel.set(c.dx * c.sp, 0, c.dz * c.sp);
    let done = c.t > 0.15 && p.onGround;
    for (const n of game.npcs) {
      if (!alive(n) || !touching(p, n, 0.9)) continue;
      damage(game, n, 35, p.pos, 10);
      done = true;
      break;
    }
    if (done) { endSpecial(p); p.vel.set(0, 0, 0); }
  } else if (p.dive) {
    const c = p.dive;
    p.hover = true; p.vy = -26; p.pitch = 0.9;
    p.vel.set(c.dx * 20, 0, c.dz * 20);
    let boom = p.onGround;
    for (const n of game.npcs) if (alive(n) && touching(p, n, 1.2)) { boom = true; break; }
    if (boom) {
      for (const n of game.npcs) {
        if (alive(n) && touching(p, n, 5)) damage(game, n, 40, p.pos, 14);
      }
      fx.ring(p.pos, 7, 0.4, 0xffffff);
      fx.dust(p.pos, 2);
      game.sfx.stomp();
      game.shake = 0.35;
      endSpecial(p);
      p.vy = 11; p.onGround = false; p.hover = true; // bounce back into the air
      p.vel.set(0, 0, 0);
    }
  } else {
    if (moving) {
      p.yaw = angleLerp(p.yaw, aimYaw, dt * 10);
      p.vel.set(mx * speed, 0, mz * speed);
    } else p.vel.set(0, 0, 0);

    if (canFly) {
      if (p.onGround) {
        p.hover = false; p.pitch = 0;
        if (inp.down('Space')) { p.vy = 9; p.onGround = false; p.hover = true; game.sfx.whoosh(); }
      } else {
        p.hover = true;
        const want = inp.down('Space') ? 10 : shift ? -14 : moving ? -1.2 : -2.5;
        p.vy += (want - p.vy) * Math.min(1, dt * 5);
        if (p.pos.y > 95 && p.vy > 0) p.vy = 0;
        p.pitch = -p.vy * 0.03;
      }
    } else if (inp.hit('Space') && p.onGround && !p.steep) {
      p.vy = s.jump; p.onGround = false;
    }
  }

  p.physics(dt);

  // a heavy dinosaur at a log bridge just wades through: say why
  p.bridgeHintT = (p.bridgeHintT || 0) - dt;
  if (!p.light && p.bridgeHintT <= 0 && Math.abs(bridgeAt(p.pos.x, p.pos.z) - p.pos.y) < 4) {
    p.bridgeHintT = 8;
    game.hud.toast(`${s.name} is too heavy for the log bridge.`, 2.5);
  }

  const busy = p.charge || p.pounce || p.dive;

  // ---- special move ----
  if (inp.hit('Special') && p.specialCd <= 0 && !busy) {
    const dx = Math.sin(aimYaw), dz = Math.cos(aimYaw);
    if (s.special === 'roar') {
      p.specialCd = s.specialCd; p.roarT = 0.9;
      game.sfx.roar(); game.shake = 0.4;
      fx.ring(p.pos, 36, 0.8, 0xfff3b0);
      for (const n of game.npcs) {
        if (!alive(n) || n.pos.distanceTo(p.pos) > 36) continue;
        if (n.boss || n.key === 'trex') { n.stun = 1.6; fx.stars(n, 1.6); }
        else { n.fleeT = 6; n.angryT = 0; if (n.air) n.air.mode = 'climb'; }
      }
    } else if (s.special === 'charge') {
      p.specialCd = s.specialCd; p.specialAnim = 1;
      p.charge = { t: 1.1, dx, dz, hit: new Set() };
      game.sfx.whoosh();
    } else if (s.special === 'pounce' && p.onGround && !p.steep) {
      p.specialCd = s.specialCd; p.specialAnim = 1;
      const t = nearest(game, p, 20, aimYaw, 0.3);
      let ux = dx, uz = dz, sp = 22;
      if (t) {
        const tx = t.pos.x - p.pos.x, tz = t.pos.z - p.pos.z, l = Math.hypot(tx, tz) || 1;
        ux = tx / l; uz = tz / l;
        sp = Math.min(28, Math.max(12, l / 0.6));
      }
      p.yaw = Math.atan2(ux, uz);
      p.pounce = { t: 0, dx: ux, dz: uz, sp };
      p.vy = 10; p.onGround = false;
      game.sfx.whoosh();
    } else if (s.special === 'dive') {
      if (p.onGround || p.pos.y - groundAt(p.pos.x, p.pos.z) < 3) { // quick launch
        p.vy = 16; p.onGround = false; p.hover = true; p.specialCd = 0.6;
        game.sfx.whoosh();
      } else {
        p.specialCd = s.specialCd; p.specialAnim = 1;
        const t = nearest(game, p, 30, aimYaw, 0.2);
        let ux = dx, uz = dz;
        if (t) { const tx = t.pos.x - p.pos.x, tz = t.pos.z - p.pos.z, l = Math.hypot(tx, tz) || 1; ux = tx / l; uz = tz / l; }
        p.yaw = Math.atan2(ux, uz);
        p.dive = { dx: ux, dz: uz };
        game.sfx.whoosh();
      }
    }
  }

  // ---- basic attack (hold to keep attacking) ----
  if (inp.down('Attack') && p.attackCd <= 0 && !busy) {
    const t = nearest(game, p, s.range + 3);
    if (t) p.yaw = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
    else if (!moving) p.yaw = cy;
    p.attackCd = s.atkCd;
    p.startAttackAnim(Math.min(0.3, s.atkCd));
    if (p.key === 'trex') game.sfx.chomp(); else game.sfx.swipe();
    melee(game, p, s.range, s.dmg, p.key === 'trex' ? 12 : p.key === 'trike' ? 10 : 6);
    if (p.key === 'trike') hornTree(game, p, s.range);
  }
}

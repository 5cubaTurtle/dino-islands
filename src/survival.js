// Health / hunger / thirst, plus the things you can eat and drink.
import * as THREE from 'three';
import { waterKind, inLava } from './world.js';
import { groundAt } from './entity.js';
import { FOOD_HINT } from './species.js';
import { knockOut } from './combat.js';

const boneM = new THREE.MeshLambertMaterial({ color: 0xfff6dc, flatShading: true });
const meatM = new THREE.MeshLambertMaterial({ color: 0xb5651d, flatShading: true });
const boneG = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 6);
const knobG = new THREE.SphereGeometry(0.2, 6, 5);
const meatG = new THREE.SphereGeometry(0.55, 8, 6);

const FALL_SAFE = 3;     // metres you can drop without getting hurt
const FALL_HURT = 0.04;  // share of full health lost per metre beyond that (28 m is a knock-out)

export function newSurvival() {
  return { hunger: 100, thirst: 100, warnedHunger: false, warnedThirst: false, busy: 0 };
}

/** Drop a cartoon drumstick where a dinosaur was knocked out. */
export function dropMeat(game, pos, big = false) {
  const g = new THREE.Group();
  const bone = new THREE.Mesh(boneG, boneM); bone.position.y = -0.6;
  const knob = new THREE.Mesh(knobG, boneM); knob.position.y = -1.1;
  const meat = new THREE.Mesh(meatG, meatM); meat.scale.set(1, 1.25, 1); meat.position.y = 0.2;
  g.add(bone, knob, meat);
  g.rotation.z = 0.5;
  g.scale.setScalar(big ? 2.2 : 1.3);
  const y = groundAt(pos.x, pos.z) + (big ? 2.6 : 1.6);
  g.position.set(pos.x, y, pos.z);
  game.scene.add(g);
  game.pickups.push({ x: pos.x, z: pos.z, y, group: g, life: 90, food: big ? 100 : 40 });
}

function removePickup(game, i) {
  game.scene.remove(game.pickups[i].group);
  game.pickups.splice(i, 1);
}

function feed(game, amount) {
  const p = game.player, sv = game.survival;
  sv.hunger = Math.min(100, sv.hunger + amount);
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.15);
  sv.warnedHunger = false;
  game.sfx.eat();
  const head = p.pos.clone(); head.y += p.spec.headH;
  game.effects.word(head, 'YUM!', '#8ef58a', 2.2);
}

export function updateSurvival(game, dt) {
  const p = game.player, sv = game.survival, w = game.world, t = game.time;
  const drop = p.fallDrop;
  p.fallDrop = 0;
  if (p.ko) { game.hud.setPrompt(''); return; }

  // Falling hurts: nothing for the first few metres, then more the further you drop.
  if (drop > FALL_SAFE) {
    p.hp -= p.maxHp * (drop - FALL_SAFE) * FALL_HURT;
    p.lastHit = t;
    game.sfx.ouch();
    game.shake = Math.max(game.shake, 0.4);
    game.effects.dust(p.pos, 1 + p.radius);
    const head = p.pos.clone(); head.y += p.spec.headH;
    game.effects.word(head, 'OUCH!', '#ffb36b', 2.2);
    if (p.hp <= 0) {
      p.hp = 0;
      game.starved = 'fall';
      knockOut(game, p);
      game.hud.setPrompt('');
      return;
    }
  }

  // Lava burns through a full health bar in about 2 seconds.
  if (inLava(p.pos)) {
    if (!sv.inLava) { sv.inLava = true; game.hud.toast('Lava! Get out!', 1.5); }
    p.hp -= p.maxHp * 0.5 * dt;
    if (p.hp <= 0) {
      p.hp = 0;
      game.starved = 'lava';
      knockOut(game, p);
      game.hud.setPrompt('');
      return;
    }
  } else sv.inLava = false;

  sv.hunger = Math.max(0, sv.hunger - 0.33 * dt);
  sv.thirst = Math.max(0, sv.thirst - 0.42 * dt);
  if (sv.hunger <= 0 || sv.thirst <= 0) {
    // Running out of food or water is deadly.
    p.hp -= p.maxHp * 0.01 * dt;
    if (p.hp <= 0) {
      p.hp = 0;
      game.starved = sv.hunger <= 0 ? 'hunger' : 'thirst';
      knockOut(game, p);
      game.hud.setPrompt('');
      return;
    }
  } else if (t - p.lastHit > 4 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.0025 * dt);
  }
  if (sv.hunger < 25 && !sv.warnedHunger) { sv.warnedHunger = true; game.hud.toast("I'm hungry! " + FOOD_HINT[p.spec.diet], 4); }
  if (sv.thirst < 25 && !sv.warnedThirst) { sv.warnedThirst = true; game.hud.toast("I'm thirsty! Find water and press E.", 4); }

  // pickups bob and time out
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const k = game.pickups[i];
    k.life -= dt;
    k.group.position.y = k.y + Math.sin(t * 3 + k.x) * 0.25;
    k.group.rotation.y += dt * 2;
    if (k.life <= 0) removePickup(game, i);
  }

  const reach = p.radius + 3.5;
  const eatsMeat = p.spec.diet !== 'plant';
  let food = null, foodI = -1;
  if (eatsMeat) {
    game.pickups.forEach((k, i) => {
      if (Math.hypot(k.x - p.pos.x, k.z - p.pos.z) < reach && Math.abs(k.y - p.pos.y) < 6) { food = k; foodI = i; }
    });
  } else {
    for (const b of w.bushes) {
      if (b.ready && Math.hypot(b.x - p.pos.x, b.z - p.pos.z) < reach && Math.abs(b.y - p.pos.y) < 4) { food = b; break; }
    }
  }

  // Pteranodons snatch fish just by swooping through them
  if (p.spec.diet === 'fish') {
    for (const f of w.fish) {
      if (!f.ready) continue;
      const fp = f.group.position;
      if (Math.hypot(fp.x - p.pos.x, fp.z - p.pos.z) < 3.5 && Math.abs(fp.y - p.pos.y) < 4) {
        f.ready = false; f.regrow = 25; f.group.visible = false;
        feed(game, 35);
      }
    }
  }

  const water = p.onGround ? waterKind(p.pos.x, p.pos.z, p.radius + 2) : null;
  sv.busy -= dt;
  let prompt = '';
  if (food && sv.hunger < 97) prompt = eatsMeat ? 'Press E to eat' : 'Press E to munch berries';
  else if (water === 'salt') prompt = 'Press E to drink sea water';
  else if (water && sv.thirst < 97) prompt = 'Press E to drink';
  game.hud.setPrompt(prompt);

  if (prompt && game.input.hit('KeyE') && sv.busy <= 0) {
    sv.busy = 0.4;
    if (prompt === 'Press E to drink sea water') {
      // The sea is salty: drinking it makes you thirstier.
      sv.thirst = Math.max(0, sv.thirst - 20);
      game.sfx.drink();
      const head = p.pos.clone(); head.y += p.spec.headH;
      game.effects.word(head, 'YUCK!', '#c8e06a', 2.2);
      game.hud.toast('Sea water is salty! Drink from the lake or river.', 3);
    } else if (prompt === 'Press E to drink') {
      sv.thirst = Math.min(100, sv.thirst + 45);
      sv.warnedThirst = false;
      game.sfx.drink();
      const head = p.pos.clone(); head.y += p.spec.headH;
      game.effects.word(head, 'GULP!', '#7fd4ff', 2.2);
    } else if (eatsMeat) {
      feed(game, food.food);
      removePickup(game, foodI);
    } else {
      food.ready = false; food.regrow = 45; food.berries.visible = false;
      feed(game, 35);
    }
  }
}

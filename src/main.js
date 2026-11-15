// Dino Island: boot, game states and the main loop.
import * as THREE from 'three';
import { World, NESTS } from './world.js';
import { SPECIES, SPECIES_ORDER } from './species.js';
import { Dino } from './entity.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { Effects } from './combat.js';
import { ChaseCam } from './camera.js';
import { Hud } from './hud.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { spawnWildlife, updateNpcs } from './ai.js';
import { spawnBosses, updateWaves, BOSS_ORDER } from './bosses.js';
import { updatePlayer, resetPlayerState } from './player.js';
import { newSurvival, updateSurvival, dropMeat } from './survival.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

const scene = new THREE.Scene();
const DAY = new THREE.Color(0x8fd3ff), DUSK = new THREE.Color(0xffc391);
scene.background = DAY.clone();
scene.fog = new THREE.Fog(scene.background.clone(), 140, 560);
const camera = new THREE.PerspectiveCamera(60, 1, 0.3, 2500);
const hemi = new THREE.HemisphereLight(0xffffff, 0x7a9a62, 1.5);
const sun = new THREE.DirectionalLight(0xfff2d6, 1.9);
sun.position.set(90, 160, 70);
scene.add(hemi, sun);

const game = {
  scene, camera, renderer,
  state: 'menu',            // menu | playing | paused | nap
  time: 0, shake: 0,
  npcs: [], pickups: [], waves: [],
  activeBoss: null,
  save: loadSave(),
  survival: newSurvival(),
  input: new Input(canvas),
  sfx: new Sfx(),
  effects: new Effects(scene),
  player: null,
  hadLock: false, napT: 0, wonShown: false,
};
game.world = new World(scene);
game.cam = new ChaseCam(camera);
game.hud = new Hud();
window.game = game; // handy for debugging in the browser console

function setSpecies(key) {
  if (game.player) game.player.dispose();
  const p = new Dino(scene, key, { isPlayer: true });
  resetPlayerState(p);
  p.place(NESTS[0].x + 5, NESTS[0].z);
  p.yaw = Math.PI;
  game.player = p;
  game.save.species = key;
  game.cam.snap = true;
  game.hud.setSpecies(p.spec);
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', c.dataset.key === key));
}

function nearestNest(pos) {
  let best = NESTS[0], bd = Infinity;
  for (const n of NESTS) { const d = Math.hypot(n.x - pos.x, n.z - pos.z); if (d < bd) { bd = d; best = n; } }
  return best;
}

function lockPointer() {
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* not available */ }
}
function show(id, on) { $(id).classList.toggle('hidden', !on); }

function startGame() {
  game.sfx.init();
  writeSave(game.save);
  game.state = 'playing';
  game.survival = newSurvival();
  game.cam.yaw = Math.PI; game.cam.pitch = 0.3;
  show('menu', false); show('hud', true);
  lockPointer();
  const left = BOSS_ORDER.filter((id) => !game.save.crowns[id]).length;
  game.hud.toast(left ? `Find the ${left} boss${left > 1 ? 'es' : ''} marked ! on the map` : 'Roam free, champion!', 4);
}
function pause() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  show('pause', true);
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}
function resume() {
  if (game.state !== 'paused') return;
  game.state = 'playing';
  show('pause', false); show('win', false);
  lockPointer();
}

game.onPlayerKO = () => {
  game.state = 'nap';
  game.napT = 2.8;
  game.sfx.nap();
  $('napTitle').textContent = game.starved === 'hunger' ? 'You starved! 🍖' : game.starved === 'thirst' ? 'You got too thirsty! 💧' : 'Take a nap! 💤';
  game.starved = false;
  show('nap', true);
};
function wakeUp() {
  const p = game.player, nest = nearestNest(p.pos);
  resetPlayerState(p);
  p.ko = false; p.hp = p.maxHp; p.invuln = 3;
  p.place(nest.x + 5, nest.z);
  game.survival = newSurvival();
  game.waves.length = 0;
  for (const n of game.npcs) { n.angryT = 0; n.windup = 0; }
  game.cam.snap = true;
  game.state = 'playing';
  show('nap', false);
  game.hud.toast('All rested! Back to the adventure.');
}

game.onNpcKO = (n) => {
  if (n.bar) n.bar.visible = false;
  dropMeat(game, n.pos, !!n.boss);
  if (!n.boss) return;
  game.save.crowns[n.boss.id] = true;
  writeSave(game.save);
  game.hud.setCrowns(game.save.crowns);
  game.sfx.crown();
  game.hud.toast(`You beat ${n.boss.name}! You earned a crown!`, 5);
  if (BOSS_ORDER.every((id) => game.save.crowns[id]) && !game.wonShown) {
    game.wonShown = true;
    setTimeout(() => {
      if (game.state !== 'playing') return;
      game.state = 'paused';
      show('win', true);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    }, 3500);
  }
};

// ---- menu ------------------------------------------------------------------
const cards = $('cards');
for (const key of SPECIES_ORDER) {
  const s = SPECIES[key];
  const b = document.createElement('button');
  b.className = 'card'; b.dataset.key = key;
  b.innerHTML = `<strong>${s.name}</strong><span>${s.blurb}</span><em>${s.attackName} + ${s.specialName}</em>`;
  b.addEventListener('click', () => { game.sfx.init(); game.sfx.bonk(); setSpecies(key); });
  cards.appendChild(b);
}
$('play').addEventListener('click', startGame);
$('reset').addEventListener('click', () => { clearSave(); location.reload(); });
$('pause').addEventListener('click', resume);
$('keepGoing').addEventListener('click', resume);
canvas.addEventListener('click', () => { if (game.state === 'playing' && document.pointerLockElement !== canvas) lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) game.hadLock = true;
  else if (game.hadLock && game.state === 'playing') pause();
});
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') { if (game.state === 'playing') pause(); else resume(); }
  if (e.code === 'Enter' && game.state === 'menu') startGame();
});
addEventListener('blur', pause);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

setSpecies(SPECIES[game.save.species] ? game.save.species : 'trex');
game.hud.setCrowns(game.save.crowns);
spawnWildlife(game);
spawnBosses(game);

// ---- main loop -------------------------------------------------------------
const tmpCol = new THREE.Color();
function update(dt) {
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * 1.5);
  game.activeBoss = null;
  const p = game.player;

  if (game.state === 'playing') updatePlayer(game, dt);
  else { p.vel.set(0, 0, 0); p.physics(dt); }
  updateNpcs(game, dt);
  p.sync(dt, game.time);
  if (game.state === 'playing') { updateWaves(game, dt); updateSurvival(game, dt); }
  if (game.state === 'nap') {
    p.koT = Math.max(0.5, p.koT - dt);
    game.napT -= dt;
    if (game.napT <= 0) wakeUp();
  }
  game.world.update(dt, game.time);
  game.effects.update(dt);
  game.cam.update(game, dt, game.state === 'menu');
  game.hud.update(game, dt);

  // gentle day -> golden hour -> day cycle (never gets dark)
  const k = Math.pow(Math.max(0, Math.sin(game.time * 0.02)), 4);
  tmpCol.copy(DAY).lerp(DUSK, k * 0.8);
  scene.background.copy(tmpCol);
  scene.fog.color.copy(tmpCol);
  sun.intensity = 1.9 - k * 0.5;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state !== 'paused') update(dt);
  renderer.render(scene, camera);
  game.input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// On-screen display: meters, boss bar, minimap, crowns and messages.
import { getHeight, zoneAt, NESTS } from './world.js';
import { BOSSES, BOSS_ORDER } from './bosses.js';

const $ = (id) => document.getElementById(id);
const MAP = 160, WORLD = 680;
const toMap = (v) => (v + WORLD / 2) / WORLD * MAP;
const ZONE_COLORS = {
  grass: '#86cf58', jungle: '#3f9b4b', plains: '#b5d76a', canyon: '#c0915f', volcano: '#5b5552', lake: '#86cf58',
};

export class Hud {
  constructor() {
    this.el = {
      hp: $('hp'), hunger: $('hunger'), thirst: $('thirst'), special: $('special'), specialName: $('specialName'),
      attackName: $('attackName'), prompt: $('prompt'), toast: $('toast'), boss: $('boss'), bossName: $('bossName'),
      bossFill: $('bossFill'), crowns: $('crowns'), map: $('minimap'), hint: $('hint'),
    };
    this.toastT = 0;
    this.promptText = '';
    this.ctx = this.el.map.getContext('2d');
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = MAP;
    const c = this.base.getContext('2d');
    for (let py = 0; py < MAP; py += 2) for (let px = 0; px < MAP; px += 2) {
      const x = (px + 1) / MAP * WORLD - WORLD / 2, z = (py + 1) / MAP * WORLD - WORLD / 2;
      const h = getHeight(x, z);
      c.fillStyle = h < 0 ? '#35a5e6' : h < 1.5 ? '#ecd9a0' : ZONE_COLORS[zoneAt(x, z)];
      c.fillRect(px, py, 2, 2);
    }
    c.fillStyle = '#ff7a1a';
    c.beginPath(); c.arc(toMap(20), toMap(-195), 4, 0, 6.3); c.fill();
  }

  setSpecies(spec) {
    this.el.specialName.textContent = spec.specialName;
    this.el.attackName.textContent = spec.attackName;
    const fly = spec.fly ? '<b>Space</b> fly up &nbsp; <b>Shift</b> fly down' : '<b>Space</b> jump &nbsp; <b>Shift</b> run';
    this.el.hint.innerHTML = `<b>WASD</b> move &nbsp; <b>Mouse</b> look<br>${fly}<br><b>Click / J</b> ${spec.attackName} &nbsp; <b>Right-click / K</b> ${spec.specialName}<br><b>E</b> eat / drink &nbsp; <b>P</b> pause`;
  }

  setCrowns(crowns) {
    this.el.crowns.innerHTML = BOSS_ORDER.map((id) =>
      `<span class="crown ${crowns[id] ? 'won' : ''}" title="${BOSSES[id].name}">👑</span>`).join('');
  }

  toast(text, secs = 2.6) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastT = secs;
  }

  setPrompt(text) {
    if (text === this.promptText) return;
    this.promptText = text;
    this.el.prompt.textContent = text;
    this.el.prompt.classList.toggle('show', !!text);
  }

  update(game, dt) {
    const p = game.player, sv = game.survival, e = this.el;
    const hp = p.hp / p.maxHp * 100;
    e.hp.style.width = hp + '%';
    e.hp.parentElement.classList.toggle('low', hp < 30);
    e.hunger.style.width = sv.hunger + '%';
    e.hunger.parentElement.classList.toggle('low', sv.hunger < 25);
    e.thirst.style.width = sv.thirst + '%';
    e.thirst.parentElement.classList.toggle('low', sv.thirst < 25);
    const cd = Math.max(0, p.specialCd || 0) / p.spec.specialCd;
    e.special.style.width = (1 - Math.min(1, cd)) * 100 + '%';
    e.special.parentElement.classList.toggle('ready', cd <= 0);

    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) e.toast.classList.remove('show'); }

    const b = game.activeBoss;
    e.boss.classList.toggle('show', !!b);
    if (b) { e.bossName.textContent = b.boss.name; e.bossFill.style.width = b.hp / b.maxHp * 100 + '%'; }

    // minimap
    const c = this.ctx;
    c.clearRect(0, 0, MAP, MAP);
    c.drawImage(this.base, 0, 0);
    c.fillStyle = '#fff'; c.strokeStyle = '#7a5230'; c.lineWidth = 1.5;
    for (const n of NESTS) { c.beginPath(); c.arc(toMap(n.x), toMap(n.z), 2.5, 0, 6.3); c.fill(); c.stroke(); }
    c.font = '13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const id of BOSS_ORDER) {
      if (game.save.crowns[id]) continue;
      const bx = toMap(BOSSES[id].x), bz = toMap(BOSSES[id].z);
      c.fillStyle = '#e63946'; c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.arc(bx, bz, 6 + Math.sin(game.time * 4) * 1, 0, 6.3); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.fillText('!', bx, bz + 0.5);
    }
    c.save();
    c.translate(toMap(p.pos.x), toMap(p.pos.z));
    c.rotate(-p.yaw);
    c.fillStyle = '#fff'; c.strokeStyle = '#222'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, 7); c.lineTo(5, -5); c.lineTo(0, -2); c.lineTo(-5, -5); c.closePath();
    c.fill(); c.stroke();
    c.restore();
  }
}

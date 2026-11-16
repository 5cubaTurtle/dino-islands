// On-screen display: meters, boss bar, minimap, crowns and messages.
import { getHeight, zoneAt, NESTS, ZONES, WORLD_BOUNDS } from './world.js';
import { BOSSES, BOSS_ORDER } from './bosses.js';

const $ = (id) => document.getElementById(id);
// The minimap follows you: it shows MAP * PX metres across, one pixel per PX metres.
const MAP = 160, PX = 3;
const ZONE_COLORS = {
  grass: '#86cf58', jungle: '#3f9b4b', plains: '#b5d76a', canyon: '#c0915f', volcano: '#5b5552', lake: '#86cf58',
  fern: '#5aa844', forest: '#3e8a3a', fernLake: '#5aa844', sky: '#9a917f',
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
    // the whole world drawn once, one pixel per PX metres
    const B = WORLD_BOUNDS, W = (B.x1 - B.x0) / PX, H = (B.z1 - B.z0) / PX;
    this.base = document.createElement('canvas');
    this.base.width = W; this.base.height = H;
    const c = this.base.getContext('2d');
    const img = c.createImageData(W, H), hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const x = B.x0 + (px + 0.5) * PX, z = B.z0 + (py + 0.5) * PX;
      const h = getHeight(x, z);
      const col = hex(h < 0 ? '#35a5e6' : h < 1.5 ? '#ecd9a0' : ZONE_COLORS[zoneAt(x, z)] || '#86cf58');
      img.data.set([...col, 255], (py * W + px) * 4);
    }
    c.putImageData(img, 0, 0);
    const v = ZONES.volcano;
    c.fillStyle = '#ff7a1a';
    c.beginPath(); c.arc((v.x - B.x0) / PX, (v.z - B.z0) / PX, 4, 0, 6.3); c.fill();
  }

  setSpecies(spec) {
    this.el.specialName.textContent = spec.specialName;
    this.el.attackName.textContent = spec.attackName;
    const fly = spec.fly ? '<b>Space</b> fly up &nbsp; <b>Shift</b> fly down'
      : spec.swim ? '<b>Shift</b> swim fast &nbsp; (stays in the water)'
        : spec.jump ? '<b>Space</b> jump &nbsp; <b>Shift</b> run' : '<b>Shift</b> run';
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

    // minimap, centred on you
    const c = this.ctx, B = WORLD_BOUNDS, half = MAP / 2;
    const mx = (x) => half + (x - p.pos.x) / PX, mz = (z) => half + (z - p.pos.z) / PX;
    c.clearRect(0, 0, MAP, MAP);
    c.drawImage(this.base, mx(B.x0), mz(B.z0));
    c.fillStyle = '#fff'; c.strokeStyle = '#7a5230'; c.lineWidth = 1.5;
    for (const n of NESTS) { c.beginPath(); c.arc(mx(n.x), mz(n.z), 2.5, 0, 6.3); c.fill(); c.stroke(); }
    c.font = '13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const id of BOSS_ORDER) {
      if (game.save.crowns[id]) continue;
      let bx = mx(BOSSES[id].x) - half, bz = mz(BOSSES[id].z) - half;
      const d = Math.hypot(bx, bz), edge = half - 10;
      if (d > edge) { bx *= edge / d; bz *= edge / d; } // off the map: pin it to the edge
      bx += half; bz += half;
      c.fillStyle = '#e63946'; c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.arc(bx, bz, 6 + Math.sin(game.time * 4) * 1, 0, 6.3); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.fillText('!', bx, bz + 0.5);
    }
    c.save();
    c.translate(half, half);
    c.rotate(-p.yaw);
    c.fillStyle = '#fff'; c.strokeStyle = '#222'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, 7); c.lineTo(5, -5); c.lineTo(0, -2); c.lineTo(-5, -5); c.closePath();
    c.fill(); c.stroke();
    c.restore();
  }
}

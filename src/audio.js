// Tiny WebAudio synth: every sound effect is generated, no audio files.
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; }
  init() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { this.ctx = null; }
  }
  tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, freq = 1000, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
  roar(big = 1) {
    this.tone('sawtooth', 160 / big, 55 / big, 0.9, 0.35);
    this.tone('square', 110 / big, 40 / big, 0.9, 0.15);
    this.noise(0.9, 0.3, 500);
  }
  stomp() { this.tone('sine', 90, 30, 0.35, 0.6); this.noise(0.2, 0.3, 200); }
  chomp() { this.noise(0.08, 0.4, 2500); this.tone('square', 300, 120, 0.08, 0.15); }
  swipe() { this.noise(0.12, 0.25, 4000); }
  bonk() { this.tone('square', 420, 140, 0.14, 0.25); this.noise(0.06, 0.25, 1500); }
  ouch() { this.tone('triangle', 500, 220, 0.2, 0.3); }
  whoosh() { this.noise(0.35, 0.25, 900); }
  eat() { for (let i = 0; i < 3; i++) this.noise(0.07, 0.35, 1800, i * 0.13); }
  drink() { for (let i = 0; i < 3; i++) this.tone('sine', 500 + i * 120, 900 + i * 120, 0.09, 0.2, i * 0.12); }
  ko() { this.tone('triangle', 700, 150, 0.5, 0.3); }
  alarm() { this.tone('square', 660, 660, 0.12, 0.2); this.tone('square', 660, 660, 0.12, 0.2, 0.2); }
  crown() { [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.3, i * 0.14)); }
  nap() { [392, 330, 262].forEach((f, i) => this.tone('sine', f, f, 0.3, 0.25, i * 0.25)); }
}

// Keyboard + mouse input. Mouse buttons are mapped to the pseudo-keys
// "Attack" (left) and "Special" (right) so J / K work the same way.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.dx = 0; this.dy = 0;
    const alias = { KeyJ: 'Attack', KeyK: 'Special' };
    const down = (code) => { if (!this.keys.has(code)) this.pressed.add(code); this.keys.add(code); };
    const up = (code) => this.keys.delete(code);

    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      down(alias[e.code] || e.code);
    });
    addEventListener('keyup', (e) => up(alias[e.code] || e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) down('Attack');
      if (e.button === 2) down('Special');
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) up('Attack');
      if (e.button === 2) up('Special');
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) { this.dx += e.movementX; this.dy += e.movementY; }
    });
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.dx = 0; this.dy = 0; }
}

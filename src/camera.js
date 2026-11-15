// Third-person chase camera: mouse (or arrow keys) to look around.
import * as THREE from 'three';
import { getHeight } from './world.js';

export class ChaseCam {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;
    this.pitch = 0.3;
    this.target = new THREE.Vector3();
    this.distK = 1;
    this.snap = true;
  }

  update(game, dt, orbit = false) {
    const inp = game.input, p = game.player;
    if (orbit) {
      this.yaw += dt * 0.35;
      this.pitch = 0.22;
    } else {
      this.yaw -= inp.dx * 0.0026;
      this.pitch += inp.dy * 0.0022;
      const turn = (inp.down('ArrowLeft') ? 1 : 0) - (inp.down('ArrowRight') ? 1 : 0);
      const tilt = (inp.down('ArrowUp') ? 1 : 0) - (inp.down('ArrowDown') ? 1 : 0);
      this.yaw += turn * dt * 2.2;
      this.pitch += tilt * dt * 1.2;
      this.pitch = Math.min(1.35, Math.max(-0.35, this.pitch));
    }
    const want = this.target.clone().copy(p.pos);
    want.y += p.spec.camH * p.scale;
    if (this.snap) { this.target.copy(want); this.snap = false; }
    else this.target.lerp(want, 1 - Math.exp(-12 * dt));

    const dist = p.spec.camDist * (orbit ? 0.85 : 1);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const c = this.camera;
    c.position.set(
      this.target.x - Math.sin(this.yaw) * cp * dist,
      this.target.y + sp * dist,
      this.target.z - Math.cos(this.yaw) * cp * dist,
    );
    const floor = Math.max(getHeight(c.position.x, c.position.z), 0) + 0.8;
    if (c.position.y < floor) c.position.y = floor;
    if (game.shake > 0) {
      const s = game.shake;
      c.position.x += (Math.random() - 0.5) * s;
      c.position.y += (Math.random() - 0.5) * s;
      c.position.z += (Math.random() - 0.5) * s;
    }
    c.lookAt(this.target);
  }
}

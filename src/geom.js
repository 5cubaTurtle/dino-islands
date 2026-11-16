// Geometry helpers for the detailed models: smooth tapered tubes with painted
// skin, and a "kit" that merges many parts into one mesh (one draw call).
import * as THREE from 'three';

const sstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * A smooth body along a path. `pts` is a list of [x, y, z, rx, ry]: centre
 * points with the half-width (rx) and half-height (ry) of the cross-section
 * there. `color` is a hex number or a function (u, a, out) that fills the
 * THREE.Color `out` for a point `u` (0..1) along the tube at angle `a` around
 * it (sin(a) > 0 is the top). Both ends are closed.
 */
export function tube(pts, { radial = 12, steps = 4, color = 0xffffff } = {}) {
  const m = pts.length;
  const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2])), false, 'centripetal');
  const n = (m - 1) * steps;
  const pos = [], col = [], idx = [];
  const C = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), U = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1);
  const c = new THREE.Color();
  const paint = typeof color === 'function' ? color : (u, a, out) => out.setHex(color);
  const radius = (t, k) => {
    const f = t * (m - 1), i = Math.min(m - 2, Math.floor(f)), w = f - i, s = w * w * (3 - 2 * w);
    return pts[i][k] + (pts[i + 1][k] - pts[i][k]) * s;
  };
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    curve.getPoint(t, C);
    curve.getTangent(t, T).normalize();
    const ref = Math.abs(T.y) > 0.9 ? fwd : up;
    S.crossVectors(ref, T).normalize();   // sideways
    U.crossVectors(T, S).normalize();     // "up" across the tube
    const rx = radius(t, 3), ry = radius(t, 4);
    for (let j = 0; j < radial; j++) {
      const a = j / radial * Math.PI * 2;
      pos.push(
        C.x + S.x * Math.cos(a) * rx + U.x * Math.sin(a) * ry,
        C.y + S.y * Math.cos(a) * rx + U.y * Math.sin(a) * ry,
        C.z + S.z * Math.cos(a) * rx + U.z * Math.sin(a) * ry,
      );
      paint(t, a, c);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, d = a + radial, e = b + radial;
    idx.push(a, b, d, b, e, d);
  }
  // end caps
  for (const [ring, t, flip] of [[0, 0, true], [n, 1, false]]) {
    curve.getPoint(t, C);
    const ci = pos.length / 3;
    pos.push(C.x, C.y, C.z);
    paint(t, Math.PI / 2, c);
    col.push(c.r, c.g, c.b);
    for (let j = 0; j < radial; j++) {
      const a = ring * radial + j, b = ring * radial + (j + 1) % radial;
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Skin painter: main colour, paler belly, optional darker bands across the back. */
export function skin(main, belly, dark, { bands = 0, bandK = 0.55, mottle = 0 } = {}) {
  const M = new THREE.Color(main), B = new THREE.Color(belly), D = new THREE.Color(dark);
  return (u, a, out) => {
    const top = Math.sin(a);
    out.copy(M);
    if (bands) {
      const s = Math.max(0, Math.sin(u * bands * Math.PI * 2));
      out.lerp(D, s * s * bandK * sstep(-0.2, 0.6, top));
    }
    if (mottle) {
      const k = Math.sin(u * 37.1 + a * 5.3) * Math.sin(u * 19.7 - a * 3.1);
      out.lerp(D, Math.max(0, k) * mottle * sstep(-0.3, 0.4, top));
    }
    out.lerp(B, sstep(-0.1, -0.7, top));
    return out;
  };
}

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color();

/** Collects parts and merges them into a single non-indexed geometry with vertex colours. */
export class Kit {
  constructor() { this.pos = []; this.nor = []; this.col = []; }

  /**
   * Add `geometry` moved by p (position), r (Euler rotation) and s (scale).
   * `color` is a hex number, or null to keep the geometry's own colours.
   */
  add(geometry, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    tmpM.compose(tmpP.set(p[0], p[1], p[2]), tmpQ.setFromEuler(tmpE.set(r[0], r[1], r[2])), tmpS.set(s[0], s[1], s[2]));
    g.applyMatrix4(tmpM);
    if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal, Cl = g.attributes.color;
    if (color !== null) tmpC.setHex(color);
    for (let i = 0; i < P.count; i++) {
      this.pos.push(P.getX(i), P.getY(i), P.getZ(i));
      this.nor.push(N.getX(i), N.getY(i), N.getZ(i));
      if (color === null && Cl) this.col.push(Cl.getX(i), Cl.getY(i), Cl.getZ(i));
      else this.col.push(tmpC.r, tmpC.g, tmpC.b);
    }
    g.dispose();
    return this;
  }

  /** Shorthand for a smooth ellipsoid with half-sizes rx, ry, rz. */
  blob(rx, ry, rz, color, p, r) {
    return this.add(SPHERE, color, { p, r, s: [rx, ry, rz] });
  }

  /** A cone of radius rad and length len, pointing along +Y before rotation r. */
  spike(rad, len, color, p, r) {
    return this.add(CONE, color, { p, r, s: [rad, len, rad] });
  }

  tube(pts, opts) {
    const g = tube(pts, opts);
    this.add(g, null);
    g.dispose();
    return this;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const SPHERE = new THREE.SphereGeometry(1, 14, 10);
const CONE = new THREE.ConeGeometry(1, 1, 8); // base at y=-0.5, tip at y=+0.5
CONE.translate(0, 0.5, 0);                     // base at the origin, tip at y=1

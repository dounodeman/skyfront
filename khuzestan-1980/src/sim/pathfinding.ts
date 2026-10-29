import { TILE } from '../core/constants';
import type { Vec } from '../core/math';
import { TERRAIN, type MoveClass } from '../data/terrain';
import type { TileMap } from './map';

/**
 * A* over the tile grid with per-movement-class terrain costs (cost = 1 / speed multiplier).
 * Returns world-space waypoints (tile centres) smoothed by line-of-walk checks.
 * If the goal is unreachable, returns a path to the reachable tile closest to it.
 */
const SQRT2 = Math.SQRT2;
const NEIGH: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

class Heap {
  keys: number[] = [];
  vals: number[] = [];
  get size() { return this.keys.length; }
  push(k: number, v: number) {
    const ks = this.keys, vs = this.vals;
    let i = ks.length;
    ks.push(k); vs.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (ks[p] <= k) break;
      ks[i] = ks[p]; vs[i] = vs[p]; i = p;
    }
    ks[i] = k; vs[i] = v;
  }
  pop(): number {
    const ks = this.keys, vs = this.vals;
    const top = vs[0];
    const lk = ks.pop()!, lv = vs.pop()!;
    const n = ks.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && ks[c + 1] < ks[c]) c++;
        if (ks[c] >= lk) break;
        ks[i] = ks[c]; vs[i] = vs[c]; i = c;
      }
      ks[i] = lk; vs[i] = lv;
    }
    return top;
  }
}

export function tileCost(map: TileMap, mc: MoveClass, tx: number, ty: number, heavy: boolean): number {
  const s = map.speedMul(mc, tx, ty);
  if (s <= 0) return Infinity;
  let c = 1 / s;
  // Heavy tracked vehicles avoid marsh unless there is no other way.
  if (heavy && TERRAIN[map.get(tx, ty)].bogs) c += 4;
  return c;
}

export function findPath(
  map: TileMap, mc: MoveClass, sx: number, sy: number, gx: number, gy: number, heavy = false,
): Vec[] {
  const w = map.w, h = map.h;
  const stx = Math.max(0, Math.min(w - 1, Math.floor(sx / TILE)));
  const sty = Math.max(0, Math.min(h - 1, Math.floor(sy / TILE)));
  let gtx = Math.max(0, Math.min(w - 1, Math.floor(gx / TILE)));
  let gty = Math.max(0, Math.min(h - 1, Math.floor(gy / TILE)));
  if (mc === 'air') return [{ x: gx, y: gy }];

  const g = new Float32Array(w * h).fill(Infinity);
  const from = new Int32Array(w * h).fill(-1);
  const closed = new Uint8Array(w * h);
  const heap = new Heap();
  const start = sty * w + stx;
  g[start] = 0;
  const hfn = (x: number, y: number) => {
    const dx = Math.abs(x - gtx), dy = Math.abs(y - gty);
    return (dx + dy) + (SQRT2 - 2) * Math.min(dx, dy); // octile distance, admissible-ish (min cost 0.6)
  };
  heap.push(hfn(stx, sty) * 0.65, start);
  let best = start, bestH = hfn(stx, sty);
  const goalIdx = gty * w + gtx;
  const goalPassable = tileCost(map, mc, gtx, gty, heavy) < Infinity;
  let found = false;
  let guard = 0;
  while (heap.size > 0 && guard++ < 60000) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goalIdx) { found = true; best = cur; break; }
    const cx = cur % w, cy = (cur / w) | 0;
    const hh = hfn(cx, cy);
    if (hh < bestH) { bestH = hh; best = cur; }
    for (const [dx, dy, dc] of NEIGH) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (closed[ni]) continue;
      const c = tileCost(map, mc, nx, ny, heavy);
      if (c === Infinity) continue;
      if (dx !== 0 && dy !== 0) { // no corner cutting
        if (tileCost(map, mc, cx + dx, cy, heavy) === Infinity || tileCost(map, mc, cx, cy + dy, heavy) === Infinity) continue;
      }
      const ng = g[cur] + c * dc;
      if (ng < g[ni]) {
        g[ni] = ng; from[ni] = cur;
        heap.push(ng + hfn(nx, ny) * 0.65, ni);
      }
    }
  }
  if (!found && goalPassable === false) { /* approach closest reachable tile */ }

  // Reconstruct
  const tiles: number[] = [];
  for (let i = best; i !== -1; i = from[i]) tiles.push(i);
  tiles.reverse();
  if (tiles.length <= 1) return found ? [{ x: gx, y: gy }] : [];
  const onPath = new Set(tiles);

  // String-pull: skip waypoints when a straight walk stays on cheap tiles (or tiles the path already used).
  const pts = tiles.map((i) => ({ tx: i % w, ty: (i / w) | 0 }));
  const walkable = (a: { tx: number; ty: number }, b: { tx: number; ty: number }) => {
    const n = Math.max(Math.abs(b.tx - a.tx), Math.abs(b.ty - a.ty)) * 2;
    for (let k = 1; k < n; k++) {
      const tx = Math.round(a.tx + ((b.tx - a.tx) * k) / n), ty = Math.round(a.ty + ((b.ty - a.ty) * k) / n);
      const c = tileCost(map, mc, tx, ty, heavy);
      if (c === Infinity) return false;
      if (c > 1.45 && !onPath.has(ty * w + tx)) return false;
      // also guard against squeezing diagonally past a blocker
      const ox = Math.floor(a.tx + ((b.tx - a.tx) * k) / n), oy = Math.floor(a.ty + ((b.ty - a.ty) * k) / n);
      if (tileCost(map, mc, ox, oy, heavy) === Infinity) return false;
    }
    return true;
  };
  const out: Vec[] = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !walkable(pts[i], pts[j])) j--;
    out.push({ x: (pts[j].tx + 0.5) * TILE, y: (pts[j].ty + 0.5) * TILE });
    i = j;
  }
  // Final waypoint is the exact requested point when reachable.
  if (found && out.length) out[out.length - 1] = { x: gx, y: gy };
  return out;
}

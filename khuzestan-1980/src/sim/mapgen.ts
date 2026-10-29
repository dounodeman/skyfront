import { TILE } from '../core/constants';
import { Rng } from '../core/rng';
import { T, TERRAIN, type TerrainId } from '../data/terrain';
import type { MapDef, PaintOp } from '../data/maps/types';
import { TileMap } from './map';

/** Smooth value noise in [0,1] for organic edges. */
function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Builds a tile map from a declarative MapDef (plus optional extra ops from a scenario). */
export function buildMap(def: MapDef, extra: PaintOp[] = []): TileMap {
  const map = new TileMap();
  const rng = new Rng(def.seed);
  for (const op of [...def.ops, ...extra]) apply(map, op, rng, def.seed);
  return map;
}

function put(map: TileMap, tx: number, ty: number, t: TerrainId, only?: TerrainId[], bridge = false) {
  if (!map.inb(tx, ty)) return;
  const cur = map.get(tx, ty);
  if (only && !only.includes(cur)) return;
  if (bridge && cur === T.Canal) { map.set(tx, ty, T.Bridge); return; }
  // Roads/trenches never replace canals or bridges unless bridging; nothing replaces bridges.
  if (cur === T.Bridge) return;
  if ((t === T.Road || t === T.Trench) && (cur === T.Canal || cur === T.Building)) return;
  map.set(tx, ty, t);
}

function apply(map: TileMap, op: PaintOp, rng: Rng, seed: number) {
  switch (op.op) {
    case 'fill': {
      const [x0, y0, x1, y1] = op.rect;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(map, x, y, op.t);
      break;
    }
    case 'blob': blob(map, op.t, op.cx, op.cy, op.rx, op.ry, op.rough ?? 0.3, op.only, seed + (op.cx | 0) * 7);
      break;
    case 'blobs': {
      const [x0, y0, x1, y1] = op.rect;
      for (let i = 0; i < op.count; i++) {
        blob(map, op.t, rng.range(x0, x1), rng.range(y0, y1), rng.range(...op.rx), rng.range(...op.ry), 0.35, op.only, seed + i * 13);
      }
      break;
    }
    case 'line': line(map, op, seed); break;
    case 'town': {
      const [x0, y0, x1, y1] = op.rect;
      const [bw, bh] = op.block;
      for (let y = y0; y + bh <= y1; y += bh + op.gap) {
        for (let x = x0; x + bw <= x1; x += bw + op.gap) {
          if (rng.chance(op.skip)) continue;
          // Slight size variation so the town doesn't look gridded.
          const w = Math.max(1, bw - (rng.chance(0.25) ? 1 : 0)), h = Math.max(1, bh - (rng.chance(0.25) ? 1 : 0));
          for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
            const cur = map.get(x + xx, y + yy);
            if (cur === T.Sand || cur === T.Dune || cur === T.Grove) map.set(x + xx, y + yy, T.Building);
          }
        }
      }
      break;
    }
    case 'ring': {
      const [x0, y0, x1, y1] = op.rect;
      for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) if ((x + y) % (op.gaps ? op.gaps + 2 : 99) !== 0) put(map, x, y, T.Building, [T.Sand, T.Dune, T.Grove, T.Road]);
      for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) if ((x + y) % (op.gaps ? op.gaps + 2 : 99) !== 0) put(map, x, y, T.Building, [T.Sand, T.Dune, T.Grove, T.Road]);
      break;
    }
    case 'scatter': {
      const [x0, y0, x1, y1] = op.rect;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (rng.chance(op.density)) put(map, x, y, op.t, op.only);
      break;
    }
  }
}

function blob(map: TileMap, t: TerrainId, cx: number, cy: number, rx: number, ry: number, rough: number, only: TerrainId[] | undefined, seed: number) {
  const x0 = Math.floor(cx - rx * 1.4), x1 = Math.ceil(cx + rx * 1.4);
  const y0 = Math.floor(cy - ry * 1.4), y1 = Math.ceil(cy + ry * 1.4);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      const n = (vnoise(x * 0.25, y * 0.25, seed) - 0.5) * 2 * rough;
      if (d + n < 1) put(map, x, y, t, only);
    }
  }
}

function line(map: TileMap, op: Extract<PaintOp, { op: 'line' }>, seed: number) {
  const { pts, width, t } = op;
  const wob = op.wobble ?? 0;
  let travelled = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
    const steps = Math.ceil(len / 0.35);
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const off = (vnoise((travelled + f * len) * 0.18, 3.7, seed) - 0.5) * 2 * wob;
      const cx = ax + (bx - ax) * f + nx * off, cy = ay + (by - ay) * f + ny * off;
      const r = width / 2;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r + 0.2) put(map, x, y, t, op.only, op.bridge);
        }
      }
    }
    travelled += len;
  }
}

/** Tile-centre world coordinates helper. */
export const tileCentre = (tx: number, ty: number): [number, number] => [(tx + 0.5) * TILE, (ty + 0.5) * TILE];

/** Quick ASCII dump for debugging in node. */
export function dumpMap(map: TileMap, step = 2): string {
  const ch = ['.', '=', '~', '#', 'B', 'p', 'H', 'x', 't', '^'];
  let s = '';
  for (let y = 0; y < map.h; y += step) {
    for (let x = 0; x < map.w; x += step) s += ch[map.get(x, y)] ?? '?';
    s += '\n';
  }
  return s;
}
void TERRAIN;

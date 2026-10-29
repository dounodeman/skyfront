import { MAP_H, MAP_W, TILE } from '../core/constants';
import { TERRAIN, T, type MoveClass, type TerrainId } from '../data/terrain';

/** Tile grid: terrain ids, per-tile hit points for destructibles, and sight/cover queries. */
export class TileMap {
  readonly w = MAP_W;
  readonly h = MAP_H;
  readonly t = new Uint8Array(MAP_W * MAP_H);
  readonly hp = new Float32Array(MAP_W * MAP_H);
  /** Bumped when any tile changes so the renderer can refresh its cached layers. */
  rev = 0;
  /** Tiles changed since the renderer last looked (for incremental redraw). */
  dirty: number[] = [];

  idx(tx: number, ty: number) { return ty * this.w + tx; }
  inb(tx: number, ty: number) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  get(tx: number, ty: number): TerrainId { return (this.inb(tx, ty) ? this.t[ty * this.w + tx] : T.Canal) as TerrainId; }
  at(x: number, y: number): TerrainId { return this.get(Math.floor(x / TILE), Math.floor(y / TILE)); }

  set(tx: number, ty: number, id: TerrainId) {
    if (!this.inb(tx, ty)) return;
    const i = this.idx(tx, ty);
    this.t[i] = id;
    this.hp[i] = TERRAIN[id].hp ?? 0;
    this.rev++;
    this.dirty.push(i);
  }

  /** Speed multiplier for a movement class on a tile (0 = blocked). Out of bounds blocks. */
  speedMul(mc: MoveClass, tx: number, ty: number): number {
    if (mc === 'air') return 1;
    if (!this.inb(tx, ty)) return 0;
    return TERRAIN[this.t[ty * this.w + tx]].speed[mc];
  }
  speedAt(mc: MoveClass, x: number, y: number) { return this.speedMul(mc, Math.floor(x / TILE), Math.floor(y / TILE)); }
  cover(x: number, y: number) { return TERRAIN[this.at(x, y)].cover; }
  opacity(tx: number, ty: number) { return this.inb(tx, ty) ? TERRAIN[this.t[ty * this.w + tx]].opacity : 1; }

  /**
   * Line of sight between two world points. Opacity of intermediate tiles accumulates;
   * the two end tiles are ignored so a unit inside a building / grove can still see out.
   */
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (d < TILE) return true;
    const steps = Math.ceil(d / (TILE * 0.5));
    const sx = (x1 - x0) / steps, sy = (y1 - y0) / steps;
    const t0x = Math.floor(x0 / TILE), t0y = Math.floor(y0 / TILE);
    const t1x = Math.floor(x1 / TILE), t1y = Math.floor(y1 / TILE);
    let acc = 0, lx = -1, ly = -1;
    for (let i = 1; i < steps; i++) {
      const tx = Math.floor((x0 + sx * i) / TILE), ty = Math.floor((y0 + sy * i) / TILE);
      if (tx === lx && ty === ly) continue;
      lx = tx; ly = ty;
      if ((tx === t0x && ty === t0y) || (tx === t1x && ty === t1y)) continue;
      acc += this.opacity(tx, ty);
      if (acc >= 1) return false;
    }
    return true;
  }

  /** Damage a destructible tile; returns true when it was destroyed. */
  damageTile(tx: number, ty: number, amount: number): boolean {
    if (!this.inb(tx, ty)) return false;
    const i = this.idx(tx, ty);
    const def = TERRAIN[this.t[i]];
    if (def.hp === undefined || def.becomes === undefined) return false;
    this.hp[i] -= amount;
    if (this.hp[i] <= 0) { this.set(tx, ty, def.becomes); return true; }
    return false;
  }
}

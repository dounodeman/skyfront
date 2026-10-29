import type { Unit } from './entity';

/** Uniform grid hash for neighbour queries (rebuilt each tick). */
export class SpatialHash {
  private cells = new Map<number, Unit[]>();
  constructor(private cell = 64) {}
  clear() { this.cells.clear(); }
  private key(cx: number, cy: number) { return (cx + 1024) * 4096 + (cy + 1024); }
  insert(u: Unit) {
    const k = this.key(Math.floor(u.x / this.cell), Math.floor(u.y / this.cell));
    const c = this.cells.get(k);
    if (c) c.push(u); else this.cells.set(k, [u]);
  }
  /** Calls fn for every unit within radius r of (x,y). */
  forEachNear(x: number, y: number, r: number, fn: (u: Unit) => void) {
    const c0x = Math.floor((x - r) / this.cell), c1x = Math.floor((x + r) / this.cell);
    const c0y = Math.floor((y - r) / this.cell), c1y = Math.floor((y + r) / this.cell);
    const r2 = r * r;
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const c = this.cells.get(this.key(cx, cy));
        if (!c) continue;
        for (const u of c) if ((u.x - x) ** 2 + (u.y - y) ** 2 <= r2) fn(u);
      }
    }
  }
  near(x: number, y: number, r: number): Unit[] {
    const out: Unit[] = [];
    this.forEachNear(x, y, r, (u) => out.push(u));
    return out;
  }
}

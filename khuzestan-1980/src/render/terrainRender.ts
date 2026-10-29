import { TILE } from '../core/constants';
import { T, TERRAIN } from '../data/terrain';
import { vnoise } from '../sim/mapgen';
import type { TileMap } from '../sim/map';
import type { Camera } from '../core/camera';

const PX = 10; // pixels per tile in the cached base layer

const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const SAND = hex('#cdb77f'), SAND2 = hex('#bfa56b'), DUNE = hex('#dcc78f'), DUNE_SH = hex('#b99f63');
const MARSH = hex('#667f58'), MARSH2 = hex('#7b9367'), WATER = hex('#3f7690'), WATER2 = hex('#4f8aa2'), BANK = hex('#8f8a62');
const ROAD = hex('#9b9078'), ROAD2 = hex('#8a806b');
const GROVE_GROUND = hex('#a9a468');
const RUBBLE = hex('#a09680'), FLOOR = hex('#b3a384'), TRENCH = hex('#7d6a43');

const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Draws the ground (sand, water, roads...) into a cached canvas and the dynamic details (palms, buildings) per frame. */
export class TerrainRenderer {
  private base: HTMLCanvasElement;
  private baseCtx: CanvasRenderingContext2D;
  private builtRev = -1;
  /** Per-type smooth fields at tile resolution (bilinear sampled). */
  private fields: Record<string, Float32Array> = {};

  constructor(private map: TileMap) {
    this.base = document.createElement('canvas');
    this.base.width = map.w * PX;
    this.base.height = map.h * PX;
    this.baseCtx = this.base.getContext('2d')!;
    this.buildFields();
    this.rebuildBase();
  }

  get baseCanvas() { return this.base; }

  private buildFields() {
    const { w, h } = this.map;
    const mk = (pred: (t: number) => boolean) => {
      const f = new Float32Array(w * h);
      for (let i = 0; i < f.length; i++) f[i] = pred(this.map.t[i]) ? 1 : 0;
      return f;
    };
    this.fields = {
      water: mk((t) => t === T.Canal || t === T.Bridge),
      marsh: mk((t) => t === T.Marsh),
      road: mk((t) => t === T.Road),
      dune: mk((t) => t === T.Dune),
      grove: mk((t) => t === T.Grove),
      rubble: mk((t) => t === T.Rubble),
      floor: mk((t) => t === T.Building),
      trench: mk((t) => t === T.Trench),
    };
  }

  private sample(f: Float32Array, fx: number, fy: number): number {
    const { w, h } = this.map;
    const x = fx - 0.5, y = fy - 0.5;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const u = x - x0, v = y - y0;
    const g = (xx: number, yy: number) => f[Math.max(0, Math.min(h - 1, yy)) * w + Math.max(0, Math.min(w - 1, xx))];
    return (g(x0, y0) * (1 - u) + g(x0 + 1, y0) * u) * (1 - v) + (g(x0, y0 + 1) * (1 - u) + g(x0 + 1, y0 + 1) * u) * v;
  }

  /** Full repaint of the cached ground layer (called at start and when destruction changes tiles). */
  private rebuildBase() {
    const { w, h } = this.map;
    const W = w * PX, H = h * PX;
    const img = this.baseCtx.createImageData(W, H);
    const d = img.data;
    const F = this.fields;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const fx = px / PX, fy = py / PX;
        const n1 = vnoise(px * 0.05, py * 0.05, 11), n2 = vnoise(px * 0.28, py * 0.28, 5), n3 = vnoise(px * 0.9, py * 0.9, 9);
        const warp = (vnoise(px * 0.09, py * 0.09, 21) - 0.5) * 0.5;
        // Base sand with large-scale mottling and grain.
        let c = mix(SAND, SAND2, smooth(0.35, 0.7, n1) * 0.8 + (n2 - 0.5) * 0.35);
        const grain = (n3 - 0.5) * 9;
        const dune = this.sample(F.dune, fx, fy);
        if (dune > 0.15) {
          const ridge = smooth(0.3, 0.8, vnoise(px * 0.03 + 3, py * 0.12, 33));
          c = mix(c, mix(DUNE, DUNE_SH, ridge), smooth(0.15, 0.6, dune + warp * 0.6));
        }
        const gr = this.sample(F.grove, fx, fy);
        if (gr > 0.2) c = mix(c, GROVE_GROUND, smooth(0.2, 0.7, gr + warp) * 0.8);
        const fl = this.sample(F.floor, fx, fy);
        if (fl > 0.4) c = mix(c, FLOOR, smooth(0.4, 0.6, fl));
        const ru = this.sample(F.rubble, fx, fy);
        if (ru > 0.3) c = mix(c, RUBBLE, smooth(0.3, 0.6, ru + (n2 - 0.5) * 0.4));
        const tr = this.sample(F.trench, fx, fy);
        if (tr > 0.3) c = mix(c, TRENCH, smooth(0.3, 0.55, tr + warp * 0.4));
        const ma = this.sample(F.marsh, fx, fy);
        if (ma + warp > 0.4) {
          const reed = smooth(0.4, 0.7, ma + warp);
          c = mix(c, mix(MARSH, MARSH2, n2), reed * 0.92);
          // Open water patches inside the marsh.
          if (vnoise(px * 0.06, py * 0.06, 77) > 0.66 && reed > 0.7) c = mix(c, WATER2, 0.55);
        }
        const rd = this.sample(F.road, fx, fy);
        if (rd + warp * 0.25 > 0.5) c = mix(c, mix(ROAD, ROAD2, n2), 0.95);
        else if (rd > 0.3) c = mix(c, ROAD2, 0.25);
        const wa = this.sample(F.water, fx, fy) + warp * 0.35;
        if (wa > 0.5) c = mix(mix(WATER, WATER2, n2), mix(WATER2, [150, 190, 205], 0.25), smooth(0.5, 0.9, vnoise(px * 0.2, py * 0.05, 3)) * 0.4);
        else if (wa > 0.34) c = mix(c, BANK, smooth(0.34, 0.5, wa) * 0.8); // wet bank
        const o = (py * W + px) * 4;
        d[o] = c[0] + grain; d[o + 1] = c[1] + grain; d[o + 2] = c[2] + grain; d[o + 3] = 255;
      }
    }
    this.baseCtx.putImageData(img, 0, 0);
    this.builtRev = this.map.rev;
  }

  /** Redraws the cached layer when destruction changed tiles (rare, so a full rebuild is fine). */
  refresh() {
    if (this.builtRev !== this.map.rev) {
      this.buildFields();
      this.rebuildBase();
      this.map.dirty.length = 0;
    }
  }

  /** Draws ground + dynamic tile details for the visible region. */
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    this.refresh();
    const b = cam.bounds();
    const [sx0, sy0] = cam.worldToScreen(0, 0);
    const worldW = this.map.w * TILE, worldH = this.map.h * TILE;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, sx0, sy0, worldW * cam.zoom, worldH * cam.zoom);

    const tx0 = Math.max(0, Math.floor(b.x0 / TILE) - 1), tx1 = Math.min(this.map.w - 1, Math.ceil(b.x1 / TILE) + 1);
    const ty0 = Math.max(0, Math.floor(b.y0 / TILE) - 1), ty1 = Math.min(this.map.h - 1, Math.ceil(b.y1 / TILE) + 1);
    const tpx = TILE * cam.zoom;
    const detail = tpx >= 9;

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.map.t[ty * this.map.w + tx];
        if (t === T.Sand || t === T.Road || t === T.Canal || t === T.Marsh || t === T.Dune) continue;
        const [sx, sy] = cam.worldToScreen(tx * TILE, ty * TILE);
        if (t === T.Grove) this.drawPalms(ctx, tx, ty, sx, sy, tpx, detail);
        else if (t === T.Building) this.drawBuilding(ctx, tx, ty, sx, sy, tpx, detail);
        else if (t === T.Bridge) this.drawBridge(ctx, tx, ty, sx, sy, tpx);
        else if (t === T.Rubble && detail) this.drawRubble(ctx, tx, ty, sx, sy, tpx);
        else if (t === T.Trench && detail) this.drawTrench(ctx, tx, ty, sx, sy, tpx);
      }
    }
  }

  private rnd(tx: number, ty: number, k: number) {
    const v = Math.sin(tx * 127.1 + ty * 311.7 + k * 74.7) * 43758.5453;
    return v - Math.floor(v);
  }

  private drawPalms(ctx: CanvasRenderingContext2D, tx: number, ty: number, sx: number, sy: number, s: number, detail: boolean) {
    if (!detail) { ctx.fillStyle = 'rgba(70,100,45,0.85)'; ctx.fillRect(sx, sy, s + 1, s + 1); return; }
    const n = 2;
    for (let i = 0; i < n; i++) {
      const px = sx + (0.2 + this.rnd(tx, ty, i * 3) * 0.6) * s, py = sy + (0.2 + this.rnd(tx, ty, i * 3 + 1) * 0.6) * s;
      const r = s * (0.3 + this.rnd(tx, ty, i * 3 + 2) * 0.12);
      // Shadow
      ctx.fillStyle = 'rgba(30,35,10,0.28)';
      ctx.beginPath(); ctx.ellipse(px + r * 0.35, py + r * 0.35, r * 0.9, r * 0.75, 0, 0, 6.3); ctx.fill();
      // Fronds: a star of leaf spokes.
      ctx.strokeStyle = '#3f6428'; ctx.lineWidth = Math.max(1, r * 0.22); ctx.lineCap = 'round';
      const rot = this.rnd(tx, ty, i + 9) * 6.28;
      ctx.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = rot + (k / 9) * 6.283;
        ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
      }
      ctx.stroke();
      ctx.strokeStyle = '#5c8a35'; ctx.lineWidth = Math.max(0.8, r * 0.1);
      ctx.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = rot + (k / 9) * 6.283;
        ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * r * 0.9, py + Math.sin(a) * r * 0.9);
      }
      ctx.stroke();
      ctx.fillStyle = '#6b5532';
      ctx.beginPath(); ctx.arc(px, py, Math.max(1, r * 0.14), 0, 6.3); ctx.fill();
    }
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, tx: number, ty: number, sx: number, sy: number, s: number, detail: boolean) {
    const hp = this.map.hp[ty * this.map.w + tx] / (TERRAIN[T.Building].hp ?? 1);
    const shade = 0.88 + this.rnd(tx, ty, 1) * 0.16;
    const base = `rgb(${Math.round(196 * shade)},${Math.round(180 * shade)},${Math.round(146 * shade)})`;
    // Drop shadow
    ctx.fillStyle = 'rgba(40,30,10,0.3)';
    ctx.fillRect(sx + s * 0.1, sy + s * 0.1, s, s);
    ctx.fillStyle = base;
    ctx.fillRect(sx, sy, s + 0.5, s + 0.5);
    if (detail) {
      ctx.strokeStyle = 'rgba(70,55,30,0.55)'; ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.strokeRect(sx + s * 0.05, sy + s * 0.05, s * 0.9, s * 0.9);
      ctx.fillStyle = 'rgba(255,255,240,0.14)';
      ctx.fillRect(sx + s * 0.12, sy + s * 0.12, s * 0.76, s * 0.76);
      if (this.rnd(tx, ty, 4) > 0.55) { // rooftop water tank / AC box
        ctx.fillStyle = 'rgba(80,90,95,0.7)'; ctx.fillRect(sx + s * 0.55, sy + s * 0.2, s * 0.25, s * 0.25);
      }
      if (hp < 0.6) { // cracks as the building takes damage
        ctx.strokeStyle = 'rgba(30,20,10,0.8)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sx + s * 0.2, sy + s * 0.1); ctx.lineTo(sx + s * 0.5, sy + s * 0.5); ctx.lineTo(sx + s * 0.4, sy + s * 0.9); ctx.stroke();
      }
    }
  }

  private drawBridge(ctx: CanvasRenderingContext2D, tx: number, ty: number, sx: number, sy: number, s: number) {
    ctx.fillStyle = '#7a6347';
    ctx.fillRect(sx, sy, s + 0.5, s + 0.5);
    ctx.strokeStyle = 'rgba(40,28,15,0.55)'; ctx.lineWidth = 1;
    const horizontalCanal = this.map.get(tx, ty - 1) === T.Canal || this.map.get(tx, ty + 1) === T.Canal;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const k = (i / 4) * s;
      if (horizontalCanal) { ctx.moveTo(sx + k, sy); ctx.lineTo(sx + k, sy + s); } else { ctx.moveTo(sx, sy + k); ctx.lineTo(sx + s, sy + k); }
    }
    ctx.stroke();
    ctx.strokeStyle = '#4a3a26'; ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.beginPath();
    if (horizontalCanal) { ctx.moveTo(sx, sy); ctx.lineTo(sx + s, sy); ctx.moveTo(sx, sy + s); ctx.lineTo(sx + s, sy + s); }
    else { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + s); ctx.moveTo(sx + s, sy); ctx.lineTo(sx + s, sy + s); }
    ctx.stroke();
  }

  private drawRubble(ctx: CanvasRenderingContext2D, tx: number, ty: number, sx: number, sy: number, s: number) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(90,80,66,0.8)' : 'rgba(150,138,118,0.9)';
      const px = sx + this.rnd(tx, ty, i) * s * 0.85, py = sy + this.rnd(tx, ty, i + 20) * s * 0.85;
      ctx.fillRect(px, py, s * (0.1 + this.rnd(tx, ty, i + 40) * 0.15), s * (0.08 + this.rnd(tx, ty, i + 60) * 0.12));
    }
  }

  private drawTrench(ctx: CanvasRenderingContext2D, tx: number, ty: number, sx: number, sy: number, s: number) {
    ctx.fillStyle = 'rgba(40,30,15,0.55)';
    ctx.fillRect(sx + s * 0.2, sy + s * 0.2, s * 0.6, s * 0.6);
    ctx.fillStyle = 'rgba(190,170,110,0.7)'; // spoil berm
    ctx.fillRect(sx + s * 0.1, sy + s * 0.1, s * 0.8, s * 0.1);
  }
}

import type { Camera } from '../core/camera';
import { TILE } from '../core/constants';
import type { World } from '../sim/world';
import { grainTile } from '../ui/theme/textures';

/**
 * Fog of war as an unrevised paper map, plus time-of-day and weather grading.
 *  - unexplored: desaturated, sepia-toned and darker, with a pencilled grid;
 *  - explored but not in sight: desaturated and dimmed (last known state);
 *  - visible: untouched, so the battlefield stays crisp.
 * Grading: dusk warms, night darkens (units with night sights get a green NV patch), dust browns out.
 */
const UP = 4; // fog layers are drawn at 4 px per tile, then smoothed when scaled

export class FogRenderer {
  private raw: HTMLCanvasElement;
  private grey: HTMLCanvasElement;
  private tone: HTMLCanvasElement;
  private grid: HTMLCanvasElement;
  private version = -1;
  private haze = grainTile(256, 90, 51);
  private nv: HTMLCanvasElement | null = null;
  private nvMask(w: number, h: number) {
    // Half resolution is plenty for a soft tint.
    if (!this.nv || this.nv.width !== Math.ceil(w / 2)) this.nv = mk(Math.ceil(w / 2), Math.ceil(h / 2));
    return this.nv;
  }

  constructor(private world: World) {
    const { w, h } = world.map;
    this.raw = mk(w, h);
    this.grey = mk(w * UP, h * UP);
    this.tone = mk(w * UP, h * UP);
    this.grid = mk(w * 8, h * 8);
  }

  private refresh() {
    const fog = this.world.fog;
    if (!fog || fog.version === this.version) return;
    this.version = fog.version;
    const { w, h } = this.world.map;
    const rc = this.raw.getContext('2d')!;
    const paint = (fn: (v: number) => [number, number, number, number]) => {
      const img = rc.createImageData(w, h);
      for (let i = 0; i < fog.vis.length; i++) { const [r, g, b, a] = fn(fog.vis[i]); const o = i * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = a; }
      rc.putImageData(img, 0, 0);
    };
    const up = (dst: HTMLCanvasElement, blur: number) => {
      const c = dst.getContext('2d')!;
      c.clearRect(0, 0, dst.width, dst.height);
      c.filter = `blur(${blur}px)`; c.imageSmoothingEnabled = true;
      c.drawImage(this.raw, 0, 0, dst.width, dst.height);
      c.filter = 'none';
    };
    paint((v) => (v === 2 ? [128, 128, 128, 0] : v === 1 ? [128, 128, 128, 140] : [128, 128, 128, 255]));
    up(this.grey, 3);
    paint((v) => (v === 2 ? [255, 255, 255, 0] : v === 1 ? [176, 164, 138, 150] : [158, 140, 104, 235]));
    up(this.tone, 3);
    // Pencilled map grid (250 m squares) over ground nobody has seen yet.
    paint((v) => (v === 0 ? [0, 0, 0, 255] : [0, 0, 0, 0]));
    const g = this.grid.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, this.grid.width, this.grid.height);
    const px = 8 / TILE;
    g.strokeStyle = 'rgba(60,52,38,0.55)'; g.lineWidth = 1.2;
    for (let x = 0; x < w * TILE; x += 250) { g.beginPath(); g.moveTo(x * px + 0.5, 0); g.lineTo(x * px + 0.5, this.grid.height); g.stroke(); }
    for (let y = 0; y < h * TILE; y += 250) { g.beginPath(); g.moveTo(0, y * px + 0.5); g.lineTo(this.grid.width, y * px + 0.5); g.stroke(); }
    g.strokeStyle = 'rgba(60,52,38,0.25)'; g.lineWidth = 0.8; // fine hatching
    for (let d = -this.grid.height; d < this.grid.width; d += 14) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + this.grid.height, this.grid.height); g.stroke(); }
    g.globalCompositeOperation = 'destination-in';
    g.filter = 'blur(4px)'; g.drawImage(this.raw, 0, 0, this.grid.width, this.grid.height); g.filter = 'none';
    g.globalCompositeOperation = 'source-over';
  }

  /** Fog layer, drawn over the world (before HUD overlays). */
  drawFog(ctx: CanvasRenderingContext2D, cam: Camera) {
    if (!this.world.fog) return;
    this.refresh();
    const [sx, sy] = cam.worldToScreen(0, 0);
    const W = this.world.map.w * TILE * cam.zoom, H = this.world.map.h * TILE * cam.zoom;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'saturation'; ctx.drawImage(this.grey, sx, sy, W, H);
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(this.tone, sx, sy, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(this.grid, sx, sy, W, H);
    ctx.restore();
  }

  /** Time-of-day / weather grading. `nv` = night-sight patches in screen space. */
  drawGrade(ctx: CanvasRenderingContext2D, cam: Camera, time: number, nv: Array<{ x: number; y: number; r: number }>) {
    const env = this.world.env;
    ctx.save();
    if (env.light === 1) {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(232,186,140)'; ctx.fillRect(0, 0, cam.viewW, cam.viewH);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(60,30,10,0.12)'; ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    } else if (env.light === 2) {
      ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.6)'; ctx.fillRect(0, 0, cam.viewW, cam.viewH);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(78,84,82)'; ctx.fillRect(0, 0, cam.viewW, cam.viewH);
      // Night sights: one merged mask (overlaps never stack), tinted phosphor green, lifted with 'screen'.
      if (nv.length) {
        const m = this.nvMask(cam.viewW, cam.viewH);
        const mc = m.getContext('2d')!;
        mc.globalCompositeOperation = 'source-over';
        mc.setTransform(1, 0, 0, 1, 0, 0);
        mc.clearRect(0, 0, m.width, m.height);
        mc.setTransform(0.5, 0, 0, 0.5, 0, 0);
        mc.globalCompositeOperation = 'lighten';
        for (const p of nv) {
          const g = mc.createRadialGradient(p.x, p.y, p.r * 0.15, p.x, p.y, p.r);
          g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.75, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          mc.fillStyle = g; mc.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
        mc.setTransform(1, 0, 0, 1, 0, 0);
        mc.globalCompositeOperation = 'source-in';
        mc.fillStyle = 'rgba(70,140,58,0.38)'; mc.fillRect(0, 0, m.width, m.height);
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(m, 0, 0, cam.viewW, cam.viewH);
      }
    }
    if (env.dust) {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(214,178,120)'; ctx.fillRect(0, 0, cam.viewW, cam.viewH);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(176,138,82,0.28)'; ctx.fillRect(0, 0, cam.viewW, cam.viewH);
      // Drifting haze: large blown-up grain moving with the wind.
      ctx.globalAlpha = 0.18;
      const s = 900, ox = (time * 40) % s, oy = (time * 12) % s;
      for (let x = -ox; x < cam.viewW; x += s) for (let y = -oy; y < cam.viewH; y += s) ctx.drawImage(this.haze, x, y, s, s);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

function mk(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

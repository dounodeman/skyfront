import type { Camera } from '../core/camera';
import { WORLD_H, WORLD_W } from '../core/constants';
import type { Unit } from '../sim/entity';
import type { World } from '../sim/world';
import { listen } from './events';
import { TOKENS } from './theme/tokens';

/**
 * Minimap as a CRT radar scope: phosphor-green terrain, a rotating sweep that "paints" contacts,
 * blips that decay after the sweep passes, enemy contacts in signal red, a camera frame, and a
 * switch row for layers (terrain / fog / contacts). Left-click pans, right-click orders.
 */
export class Radar {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement;
  private fogC: HTMLCanvasElement;
  private fogVersion = -1;
  private lit = new Map<number, { t: number; x: number; y: number; hostile: boolean }>();
  private lastAngle = 0;
  layers = { terrain: true, fog: true, contacts: true };
  private dragging = false;
  private readonly W = 528; private readonly H = 352;

  constructor(private world: World, private cam: Camera, base: HTMLCanvasElement,
    private isVisible: (u: Unit) => boolean, private onOrder: (wx: number, wy: number, queue: boolean) => void, private onSwitch: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'unit scope';
    this.el.innerHTML = `<div class="bezel"><span class="screw" style="left:-4px;top:-4px"></span><span class="screw" style="right:-4px;top:-4px"></span>
      <span class="screw" style="left:-4px;bottom:-4px"></span><span class="screw" style="right:-4px;bottom:-4px"></span>
      <div class="crt" style="height:124px"><canvas></canvas><div class="scan"></div><div class="curve"></div></div></div>
      <div class="switchrow">${(['terrain', 'fog', 'contacts'] as const).map((k) => `<button class="tog on" data-l="${k}"><span class="lever"></span><span class="cap">${k}</span></button>`).join('')}</div>`;
    this.canvas = this.el.querySelector('canvas')!;
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d')!;
    this.terrain = this.phosphorTerrain(base);
    this.fogC = document.createElement('canvas');
    this.fogC.width = world.map.w; this.fogC.height = world.map.h;

    const toWorld = (e: MouseEvent): [number, number] => {
      const r = this.canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * WORLD_W, ((e.clientY - r.top) / r.height) * WORLD_H];
    };
    listen(this.canvas, 'mousedown', (e) => {
      const [wx, wy] = toWorld(e);
      if (e.button === 0) { this.dragging = true; this.cam.centerOn(wx, wy); }
      else if (e.button === 2) this.onOrder(wx, wy, e.shiftKey);
    });
    listen(window, 'mousemove', (e) => { if (this.dragging) { const [wx, wy] = toWorld(e); this.cam.centerOn(wx, wy); } });
    listen(window, 'mouseup', () => { this.dragging = false; });
    listen(this.canvas, 'contextmenu', (e) => e.preventDefault());
    for (const b of Array.from(this.el.querySelectorAll<HTMLButtonElement>('.tog'))) {
      listen(b, 'click', () => {
        const k = b.dataset.l as keyof Radar['layers'];
        this.layers[k] = !this.layers[k];
        b.classList.toggle('on', this.layers[k]);
        this.onSwitch();
      });
    }
  }

  /** Converts the painted terrain into monochrome phosphor (water and buildings read brighter). */
  private phosphorTerrain(base: HTMLCanvasElement) {
    const c = document.createElement('canvas');
    c.width = this.W; c.height = this.H;
    const x = c.getContext('2d')!;
    x.drawImage(base, 0, 0, this.W, this.H);
    const img = x.getImageData(0, 0, this.W, this.H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const water = b > r ? 1 : 0;
      const v = Math.max(0, (lum - 120) / 135) * 0.45 + water * 0.5 + (g > r + 4 ? 0.12 : 0);
      d[i] = 10 + v * 40; d[i + 1] = 30 + v * 150; d[i + 2] = 12 + v * 35; d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  private refreshFog() {
    const fog = this.world.fog;
    if (!fog || fog.version === this.fogVersion) return;
    this.fogVersion = fog.version;
    const x = this.fogC.getContext('2d')!;
    const img = x.createImageData(this.fogC.width, this.fogC.height);
    for (let i = 0; i < fog.vis.length; i++) {
      const v = fog.vis[i];
      img.data[i * 4 + 3] = v === 2 ? 0 : v === 1 ? 110 : 200;
    }
    x.putImageData(img, 0, 0);
  }

  draw(time: number) {
    const { ctx, W, H } = this;
    const sx = W / WORLD_W, sy = H / WORLD_H;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = TOKENS.phosphorDark; ctx.fillRect(0, 0, W, H);
    if (this.layers.terrain) { ctx.globalAlpha = 0.95; ctx.drawImage(this.terrain, 0, 0); ctx.globalAlpha = 1; }
    // Range grid
    ctx.strokeStyle = 'rgba(134,255,110,0.12)'; ctx.lineWidth = 1;
    for (let gx = 0; gx < WORLD_W; gx += 500) { ctx.beginPath(); ctx.moveTo(gx * sx, 0); ctx.lineTo(gx * sx, H); ctx.stroke(); }
    for (let gy = 0; gy < WORLD_H; gy += 500) { ctx.beginPath(); ctx.moveTo(0, gy * sy); ctx.lineTo(W, gy * sy); ctx.stroke(); }
    if (this.layers.fog && this.world.fog) { this.refreshFog(); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.fogC, 0, 0, W, H); }

    // Sweep: phosphor wedge trailing a bright line.
    const cx = W / 2, cy = H / 2;
    const ang = (time * 1.3) % (Math.PI * 2);
    const g = ctx.createConicGradient(ang - 1.2, cx, cy);
    g.addColorStop(0, 'rgba(134,255,110,0)');
    g.addColorStop(0.19, 'rgba(134,255,110,0.16)');
    g.addColorStop(0.191, 'rgba(134,255,110,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(160,255,140,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * W, cy + Math.sin(ang) * W); ctx.stroke();

    // Objectives and depots
    for (const o of this.world.objectives) {
      ctx.strokeStyle = o.owner === null ? TOKENS.neutral : o.owner === 0 ? TOKENS.phosphor : TOKENS.enemy;
      ctx.lineWidth = 2.5;
      const r = Math.max(8, o.radius * sx);
      ctx.strokeRect(o.x * sx - r, o.y * sy - r, r * 2, r * 2);
    }

    // Contacts: the sweep paints them; they fade until painted again.
    if (this.layers.contacts) {
      const prev = this.lastAngle;
      const crossed = (a: number) => {
        const d1 = (a - prev + Math.PI * 4) % (Math.PI * 2), span = (ang - prev + Math.PI * 4) % (Math.PI * 2);
        return d1 <= span;
      };
      for (const u of this.world.units) {
        if (!u.onMap) continue;
        const hostile = u.team !== 0;
        if (hostile && !this.isVisible(u)) continue;
        if (!u.alive) continue;
        const a = Math.atan2(u.y * sy - cy, u.x * sx - cx);
        if (crossed((a + Math.PI * 2) % (Math.PI * 2)) || !this.lit.has(u.id)) this.lit.set(u.id, { t: time, x: u.x, y: u.y, hostile });
      }
      for (const [id, b] of this.lit) {
        const age = time - b.t;
        if (age > 6) { this.lit.delete(id); continue; }
        const u = this.world.get(id);
        const own = u && u.alive && u.team === 0;
        const alpha = own ? Math.max(0.55, 1 - age / 5) : Math.max(0, 1 - age / 5);
        const px = (own ? u!.x : b.x) * sx, py = (own ? u!.y : b.y) * sy;
        ctx.fillStyle = b.hostile ? `rgba(240,60,40,${alpha})` : `rgba(150,255,130,${alpha})`;
        const s = u?.isAir ? 4 : u?.inf ? 3 : 5;
        if (b.hostile) { ctx.beginPath(); ctx.moveTo(px, py - s); ctx.lineTo(px + s, py); ctx.lineTo(px, py + s); ctx.lineTo(px - s, py); ctx.fill(); }
        else ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
      this.lastAngle = ang;
    }

    // Camera frame: amber corner brackets.
    const b = this.cam.bounds();
    const x0 = b.x0 * sx, y0 = b.y0 * sy, x1 = b.x1 * sx, y1 = b.y1 * sy, k = 9;
    ctx.strokeStyle = TOKENS.amber; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + k); ctx.lineTo(x0, y0); ctx.lineTo(x0 + k, y0);
    ctx.moveTo(x1 - k, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + k);
    ctx.moveTo(x1, y1 - k); ctx.lineTo(x1, y1); ctx.lineTo(x1 - k, y1);
    ctx.moveTo(x0 + k, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - k);
    ctx.stroke();
  }
}

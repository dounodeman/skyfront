import { listen } from './events';
import { TEAM_COLORS, WORLD_H, WORLD_W } from '../core/constants';
import type { Camera } from '../core/camera';
import type { World } from '../sim/world';
import type { Unit } from '../sim/entity';

/** Minimap: terrain thumbnail, fog, units, objectives and camera frame. Left-click pans, right-click orders. */
export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dragging = false;
  fog: HTMLCanvasElement | null = null;

  constructor(private world: World, private cam: Camera, private base: HTMLCanvasElement,
    private isVisible: (u: Unit) => boolean, private onOrder: (wx: number, wy: number, queue: boolean) => void) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap';
    this.canvas.width = 222 * 2; this.canvas.height = 148 * 2;
    this.canvas.style.height = '148px';
    this.ctx = this.canvas.getContext('2d')!;
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
  }

  draw() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const sx = W / WORLD_W, sy = H / WORLD_H;
    ctx.drawImage(this.base, 0, 0, W, H);
    if (this.fog) { ctx.imageSmoothingEnabled = true; ctx.drawImage(this.fog, 0, 0, W, H); }
    for (const o of this.world.objectives) {
      ctx.strokeStyle = o.owner === null ? '#ddd' : TEAM_COLORS[o.owner];
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(o.x * sx, o.y * sy, Math.max(6, o.radius * sx), 0, 6.3); ctx.stroke();
    }
    for (const u of this.world.units) {
      if (!u.onMap || !this.isVisible(u)) continue;
      ctx.fillStyle = u.alive ? TEAM_COLORS[u.team] : '#222';
      const r = u.isInfantry ? 2.2 : u.isAir ? 3.6 : 3.2;
      if (u.isAir) { ctx.beginPath(); ctx.moveTo(u.x * sx, u.y * sy - r); ctx.lineTo(u.x * sx + r, u.y * sy + r); ctx.lineTo(u.x * sx - r, u.y * sy + r); ctx.fill(); }
      else ctx.fillRect(u.x * sx - r, u.y * sy - r, r * 2, r * 2);
    }
    const b = this.cam.bounds();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x0 * sx, b.y0 * sy, (b.x1 - b.x0) * sx, (b.y1 - b.y0) * sy);
  }
}

import { TILE } from '../core/constants';
import { Rng } from '../core/rng';
import type { Unit } from '../sim/entity';
import type { World } from '../sim/world';
import { grainTile } from './theme/textures';
import { FONTS } from './theme/tokens';

/**
 * Analog video monitor for the drone tier: monochrome camera view under the selected drone,
 * with static that grows with range and damage, rolling bars, and signal-loss dropouts.
 */
export class DroneFeed {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private noise = grainTile(160, 255, 77);
  private rng = new Rng(5);
  private loss = 0;
  private lastId = 0;
  private lostAt = -99;

  constructor(private world: World, private base: HTMLCanvasElement, private isVisible: (u: Unit) => boolean) {
    this.el = document.createElement('div');
    this.el.className = 'plate dark unit feed';
    this.el.innerHTML = `<div class="bezel"><span class="screw" style="left:-4px;top:-4px"></span><span class="screw" style="right:-4px;top:-4px"></span>
      <div class="crt"><canvas></canvas><div class="scan"></div><div class="curve"></div></div></div><div class="lbl"><span class="a">CAM-1</span><span class="b"></span></div>`;
    this.canvas = this.el.querySelector('canvas')!;
    this.canvas.width = 320; this.canvas.height = 220;
    this.ctx = this.canvas.getContext('2d')!;
  }

  update(selection: Unit[], time: number, dt: number) {
    const d = selection.find((u) => u.def.category === 'drone');
    const lostRecently = time - this.lostAt < 2.5;
    if (d) this.lastId = d.id;
    const tracked = this.world.get(this.lastId);
    const show = !!d || (lostRecently && !!tracked);
    this.el.classList.toggle('on', show);
    if (!show) return;
    if (tracked && !tracked.alive && this.lostAt < 0) this.lostAt = time;
    if (tracked && tracked.alive) this.lostAt = -99;
    const { ctx } = this;
    const W = 320, H = 220;
    const u = tracked;
    if (!u || !u.alive) { this.static(1); this.caption('NO CARRIER', true); return; }

    // Signal quality: range from own depot and airframe damage.
    const dep = this.world.depots[0];
    const range = Math.hypot(u.x - dep.x, u.y - dep.y);
    const q = Math.max(0.15, Math.min(1, 1.25 - range / 3200)) * (0.45 + 0.55 * u.hpFrac);
    if (this.loss <= 0 && this.rng.chance((1 - q) * dt * 1.8)) this.loss = 0.25 + this.rng.next() * 0.5;
    this.loss -= dt;

    // Camera image: painted ground under the drone, then contacts as dark shapes.
    const view = u.def.air?.vtol ? 150 : 320; // metres across
    const px = 10 / TILE; // base canvas px per metre
    ctx.save();
    ctx.filter = 'grayscale(1) contrast(2.1) brightness(0.7)';
    ctx.drawImage(this.base, (u.x - view / 2) * px, (u.y - (view * H / W) / 2) * px, view * px, view * H / W * px, 0, 0, W, H);
    ctx.restore();
    const k = W / view;
    for (const t of this.world.units) {
      if (!t.onMap || (t.team !== 0 && !this.isVisible(t)) || t === u) continue;
      const sx = (t.x - u.x) * k + W / 2, sy = (t.y - u.y) * k + H / 2;
      if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(t.heading);
      ctx.fillStyle = t.alive ? 'rgba(20,20,18,0.85)' : 'rgba(10,10,10,0.6)';
      if (t.inf) for (let i = 0; i < Math.ceil(t.inf.men); i++) ctx.fillRect(((i * 7) % 5 - 2) * 2.5 * k * 0.3, ((i * 3) % 4 - 2) * 2.5 * k * 0.3, 2.5, 2.5);
      else ctx.fillRect(-t.def.sprite.length * k * 0.85, -t.def.sprite.width * k * 0.85, t.def.sprite.length * k * 1.7, t.def.sprite.width * k * 1.7);
      ctx.restore();
    }
    // Tint toward phosphor-grey video, add static and rolling bar.
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#a7b59a'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    this.static(this.loss > 0 ? 0.9 : (1 - q) * 0.55 + 0.08);
    const bar = (time * 60) % (H + 60) - 30;
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, bar, W, 22);
    // Reticle
    ctx.strokeStyle = 'rgba(235,240,225,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W / 2 - 18, H / 2); ctx.lineTo(W / 2 - 6, H / 2); ctx.moveTo(W / 2 + 6, H / 2); ctx.lineTo(W / 2 + 18, H / 2);
    ctx.moveTo(W / 2, H / 2 - 18); ctx.lineTo(W / 2, H / 2 - 6); ctx.moveTo(W / 2, H / 2 + 6); ctx.lineTo(W / 2, H / 2 + 18); ctx.stroke();
    const hdg = String(Math.round(((u.heading * 180) / Math.PI + 450) % 360)).padStart(3, '0');
    ctx.fillStyle = 'rgba(235,240,225,0.9)'; ctx.font = `14px ${FONTS.mono}`; ctx.textAlign = 'left';
    ctx.fillText(`ALT ${String(Math.round(u.altitude)).padStart(3, '0')}  HDG ${hdg}`, 8, 18);
    ctx.fillText(`SIG ${'|'.repeat(Math.round(q * 8)).padEnd(8, '.')}`, 8, H - 10);
    if (this.loss > 0) this.caption('SIGNAL LOSS', false);
    (this.el.querySelector('.b') as HTMLElement).textContent = u.def.name.toUpperCase();
  }

  private static(amount: number) {
    const { ctx } = this;
    ctx.globalAlpha = Math.min(1, amount);
    const ox = this.rng.int(0, 150), oy = this.rng.int(0, 150);
    ctx.drawImage(this.noise, -ox, -oy, 480, 380);
    ctx.globalAlpha = 1;
    if (amount > 0.5) for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgba(230,230,220,${this.rng.next() * 0.25})`; ctx.fillRect(0, this.rng.next() * 220, 320, 1 + this.rng.next() * 4); }
  }

  private caption(s: string, full: boolean) {
    const { ctx } = this;
    if (full) { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 320, 220); this.static(1); }
    ctx.fillStyle = 'rgba(10,10,8,0.8)'; ctx.fillRect(80, 92, 160, 34);
    ctx.fillStyle = '#e8e0c8'; ctx.font = `18px ${FONTS.stencil}`; ctx.textAlign = 'center';
    ctx.fillText(s, 160, 116); ctx.textAlign = 'left';
  }
}

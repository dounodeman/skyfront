import { fx } from '../ui/settings';
import { grainCanvas } from '../ui/theme/textures';

/**
 * Screen post-effects on a separate canvas above the battlefield and below the HUD:
 * animated film grain and a vignette. Both toggleable; "clean HUD" disables them.
 * (Scanlines and CRT curvature are limited to the radar and drone monitor — see CSS.)
 */
export class PostFX {
  private ctx: CanvasRenderingContext2D;
  private grain = grainCanvas();
  private pattern: CanvasPattern | null = null;
  private vignette: HTMLCanvasElement | null = null;
  private frame = 0;
  private w = 0; private h = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.pattern = this.ctx.createPattern(this.grain, 'repeat');
    const v = document.createElement('canvas');
    v.width = this.w; v.height = this.h;
    const c = v.getContext('2d')!;
    const g = c.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.42, this.w / 2, this.h / 2, Math.hypot(this.w, this.h) * 0.62);
    g.addColorStop(0, 'rgba(10,9,6,0)'); g.addColorStop(1, 'rgba(10,9,6,0.62)');
    c.fillStyle = g; c.fillRect(0, 0, this.w, this.h);
    this.vignette = v;
  }

  draw() {
    const { ctx } = this;
    this.frame++;
    if (this.frame % 3 && this.frame > 3) return; // grain refreshes ~20 fps, like film
    ctx.clearRect(0, 0, this.w, this.h);
    if (fx.vignette && this.vignette) ctx.drawImage(this.vignette, 0, 0);
    if (fx.grain && this.pattern) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.translate(-Math.random() * 256, -Math.random() * 256);
      ctx.fillStyle = this.pattern;
      ctx.fillRect(0, 0, this.w + 256, this.h + 256);
      ctx.restore();
    }
  }
}

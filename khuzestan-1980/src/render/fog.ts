import type { Camera } from '../core/camera';
import { TILE } from '../core/constants';
import type { World } from '../sim/world';

/** Fog-of-war overlay (tile resolution, smoothed when scaled) plus night and dust-storm tints. */
export class FogRenderer {
  /** Blurred, 4x upscaled fog used for drawing (soft edges). */
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raw: HTMLCanvasElement;
  private rawCtx: CanvasRenderingContext2D;
  private img: ImageData;
  private version = -1;

  constructor(private world: World) {
    this.raw = document.createElement('canvas');
    this.raw.width = world.map.w; this.raw.height = world.map.h;
    this.rawCtx = this.raw.getContext('2d')!;
    this.img = this.rawCtx.createImageData(world.map.w, world.map.h);
    this.canvas = document.createElement('canvas');
    this.canvas.width = world.map.w * 4; this.canvas.height = world.map.h * 4;
    this.ctx = this.canvas.getContext('2d')!;
  }

  refresh() {
    const fog = this.world.fog;
    if (!fog || fog.version === this.version) return;
    this.version = fog.version;
    const d = this.img.data;
    for (let i = 0; i < fog.vis.length; i++) {
      const v = fog.vis[i];
      const o = i * 4;
      d[o] = 8; d[o + 1] = 10; d[o + 2] = 7;
      d[o + 3] = v === 2 ? 0 : v === 1 ? 120 : 225;
    }
    this.rawCtx.putImageData(this.img, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.filter = 'blur(3px)';
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.raw, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.filter = 'none';
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const env = this.world.env;
    if (env.light > 0) {
      ctx.fillStyle = env.light === 2 ? 'rgba(8,16,44,0.48)' : 'rgba(70,40,30,0.22)';
      ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    }
    if (env.dust) {
      ctx.fillStyle = 'rgba(176,138,82,0.32)';
      ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    }
    if (!this.world.fog) return;
    this.refresh();
    const [sx, sy] = cam.worldToScreen(0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.canvas, sx, sy, this.world.map.w * TILE * cam.zoom, this.world.map.h * TILE * cam.zoom);
  }
}

import { WORLD_H, WORLD_W } from './constants';
import { clamp } from './math';

/** Top-down camera. `zoom` is screen pixels per world metre. */
export class Camera {
  x = WORLD_W / 2; // world position at screen centre
  y = WORLD_H / 2;
  zoom = 2;
  minZoom = 0.45;
  maxZoom = 6;
  viewW = 1280;
  viewH = 720;

  resize(w: number, h: number) { this.viewW = w; this.viewH = h; }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.zoom + this.viewW / 2, (wy - this.y) * this.zoom + this.viewH / 2];
  }
  screenToWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.viewW / 2) / this.zoom + this.x, (sy - this.viewH / 2) / this.zoom + this.y];
  }
  /** Zoom keeping the world point under the cursor fixed. */
  zoomAt(sx: number, sy: number, factor: number) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    this.x = wx - (sx - this.viewW / 2) / this.zoom;
    this.y = wy - (sy - this.viewH / 2) / this.zoom;
    this.clampToWorld();
  }
  pan(dxPx: number, dyPx: number) {
    this.x += dxPx / this.zoom;
    this.y += dyPx / this.zoom;
    this.clampToWorld();
  }
  centerOn(wx: number, wy: number) { this.x = wx; this.y = wy; this.clampToWorld(); }
  /** Keep the view inside the map (centre it when zoomed out further than the map). */
  clampToWorld() {
    const hw = this.viewW / 2 / this.zoom, hh = this.viewH / 2 / this.zoom;
    this.x = hw * 2 >= WORLD_W ? WORLD_W / 2 : clamp(this.x, hw, WORLD_W - hw);
    this.y = hh * 2 >= WORLD_H ? WORLD_H / 2 : clamp(this.y, hh - 40, WORLD_H - hh + 180); // room for the HUD bars
  }
  /** Visible world rectangle. */
  bounds() {
    const hw = this.viewW / 2 / this.zoom, hh = this.viewH / 2 / this.zoom;
    return { x0: this.x - hw, y0: this.y - hh, x1: this.x + hw, y1: this.y + hh };
  }
}

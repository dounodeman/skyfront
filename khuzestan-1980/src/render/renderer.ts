import type { Camera } from '../core/camera';
import { TEAM_COLORS, TILE } from '../core/constants';
import type { Unit } from '../sim/entity';
import type { World } from '../sim/world';
import { TerrainRenderer } from './terrainRender';
import { drawAirShadow, drawBars, drawSelection, drawUnit, type SpriteFlags } from './sprites';

export interface DrawState {
  selected: Set<number>;
  hoverId: number;
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  time: number;
  /** Predicate: should this unit be drawn (fog of war)? */
  visible: (u: Unit) => boolean;
  showPaths: boolean;
  cursorMode: string;
}

/** Draws the whole battlefield. Pure view code: reads the World, never mutates it. */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  terrain: TerrainRenderer;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement, public world: World, public cam: Camera) {
    this.ctx = canvas.getContext('2d')!;
    this.terrain = new TerrainRenderer(world.map);
    this.resize();
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.cam.resize(w, h);
  }

  draw(st: DrawState) {
    const { ctx, cam, world } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b0d09';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    this.terrain.draw(ctx, cam);

    const b = cam.bounds();
    const margin = 30;
    const inView = (u: Unit) => u.x > b.x0 - margin && u.x < b.x1 + margin && u.y > b.y0 - margin && u.y < b.y1 + margin;

    const flags: SpriteFlags = { selected: false, hover: false, time: st.time, zoom: cam.zoom, friendlyView: true };
    const units = world.units.filter((u) => !u.carrier && inView(u) && st.visible(u));
    // Wrecks first, then ground units (sorted so lower units overlap), then aircraft.
    const wrecks = units.filter((u) => !u.alive);
    const ground = units.filter((u) => u.alive && !u.isAir);
    const air = units.filter((u) => u.alive && u.isAir);
    for (const u of wrecks) { const [sx, sy] = cam.worldToScreen(u.x, u.y); drawUnit(ctx, u, sx, sy, flags); }
    ground.sort((a, c) => a.y - c.y);
    for (const u of ground) { const [sx, sy] = cam.worldToScreen(u.x, u.y); drawUnit(ctx, u, sx, sy, flags); }
    for (const u of air) { const [sx, sy] = cam.worldToScreen(u.x, u.y); drawAirShadow(ctx, u, sx, sy, cam.zoom); }
    air.sort((a, c) => a.altitude - c.altitude);
    for (const u of air) {
      const [sx, sy] = cam.worldToScreen(u.x, u.y);
      // Lift the sprite slightly with altitude for a parallax hint.
      drawUnit(ctx, u, sx, sy - u.altitude * 0.06 * cam.zoom, flags);
    }

    // Overlays: bars, selection, orders.
    for (const u of [...ground, ...air]) {
      const [sx, sy] = cam.worldToScreen(u.x, u.y);
      const sel = st.selected.has(u.id), hov = st.hoverId === u.id;
      if (sel || hov) drawSelection(ctx, u, sx, sy, cam.zoom, !sel && hov);
      if (sel || hov || u.hpFrac < 0.995) drawBars(ctx, u, sx, sy, cam.zoom, sel);
    }
    if (st.showPaths) this.drawOrders(st);
    this.drawObjectives();

    if (st.box) {
      const { x0, y0, x1, y1 } = st.box;
      ctx.strokeStyle = '#7dff9b'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(125,255,155,0.08)';
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  }

  private drawObjectives() {
    const { ctx, cam, world } = this;
    for (const o of world.objectives) {
      const [sx, sy] = cam.worldToScreen(o.x, o.y);
      const r = o.radius * cam.zoom;
      if (sx < -r - 40 || sy < -r - 40 || sx > cam.viewW + r + 40 || sy > cam.viewH + r + 40) continue;
      const col = o.owner === null ? '#d9d9d9' : TEAM_COLORS[o.owner];
      ctx.save();
      ctx.strokeStyle = col + 'cc'; ctx.fillStyle = col + '14'; ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.3); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      // Capture progress arc
      const p = (o.progress + 1) / 2;
      ctx.lineWidth = 5; ctx.strokeStyle = TEAM_COLORS[0]; ctx.beginPath(); ctx.arc(sx, sy, r + 6, -Math.PI / 2, -Math.PI / 2 + 6.283 * p); ctx.stroke();
      ctx.strokeStyle = TEAM_COLORS[1]; ctx.beginPath(); ctx.arc(sx, sy, r + 6, -Math.PI / 2 + 6.283 * p, -Math.PI / 2 + 6.283); ctx.stroke();
      // Flag + label
      ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sy - 22); ctx.lineTo(sx + 16, sy - 17); ctx.lineTo(sx, sy - 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, sy - 22); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.font = '600 12px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000c';
      ctx.strokeText(o.name, sx, sy + r + 20); ctx.fillStyle = '#f2f2e6'; ctx.fillText(o.name, sx, sy + r + 20);
      ctx.restore();
    }
  }

  private drawOrders(st: DrawState) {
    const { ctx, cam, world } = this;
    ctx.save();
    ctx.lineWidth = 1.2;
    for (const id of st.selected) {
      const u = world.alive(id);
      if (!u || u.carrier || !u.orders.length) continue;
      let px = u.x, py = u.y;
      ctx.beginPath();
      const [sx, sy] = cam.worldToScreen(px, py);
      ctx.moveTo(sx, sy);
      let attack = false;
      const pts: Array<[number, number, string]> = [];
      // Remaining path of the active move, then queued order destinations.
      if (u.orders[0].type === 'move') for (let i = u.mob.pathI; i < u.mob.path.length; i++) pts.push([u.mob.path[i].x, u.mob.path[i].y, 'path']);
      for (let i = 0; i < u.orders.length; i++) {
        const o = u.orders[i];
        if (o.type === 'move' && !(i === 0 && pts.length)) pts.push([o.x, o.y, o.attackMove ? 'amove' : 'move']);
        else if (o.type === 'move') { const last = pts[pts.length - 1]; if (last) last[2] = o.attackMove ? 'amove' : 'move'; }
        else if (o.type === 'attack') { const t = world.alive(o.targetId); if (t) { pts.push([t.x, t.y, 'attack']); attack = true; } }
        else if (o.type === 'unload') pts.push([o.x, o.y, 'unload']);
        else if (o.type === 'board') { const t = world.alive(o.targetId); if (t) pts.push([t.x, t.y, 'board']); }
      }
      ctx.strokeStyle = attack ? 'rgba(255,100,80,0.7)' : 'rgba(125,255,155,0.55)';
      for (const [x, y] of pts) { const [qx, qy] = cam.worldToScreen(x, y); ctx.lineTo(qx, qy); }
      ctx.stroke();
      for (const [x, y, kind] of pts) {
        if (kind === 'path') continue;
        const [qx, qy] = cam.worldToScreen(x, y);
        ctx.fillStyle = kind === 'attack' ? '#ff6450' : kind === 'amove' ? '#ffb347' : '#7dff9b';
        ctx.beginPath(); ctx.arc(qx, qy, 3.5, 0, 6.3); ctx.fill();
      }
      px = 0; py = 0;
    }
    ctx.restore();
  }
}
void TILE;

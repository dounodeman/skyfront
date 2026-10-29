import type { Camera } from '../core/camera';
import { SPRITE_SCALE, TEAM_COLORS } from '../core/constants';
import type { Unit } from '../sim/entity';
import type { World } from '../sim/world';
import { envVisionMul } from '../sim/systems/vision';
import { fx } from '../ui/settings';
import { FONTS, TOKENS } from '../ui/theme/tokens';
import { Effects } from './effects';
import { Feedback } from './feedback';
import { FogRenderer } from './fog';
import { airLift, drawAirShadow, drawBars, drawRangeRing, drawSelection, drawUnit, type SpriteFlags } from './sprites';
import { TerrainRenderer } from './terrainRender';

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

/**
 * Draws the battlefield. Pure view code: reads the World, never mutates it.
 * Layer order: terrain → ground decals (scorch, treads, brass) → acetate marks (ghosts, orders) →
 * wrecks → ground units → dust/projectiles → aircraft → smoke/fire → light (bloom, flicker, rings) →
 * heat shimmer → fog of war → grading → selection overlays → objectives → callouts.
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  terrain: TerrainRenderer;
  effects: Effects;
  fog: FogRenderer;
  feedback: Feedback;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement, public world: World, public cam: Camera, isVisible: (u: Unit) => boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.terrain = new TerrainRenderer(world.map);
    this.effects = new Effects(world);
    this.fog = new FogRenderer(world);
    this.feedback = new Feedback(world, cam, isVisible);
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
    // Camera shake: offset the camera for this frame only.
    const [shx, shy] = this.feedback.shakeOffset();
    const cx0 = cam.x, cy0 = cam.y;
    cam.x += shx / cam.zoom; cam.y += shy / cam.zoom;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = TOKENS.oil;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    this.terrain.draw(ctx, cam);
    this.effects.drawDecals(ctx, cam);
    this.effects.drawCasings(ctx, cam);
    this.feedback.drawGround(ctx, cam);

    const b = cam.bounds();
    const margin = 40;
    const inView = (u: Unit) => u.x > b.x0 - margin && u.x < b.x1 + margin && u.y > b.y0 - margin && u.y < b.y1 + margin;
    const flags: SpriteFlags = { selected: false, hover: false, time: st.time, zoom: cam.zoom, friendlyView: true };
    const units = world.units.filter((u) => !u.carrier && inView(u) && st.visible(u));
    const wrecks = units.filter((u) => !u.alive);
    const ground = units.filter((u) => u.alive && !u.isAir).sort((a, c) => a.y - c.y);
    const air = units.filter((u) => u.alive && u.isAir).sort((a, c) => a.altitude - c.altitude);

    for (const u of wrecks) { const [sx, sy] = cam.worldToScreen(u.x, u.y); drawUnit(ctx, u, sx, sy, flags); }
    for (const u of ground) { const [sx, sy] = cam.worldToScreen(u.x, u.y); drawUnit(ctx, u, sx, sy, flags); }
    this.effects.draw(ctx, cam, false);
    this.effects.drawProjectiles(ctx, cam);
    for (const u of air) { const [sx, sy] = cam.worldToScreen(u.x, u.y); drawAirShadow(ctx, u, sx, sy, cam.zoom); }
    for (const u of air) { const [sx, sy] = cam.worldToScreen(u.x, u.y); drawUnit(ctx, u, sx, sy - airLift(u) * cam.zoom, flags); }
    this.effects.draw(ctx, cam, true);
    this.effects.drawLights(ctx, cam, st.time);
    if (fx.shimmer) this.shimmer(wrecks, st.time);
    this.fog.drawFog(ctx, cam);
    this.fog.drawGrade(ctx, cam, st.time, this.nightSights());

    // Overlays: range rings, brackets, segmented status, passenger counts.
    const sel = [...ground, ...air].filter((u) => st.selected.has(u.id));
    if (sel.length <= 6) for (const u of sel) {
      const w = u.weapons[0];
      if (!w) continue;
      const [sx, sy] = cam.worldToScreen(u.x, u.y - airLift(u));
      drawRangeRing(ctx, sx, sy, w.def.range * cam.zoom);
    }
    for (const u of [...ground, ...air]) {
      const [sx, sy] = cam.worldToScreen(u.x, u.y - airLift(u));
      const s = st.selected.has(u.id), hov = st.hoverId === u.id;
      if (s || hov) drawSelection(ctx, u, sx, sy, cam.zoom, !s && hov);
      if (s || hov || u.hpFrac < 0.995 || (u.inf && u.inf.suppression > 15)) drawBars(ctx, u, sx, sy, cam.zoom, s);
      if (u.cargo.length && u.team === 0) {
        const bx = sx + 13, by = sy - 13;
        ctx.fillStyle = TOKENS.oil; ctx.fillRect(bx - 7, by - 7, 14, 14);
        ctx.strokeStyle = TOKENS.amber; ctx.lineWidth = 1.2; ctx.strokeRect(bx - 6, by - 6, 12, 12);
        ctx.fillStyle = TOKENS.amber; ctx.font = `11px ${FONTS.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(u.cargo.length), bx, by + 0.5); ctx.textBaseline = 'alphabetic';
      }
    }
    if (st.showPaths) this.drawOrders(st);
    this.drawObjectives();
    this.feedback.drawTexts(ctx, cam);

    if (st.box) {
      const { x0, y0, x1, y1 } = st.box;
      const ax = Math.min(x0, x1), ay = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      ctx.fillStyle = 'rgba(233,163,26,0.07)'; ctx.fillRect(ax, ay, w, h);
      ctx.strokeStyle = TOKENS.amber; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
      ctx.strokeRect(ax + 0.5, ay + 0.5, w, h); ctx.setLineDash([]);
    }
    cam.x = cx0; cam.y = cy0;
  }

  /** Screen-space patches for friendly units with real night sights (IR/NV, radar). */
  private nightSights() {
    if (this.world.env.light !== 2) return [];
    const out: Array<{ x: number; y: number; r: number }> = [];
    for (const u of this.world.units) {
      if (u.team !== 0 || !u.alive || u.carrier || u.def.vision.night < 0.5) continue;
      const [x, y] = this.cam.worldToScreen(u.x, u.y);
      const r = u.def.vision.range * envVisionMul(this.world, u) * this.cam.zoom;
      if (x + r < 0 || y + r < 0 || x - r > this.cam.viewW || y - r > this.cam.viewH) continue;
      out.push({ x, y, r });
    }
    return out;
  }

  /** Heat haze above burning wrecks: horizontal strips of the frame nudged sideways. */
  private shimmer(wrecks: Unit[], time: number) {
    const { ctx, cam } = this;
    const hot = wrecks.filter((u) => u.wreck && this.world.time - u.wreckTime < 45).slice(0, 6);
    if (!hot.length || cam.zoom < 1) return;
    const d = this.dpr;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const u of hot) {
      const [sx, sy] = cam.worldToScreen(u.x, u.y);
      const w = Math.round(26 * cam.zoom * d), h = Math.round(34 * cam.zoom * d);
      const x0 = Math.round(sx * d - w / 2), y0 = Math.round(sy * d - h);
      if (x0 < 0 || y0 < 0 || x0 + w > this.canvas.width || y0 + h > this.canvas.height) continue;
      const strip = Math.max(2, Math.round(3 * d));
      for (let y = 0; y < h; y += strip) {
        const k = (1 - y / h) * 0.3 + 0.7 * (y / h);
        const off = Math.sin(time * 9 + y * 0.35 + u.id) * 1.6 * d * k;
        ctx.drawImage(this.canvas, x0, y0 + y, w, strip, x0 + off, y0 + y, w, strip);
      }
    }
    ctx.restore();
  }

  private drawObjectives() {
    const { ctx, cam, world } = this;
    // Supply depots: stencilled marker in a dashed square.
    world.depots.forEach((d, team) => {
      const [sx, sy] = cam.worldToScreen(d.x, d.y);
      if (sx < -120 || sy < -120 || sx > cam.viewW + 120 || sy > cam.viewH + 120) return;
      const r = 140 * cam.zoom;
      const col = team === 0 ? TOKENS.bone : TOKENS.signal;
      ctx.save();
      ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5; ctx.setLineDash([8, 8]);
      ctx.strokeRect(sx - r, sy - r, r * 2, r * 2); ctx.setLineDash([]); ctx.globalAlpha = 1;
      label(ctx, team === 0 ? 'SUPPLY DEPOT' : 'ENEMY DEPOT', sx, sy + 4, col);
      ctx.restore();
    });
    for (const o of world.objectives) {
      const [sx, sy] = cam.worldToScreen(o.x, o.y);
      const r = o.radius * cam.zoom;
      if (sx < -r - 60 || sy < -r - 60 || sx > cam.viewW + r + 60 || sy > cam.viewH + r + 60) continue;
      const col = o.owner === null ? TOKENS.neutral : TEAM_COLORS[o.owner];
      ctx.save();
      // Grease-pencil circle on the acetate, with a hand-drawn wobble.
      ctx.strokeStyle = TOKENS.oil; ctx.lineWidth = 4; ctx.globalAlpha = 0.5; wobbleCircle(ctx, sx, sy, r, o.x); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.85; wobbleCircle(ctx, sx, sy, r, o.x); ctx.stroke();
      ctx.globalAlpha = 1;
      if (Math.abs(o.progress) > 0.01) {
        // Capture progress: tick marks around the rim, coloured for the side holding the edge.
        const n = Math.round(Math.abs(o.progress) * 36);
        ctx.strokeStyle = TEAM_COLORS[o.progress > 0 ? 0 : 1]; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / 36) * Math.PI * 2; ctx.moveTo(sx + Math.cos(a) * (r + 4), sy + Math.sin(a) * (r + 4)); ctx.lineTo(sx + Math.cos(a) * (r + 11), sy + Math.sin(a) * (r + 11)); }
        ctx.stroke();
      }
      label(ctx, o.name.toUpperCase(), sx, sy + r + 20, col);
      // Push-pin
      ctx.fillStyle = col; ctx.strokeStyle = TOKENS.oil; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy - 8, 5, 0, 6.3); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, sy - 3); ctx.lineTo(sx, sy + 5); ctx.stroke();
      ctx.restore();
    }
  }

  private drawOrders(st: DrawState) {
    const { ctx, cam, world } = this;
    ctx.save();
    ctx.lineWidth = 1.4;
    for (const id of st.selected) {
      const u = world.alive(id);
      if (!u || u.carrier || !u.orders.length) continue;
      const [sx, sy] = cam.worldToScreen(u.x, u.y);
      let attack = false;
      const pts: Array<[number, number, string]> = [];
      if (u.orders[0].type === 'move') for (let i = u.mob.pathI; i < u.mob.path.length; i++) pts.push([u.mob.path[i].x, u.mob.path[i].y, 'path']);
      for (let i = 0; i < u.orders.length; i++) {
        const o = u.orders[i];
        if (o.type === 'move' && !(i === 0 && pts.length)) pts.push([o.x, o.y, o.attackMove ? 'amove' : 'move']);
        else if (o.type === 'move') { const last = pts[pts.length - 1]; if (last) last[2] = o.attackMove ? 'amove' : 'move'; }
        else if (o.type === 'attack') { const t = world.alive(o.targetId); if (t && st.visible(t)) { pts.push([t.x, t.y, 'attack']); attack = true; } }
        else if (o.type === 'unload') pts.push([o.x, o.y, 'unload']);
        else if (o.type === 'board') { const t = world.alive(o.targetId); if (t) pts.push([t.x, t.y, 'board']); }
      }
      // Grease-pencil route: dashed line, ticks at waypoints.
      ctx.strokeStyle = attack ? 'rgba(208,48,28,0.8)' : 'rgba(232,224,200,0.6)';
      ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.moveTo(sx, sy);
      for (const [x, y] of pts) { const [qx, qy] = cam.worldToScreen(x, y); ctx.lineTo(qx, qy); }
      ctx.stroke(); ctx.setLineDash([]);
      for (const [x, y, kind] of pts) {
        if (kind === 'path') continue;
        const [qx, qy] = cam.worldToScreen(x, y);
        ctx.strokeStyle = kind === 'attack' ? TOKENS.signal : kind === 'amove' ? TOKENS.amber : TOKENS.bone;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(qx - 5, qy - 5); ctx.lineTo(qx + 5, qy + 5); ctx.moveTo(qx + 5, qy - 5); ctx.lineTo(qx - 5, qy + 5); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, col: string) {
  ctx.font = `12px ${FONTS.stencil}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const t = s.split('').join(' ');
  const w = ctx.measureText(t).width + 12;
  ctx.fillStyle = 'rgba(22,20,15,0.78)'; ctx.fillRect(x - w / 2, y - 9, w, 18);
  ctx.fillStyle = col; ctx.fillText(t, x, y + 1);
  ctx.textBaseline = 'alphabetic';
}

function wobbleCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rr = r * (1 + Math.sin(a * 3 + seed) * 0.012 + Math.sin(a * 7 + seed * 2) * 0.008);
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
}
void SPRITE_SCALE;

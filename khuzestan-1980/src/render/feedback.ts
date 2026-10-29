import type { Camera } from '../core/camera';
import { SPRITE_SCALE, TILE } from '../core/constants';
import { AMMO } from '../data/ammo';
import type { UnitDef } from '../data/units/types';
import type { Unit } from '../sim/entity';
import type { World } from '../sim/world';
import { settings } from '../ui/settings';
import { FONTS, TOKENS } from '../ui/theme/tokens';

type MarkerKind = 'move' | 'amove' | 'attack' | 'unload';
interface Marker { x: number; y: number; kind: MarkerKind; t: number; angle: number }
interface Floater { x: number; y: number; text: string; color: string; t: number; rot: number; slot: number }
interface Ghost { x: number; y: number; def: UnitDef; t: number; heading: number }

const STATUS_TEXT: Record<string, string> = {
  'Crew bailed out': 'CREW BAILED', 'Track broken': 'MOBILITY KILL', 'Engine destroyed': 'MOBILITY KILL', 'Driver killed': 'MOBILITY KILL',
  'Main gun disabled': 'FIREPOWER KILL', 'Ammunition detonation!': 'CATASTROPHIC', 'Squad broken – falling back': 'BROKEN',
  'Bogged down in the marsh': 'BOGGED', 'Engine stalled': 'STALLED', 'Vehicle on fire': 'ON FIRE', 'Crew knocked out': 'CREW DOWN',
  'Turret traverse jammed': 'TURRET JAM', 'Rallied': 'RALLIED',
};

/**
 * Commander's acetate overlay: order markers, stencilled floating callouts, last-known enemy
 * positions in grease pencil, and camera shake. View-only: reads the world, never changes it.
 */
export class Feedback {
  markers: Marker[] = [];
  texts: Floater[] = [];
  ghosts = new Map<number, Ghost>();
  private shake = 0;
  private lastText = new Map<string, number>();
  private infState = new Map<number, string>();
  private time = 0;
  private scanTimer = 0;

  constructor(private world: World, private cam: Camera, private isVisible: (u: Unit) => boolean) {
    const bus = world.bus;
    bus.on('impact', (e) => {
      if (e.kind === 'ricochet') this.callout(e.x, e.y, 'RICOCHET', TOKENS.bone, 1.2);
      else if (e.kind === 'pen' && AMMO[e.ammoId].caliber >= 20) this.callout(e.x, e.y, 'PENETRATION', TOKENS.amber, 1.2);
    });
    bus.on('kill', (e) => {
      if (!this.isVisible(e.unit) || e.unit.ai.detonated) return;
      const t = e.unit.inf ? 'WIPED OUT' : e.unit.abandoned ? 'CREW BAILED' : e.brewUp ? 'DESTROYED' : 'KNOCKED OUT';
      this.callout(e.unit.x, e.unit.y - 6, t, e.unit.team === 0 ? TOKENS.signal : TOKENS.bone, 0, true);
      this.ghosts.delete(e.unit.id);
    });
    bus.on('status', (e) => {
      const t = STATUS_TEXT[e.text];
      if (t && this.isVisible(e.unit) && t !== 'CREW BAILED') this.callout(e.unit.x, e.unit.y - 6, t, e.unit.team === 0 ? TOKENS.signal : TOKENS.amber, 0, true);
    });
    bus.on('shot', (e) => {
      const cal = AMMO[e.ammoId].caliber;
      if (cal >= 60) this.kick(e.x, e.y, cal / 100 * 2.2);
    });
    bus.on('explosion', (e) => this.kick(e.x, e.y, e.size * 3));
  }

  /** Order marker dropped at a destination (called by the controls). */
  order(kind: MarkerKind, x: number, y: number, fromX: number, fromY: number) {
    this.markers.push({ x, y, kind, t: this.time, angle: Math.atan2(y - fromY, x - fromX) });
    if (this.markers.length > 40) this.markers.shift();
  }

  private callout(x: number, y: number, text: string, color: string, throttle: number, force = false) {
    if (!settings.floatText) return;
    const b = this.cam.bounds();
    if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return;
    const key = `${text}:${Math.round(x / 40)}:${Math.round(y / 40)}`;
    if (!force && this.time - (this.lastText.get(key) ?? -9) < throttle) return;
    this.lastText.set(key, this.time);
    // Callouts at the same spot ladder upward instead of overprinting.
    const busy = this.texts.filter((f) => Math.hypot(f.x - x, f.y - y) < 30 && this.time - f.t < 1.6).map((f) => f.slot);
    let slot = 0;
    while (busy.includes(slot)) slot++;
    this.texts.push({ x, y, text, color, t: this.time, rot: (Math.random() - 0.5) * 0.12, slot });
    if (this.texts.length > 30) this.texts.shift();
  }

  private kick(x: number, y: number, amount: number) {
    if (!settings.shake) return;
    const b = this.cam.bounds();
    const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    const near = 1 - Math.min(1, Math.hypot(x - this.cam.x, y - this.cam.y) / span);
    this.shake = Math.min(9, this.shake + amount * near * near);
  }

  /** Screen-space camera offset for this frame. */
  shakeOffset(): [number, number] {
    if (this.shake < 0.05) return [0, 0];
    return [(Math.random() - 0.5) * 2 * this.shake, (Math.random() - 0.5) * 2 * this.shake];
  }

  update(dt: number) {
    this.time += dt;
    this.shake *= Math.exp(-dt * 9);
    this.markers = this.markers.filter((m) => this.time - m.t < 1.6);
    this.texts = this.texts.filter((f) => this.time - f.t < 1.9);
    this.scanTimer -= dt;
    if (this.scanTimer > 0) return;
    this.scanTimer = 0.2;
    const w = this.world;
    for (const u of w.units) {
      if (!u.alive || !u.onMap) continue;
      // Suppression callouts on transitions into "pinned".
      if (u.inf) {
        const prev = this.infState.get(u.id);
        if (prev && prev !== 'pinned' && u.inf.state === 'pinned' && this.isVisible(u)) this.callout(u.x, u.y - 5, 'SUPPRESSED', u.team === 0 ? TOKENS.signal : TOKENS.amber, 0, true);
        this.infState.set(u.id, u.inf.state);
      }
      if (u.team === 0) continue;
      if (this.isVisible(u)) this.ghosts.set(u.id, { x: u.x, y: u.y, def: u.def, t: this.time, heading: u.heading });
    }
    // Revise the map: drop ghosts whose spot is in view again, or that have gone stale.
    for (const [id, g] of this.ghosts) {
      const u = w.get(id);
      if (!u || !u.alive) { this.ghosts.delete(id); continue; }
      if (this.isVisible(u)) continue;
      const i = Math.floor(g.y / TILE) * w.map.w + Math.floor(g.x / TILE);
      if ((w.fog && w.fog.vis[i] === 2) || this.time - g.t > 150) this.ghosts.delete(id);
    }
  }

  /** Ground-level marks: ghosts and order markers. */
  drawGround(ctx: CanvasRenderingContext2D, cam: Camera) {
    // Ghost markers: last-known enemy positions in red grease pencil.
    for (const [id, g] of this.ghosts) {
      const u = this.world.get(id);
      if (u && this.isVisible(u)) continue;
      const [sx, sy] = cam.worldToScreen(g.x, g.y);
      if (sx < -30 || sy < -30 || sx > cam.viewW + 30 || sy > cam.viewH + 30) continue;
      const age = this.time - g.t;
      const a = Math.max(0.15, 0.75 - age / 200);
      const s = Math.max(12, Math.max(g.def.sprite.length, g.def.sprite.width) * cam.zoom * SPRITE_SCALE * 0.6);
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = TOKENS.signal; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      for (const j of [0, 1.5]) { // double pencil stroke
        ctx.beginPath();
        ctx.moveTo(sx + j * 0.5, sy - s - j); ctx.lineTo(sx + s + j, sy + j * 0.3); ctx.lineTo(sx - j * 0.4, sy + s + j); ctx.lineTo(sx - s - j * 0.6, sy - j * 0.2); ctx.closePath();
        ctx.stroke(); ctx.lineWidth = 1;
      }
      ctx.fillStyle = TOKENS.signal; ctx.font = `${Math.round(s * 0.9)}px ${FONTS.type}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', sx, sy + 1);
      ctx.font = `10px ${FONTS.mono}`; ctx.fillText(`${Math.floor(age / 60)}:${String(Math.floor(age % 60)).padStart(2, '0')}`, sx, sy + s + 9);
      ctx.restore();
    }
    for (const m of this.markers) {
      const age = this.time - m.t;
      const a = Math.max(0, 1 - age / 1.6);
      const [sx, sy] = cam.worldToScreen(m.x, m.y);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(sx, sy);
      if (m.kind === 'attack') {
        const r = 14 + age * 6;
        ctx.strokeStyle = TOKENS.oil; ctx.lineWidth = 4; crosshair(ctx, r);
        ctx.strokeStyle = TOKENS.signal; ctx.lineWidth = 2; crosshair(ctx, r);
      } else if (m.kind === 'unload') {
        stencilMark(ctx, 'LZ', TOKENS.amber);
      } else {
        ctx.rotate(m.angle);
        const col = m.kind === 'amove' ? TOKENS.amber : TOKENS.bone;
        const drop = Math.max(0, 1 - age * 4) * 10; // settles onto the map
        for (const k of [0, 1]) {
          ctx.beginPath(); const o = k * 9 - 4 - drop;
          ctx.moveTo(o - 7, -9); ctx.lineTo(o + 3, 0); ctx.lineTo(o - 7, 9); ctx.lineTo(o - 3, 0); ctx.closePath();
          ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = TOKENS.oil; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  /** Floating stencil callouts: fade and drift a little, never bounce. */
  drawTexts(ctx: CanvasRenderingContext2D, cam: Camera) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.texts) {
      const age = this.time - f.t;
      const a = age < 0.08 ? age / 0.08 : Math.max(0, 1 - (age - 0.9) / 1);
      const [sx, sy] = cam.worldToScreen(f.x, f.y);
      ctx.save();
      ctx.globalAlpha = Math.min(1, a);
      ctx.translate(sx, sy - 18 - f.slot * 22 - age * 8);
      ctx.rotate(f.rot);
      ctx.font = `13px ${FONTS.stencil}`;
      const label = f.text.split('').join(' ');
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(22,20,15,0.72)'; ctx.fillRect(-w / 2, -10, w, 20);
      ctx.strokeStyle = f.color; ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2 + 2, -8, w - 4, 16);
      ctx.fillStyle = f.color; ctx.fillText(label, 0, 1);
      ctx.restore();
    }
    ctx.restore();
  }
}

function crosshair(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, 0, 6.3);
  ctx.moveTo(-r, 0); ctx.lineTo(-r * 0.3, 0); ctx.moveTo(r * 0.3, 0); ctx.lineTo(r, 0);
  ctx.moveTo(0, -r); ctx.lineTo(0, -r * 0.3); ctx.moveTo(0, r * 0.3); ctx.lineTo(0, r);
  ctx.stroke();
}

function stencilMark(ctx: CanvasRenderingContext2D, s: string, col: string) {
  ctx.font = `18px ${FONTS.stencil}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = TOKENS.oil; ctx.strokeText(s, 0, 0);
  ctx.fillStyle = col; ctx.fillText(s, 0, 0);
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(-18, -13, 36, 26);
}

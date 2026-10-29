import type { Camera } from '../core/camera';
import { AMMO } from '../data/ammo';
import { T } from '../data/terrain';
import type { World } from '../sim/world';

/**
 * Purely visual particles and decals driven by simulation events: muzzle flashes, tracers' impact
 * sparks, explosions, smoke columns from wrecks, dust trails, rotor wash. No gore, only smoke and fire.
 */
interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grow: number; kind: number; seed: number }
const SMOKE = 0, FIRE = 1, FLASH = 2, SPARK = 3, DUST = 4, DEBRIS = 5, FLAK = 6, TRAIL = 7;
const MAX = 3000;

interface Decal { x: number; y: number; r: number; rot: number }

export class Effects {
  ps: P[] = [];
  decals: Decal[] = [];
  private rnd = Math.random;

  constructor(private world: World) {
    const bus = world.bus;
    bus.on('shot', (e) => {
      const a = AMMO[e.ammoId];
      const big = a.caliber >= 60;
      this.add(FLASH, e.x, e.y, 0, Math.cos(e.angle) * 2, Math.sin(e.angle) * 2, 0, big ? 0.12 : 0.06, big ? 3.2 : 1.2, 0);
      if (big) {
        for (let i = 0; i < 6; i++) this.add(SMOKE, e.x, e.y, 1, Math.cos(e.angle) * 6 + this.j(5), Math.sin(e.angle) * 6 + this.j(5), 0.5, 1.6 + this.rnd(), 1.8, 2.4);
        // Muzzle blast kicks up dust around the vehicle
        for (let i = 0; i < 6; i++) this.add(DUST, e.unit.x + this.j(4), e.unit.y + this.j(4), 0, this.j(6), this.j(6), 0, 1.4, 2.5, 2.5);
      }
      if (a.kind === 'ATGM' || a.kind === 'ROCKET' || a.kind === 'SAM' || a.id === 'pg7' || a.id === 'm344') {
        for (let i = 0; i < 5; i++) this.add(SMOKE, e.x - Math.cos(e.angle) * 3, e.y - Math.sin(e.angle) * 3, 0.5, -Math.cos(e.angle) * 8 + this.j(4), -Math.sin(e.angle) * 8 + this.j(4), 0.3, 1.4, 1.5, 2);
      }
    });
    bus.on('missile', (e) => this.add(TRAIL, e.x, e.y, 0, this.j(0.6), this.j(0.6), 0.2, 1.6, 0.8, 1.6));
    bus.on('impact', (e) => {
      const a = AMMO[e.ammoId];
      if (e.kind === 'air') { this.add(FLAK, e.x + this.j(6), e.y + this.j(6), 30, 0, 0, 0, 1.2, a.caliber > 30 ? 3 : 1.8, 1.5); return; }
      if (e.kind === 'pen') { for (let i = 0; i < 8; i++) this.add(SPARK, e.x, e.y, 1, this.j(25), this.j(25), 10, 0.35, 0.5, 0); this.add(FLASH, e.x, e.y, 1, 0, 0, 0, 0.15, 2.5, 0); }
      else if (e.kind === 'ricochet') { for (let i = 0; i < 5; i++) this.add(SPARK, e.x, e.y, 1, this.j(40), this.j(40), 6, 0.25, 0.4, 0); }
      else if (a.kind === 'BULLET' || a.kind === 'FLAK') { if (this.rnd() < 0.5) this.add(DUST, e.x + this.j(3), e.y + this.j(3), 0, this.j(2), this.j(2), 0, 0.6, 0.8, 1.2); }
      else if (a.blast < 6) { for (let i = 0; i < 4; i++) this.add(DUST, e.x, e.y, 0, this.j(5), this.j(5), 0, 1.2, 1.6, 2); }
    });
    bus.on('explosion', (e) => this.explode(e.x, e.y, e.size));
  }

  private j(s: number) { return (this.rnd() - 0.5) * 2 * s; }
  private add(kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, grow: number) {
    if (this.ps.length >= MAX) this.ps.shift();
    this.ps.push({ x, y, z, vx, vy, vz, life, max: life, size, grow, kind, seed: this.rnd() });
  }

  explode(x: number, y: number, size: number) {
    this.add(FLASH, x, y, 1, 0, 0, 0, 0.22, 6 * size, 6);
    for (let i = 0; i < 8 * size; i++) this.add(FIRE, x + this.j(2 * size), y + this.j(2 * size), 1, this.j(8 * size), this.j(8 * size), 4, 0.5 + this.rnd() * 0.4, 1.6 * size, 3);
    for (let i = 0; i < 10 * size; i++) this.add(SMOKE, x + this.j(3 * size), y + this.j(3 * size), 2, this.j(5 * size), this.j(5 * size), 2, 2.5 + this.rnd() * 2, 2 * size, 2.5);
    for (let i = 0; i < 6 * size; i++) this.add(DEBRIS, x, y, 1, this.j(18 * size), this.j(18 * size), 12, 0.7, 0.35, 0);
    if (this.world.map.at(x, y) !== T.Canal) {
      this.decals.push({ x, y, r: 2.2 * size + this.rnd(), rot: this.rnd() * 6 });
      if (this.decals.length > 350) this.decals.shift();
    }
  }

  /** Per-frame emitters (wreck smoke, fires, dust trails) and particle integration. */
  update(dt: number, wind = { x: 2.5, y: -1 }) {
    if (dt <= 0) return;
    const w = this.world;
    for (const u of w.units) {
      if (u.carrier) continue;
      if (u.wreck) {
        const age = w.time - u.wreckTime;
        if (age < 150 && this.rnd() < dt * (age < 40 ? 8 : 3) * (1 - age / 160)) this.add(SMOKE, u.x + this.j(2), u.y + this.j(2), 2, this.j(1), this.j(1), 1.5, 4 + this.rnd() * 3, 1.5, 1.6);
        if (age < 35 && this.rnd() < dt * 10) this.add(FIRE, u.x + this.j(2), u.y + this.j(2), 1, this.j(1), this.j(1), 2, 0.6, 1.4, 1);
        continue;
      }
      if (!u.alive) continue;
      if (u.dmg.fire > 0) {
        if (this.rnd() < dt * 12) this.add(FIRE, u.x + this.j(1.5), u.y + this.j(1.5), 1, this.j(1), this.j(1), 2, 0.5, 1.2, 1);
        if (this.rnd() < dt * 6) this.add(SMOKE, u.x, u.y, 2, this.j(1), this.j(1), 1.5, 3.5, 1.6, 2);
      } else if (u.hpFrac < 0.4 && !u.inf && this.rnd() < dt * 2) this.add(SMOKE, u.x, u.y, 2, 0, 0, 1, 2.5, 1, 1.5);
      if (u.isAir) {
        if (u.altitude < 35 && this.rnd() < dt * 18 * (1 - u.altitude / 35)) {
          const a = this.rnd() * 6.283, r = (u.def.sprite.rotor?.radius ?? 5) * 1.6;
          this.add(DUST, u.x + Math.cos(a) * r, u.y + Math.sin(a) * r, 0, Math.cos(a) * 12, Math.sin(a) * 12, 0, 1.2, 2.5, 3);
        }
        continue;
      }
      if (u.mob.moving && !u.inf && u.speed > 2) {
        const t = w.map.at(u.x, u.y);
        if ((t === T.Sand || t === T.Dune || t === T.Road || t === T.Rubble) && this.rnd() < dt * u.speed * 1.1) {
          const back = u.def.sprite.length * 0.9;
          this.add(DUST, u.x - Math.cos(u.heading) * back + this.j(1.5), u.y - Math.sin(u.heading) * back + this.j(1.5), 0, this.j(1.5), this.j(1.5), 0, 1.8, 1.4, 2.6);
        }
      }
    }
    for (const p of this.ps) {
      p.life -= dt;
      p.x += (p.vx + (p.kind === SMOKE || p.kind === DUST || p.kind === TRAIL ? wind.x : 0)) * dt;
      p.y += (p.vy + (p.kind === SMOKE || p.kind === DUST || p.kind === TRAIL ? wind.y : 0)) * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      if (p.kind === DEBRIS || p.kind === SPARK) { p.vz -= 30 * dt; p.vx *= 0.97; p.vy *= 0.97; }
      else { p.vx *= 0.94; p.vy *= 0.94; }
      p.size += p.grow * dt;
    }
    if (this.ps.length && this.ps[0].life <= 0 || this.ps.length > 200) this.ps = this.ps.filter((p) => p.life > 0);
  }

  drawDecals(ctx: CanvasRenderingContext2D, cam: Camera) {
    const b = cam.bounds();
    for (const d of this.decals) {
      if (d.x < b.x0 - 10 || d.x > b.x1 + 10 || d.y < b.y0 - 10 || d.y > b.y1 + 10) continue;
      const [sx, sy] = cam.worldToScreen(d.x, d.y);
      const r = d.r * cam.zoom;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, 'rgba(30,25,18,0.55)'); g.addColorStop(1, 'rgba(30,25,18,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.8, d.rot, 0, 6.3); ctx.fill();
    }
  }

  /** Low layer = dust, debris; high layer = fire, smoke, flashes (drawn above units). */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, high: boolean) {
    const b = cam.bounds();
    const z = cam.zoom;
    for (const p of this.ps) {
      if (p.life <= 0) continue;
      const isHigh = p.kind === SMOKE || p.kind === FIRE || p.kind === FLASH || p.kind === FLAK || p.kind === TRAIL;
      if (isHigh !== high) continue;
      if (p.x < b.x0 - 20 || p.x > b.x1 + 20 || p.y < b.y0 - 40 || p.y > b.y1 + 20) continue;
      const [sx, sy0] = cam.worldToScreen(p.x, p.y);
      const sy = sy0 - p.z * z * 0.3;
      const t = p.life / p.max;
      const r = Math.max(0.6, p.size * z);
      switch (p.kind) {
        case SMOKE: { const g = 0.25 + p.seed * 0.15; ctx.fillStyle = `rgba(${50 + g * 70},${48 + g * 66},${45 + g * 60},${0.38 * t})`; break; }
        case TRAIL: ctx.fillStyle = `rgba(225,225,220,${0.5 * t})`; break;
        case DUST: ctx.fillStyle = `rgba(196,176,128,${0.35 * t})`; break;
        case FIRE: ctx.fillStyle = `rgba(255,${Math.round(120 + 110 * t)},${Math.round(40 * t)},${0.85 * t})`; break;
        case FLASH: ctx.fillStyle = `rgba(255,236,170,${t})`; break;
        case SPARK: ctx.fillStyle = `rgba(255,210,120,${t})`; break;
        case DEBRIS: ctx.fillStyle = `rgba(60,50,40,${t})`; break;
        case FLAK: ctx.fillStyle = `rgba(30,30,30,${0.7 * t})`; break;
      }
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.3); ctx.fill();
    }
  }

  /** Projectiles: tracers, shell streaks and missiles with glowing motors. */
  drawProjectiles(ctx: CanvasRenderingContext2D, cam: Camera) {
    const z = cam.zoom;
    ctx.lineCap = 'round';
    for (const p of this.world.projectiles) {
      if (!p.alive || p.age < 0) continue;
      const [sx, sy] = cam.worldToScreen(p.x, p.y);
      if (sx < -50 || sy < -50 || sx > cam.viewW + 50 || sy > cam.viewH + 50) continue;
      const a = p.ammo;
      const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
      if (a.kind === 'ATGM' || a.kind === 'SAM' || a.kind === 'ROCKET' || a.id === 'pg7') {
        ctx.strokeStyle = '#5c5a50'; ctx.lineWidth = Math.max(1.5, 0.35 * z);
        ctx.beginPath(); ctx.moveTo(sx - ca * 1.2 * z, sy - sa * 1.2 * z); ctx.lineTo(sx + ca * 0.4 * z, sy + sa * 0.4 * z); ctx.stroke();
        ctx.fillStyle = a.kind === 'ROCKET' ? '#ffb15a' : '#fff6d0';
        ctx.beginPath(); ctx.arc(sx - ca * 1.3 * z, sy - sa * 1.3 * z, Math.max(1.5, 0.45 * z), 0, 6.3); ctx.fill();
      } else {
        const len = Math.min(a.kind === 'BULLET' || a.kind === 'FLAK' ? 14 : 24, p.speed * 0.025) * z;
        ctx.strokeStyle = a.tracer ?? '#ffe9a8';
        ctx.lineWidth = a.caliber >= 60 ? Math.max(1.6, 0.25 * z) : Math.max(1, 0.12 * z);
        ctx.globalAlpha = a.kind === 'BULLET' ? 0.75 : 1;
        ctx.beginPath(); ctx.moveTo(sx - ca * len, sy - sa * len); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }
}

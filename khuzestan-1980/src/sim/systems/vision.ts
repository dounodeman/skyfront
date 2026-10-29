import { TILE, type TeamId } from '../../core/constants';
import { killUnit } from '../damage';
import type { Unit } from '../entity';
import type { World } from '../world';

/**
 * Spotting and fog of war.
 * Each observer has a sight range (data: vision.range) scaled by light/dust and its night-sight rating.
 * A target is spotted when within range x its signature and in line of sight (terrain opacity).
 * Firing, moving and being an aircraft raise signature; infantry in cover lowers it.
 */
const LIGHT_BASE = [1, 0.66, 0.34];

export function envVisionMul(w: World, u: Unit): number {
  const base = LIGHT_BASE[w.env.light];
  let m = w.env.light === 0 ? 1 : base + (1 - base) * u.def.vision.night * (w.env.light === 2 ? 0.8 : 0.6);
  if (w.env.dust) m *= u.def.tags?.includes('radar') ? 0.85 : 0.55;
  return m;
}

function signature(w: World, e: Unit): number {
  let s = e.def.vision.signature;
  if (e.mob.moving) s *= 1.15;
  else if (e.inf && e.inf.cover > 0.2) s *= 1 - e.inf.cover * 0.6;
  else if (e.ai.dugIn && !e.isAir) s *= 0.6; // dug-in vehicles: hull-down, camouflaged
  if (w.time - e.lastShotTime < 3) s *= w.env.light === 2 ? 2.4 : 1.5; // muzzle flash / dust
  if (e.isAir && e.altitude > 15) s *= 1.25;
  return s;
}

export function canObserve(u: Unit) {
  return u.onMap && u.alive && !(u.def.crew.length && u.crewAlive === 0) && !(u.inf && u.inf.men < 0.5);
}

/** Tile fog for the human team: 0 unseen, 1 explored (remembered), 2 visible now. */
export class FogGrid {
  vis: Uint8Array;
  version = 0;
  constructor(public w: number, public h: number) { this.vis = new Uint8Array(w * h); }
}

export function visionSystem(w: World) {
  if (w.tick % 6 !== 0) return;
  for (const team of [0, 1] as TeamId[]) spotForTeam(w, team);
  if (w.fog && w.tick % 9 === 0) updateFog(w, w.fog.team);
}

function spotForTeam(w: World, team: TeamId) {
  for (const e of w.units) {
    if (!e.onMap || !e.alive || e.team === team) continue;
    const sig = signature(w, e);
    let seen = false;
    w.spatial.forEachNear(e.x, e.y, 1900, (o) => {
      if (seen || o.team !== team || !canObserve(o)) return;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      const r = Math.max(70, o.def.vision.range * envVisionMul(w, o) * sig);
      if (d > r) return;
      if (o.isAir || e.isAir || w.map.los(o.x, o.y, e.x, e.y)) seen = true;
    });
    if (seen) {
      if (w.time - e.seenAt[team] > 20) w.bus.emit({ type: 'spotted', unit: e, by: team });
      e.seenAt[team] = w.time;
    }
  }
}

function updateFog(w: World, team: TeamId) {
  const fog = w.fog!;
  const vis = fog.vis;
  const W = w.map.w, H = w.map.h;
  for (let i = 0; i < vis.length; i++) if (vis[i] === 2) vis[i] = 1;
  for (const o of w.units) {
    if (o.team !== team || !canObserve(o)) continue;
    const rT = Math.min(110, (o.def.vision.range * envVisionMul(w, o)) / TILE);
    const ox = o.x / TILE, oy = o.y / TILE;
    const otx = Math.floor(ox), oty = Math.floor(oy);
    const air = o.isAir;
    const rays = Math.max(48, Math.min(360, Math.ceil(rT * 5)));
    for (let r = 0; r < rays; r++) {
      const a = (r / rays) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      let acc = 0;
      for (let s = 0; s <= rT; s += 0.7) {
        const tx = Math.floor(ox + dx * s), ty = Math.floor(oy + dy * s);
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) break;
        vis[ty * W + tx] = 2;
        if (!air && (tx !== otx || ty !== oty)) {
          acc += w.map.opacity(tx, ty) * 0.7; // rays step 0.7 tiles, so this matches TileMap.los per tile
          if (acc >= 1) break;
        }
      }
    }
  }
  fog.version++;
}

/** Fire on burning vehicles: damage over time, may end in a brew-up. */
export function lifecycleSystem(w: World, dt: number) {
  for (const u of w.units) {
    if (!u.alive || u.carrier) continue;
    if (u.dmg.fire > 0) {
      u.dmg.fire -= dt;
      u.hp -= 2.2 * dt;
      if (u.hp <= 0 || u.dmg.fire <= 0) {
        if (u.hp <= 0 || w.rng.chance(0.45)) {
          killBrew(w, u);
        } else { u.dmg.fire = 0; w.bus.emit({ type: 'status', unit: u, text: 'Fire put out' }); }
      }
    }
  }
}
function killBrew(w: World, u: Unit) {
  w.bus.emit({ type: 'status', unit: u, text: 'Brewed up' });
  killUnit(w, u, null, true);
}

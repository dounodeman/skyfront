import { DEG, angleDiff, angleTo, dist, turnToward } from '../../core/math';
import { AMMO, type AmmoDef } from '../../data/ammo';
import { SPRITE_SCALE } from '../../core/constants';
import { armorRef, penAt } from '../damage';
import type { Unit, WeaponState } from '../entity';
import type { Projectile } from '../projectiles';
import type { World } from '../world';
import { envVisionMul } from './vision';

/** Is `t` currently spotted by `team`? (vision refreshes every 0.2 s) */
export const spotted = (w: World, team: number, t: Unit) => t.seenAt[team] >= w.time - 0.45;

/** Can this unit operate its weapons at all? */
export function canFight(u: Unit): boolean {
  if (!u.onMap || u.wreck || !u.alive) return false;
  if (u.inf) return u.inf.state !== 'broken' && u.inf.men > 0.5;
  if (u.def.crew.length && u.crewAlive === 0) return false;
  if (u.air?.landed) return false;
  return true;
}

function airborne(u: Unit) { return u.isAir && u.altitude > 12; }

/** Best ammunition for this target and its expected value (0 = this weapon cannot hurt it). */
export function chooseAmmo(ws: WeaponState, t: Unit, d: number): { id: string; score: number } {
  let best = '', bestScore = 0;
  const ar = armorRef(t);
  for (const id in ws.ammo) {
    if (ws.ammo[id] <= 0) continue;
    const a: AmmoDef = AMMO[id];
    let s = 0;
    if (airborne(t)) {
      if (!a.canHitAir) continue;
      const pen = penAt(a, d);
      s = pen >= ar * 0.8 || a.kind === 'SAM' ? a.damage * Math.max(1, ws.def.burst) : a.damage * 0.25 * ws.def.burst;
    } else if (t.inf) {
      if (a.blast > 0) s = a.blastDamage * 0.7 + a.supp;
      else if (a.kind === 'BULLET' || a.kind === 'FLAK') s = (a.damage + a.supp * 0.6) * ws.def.burst;
      else if (a.kind === 'ATGM') s = 3; // wasteful but possible
      else s = a.damage * 0.3;
    } else {
      const pen = penAt(a, d);
      if (a.kind === 'HE' || a.kind === 'ROCKET') s = ar < 40 ? a.damage * 1.2 : ar < 120 ? a.damage * 0.3 : 0.5;
      else if (pen < ar * 0.55) s = a.kind === 'BULLET' ? 0 : 0.4; // won't penetrate: last resort only
      else s = a.damage * Math.min(1.4, pen / Math.max(1, ar)) * Math.max(1, ws.def.burst * 0.25);
      // Keep expensive missiles for armour.
      if (a.kind === 'ATGM' && ar < 40) s *= 0.4;
    }
    if (s > bestScore) { bestScore = s; best = id; }
  }
  return { id: best, score: bestScore };
}

function domainOk(ws: WeaponState, t: Unit) {
  return airborne(t) ? ws.def.targets.air : ws.def.targets.ground;
}

/** Line of fire (terrain) between two units; aircraft are always visible/reachable. */
export function lineOfFire(w: World, a: Unit, b: Unit) {
  if (a.isAir || b.isAir) return true;
  return w.map.los(a.x, a.y, b.x, b.y);
}

function validFor(w: World, u: Unit, ws: WeaponState, t: Unit | undefined, checkLos: boolean): boolean {
  if (!t || !t.alive || !t.onMap || t.team === u.team) return false;
  if (!spotted(w, u.team, t)) return false;
  if (!domainOk(ws, t)) return false;
  const d = dist(u.x, u.y, t.x, t.y);
  if (d > ws.def.range || d < (ws.def.minRange ?? 0)) return false;
  if (chooseAmmo(ws, t, d).score <= 0) return false;
  if (checkLos && !lineOfFire(w, u, t)) return false;
  return true;
}

function pickTarget(w: World, u: Unit, ws: WeaponState, forced: Unit | undefined): Unit | undefined {
  if (forced && validFor(w, u, ws, forced, true)) return forced;
  let best: Unit | undefined, bestScore = 0;
  w.spatial.forEachNear(u.x, u.y, ws.def.range, (t) => {
    if (t.team === u.team || !t.alive) return;
    if (!validFor(w, u, ws, t, false)) return;
    const d = dist(u.x, u.y, t.x, t.y);
    let s = chooseAmmo(ws, t, d).score / (1 + d / 500);
    // Threat weighting: tanks and AT weapons first for anti-armour guns, damaged targets for focus fire.
    if (t.def.category === 'tank') s *= 1.25;
    if (t.def.role === 'at') s *= 1.2;
    s *= 1 + (1 - t.hpFrac) * 0.5;
    if (t.id === ws.targetId) s *= 1.3; // stickiness
    if (s > bestScore && lineOfFire(w, u, t)) { bestScore = s; best = t; }
  });
  return best;
}

/** Longest range at which this unit can usefully engage `t` (0 = cannot). */
export function engageRange(u: Unit, t: Unit): number {
  let r = 0;
  for (const ws of u.weapons) {
    if (!domainOk(ws, t)) continue;
    if (chooseAmmo(ws, t, ws.def.range * 0.6).score > 0.5) r = Math.max(r, ws.def.range);
  }
  return r;
}

function hitChance(w: World, u: Unit, ws: WeaponState, t: Unit, d: number, a: AmmoDef): number {
  let p = ws.def.accuracy * (1 - 0.55 * Math.pow(Math.min(1, d / ws.def.range), 1.5));
  if (u.mob.moving && !u.isAir) p *= u.def.mobility.moveFirePenalty;
  if (u.isAir && u.speed > 15 && a.kind !== 'ATGM') p *= 0.75;
  if (t.mob.moving && a.kind !== 'ATGM' && a.kind !== 'SAM') p *= 0.8;
  if (airborne(t) && a.kind !== 'SAM') p *= Math.max(0.35, 1 - t.speed / 90);
  if (!t.inf && !t.isAir) {
    const s = t.def.sprite;
    p *= Math.max(0.55, Math.min(1.15, (s.length * s.width) / 18));
  }
  if (t.inf && a.kind !== 'BULLET' && a.kind !== 'FLAK') p *= 0.85;
  // Crew condition
  const crew = u.def.crew;
  if (crew.includes('gunner') && !u.dmg.crew[crew.indexOf('gunner')]) p *= 0.55;
  if (crew.includes('commander') && !u.dmg.crew[crew.indexOf('commander')]) p *= 0.85;
  if (u.inf) p *= 1 - u.inf.suppression / 160;
  // Darkness and dust degrade aim for those without good sights.
  p *= 0.6 + 0.4 * Math.min(1, envVisionMul(w, u));
  return Math.max(0.03, Math.min(0.97, p));
}

function reloadMul(u: Unit): number {
  let m = 1;
  const crew = u.def.crew;
  if (crew.includes('loader') && !u.dmg.crew[crew.indexOf('loader')]) m *= 1.8;
  if (crew.length && u.crewAlive < crew.length) m *= 1 + (crew.length - u.crewAlive) * 0.15;
  if (u.inf) m *= u.inf.state === 'pinned' ? 2.5 : 1 + u.inf.suppression / 120;
  return m;
}

/** World position of a weapon's muzzle (visual only; sprites are drawn SPRITE_SCALE larger). */
export function muzzle(u: Unit, ws: WeaponState): { x: number; y: number; a: number } {
  const t = u.def.sprite.turret;
  if (ws.mount.mount === 'turret' && t) {
    const tx = u.x + Math.cos(u.heading) * t.x * SPRITE_SCALE, ty = u.y + Math.sin(u.heading) * t.x * SPRITE_SCALE;
    const l = (t.radius * 0.4 + t.gunLength) * SPRITE_SCALE;
    return { x: tx + Math.cos(u.turretAngle) * l, y: ty + Math.sin(u.turretAngle) * l, a: u.turretAngle };
  }
  const a = ws.mount.mount === 'free' ? ws.aim : u.heading;
  const l = u.inf ? 1 : u.def.sprite.length * 0.45 * SPRITE_SCALE;
  return { x: u.x + Math.cos(a) * l, y: u.y + Math.sin(a) * l, a };
}

function fire(w: World, u: Unit, ws: WeaponState, t: Unit) {
  const d = dist(u.x, u.y, t.x, t.y);
  const { id } = chooseAmmo(ws, t, d);
  if (!id) return;
  const a = AMMO[id];
  let rounds = Math.min(ws.def.burst, ws.ammo[id]);
  if (u.inf && ws.def.burst > 1) rounds = Math.max(1, Math.round(rounds * (u.inf.men / u.inf.maxMen)));
  if (rounds <= 0) return;
  ws.ammo[id] -= rounds;
  const p = hitChance(w, u, ws, t, d, a);
  const m = muzzle(u, ws);
  const pellets = Math.min(ws.def.pellets, rounds);
  const per = rounds / pellets;
  for (let i = 0; i < pellets; i++) {
    let hits = 0;
    if (per > 1) { for (let k = 0; k < per; k++) if (w.rng.chance(p * (t.inf ? 0.6 : 1))) hits++; }
    else hits = w.rng.chance(p) ? 1 : 0;
    // Misses land around the target: lateral scatter grows with range and weapon spread.
    const lat = (3 + d * Math.tan(ws.def.spread * DEG) * 2.2) * w.rng.gauss() * 0.7;
    const over = w.rng.range(-12, 30);
    const ang = angleTo(u.x, u.y, t.x, t.y);
    const tx = hits ? t.x : t.x + Math.cos(ang) * over - Math.sin(ang) * lat;
    const ty = hits ? t.y : t.y + Math.sin(ang) * over + Math.cos(ang) * lat;
    const guided = !!a.guided;
    const proj: Projectile = {
      x: m.x, y: m.y, fromX: u.x, fromY: u.y, tx, ty, speed: a.speed * (pellets > 1 ? w.rng.range(0.92, 1.08) : 1),
      ammo: a, team: u.team, shooterId: u.id, targetId: t.id, hits, rounds: per, guided, alive: true, age: -i * 0.08,
      air: airborne(t), angle: ang,
    };
    w.projectiles.push(proj);
    if (guided && a.guided !== 'ir') u.guiding++;
  }
  ws.cooldown = ws.def.reload * reloadMul(u) * w.rng.range(0.92, 1.1);
  ws.lastFired = w.time;
  u.lastShotTime = w.time;
  if (ws.mount.mount === 'turret' && a.caliber >= 20) u.recoil = 1;
  w.bus.emit({ type: 'shot', unit: u, weapon: ws, x: m.x, y: m.y, angle: m.a, ammoId: id });
}

export function combatSystem(w: World, dt: number) {
  for (const u of w.units) {
    if (!u.onMap) continue;
    for (const ws of u.weapons) if (ws.cooldown > 0) ws.cooldown -= dt;
    u.engaged = false;
    u.faceWant = null;
    if (!canFight(u)) { u.targetId = 0; if (!u.mob.moving) u.turretWant = u.turretWant; continue; }
    const retarget = (w.tick + u.id) % 12 === 0;
    const o = u.orders[0];
    const forced = o?.type === 'attack' ? w.alive(o.targetId) : undefined;
    const holdFire = u.def.spotter;
    if (holdFire) continue;

    let turretTarget: Unit | undefined;
    let primaryTarget: Unit | undefined;
    for (let i = 0; i < u.weapons.length; i++) {
      const ws = u.weapons[i];
      const isTurret = ws.mount.mount === 'turret' && !!u.def.turret;
      let t = w.alive(ws.targetId);
      if (isTurret && turretTarget) {
        // Secondary turret weapons (coax) can only shoot where the turret points.
        t = validFor(w, u, ws, turretTarget, false) ? turretTarget : undefined;
      } else if (retarget || !validFor(w, u, ws, t, false)) {
        t = pickTarget(w, u, ws, forced);
      }
      ws.targetId = t ? t.id : 0;
      if (!t) continue;
      if (isTurret && !turretTarget) turretTarget = t;
      if (!primaryTarget) primaryTarget = t;
      const bearing = angleTo(u.x, u.y, t.x, t.y);

      // Aim
      let aimed = false;
      if (isTurret) {
        u.turretWant = bearing;
        aimed = Math.abs(angleDiff(u.turretAngle, bearing)) < 2.5 * DEG;
        if (u.def.turret!.arc !== undefined && Math.abs(angleDiff(u.heading, bearing)) > u.def.turret!.arc * DEG) { aimed = false; u.faceWant = bearing; }
      } else if (ws.mount.mount === 'hull') {
        const arc = (ws.mount.arc ?? 8) * DEG;
        aimed = Math.abs(angleDiff(u.heading, bearing)) <= arc;
        if (!aimed) u.faceWant = bearing;
      } else {
        ws.aim = turnToward(ws.aim, bearing, (u.inf ? 400 : 200) * DEG * dt);
        aimed = Math.abs(angleDiff(ws.aim, bearing)) < 6 * DEG;
        if (u.inf) u.heading = turnToward(u.heading, bearing, 6 * dt);
      }
      if (!aimed || ws.cooldown > 0) continue;
      // Gun state and guidance constraints
      const primaryGun = i === 0 && !u.inf;
      if (primaryGun && u.dmg.gunDisabled) continue;
      if (ws.def.guidesStationary && (u.isAir ? u.speed > 12 : u.mob.moving)) {
        // ATGM crews must halt to fire; vehicles on attack orders will stop by themselves.
        if (!(o && o.type === 'move' && !o.attackMove)) u.engaged = true;
        continue;
      }
      if (ws.def.guidesStationary && u.guiding > 0) continue; // one missile at a time
      fire(w, u, ws, t);
    }
    u.targetId = primaryTarget ? primaryTarget.id : 0;
    if (!turretTarget && u.def.turret && !u.mob.moving && u.turretWant !== null && w.time - u.lastShotTime > 6) u.turretWant = null;
    // Attack-move: halt while something worthwhile is in reach; stationary vehicles face the threat.
    if (primaryTarget) {
      if (o?.type === 'move' && o.attackMove) u.engaged = true;
      if (u.faceWant === null && !u.inf && !u.mob.moving && !u.isAir && u.def.moveClass === 'tracked') u.faceWant = angleTo(u.x, u.y, primaryTarget.x, primaryTarget.y);
    }
  }
}

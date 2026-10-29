import { DEG, angleDiff, dist } from '../core/math';
import { TILE, type TeamId } from '../core/constants';
import type { AmmoDef } from '../data/ammo';
import type { ArmorProfile } from '../data/units/types';
import type { Unit } from './entity';
import type { World } from './world';

/**
 * Damage model.
 *  - Vehicles: hit location (hull/turret), facing (front/side/rear) and obliquity give effective armour;
 *    penetration (falls with range for kinetic rounds) is compared to it. Penetrations remove hull
 *    integrity and roll for subsystem damage: crew casualties, engine, gun, turret, fire, ammo brew-up.
 *  - Infantry squads: HP pool = men x hpPerMan, reduced by cover; casualties lower morale.
 */

export function penAt(a: AmmoDef, rangeM: number): number {
  return a.pen * Math.max(0.2, 1 - a.penFalloff * (rangeM / 1000));
}

export type Facing = 'front' | 'side' | 'rear';

/** Facing and obliquity (radians) of a shot travelling along `shotAngle` against a plate oriented `ref`. */
export function facingOf(ref: number, shotAngle: number): { facing: Facing; obliq: number } {
  // Direction from target toward the shooter, relative to the target's forward axis.
  const rel = Math.abs(angleDiff(ref, shotAngle + Math.PI));
  if (rel <= 50 * DEG) return { facing: 'front', obliq: rel };
  if (rel >= 130 * DEG) return { facing: 'rear', obliq: Math.PI - rel };
  return { facing: 'side', obliq: Math.abs(rel - Math.PI / 2) };
}

function plate(p: ArmorProfile, f: Facing) { return f === 'front' ? p.f : f === 'side' ? p.s : p.r; }

export function effectiveArmor(raw: number, obliq: number, a: AmmoDef): number {
  if (raw <= 0) return 0;
  if (a.ignoresSlope) return raw;
  const o = Math.min(obliq, 70 * DEG);
  const k = 1 / Math.cos(o);
  // Shaped charges care less about slope than kinetic rounds.
  return raw * (a.kind === 'HEAT' || a.kind === 'ATGM' ? Math.pow(k, 0.6) : k);
}

/** Expected-armour reference for ammo selection (mix of front and side hull). */
export function armorRef(u: Unit): number {
  const h = u.def.armor?.hull;
  return h ? (h.f * 0.6 + h.s * 0.4) : 0;
}

export function killUnit(w: World, u: Unit, killerTeam: TeamId | null, brewUp: boolean) {
  if (!u.alive) return;
  u.alive = false;
  u.speed = 0;
  u.orders.length = 0;
  if (!u.inf) { u.wreck = true; u.wreckTime = w.time; }
  if (u.air) { u.air.altitude = 0; u.air.targetAlt = 0; } // aircraft crash where they are
  // Passengers: some die with the vehicle, survivors bail out.
  if (u.cargo.length) {
    for (const p of u.cargo) {
      p.carrier = null;
      p.x = u.x + w.rng.range(-8, 8); p.y = u.y + w.rng.range(-8, 8);
      if (u.isAir && u.altitude > 20 || brewUp && w.rng.chance(0.5)) { p.alive = false; continue; }
      if (p.inf) { damageInfantry(w, p, p.maxHp * w.rng.range(0.2, 0.6), killerTeam); p.inf.morale = Math.min(p.inf.morale, 25); p.inf.suppression = 80; }
      p.orders.length = 0;
    }
    u.cargo = [];
  }
  if (u.carrier) { u.carrier.cargo = u.carrier.cargo.filter((c) => c !== u); u.carrier = null; }
  w.bus.emit({ type: 'kill', unit: u, killerTeam, brewUp });
  if (!u.inf) w.bus.emit({ type: 'explosion', x: u.x, y: u.y, size: brewUp ? 3 : 1.4 });
}

export function damageInfantry(w: World, u: Unit, dmg: number, killerTeam: TeamId | null) {
  const inf = u.inf!;
  if (dmg <= 0 || !u.alive) return;
  const menBefore = Math.ceil(inf.men);
  u.hp = Math.max(0, u.hp - dmg);
  inf.men = u.hp / inf.hpPerMan;
  const lost = menBefore - Math.ceil(inf.men);
  if (lost > 0) {
    // Casualties hit morale harder the less resilient the unit is.
    const res = u.def.squad!.moraleResilience;
    inf.morale = Math.max(0, inf.morale - lost * (14 - res * 8));
    inf.suppression = Math.min(100, inf.suppression + lost * 12);
  }
  u.dmg.lastHitTime = w.time;
  if (u.hp <= 0.01) killUnit(w, u, killerTeam, false);
}

/**
 * Applies a direct hit from projectile/ammo `a` travelling along `shotAngle` from range `rangeM`.
 * `count` = rounds that struck (bursts of small arms).
 */
export function applyHit(w: World, u: Unit, a: AmmoDef, shotAngle: number, rangeM: number, count: number, shooter: Unit | undefined, team: TeamId) {
  if (!u.alive) return;
  u.dmg.lastHitTime = w.time;
  if (shooter) u.dmg.lastAttackerId = shooter.id;

  if (u.inf) {
    const cover = u.inf.cover;
    const prone = u.inf.state !== 'ok' || u.inf.suppression > 50 ? 0.8 : 1;
    let dmg: number;
    if (a.blast > 0) dmg = a.blastDamage * (1 - cover * 0.6) * prone; // shell landing among the squad
    else dmg = a.damage * count * (1 - cover) * prone;
    if (u.isAir === false && u.inf.state !== 'broken') u.inf.suppression = Math.min(100, u.inf.suppression + a.supp * Math.max(1, count) * (1 - cover * 0.5));
    damageInfantry(w, u, dmg, team);
    return;
  }

  // ---- vehicles and aircraft
  const def = u.def;
  const hasTurretArmor = !!def.armor?.turret;
  const turretHit = hasTurretArmor && w.rng.chance(def.turretShare ?? 0.4);
  const prof = turretHit ? def.armor!.turret! : def.armor?.hull ?? { f: 0, s: 0, r: 0 };
  // Dug-in (hull-down) vehicles in prepared positions: most shots aimed at the hull hit the berm.
  if (!turretHit && u.ai.dugIn && !u.mob.moving && !u.isAir && w.rng.chance(0.6)) {
    w.bus.emit({ type: 'impact', x: u.x, y: u.y, kind: 'ground', ammoId: a.id, size: a.caliber });
    return;
  }
  const { facing, obliq } = facingOf(turretHit ? u.turretAngle : u.heading, shotAngle);
  const eff = effectiveArmor(plate(prof, facing), obliq, a);
  const pen = penAt(a, rangeM) * w.rng.range(0.9, 1.1);

  let dmg = 0;
  let penetrated = false;
  if (pen >= eff) {
    penetrated = true;
    dmg = a.damage * w.rng.range(0.75, 1.25) * (pen > eff * 2 ? 1.15 : 1) * Math.max(1, count);
  } else if (a.kind === 'HESH' && pen >= eff * 0.6) {
    // Spalling: scab of armour flies off inside without a hole.
    dmg = a.damage * 0.4;
    penetrated = w.rng.chance(0.5);
  } else if (a.kind === 'HE' || a.kind === 'ROCKET') {
    dmg = eff < 40 ? a.damage * 0.6 : a.damage * 0.12;
    if (u.isVehicle && w.rng.chance(0.07)) immobilize(w, u, 'Track broken');
  }
  if (u.isAir && a.kind === 'SAM') { penetrated = true; dmg = a.damage * w.rng.range(0.7, 1.3); }
  w.bus.emit({ type: 'impact', x: u.x, y: u.y, kind: penetrated ? 'pen' : dmg > 0 ? 'ground' : 'ricochet', ammoId: a.id, size: a.caliber });
  if (dmg <= 0) return;
  u.hp -= dmg;

  // Subsystem damage on real penetrations by heavy rounds.
  if (penetrated && a.damage >= 20 && def.crew.length) {
    if (u.isAir) {
      if (w.rng.chance(0.25)) killCrew(w, u, w.rng.chance(0.5) ? 'pilot' : 'copilot');
    } else if (turretHit) {
      if (w.rng.chance(0.4)) killCrew(w, u, w.rng.pick(['commander', 'gunner', 'loader']));
      if (w.rng.chance(0.18) && !u.dmg.gunDisabled) { u.dmg.gunDisabled = true; status(w, u, 'Main gun disabled'); }
      if (w.rng.chance(0.12) && !u.dmg.turretJammed) { u.dmg.turretJammed = true; status(w, u, 'Turret traverse jammed'); }
      if (w.rng.chance((def.ammoVulnerability ?? 0.2) * Math.min(1.5, a.damage / 60))) {
        status(w, u, 'Ammunition detonation!');
        killUnit(w, u, team, true);
        return;
      }
    } else {
      if (w.rng.chance(0.3)) {
        u.dmg.engine = Math.max(0, u.dmg.engine - 0.55);
        if (u.dmg.engine <= 0) immobilize(w, u, 'Engine destroyed'); else status(w, u, 'Engine damaged');
        if (w.rng.chance(0.25)) startFire(w, u);
      }
      if (w.rng.chance(0.2)) killCrew(w, u, 'driver');
      if (w.rng.chance(0.14)) immobilize(w, u, 'Track broken');
      if (w.rng.chance(0.12)) startFire(w, u);
      if (w.rng.chance(0.2)) killCrew(w, u, w.rng.pick(def.crew));
      if (w.rng.chance((def.ammoVulnerability ?? 0.2) * 0.4)) { status(w, u, 'Ammunition detonation!'); killUnit(w, u, team, true); return; }
    }
    // Shaken crews sometimes abandon a badly damaged vehicle.
    if (u.alive && u.hp < u.maxHp * 0.3 && !u.isAir && w.rng.chance(0.25)) {
      u.abandoned = true;
      status(w, u, 'Crew bailed out');
      killUnit(w, u, team, false);
      return;
    }
  }
  // Penetrating hits from passengers' point of view.
  if (penetrated && u.cargo.length && w.rng.chance(0.4)) {
    const p = w.rng.pick(u.cargo);
    if (p.inf) damageInfantry(w, p, a.damage * 0.5, team);
    u.cargo = u.cargo.filter((c) => c.alive);
  }
  if (u.hp <= 0) killUnit(w, u, team, w.rng.chance(0.55));
  else if (u.crewAlive === 0 && def.crew.length) { status(w, u, 'Crew knocked out'); killUnit(w, u, team, false); }
}

function status(w: World, u: Unit, text: string) { w.bus.emit({ type: 'status', unit: u, text }); }

export function immobilize(w: World, u: Unit, reason: string) {
  if (u.mob.immobilized || u.isAir) return;
  u.mob.immobilized = true; u.mob.immobilizedReason = reason; u.speed = 0;
  status(w, u, reason);
}

function killCrew(w: World, u: Unit, role: string) {
  const idx = u.def.crew.findIndex((r, i) => r === role && u.dmg.crew[i]);
  const i = idx >= 0 ? idx : u.dmg.crew.findIndex((x) => x);
  if (i < 0) return;
  u.dmg.crew[i] = false;
  const r = u.def.crew[i];
  status(w, u, `${r[0].toUpperCase()}${r.slice(1)} killed`);
  if (r === 'driver' && !u.dmg.crew.some((alive, j) => alive && u.def.crew[j] === 'driver')) {
    // Another crewman takes over driving if anyone is left, but slower to react.
    if (u.crewAlive <= 1) immobilize(w, u, 'Driver killed');
  }
  if (r === 'pilot' && u.isAir && !u.dmg.crew.some((alive, j) => alive && (u.def.crew[j] === 'copilot' || u.def.crew[j] === 'pilot'))) {
    killUnit(w, u, null, false);
  }
}

export function startFire(w: World, u: Unit) {
  if (u.dmg.fire > 0 || u.inf || u.isAir) return;
  u.dmg.fire = w.rng.range(12, 30);
  status(w, u, 'Vehicle on fire');
}

/**
 * Blast at (x,y): damages soft targets and buildings, suppresses infantry. `exclude` already took a direct hit.
 */
export function applySplash(w: World, x: number, y: number, a: AmmoDef, team: TeamId, exclude: Unit | null, airBurst = false, rounds = 1) {
  const r = Math.max(a.blast, 6);
  const suppR = Math.max(10, a.blast * 1.6);
  w.spatial.forEachNear(x, y, suppR, (u) => {
    if (u === exclude || !u.alive || u.carrier) return;
    if (u.isAir && !airBurst && u.altitude > 8) return;
    const d = dist(x, y, u.x, u.y);
    if (u.inf) {
      if (u.team !== team && u.inf.state !== 'broken') u.inf.suppression = Math.min(100, u.inf.suppression + a.supp * rounds * (1 - d / suppR) * (1 - u.inf.cover * 0.5));
      if (a.blast > 0 && d < r) damageInfantry(w, u, a.blastDamage * (1 - d / r) * 0.8 * (1 - u.inf.cover * 0.65), team);
    } else if (a.blast > 0 && d < r * 0.6 && u.def.armor && armorRef(u) < 25) {
      // Light-skinned vehicles suffer from near misses.
      u.hp -= a.blastDamage * 0.15 * (1 - d / r);
      if (u.hp <= 0) killUnit(w, u, team, false);
    }
  });
  if (a.blast > 0 && !airBurst) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const bdmg = a.kind === 'HESH' ? a.blastDamage * 1.2 : a.blastDamage * 0.6;
    if (w.map.damageTile(tx, ty, bdmg)) w.bus.emit({ type: 'explosion', x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, size: 1.6 });
  }
}

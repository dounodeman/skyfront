import { DEG, angleDiff, angleTo, dist, turnToward } from '../../core/math';
import { TILE } from '../../core/constants';
import type { Unit } from '../entity';
import type { World } from '../world';
import { engageRange, spotted } from './combat';
import { unloadAll } from './transport';
import { applyHit, applySplash, killUnit } from '../damage';
import { AMMO } from '../../data/ammo';

/**
 * Helicopter (and drone) flight: straight-line flight above terrain, altitude changes,
 * hovering stand-off attacks, landing zones for troop transports, fuel, forced landings.
 */
export function airSystem(w: World, dt: number) {
  for (const u of w.units) {
    if (!u.onMap || !u.isAir) continue;
    stepAir(w, u, dt);
  }
}

function cruiseAlt(u: Unit) { return u.def.air?.altitude ?? 50; }

function stepAir(w: World, u: Unit, dt: number) {
  const a = u.air!, m = u.def.mobility, mob = u.mob;
  a.rotorPhase += dt * 30;

  // Fuel: helicopters burn fuel even hovering. Empty tank = forced landing where it is.
  if (mob.fuelMax > 0 && !a.landed) {
    mob.fuel = Math.max(0, mob.fuel - dt * (0.45 + 0.55 * u.speed / m.speed));
    if (mob.fuel <= 0 && a.targetAlt > 0) {
      a.targetAlt = 0; u.orders.length = 0;
      w.bus.emit({ type: 'status', unit: u, text: 'Out of fuel – forced landing' });
    }
  }
  // Pilot casualties: no pilot left = crash.
  if (u.def.crew.length && u.crewAlive === 0) { a.targetAlt = 0; }

  let dest: { x: number; y: number } | null = null;
  let arrive = 15;
  let face: number | null = u.faceWant;
  const o = u.orders[0];
  let wantLand = false;

  if (o) {
    switch (o.type) {
      case 'move':
        if (o.attackMove && u.engaged) break; // hover and fight
        if (u.def.air && !u.def.air.vtol && dist(u.x, u.y, o.x, o.y) < 70) { a.orbitX = o.x; a.orbitY = o.y; u.orders.shift(); break; }
        dest = { x: o.x, y: o.y };
        if (dist(u.x, u.y, o.x, o.y) < arrive && u.speed < 4) u.orders.shift();
        break;
      case 'attack': {
        const t = w.alive(o.targetId);
        if (!t || t.carrier) { u.orders.shift(); break; }
        const vis = spotted(w, u.team, t);
        if (vis) u.lastKnown = { x: t.x, y: t.y };
        const lk = u.lastKnown ?? { x: t.x, y: t.y };
        const range = engageRange(u, t);
        if (range === 0 && !u.def.kamikaze) { u.orders.shift(); break; }
        const d = dist(u.x, u.y, lk.x, lk.y);
        if (u.def.kamikaze) {
          dest = lk; arrive = 0;
          // Terminal dive: drop toward the target and detonate on arrival.
          const dd = dist(u.x, u.y, t.x, t.y);
          if (dd < 350) a.targetAlt = Math.max(2, (dd / 350) * cruiseAlt(u));
          if (dd < 14 && a.altitude < 25) { detonate(w, u, t); return; }
          u.ai.diving = dd < 350;
          break;
        }
        if (!vis && d < 60) { u.orders.shift(); break; } // lost them
        if (vis && d <= range * 0.85) { face = angleTo(u.x, u.y, t.x, t.y); }
        else dest = lk;
        break;
      }
      case 'unload': {
        if (!u.cargo.length) { u.orders.shift(); break; }
        const d = dist(u.x, u.y, o.x, o.y);
        if (d > 12) { dest = { x: o.x, y: o.y }; arrive = 8; }
        else {
          wantLand = true;
          if (a.landed) { unloadAll(w, u); u.orders.shift(); a.landTimer = 2.5; }
        }
        break;
      }
      case 'hold': break;
      default: u.orders.shift();
    }
  }
  // Auto-land when friendly infantry are walking over to board, and stay down while they climb in.
  if (!o && !wantLand && u.def.transport) {
    const boarding = w.units.some((p) => p.alive && p.team === u.team && p.orders[0]?.type === 'board' && (p.orders[0] as { targetId: number }).targetId === u.id);
    if (boarding) wantLand = true;
  }
  if (a.landTimer > 0) { a.landTimer -= dt; wantLand = true; }

  // Altitude control: land if asked or out of fuel; can't land on water/buildings.
  const ground = w.map.speedAt('foot', u.x, u.y) > 0;
  if (mob.fuel <= 0 && mob.fuelMax > 0) a.targetAlt = 0;
  else if (wantLand && ground) a.targetAlt = 0;
  else if (!u.ai.diving) a.targetAlt = cruiseAlt(u);
  if (o?.type !== 'attack') u.ai.diving = false;
  const climb = u.def.air?.climb ?? 8;
  a.altitude += Math.max(-climb * dt, Math.min(climb * dt, a.targetAlt - a.altitude));
  a.landed = a.altitude <= 0.5 && a.targetAlt === 0;

  // Horizontal flight (only once airborne enough).
  // Fixed-wing drones cannot hover: with nowhere to go they orbit their last destination.
  if (!dest && u.def.air && !u.def.air.vtol && !a.landed) {
    if (o?.type === 'move' && dist(u.x, u.y, o.x, o.y) < 60) { a.orbitX = o.x; a.orbitY = o.y; }
    const ang = Math.atan2(u.y - a.orbitY, u.x - a.orbitX) + 0.5;
    dest = { x: a.orbitX + Math.cos(ang) * 160, y: a.orbitY + Math.sin(ang) * 160 };
    arrive = 0;
  } else if (dest && o?.type === 'move') { a.orbitX = o.x; a.orbitY = o.y; }
  const canFly = a.altitude > 8 && !(mob.fuelMax > 0 && mob.fuel <= 0);
  let desired = 0;
  if (dest && canFly) {
    const want = angleTo(u.x, u.y, dest.x, dest.y);
    const d = dist(u.x, u.y, dest.x, dest.y);
    u.heading = turnToward(u.heading, want, m.turnRate * DEG * dt);
    const align = Math.max(0, Math.cos(angleDiff(u.heading, want)));
    desired = m.speed * align * Math.min(1, d / 120 + 0.1);
    if (u.def.air && !u.def.air.vtol) desired = Math.max(desired, m.speed * 0.6); // fixed wing: keep flying speed
    if (d < arrive) desired = 0;
  } else if (face !== null && canFly) {
    u.heading = turnToward(u.heading, face, m.turnRate * DEG * dt);
  }
  const acc = m.accel * dt;
  u.speed += Math.max(-acc * 1.5, Math.min(acc, desired - u.speed));
  if (u.speed < 0.05 && desired === 0) u.speed = 0;
  u.x += Math.cos(u.heading) * u.speed * dt;
  u.y += Math.sin(u.heading) * u.speed * dt;
  u.x = Math.max(TILE, Math.min(w.map.w * TILE - TILE, u.x));
  u.y = Math.max(TILE, Math.min(w.map.h * TILE - TILE, u.y));
  mob.moving = u.speed > 1;

  // Gentle separation between aircraft so formations don't merge into one sprite.
  w.spatial.forEachNear(u.x, u.y, 30, (v) => {
    if (v === u || !v.isAir || !v.alive) return;
    const dx = u.x - v.x, dy = u.y - v.y, d = Math.hypot(dx, dy) || 1;
    if (d < 26) { u.x += (dx / d) * 6 * dt; u.y += (dy / d) * 6 * dt; }
  });
}

/** One-way attack drone hits its target: warhead strike from above (top attack), then gone. */
function detonate(w: World, u: Unit, t: Unit) {
  const ws = u.weapons[0];
  const id = ws ? Object.keys(ws.ammo)[0] : 'dronewarhead';
  const a = AMMO[id];
  // Top attack: treat as a shot into the rear/roof (thin armour) by coming in from behind the target.
  applyHit(w, t, a, t.heading, 50, 1, u, u.team);
  applySplash(w, t.x, t.y, a, u.team, t);
  w.bus.emit({ type: 'explosion', x: t.x, y: t.y, size: 1.4 });
  u.ai.detonated = true;
  killUnit(w, u, null, false);
  u.wreck = false; // drones leave no wreck
}

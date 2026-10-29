import { DEG, angleDiff, turnToward } from '../../core/math';
import { TILE } from '../../core/constants';
import { TERRAIN } from '../../data/terrain';
import type { Unit } from '../entity';
import type { World } from '../world';

/** Condition multipliers on top-speed from damage. */
function damageSpeedFactor(u: Unit): number {
  let f = 1;
  if (u.dmg.engine < 1) f *= 0.35 + 0.65 * u.dmg.engine;
  if (u.inf) f *= 1 - u.inf.suppression / 250;
  return f;
}

export function movementSystem(w: World, dt: number) {
  for (const u of w.units) {
    if (!u.onMap || u.isAir) continue;
    stepGround(w, u, dt);
  }
  separate(w);
}

function stepGround(w: World, u: Unit, dt: number) {
  const m = u.def.mobility, mob = u.mob;
  if (mob.stalled > 0) mob.stalled = Math.max(0, mob.stalled - dt);
  if (mob.bogged > 0) {
    mob.bogged = Math.max(0, mob.bogged - dt);
    if (mob.bogged === 0) w.bus.emit({ type: 'status', unit: u, text: 'Freed from the mud' });
  }

  let desired = 0;
  const hasPath = mob.pathI < mob.path.length;
  const o = u.orders[0];
  const moving = hasPath && !!o && (o.type === 'move' || o.type === 'attack' || o.type === 'board' || o.type === 'unload');
  if (moving && u.canMove) {
    const wp = mob.path[mob.pathI];
    const dx = wp.x - u.x, dy = wp.y - u.y;
    const d = Math.hypot(dx, dy);
    const last = mob.pathI === mob.path.length - 1;
    if (d < (last ? 2.5 : 5)) {
      mob.pathI++;
    } else {
      const want = Math.atan2(dy, dx);
      const diff = Math.abs(angleDiff(u.heading, want));
      // Turn rate improves with speed for wheeled vehicles that cannot pivot on the spot.
      const pivot = u.def.moveClass === 'tracked' || u.def.moveClass === 'foot' ? 1 : Math.max(0.35, Math.min(1, u.speed / (m.speed * 0.5)));
      u.heading = turnToward(u.heading, want, m.turnRate * DEG * dt * pivot);
      const tmul = w.map.speedAt(u.def.moveClass, u.x, u.y);
      desired = m.speed * Math.min(tmul, 1.8) * damageSpeedFactor(u);
      if (diff > 0.9) desired *= 0.12; else if (diff > 0.45) desired *= 0.55;
      if (last) desired *= Math.min(1, d / 18 + 0.25);
    }
  }
  // Accelerate / brake (brakes harder than it accelerates).
  const a = (desired > u.speed ? m.accel : m.accel * 2.2) * dt;
  u.speed += Math.max(-a, Math.min(a, desired - u.speed));
  if (u.speed < 0.02 && desired === 0) u.speed = 0;
  mob.moving = u.speed > 0.2;

  if (u.speed > 0) {
    const nx = u.x + Math.cos(u.heading) * u.speed * dt;
    const ny = u.y + Math.sin(u.heading) * u.speed * dt;
    const mc = u.def.moveClass;
    if (w.map.speedAt(mc, nx, ny) > 0) { u.x = nx; u.y = ny; }
    else if (w.map.speedAt(mc, nx, u.y) > 0) { u.x = nx; }
    else if (w.map.speedAt(mc, u.x, ny) > 0) { u.y = ny; }
    else { u.speed = 0; mob.stuckTimer += dt; }
    u.x = Math.max(2, Math.min(w.map.w * TILE - 2, u.x));
    u.y = Math.max(2, Math.min(w.map.h * TILE - 2, u.y));

    // Fuel burn scales with throttle.
    if (mob.fuelMax > 0) mob.fuel = Math.max(0, mob.fuel - dt * (u.speed / m.speed));

    const t = TERRAIN[w.map.at(u.x, u.y)];
    // Heavy vehicles can bog down in marsh.
    if (t.bogs && m.bogRisk > 0 && mob.bogged <= 0 && u.speed > 0.5 && w.rng.chance(m.bogRisk * 0.05 * dt * (u.speed / m.speed))) {
      mob.bogged = w.rng.range(9, 16); u.speed = 0;
      w.bus.emit({ type: 'status', unit: u, text: 'Bogged down in the marsh' });
    }
    // Unreliable engines stall (Chieftain!). A small fraction are terminal until repaired.
    if (m.reliability < 1 && u.speed > m.speed * 0.5 && w.rng.chance((1 - m.reliability) * 0.012 * dt)) {
      if (w.rng.chance(0.08)) {
        mob.immobilized = true; mob.immobilizedReason = 'Engine failure';
        w.bus.emit({ type: 'status', unit: u, text: 'Engine failure' });
      } else {
        mob.stalled = w.rng.range(6, 14); u.speed = 0;
        w.bus.emit({ type: 'status', unit: u, text: 'Engine stalled' });
      }
    }
  }

  // Stuck detection: when ordered to move but barely progressing, ask for a fresh path.
  if (moving && u.canMove) {
    if (Math.hypot(u.x - mob.lastX, u.y - mob.lastY) < 0.015) mob.stuckTimer += dt; else if (mob.stuckTimer > 0) mob.stuckTimer = Math.max(0, mob.stuckTimer - dt);
    mob.lastX = u.x; mob.lastY = u.y;
    if (mob.stuckTimer > 2.5 && mob.repath <= 0) { mob.path = []; mob.pathI = 0; mob.stuckTimer = 1.5; }
  } else {
    mob.stuckTimer = 0;
  }
}

/** Soft separation so ground units do not stack. */
function separate(w: World) {
  for (const u of w.units) {
    if (!u.onMap || u.isAir || u.wreck) continue;
    const ru = u.radius;
    w.spatial.forEachNear(u.x, u.y, ru + 14, (v) => {
      if (v.id <= u.id || v.isAir || !v.alive) return;
      const dx = v.x - u.x, dy = v.y - u.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const k = u.isInfantry && v.isInfantry ? 0.55 : 0.85;
      const min = (ru + v.radius) * k;
      if (d >= min) return;
      const push = (min - d) * 0.2;
      const px = (dx / d) * push, py = (dy / d) * push;
      // Moving units shove idle ones more than the reverse.
      const wu = u.speed > 0.3 ? 0.3 : 0.7, wv = v.speed > 0.3 ? 0.3 : 0.7;
      const norm = wu + wv;
      tryShift(w, u, -px * (wu / norm) * 2, -py * (wu / norm) * 2);
      tryShift(w, v, px * (wv / norm) * 2, py * (wv / norm) * 2);
    });
  }
}
function tryShift(w: World, u: Unit, dx: number, dy: number) {
  if (w.map.speedAt(u.def.moveClass, u.x + dx, u.y + dy) > 0) { u.x += dx; u.y += dy; }
}

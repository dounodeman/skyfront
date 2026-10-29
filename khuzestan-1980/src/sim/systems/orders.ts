import { TILE } from '../../core/constants';
import { findPath } from '../pathfinding';
import type { Unit } from '../entity';
import { engageRange, lineOfFire, spotted } from './combat';
import type { World } from '../world';

/** Heavy tracked/amphibious vehicles route around marsh. */
export const isHeavy = (u: Unit) => u.def.moveClass === 'tracked' && u.def.mobility.bogRisk > 0.15;

export function computePath(w: World, u: Unit, gx: number, gy: number) {
  u.mob.path = findPath(w.map, u.def.moveClass, u.x, u.y, gx, gy, isHeavy(u));
  u.mob.pathI = 0;
  u.mob.repath = 1.5;
}

/**
 * Turns the active order into a path the movement system follows.
 * Combat-driven orders (attack, board, unload) are handled in their own systems.
 */
export function ordersSystem(w: World, dt: number) {
  for (const u of w.units) {
    if (!u.onMap || u.isAir) continue;
    const mob = u.mob;
    mob.repath -= dt;
    const o = u.orders[0];
    if (!o) continue;
    if (o.type === 'attack') {
      attackOrder(w, u, o.targetId);
      continue;
    }
    if (o.type === 'move') {
      if (mob.path.length === 0 && mob.pathI === 0) {
        computePath(w, u, o.x, o.y);
        if (mob.path.length === 0) { u.orders.shift(); continue; } // unreachable / already there
      }
      if (mob.pathI >= mob.path.length) {
        // Arrived (or gave up): next order.
        const d = Math.hypot(o.x - u.x, o.y - u.y);
        if (d < TILE * 2 || mob.stuckTimer > 4) { u.orders.shift(); mob.path = []; mob.pathI = 0; mob.stuckTimer = 0; }
        else { computePath(w, u, o.x, o.y); if (!mob.path.length) { u.orders.shift(); } }
      }
    }
  }
}

/** Close to weapon range of an attack target, then stop and let the combat system fire. */
function attackOrder(w: World, u: Unit, targetId: number) {
  const t = w.alive(targetId);
  if (!t || t.carrier) { u.orders.shift(); u.mob.path = []; u.mob.pathI = 0; u.lastKnown = null; return; }
  const vis = spotted(w, u.team, t);
  if (vis) u.lastKnown = { x: t.x, y: t.y };
  const lk = u.lastKnown ?? { x: t.x, y: t.y };
  const range = engageRange(u, t);
  if (range === 0 && !u.def.kamikaze) { u.orders.shift(); return; }
  const d = Math.hypot(t.x - u.x, t.y - u.y);
  if (!vis && Math.hypot(lk.x - u.x, lk.y - u.y) < 40) { u.orders.shift(); u.mob.path = []; u.mob.pathI = 0; return; } // lost contact
  if (w.tick % 10 === (u.id % 10)) u.ai.atkLos = lineOfFire(w, u, t);
  if (vis && d <= range * 0.9 && u.ai.atkLos !== false) {
    u.mob.path = []; u.mob.pathI = 0; // in position
    return;
  }
  if (u.isAir) return; // aircraft handle their own approach
  const end = u.mob.path[u.mob.path.length - 1];
  if (!end || (u.mob.repath <= 0 && Math.hypot(end.x - lk.x, end.y - lk.y) > 40)) computePath(w, u, lk.x, lk.y);
}

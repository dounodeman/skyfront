import { TILE } from '../../core/constants';
import { findPath } from '../pathfinding';
import type { Unit } from '../entity';
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

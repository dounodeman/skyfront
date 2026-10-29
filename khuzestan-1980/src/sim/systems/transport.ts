import { dist } from '../../core/math';
import type { Unit } from '../entity';
import type { World } from '../world';
import { computePath } from './orders';

/** Squad slots in use inside a transport. */
export const usedSlots = (t: Unit) => t.cargo.reduce((s, c) => s + (c.def.slots ?? 1), 0);
export const freeSlots = (t: Unit) => (t.def.transport?.capacity ?? 0) - usedSlots(t);

/** Helicopters must be on the ground to load or unload. */
const readyToLoad = (t: Unit) => !t.isAir || t.landed;

/**
 * Mount / dismount. Infantry with a 'board' order walk to the transport and climb in.
 * Transports with an 'unload' order drive (or fly and land) to the point and drop everyone off.
 */
export function transportSystem(w: World, _dt: number) {
  for (const u of w.units) {
    if (!u.onMap) continue;
    const o = u.orders[0];
    if (!o) continue;
    // Loaded ground transports on attack-move drop their squads on contact, then fight on.
    if (o.type === 'move' && o.attackMove && u.cargo.length && !u.isAir && u.engaged && u.speed < 2) {
      unloadAll(w, u);
      continue;
    }
    if (o.type === 'board') {
      const t = w.alive(o.targetId);
      if (!t || t.team !== u.team || t.carrier || freeSlots(t) < (u.def.slots ?? 1) || u.inf?.state === 'broken') { u.orders.shift(); u.mob.path = []; continue; }
      const d = dist(u.x, u.y, t.x, t.y);
      if (d < t.radius + 9 && readyToLoad(t)) { board(w, u, t); continue; }
      const end = u.mob.path[u.mob.path.length - 1];
      if (!end || (u.mob.repath <= 0 && dist(end.x, end.y, t.x, t.y) > 15)) computePath(w, u, t.x, t.y);
    } else if (o.type === 'unload') {
      if (!u.cargo.length) { u.orders.shift(); continue; }
      const d = dist(u.x, u.y, o.x, o.y);
      if (u.isAir) continue; // air system flies, lands and calls unloadAll
      if (d > 20 && u.canMove) {
        const end = u.mob.path[u.mob.path.length - 1];
        if (!end || dist(end.x, end.y, o.x, o.y) > 20) computePath(w, u, o.x, o.y);
        if (u.mob.pathI < u.mob.path.length) continue;
      }
      // Stop, then dismount.
      u.mob.path = []; u.mob.pathI = 0;
      if (u.speed < 1) { unloadAll(w, u); u.orders.shift(); }
    }
  }
}

export function board(w: World, u: Unit, t: Unit) {
  u.carrier = t;
  t.cargo.push(u);
  u.orders.length = 0;
  u.mob.path = []; u.mob.pathI = 0;
  u.speed = 0;
  w.bus.emit({ type: 'status', unit: u, text: `Boarded ${t.def.name}` });
}

/** Drop all passengers in a fan behind the transport. */
export function unloadAll(w: World, t: Unit) {
  const n = t.cargo.length;
  t.cargo.forEach((p, i) => {
    const a = t.heading + Math.PI + (i - (n - 1) / 2) * 0.7;
    let x = t.x + Math.cos(a) * (t.radius + 6), y = t.y + Math.sin(a) * (t.radius + 6);
    if (w.map.speedAt('foot', x, y) <= 0) { x = t.x; y = t.y; } // e.g. unloading next to a canal
    p.x = x; p.y = y; p.heading = a + Math.PI;
    p.carrier = null;
    p.orders.length = 0; p.mob.path = []; p.mob.pathI = 0;
    // Freshly dismounted troops are a little disorganised.
    if (p.inf) p.inf.suppression = Math.max(p.inf.suppression, 10);
  });
  if (n) w.bus.emit({ type: 'status', unit: t, text: `Dismounted ${n} squad${n > 1 ? 's' : ''}` });
  t.cargo = [];
}

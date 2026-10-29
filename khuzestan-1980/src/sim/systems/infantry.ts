import { TERRAIN } from '../../data/terrain';
import type { Unit } from '../entity';
import type { World } from '../world';
import { computePath } from './orders';
import { spotted } from './combat';

/**
 * Infantry squads: cover from terrain, suppression (pinned), morale (break and retreat, then rally).
 *  - suppression rises from near misses and casualties, decays when the squad is left alone;
 *    above 70 the squad goes prone and is pinned (cannot move, shoots poorly) until it drops below 35.
 *  - morale drains under suppression, and with casualties; below 20 the squad breaks and runs for home.
 */
export function infantrySystem(w: World, dt: number) {
  const slow = w.tick % 15 === 0; // 2 Hz for the neighbour scans
  for (const u of w.units) {
    const inf = u.inf;
    if (!inf || !u.onMap) continue;
    const t = TERRAIN[w.map.at(u.x, u.y)];
    inf.cover = t.cover * (u.mob.moving ? 0.5 : 1);

    const sq = u.def.squad!;
    const underFire = w.time - u.dmg.lastHitTime < 2.5;
    inf.suppression = Math.max(0, inf.suppression - dt * (underFire ? 6 : 14) * (1 + inf.cover * 0.5));

    // Morale: drains under suppression, recovers when quiet (faster with friends close by).
    if (inf.suppression > 30) inf.morale -= dt * (inf.suppression / 100) * 4 * (1 - sq.moraleResilience * 0.6);
    else if (inf.morale < sq.moraleBase) {
      const friends = slow ? countFriends(w, u) : (u.ai.friends ?? 0);
      u.ai.friends = friends;
      inf.morale = Math.min(sq.moraleBase, inf.morale + dt * (1.5 + Math.min(3, friends) * 0.6 + (inf.state === 'broken' ? 2 : 0)));
    }
    inf.morale = Math.max(0, inf.morale);

    switch (inf.state) {
      case 'ok':
        if (inf.morale < 20) breakSquad(w, u);
        else if (inf.suppression > 70) { inf.state = 'pinned'; u.speed = 0; }
        break;
      case 'pinned':
        if (inf.morale < 20) breakSquad(w, u);
        else if (inf.suppression < 35) inf.state = 'ok';
        break;
      case 'broken':
        if (inf.morale > 45 && (slow ? !enemyNear(w, u, 350) : false)) {
          inf.state = 'ok';
          u.orders.length = 0; u.mob.path = []; u.mob.pathI = 0;
          w.bus.emit({ type: 'status', unit: u, text: 'Rallied' });
        } else if (!u.orders.length && slow) retreat(w, u);
        break;
    }
  }
}

function countFriends(w: World, u: Unit) {
  let n = 0;
  w.spatial.forEachNear(u.x, u.y, 120, (v) => { if (v !== u && v.team === u.team && v.alive) n++; });
  return n;
}

function enemyNear(w: World, u: Unit, r: number) {
  let found = false;
  w.spatial.forEachNear(u.x, u.y, r, (v) => { if (!found && v.team !== u.team && v.alive && spotted(w, u.team, v)) found = true; });
  return found;
}

function breakSquad(w: World, u: Unit) {
  u.inf!.state = 'broken';
  u.inf!.suppression = Math.min(u.inf!.suppression, 50);
  w.bus.emit({ type: 'status', unit: u, text: 'Squad broken – falling back' });
  retreat(w, u);
}

/** Fall back toward the team's depot, about 300 m at a time. */
function retreat(w: World, u: Unit) {
  const home = w.depots[u.team];
  const dx = home.x - u.x, dy = home.y - u.y;
  const d = Math.hypot(dx, dy);
  if (d < 60) return;
  const step = Math.min(d, 300);
  const gx = u.x + (dx / d) * step, gy = u.y + (dy / d) * step;
  u.orders = [{ type: 'move', x: gx, y: gy }];
  computePath(w, u, gx, gy);
}

import type { TeamId } from '../../core/constants';
import { dist } from '../../core/math';
import type { Unit } from '../entity';
import type { World } from '../world';

/**
 * Match rules: objective capture, ticket bleed and victory.
 *  - A side alone inside an objective's radius pushes its capture progress (more units = faster).
 *  - Each second, every objective a side holds drains the other side's tickets.
 *  - Every unit lost costs tickets in proportion to its price.
 *  - Tickets at zero, or no fighting units left, ends the match.
 */
export const TICKETS_PER_COST = 1 / 8;
export const BLEED_PER_OBJECTIVE = 0.3; // tickets per second, per objective held, from the other side

/** Units that count for capturing and for "still has an army". */
export function isCombatant(u: Unit) {
  if (!u.alive || u.carrier) return false;
  if (u.inf) return u.inf.state !== 'broken';
  return u.weapons.length > 0 && !(u.def.crew.length && u.crewAlive === 0);
}

export function installMatchRules(w: World) {
  w.stats = { lost: [0, 0], lostValue: [0, 0], kills: [0, 0] };
  w.bus.on('kill', (e) => {
    const t = e.unit.team;
    w.stats.lost[t]++;
    w.stats.lostValue[t] += e.unit.def.cost;
    w.stats.kills[t === 0 ? 1 : 0]++;
    w.teams[t].tickets -= e.unit.def.cost * TICKETS_PER_COST;
    // Passengers lost with the vehicle are counted when their own kill event fires.
  });
}

export function objectivesSystem(w: World, dt: number) {
  if (w.tick % 6 !== 0) return; // 5 Hz is plenty
  const step = dt * 6;
  for (const o of w.objectives) {
    const n = [0, 0];
    w.spatial.forEachNear(o.x, o.y, o.radius, (u) => {
      if (u.isAir || !isCombatant(u)) return;
      n[u.team] += u.inf ? 1 : 1.2;
    });
    let push = 0;
    if (n[0] > 0 && n[1] === 0) push = 1;
    else if (n[1] > 0 && n[0] === 0) push = -1;
    if (!push) continue;
    const strength = Math.min(3, n[push > 0 ? 0 : 1]);
    const prevOwner = o.owner;
    o.progress = Math.max(-1, Math.min(1, o.progress + push * step * 0.045 * (0.6 + strength * 0.4)));
    // Ownership flips at full control; crossing the midpoint makes it neutral.
    let owner: TeamId | null = o.owner;
    if (o.progress >= 1) owner = 0;
    else if (o.progress <= -1) owner = 1;
    else if ((o.owner === 0 && o.progress <= 0) || (o.owner === 1 && o.progress >= 0)) owner = null;
    if (owner !== prevOwner) {
      o.owner = owner;
      w.bus.emit({ type: 'objective', id: o.id, owner, prev: prevOwner });
      const who = owner === null ? 'neutral' : w.teams[owner].name;
      w.bus.emit({ type: 'message', text: owner === null ? `${o.name} contested – now neutral` : `${o.name} captured by ${who}`, level: owner === 0 ? 'good' : owner === 1 ? 'warn' : 'info' });
    }
  }

  // Ticket bleed once per second.
  if (w.tick % 30 === 0) {
    const held = [0, 0];
    for (const o of w.objectives) if (o.owner !== null) held[o.owner]++;
    // Every objective a side holds drains the other side, so even splits still move toward an end.
    w.teams[1].tickets -= held[0] * BLEED_PER_OBJECTIVE;
    w.teams[0].tickets -= held[1] * BLEED_PER_OBJECTIVE;
  }

  // Victory checks
  if (w.over || w.time < 3) return;
  for (const t of [0, 1] as TeamId[]) {
    const other: TeamId = t === 0 ? 1 : 0;
    if (w.teams[t].tickets <= 0) return endMatch(w, other, `${w.teams[t].name} has run out of tickets`);
    const army = w.units.some((u) => u.team === t && (isCombatant(u) || u.carrier && u.carrier.alive));
    if (!army && !w.vars.noEliminationCheck) return endMatch(w, other, `${w.teams[t].name} has no fighting units left`);
  }
  // Scenario scripts may set a timer that decides the match.
  void dist;
}

export function endMatch(w: World, winner: TeamId | null, reason: string) {
  if (w.over) return;
  w.over = true;
  w.winner = winner;
  w.bus.emit({ type: 'end', winner, reason });
}

/**
 * Supply depots: units near their own depot are rearmed, refuelled and slowly repaired.
 * Damaged subsystems (gun, turret, tracks, engine) are fixed after ~15 s at the depot.
 */
export const DEPOT_RADIUS = 140;
export function supplySystem(w: World, dt: number) {
  if (w.tick % 15 !== 0) return;
  const step = dt * 15;
  for (const u of w.units) {
    if (!u.onMap || u.inf && u.inf.state === 'broken') continue;
    const dep = w.depots[u.team];
    if (dist(u.x, u.y, dep.x, dep.y) > DEPOT_RADIUS) { u.ai.atDepot = 0; continue; }
    u.ai.atDepot = (u.ai.atDepot ?? 0) + step;
    for (const ws of u.weapons) for (const id in ws.ammo) {
      const max = ws.ammoMax[id];
      if (ws.ammo[id] < max) ws.ammo[id] = Math.min(max, ws.ammo[id] + Math.max(1, max * 0.08) * step);
    }
    if (u.mob.fuelMax > 0) u.mob.fuel = Math.min(u.mob.fuelMax, u.mob.fuel + u.mob.fuelMax * 0.06 * step);
    if (u.hp < u.maxHp && !u.inf) u.hp = Math.min(u.maxHp, u.hp + 1.5 * step);
    if (u.inf) {
      // Replacements trickle in for depleted squads.
      if (u.hp < u.maxHp) { u.hp = Math.min(u.maxHp, u.hp + u.inf.hpPerMan * 0.08 * step); u.inf.men = u.hp / u.inf.hpPerMan; }
      u.inf.morale = Math.min(u.def.squad!.moraleBase, u.inf.morale + 3 * step);
    }
    if (u.ai.atDepot > 15) {
      if (u.dmg.gunDisabled || u.dmg.turretJammed || u.mob.immobilized || u.dmg.engine < 1 || u.dmg.crew.some((c) => !c)) {
        u.dmg.gunDisabled = false; u.dmg.turretJammed = false; u.dmg.engine = 1;
        u.mob.immobilized = false; u.mob.immobilizedReason = '';
        u.dmg.crew = u.dmg.crew.map(() => true); // replacement crewmen
        w.bus.emit({ type: 'status', unit: u, text: 'Repaired and re-crewed at depot' });
      }
    }
  }
}

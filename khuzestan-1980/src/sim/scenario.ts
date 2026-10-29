import { TILE, type TeamId } from '../core/constants';
import type { ScenarioAction, ScenarioDef } from '../data/scenarios/types';
import type { FactionId } from '../data/units/types';
import { issueMove } from './commands';
import { createWorld, deploy, other } from './setup';
import { endMatch } from './systems/objectives';
import { board } from './systems/transport';
import type { World } from './world';

/**
 * Builds a World for a scripted scenario and installs its script system:
 * timed / conditional triggers (messages, reinforcements, weather) and the victory rule
 * (attacker must hold the required objectives before the time limit; otherwise the defender wins).
 */
export function createScenarioWorld(def: ScenarioDef, playerFaction: FactionId, seed?: number): World {
  const teamOf = (f: FactionId): TeamId => (f === playerFaction ? 0 : 1);
  const w = createWorld({
    map: { ...def.map, objectives: def.objectives },
    playerFaction, era: 1980, light: def.light, dust: def.dust,
    playerForce: [], enemyForce: [], extraOps: def.extraOps, tickets: 9999, seed,
  });
  w.vars.scenario = def.id;
  w.vars.timeLimit = def.timeLimit;
  w.vars.attacker = teamOf(def.attacker);
  w.vars.noEliminationCheck = false;
  for (const f of def.forces) deploy(w, teamOf(f.faction), f.units, f.rect, true);
  for (const faction of ['iraq', 'iran'] as FactionId[]) {
    const team = teamOf(faction);
    const placed = def.placements[faction].map((p) => {
      const u = w.spawn(p.defId, team, (p.x + 0.5) * TILE, (p.y + 0.5) * TILE, p.heading ?? (faction === 'iraq' ? 0 : Math.PI));
      if (p.hold) { u.stance = 'hold'; u.ai.dugIn = true; }
      return u;
    });
    def.placements[faction].forEach((p, i) => {
      if (p.mountIn !== undefined && placed[p.mountIn]) board(w, placed[i], placed[p.mountIn]);
    });
  }
  // Starting values for "losses" triggers.
  const startValue = [0, 0];
  for (const u of w.units) startValue[u.team] += u.def.cost;

  const fired = new Set<number>();
  let holdTimer = 0;
  w.systems.push((world, dt) => {
    if (world.tick % 15 !== 0 || world.over) return;
    const step = dt * 15;
    def.triggers.forEach((t, i) => {
      if (fired.has(i)) return;
      const c = t.when;
      let ok = false;
      if (c.type === 'time') ok = world.time >= c.at;
      else if (c.type === 'objective') ok = world.objectives.find((o) => o.id === c.id)?.owner === teamOf(c.owner);
      else if (c.type === 'losses') ok = world.stats.lostValue[teamOf(c.faction)] >= startValue[teamOf(c.faction)] * c.fraction;
      if (!ok) return;
      fired.add(i);
      for (const a of t.actions) runAction(world, a, teamOf, playerFaction);
    });
    // Victory rule
    const att = teamOf(def.attacker);
    const allHeld = def.required.every((id) => world.objectives.find((o) => o.id === id)?.owner === att);
    holdTimer = allHeld ? holdTimer + step : 0;
    world.vars.holdTimer = holdTimer;
    if (holdTimer >= def.holdFor) endMatch(world, att, `${world.teams[att].name} secured all objectives`);
    else if (world.time >= def.timeLimit) endMatch(world, att === 0 ? 1 : 0, `Time ran out – the ${def.attacker === 'iraq' ? 'Iraqi' : 'Iranian'} assault was delayed`);
  });
  return w;
}

function runAction(w: World, a: ScenarioAction, teamOf: (f: FactionId) => TeamId, player: FactionId) {
  switch (a.type) {
    case 'message':
      if (a.to === undefined || a.to === 'all' || a.to === player) w.bus.emit({ type: 'message', text: a.text, level: a.level ?? 'info' });
      break;
    case 'env':
      if (a.light !== undefined) w.env.light = a.light;
      if (a.dust !== undefined) w.env.dust = a.dust;
      break;
    case 'spawn': {
      const team = teamOf(a.faction);
      const [x, y] = a.at;
      const units = deploy(w, team, a.units, [x - 3, y - 6, x + 3, y + 6], true);
      if (a.attackMoveTo) issueMove(w, units.filter((u) => !u.carrier), (a.attackMoveTo[0] + 0.5) * TILE, (a.attackMoveTo[1] + 0.5) * TILE, { attackMove: true });
      for (const u of units) u.ai.reinforcement = true;
      break;
    }
  }
}
export { other };

import { TILE, type TeamId } from '../core/constants';
import type { MapDef, PaintOp } from '../data/maps/types';
import { unitDef } from '../data/units';
import type { Era, FactionId } from '../data/units/types';
import { buildMap } from './mapgen';
import { defaultSystems } from './systems';
import { board, freeSlots } from './systems/transport';
import type { Unit } from './entity';
import { World, type Environment } from './world';

export interface ForceEntry { defId: string; count: number }

export interface MatchConfig {
  map: MapDef;
  playerFaction: FactionId;
  era: Era;
  light: Environment['light'];
  dust: boolean;
  playerForce: ForceEntry[];
  enemyForce: ForceEntry[];
  tickets?: number;
  seed?: number;
  /** Scenario extras */
  extraOps?: PaintOp[];
  /** Start infantry mounted in the team's transports. */
  mountInfantry?: boolean;
}

export const FACTION_NAMES: Record<FactionId, string> = { iraq: 'Iraq', iran: 'Iran' };
export const other = (f: FactionId): FactionId => (f === 'iraq' ? 'iran' : 'iraq');

/** Builds a World for a match. Team 0 is always the human player. */
export function createWorld(cfg: MatchConfig): World {
  const map = buildMap(cfg.map, cfg.extraOps ?? []);
  const pf = cfg.playerFaction, ef = other(pf);
  const tickets = cfg.tickets ?? 600;
  const w = new World(map, [
    { id: 0, faction: pf, name: FACTION_NAMES[pf], tickets, ticketsMax: tickets, isHuman: true },
    { id: 1, faction: ef, name: FACTION_NAMES[ef], tickets, ticketsMax: tickets, isHuman: false },
  ], cfg.seed ?? Math.floor(Math.random() * 1e9));
  w.systems = defaultSystems();
  w.env = { light: cfg.light, dust: cfg.dust, era: cfg.era };
  const teamOfFaction = (f: FactionId | null): TeamId | null => (f === null ? null : f === pf ? 0 : 1);
  w.depots = [
    { x: (cfg.map.depot[pf][0] + 0.5) * TILE, y: (cfg.map.depot[pf][1] + 0.5) * TILE },
    { x: (cfg.map.depot[ef][0] + 0.5) * TILE, y: (cfg.map.depot[ef][1] + 0.5) * TILE },
  ];
  w.objectives = cfg.map.objectives.map((o) => {
    const owner = teamOfFaction(o.owner);
    return { id: o.id, name: o.name, x: (o.x + 0.5) * TILE, y: (o.y + 0.5) * TILE, radius: o.radius * TILE, owner, progress: owner === null ? 0 : owner === 0 ? 1 : -1 };
  });
  deploy(w, 0, cfg.playerForce, cfg.map.spawn[pf], cfg.mountInfantry ?? true);
  deploy(w, 1, cfg.enemyForce, cfg.map.spawn[ef], cfg.mountInfantry ?? true);
  return w;
}

/**
 * Places a force inside a spawn rectangle (tile coords): armour in front, then other vehicles,
 * infantry behind, aircraft at the back. Infantry optionally starts inside free transport seats.
 */
export function deploy(w: World, team: TeamId, force: ForceEntry[], rect: [number, number, number, number], mount: boolean): Unit[] {
  const [x0, y0, x1, y1] = rect.map((v) => v * TILE);
  const enemyDepot = w.depots[team === 0 ? 1 : 0];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const facing = Math.atan2(enemyDepot.y - cy, enemyDepot.x - cx);
  // "Front" = side of the rectangle closest to the enemy.
  const towardEast = Math.cos(facing) > 0;
  const order = (id: string) => {
    const d = unitDef(id);
    if (d.category === 'tank') return 0;
    if (d.category === 'apc' || d.category === 'atgm') return 1;
    if (d.category === 'infantry') return 2;
    if (d.category === 'aa') return 3;
    return 4; // aircraft, drones
  };
  const list: string[] = [];
  for (const e of [...force].sort((a, b) => order(a.defId) - order(b.defId))) for (let i = 0; i < e.count; i++) list.push(e.defId);
  const units: Unit[] = [];
  const spacingX = 42, spacingY = 34;
  const maxCols = Math.max(1, Math.floor((y1 - y0) / spacingY));
  const bandCount = new Map<number, number>();
  for (const id of list) bandCount.set(order(id), (bandCount.get(order(id)) ?? 0) + 1);
  const rows = new Map<number, number>();
  // Each band (armour, carriers, infantry, AA, aircraft) is a block centred on the spawn zone.
  let depthBase = 0;
  const bandDepth = new Map<number, number>();
  for (const b of [0, 1, 2, 3, 4]) {
    const n = bandCount.get(b) ?? 0;
    if (!n) continue;
    const cols = Math.min(maxCols, Math.max(3, Math.ceil(n / 2)));
    bandDepth.set(b, depthBase);
    depthBase += Math.ceil(n / cols);
  }
  for (const id of list) {
    const band = order(id);
    const n = bandCount.get(band)!;
    const cols = Math.min(maxCols, Math.max(3, Math.ceil(n / 2)));
    const idx = rows.get(band) ?? 0;
    rows.set(band, idx + 1);
    const col = idx % cols, row = Math.floor(idx / cols);
    const depth = bandDepth.get(band)! + row;
    const x = towardEast ? x1 - depth * spacingX : x0 + depth * spacingX;
    const y = cy + (col - (cols - 1) / 2) * spacingY + (row % 2) * 8;
    let px = Math.max(x0, Math.min(x1, x)), py = Math.max(y0, Math.min(y1, y));
    // Nudge off impassable tiles.
    const mc = unitDef(id).moveClass === 'air' ? 'foot' : unitDef(id).moveClass;
    for (let k = 0; k < 20 && w.map.speedAt(mc, px, py) <= 0; k++) { px += towardEast ? -TILE : TILE; }
    units.push(w.spawn(id, team, px, py, facing));
  }
  if (mount) {
    const transports = units.filter((u) => u.def.transport && !u.isAir);
    for (const inf of units.filter((u) => u.isInfantry)) {
      const t = transports.find((tr) => freeSlots(tr) >= (inf.def.slots ?? 1));
      if (!t) break;
      board(w, inf, t);
    }
  }
  return units;
}

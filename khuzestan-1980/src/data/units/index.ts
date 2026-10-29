import type { Era, FactionId, UnitDef } from './types';
import { IRAQ_UNITS } from './iraq';
import { IRAN_UNITS } from './iran';
import { DRONE_UNITS } from './drones';

/**
 * Unit registry. To add a unit: append a UnitDef to a faction file (or create a new file and list it
 * here). Nothing else needs to change – purchase screen, AI and sprites all read from this table.
 */
const ALL: UnitDef[] = [...IRAQ_UNITS, ...IRAN_UNITS, ...DRONE_UNITS];
export const UNITS: Record<string, UnitDef> = Object.fromEntries(ALL.map((u) => [u.id, u]));

export function unitDef(id: string): UnitDef {
  const d = UNITS[id];
  if (!d) throw new Error(`Unknown unit def: ${id}`);
  return d;
}

/** Units a faction may field in the given era (unit.era <= era). */
export function rosterFor(faction: FactionId, era: Era): UnitDef[] {
  return ALL.filter((u) => u.faction === faction && u.era <= era);
}

export type { UnitDef, FactionId, Era } from './types';

import type { UnitDef } from '../data/units/types';
import type { Unit } from '../sim/entity';

/** View-side unit numbering ("T-55 #3") – assigned on first use, stable for the match. */
const numbers = new WeakMap<Unit, number>();
const counters = new Map<string, number>();
export function resetLabels() { counters.clear(); }
export function unitNo(u: Unit): number {
  let n = numbers.get(u);
  if (n === undefined) {
    const k = `${u.team}:${u.def.id}`;
    n = (counters.get(k) ?? 0) + 1;
    counters.set(k, n);
    numbers.set(u, n);
  }
  return n;
}
export const unitLabel = (u: Unit) => `${u.def.name.toUpperCase()} #${unitNo(u)}`;

/** Compass bearing (000–359, north = up) from a to b. */
export function bearing(ax: number, ay: number, bx: number, by: number): string {
  const deg = ((Math.atan2(bx - ax, -(by - ay)) * 180) / Math.PI + 360) % 360;
  return String(Math.round(deg) % 360).padStart(3, '0');
}

/** Radio contact class for a unit type. */
export function contactClass(d: UnitDef): string {
  switch (d.category) {
    case 'tank': return d.role === 'scout' ? 'LIGHT ARMOR' : 'ARMOR';
    case 'apc': return 'MECH';
    case 'infantry': return d.role === 'at' ? 'AT TEAM' : d.role === 'aa' ? 'MANPADS' : 'INFANTRY';
    case 'heli': return d.role === 'transport' ? 'HELO, TRANSPORT' : 'HELO, ATTACK';
    case 'aa': return 'AIR DEFENCE';
    case 'atgm': return 'ATGM';
    case 'drone': return 'DRONE';
  }
  return 'UNKNOWN';
}

/** Mission clock "T+04:12". */
export const missionClock = (t: number) => `T+${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

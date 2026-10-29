import { TILE, type TeamId } from '../core/constants';
import { angleTo, type Vec } from '../core/math';
import type { Unit } from './entity';
import type { World } from './world';

/**
 * Order API shared by the player UI, scenario scripts and the AI.
 * Nothing here knows about the mouse or keyboard.
 */
export type FormationId = 'none' | 'line' | 'column' | 'wedge' | 'box';
export const FORMATIONS: FormationId[] = ['none', 'line', 'column', 'wedge', 'box'];

export interface MoveOpts { queue?: boolean; attackMove?: boolean; formation?: FormationId }

function setOrder(u: Unit, o: Unit['orders'][number], queue: boolean) {
  if (!queue) { u.orders.length = 0; u.mob.path = []; u.mob.pathI = 0; u.guiding = 0; }
  u.orders.push(o);
}

/** Offsets (in a frame where +x points along the march direction) for n units. */
export function formationOffsets(kind: FormationId, n: number, spacing: number): Vec[] {
  const out: Vec[] = [];
  if (kind === 'none' || n === 1) { for (let i = 0; i < n; i++) out.push({ x: 0, y: 0 }); return out; }
  switch (kind) {
    case 'line': // abreast, perpendicular to travel
      for (let i = 0; i < n; i++) out.push({ x: 0, y: (i - (n - 1) / 2) * spacing });
      break;
    case 'column': // single file behind the lead
      for (let i = 0; i < n; i++) out.push({ x: -(i - (n - 1) / 2) * spacing, y: 0 });
      break;
    case 'wedge':
      for (let i = 0; i < n; i++) {
        const rank = Math.ceil(i / 2), side = i === 0 ? 0 : i % 2 ? 1 : -1;
        out.push({ x: -rank * spacing * 0.8, y: side * rank * spacing });
      }
      break;
    case 'box': {
      const cols = Math.ceil(Math.sqrt(n));
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        out.push({ x: -(r - (Math.ceil(n / cols) - 1) / 2) * spacing, y: (c - (cols - 1) / 2) * spacing });
      }
      break;
    }
  }
  return out;
}

export function issueMove(w: World, units: Unit[], x: number, y: number, opts: MoveOpts = {}) {
  const us = units.filter((u) => u.alive && !u.carrier);
  if (!us.length) return;
  const formation = opts.formation ?? 'none';
  const kind: FormationId = us.length > 1 && formation === 'none' ? 'box' : formation;
  const spacing = Math.max(...us.map((u) => u.radius)) * 2.6 + 4;
  // March direction: from the group's centroid to the destination.
  let cx = 0, cy = 0;
  for (const u of us) { cx += u.x; cy += u.y; }
  cx /= us.length; cy /= us.length;
  const dir = angleTo(cx, cy, x, y);
  const offs = formationOffsets(us.length > 1 && formation === 'none' && us.length <= 3 ? 'line' : kind, us.length, spacing);
  const cos = Math.cos(dir), sin = Math.sin(dir);
  const slots = offs.map((o) => ({ x: x + o.x * cos - o.y * sin, y: y + o.x * sin + o.y * cos }));
  // Assign slots by sorting both along the lateral axis so paths cross as little as possible.
  const lat = (px: number, py: number) => -(px - cx) * sin + (py - cy) * cos;
  const along = (px: number, py: number) => (px - cx) * cos + (py - cy) * sin;
  const key = (px: number, py: number) => lat(px, py) * 1000 + along(px, py);
  const sortedUnits = [...us].sort((a, b) => key(a.x, a.y) - key(b.x, b.y));
  const sortedSlots = [...slots].sort((a, b) => key(a.x, a.y) - key(b.x, b.y));
  sortedUnits.forEach((u, i) => {
    const s = sortedSlots[i];
    const gx = Math.max(TILE, Math.min(w.map.w * TILE - TILE, s.x)), gy = Math.max(TILE, Math.min(w.map.h * TILE - TILE, s.y));
    setOrder(u, { type: 'move', x: gx, y: gy, attackMove: !!opts.attackMove }, !!opts.queue);
  });
}

export function issueAttack(_w: World, units: Unit[], target: Unit, queue = false) {
  for (const u of units) {
    if (!u.alive || u.carrier || u === target) continue;
    setOrder(u, { type: 'attack', targetId: target.id }, queue);
  }
}

export function issueStop(units: Unit[]) {
  for (const u of units) { u.orders.length = 0; u.mob.path = []; u.mob.pathI = 0; u.stance = 'fire'; u.guiding = 0; }
}
export function issueHold(units: Unit[]) {
  for (const u of units) { u.orders.length = 0; u.mob.path = []; u.mob.pathI = 0; u.stance = 'hold'; }
}
export function issueBoard(_w: World, units: Unit[], carrier: Unit, queue = false) {
  for (const u of units) if (u.alive && u !== carrier && u.isInfantry) setOrder(u, { type: 'board', targetId: carrier.id }, queue);
}
export function issueUnload(units: Unit[], x?: number, y?: number) {
  for (const u of units) if (u.alive && u.def.transport) setOrder(u, { type: 'unload', x: x ?? u.x, y: y ?? u.y }, false);
}
export function teamOf(units: Unit[]): TeamId | null { return units.length ? units[0].team : null; }

import type { TeamId } from '../core/constants';
import type { Unit, WeaponState } from './entity';

/** Events emitted by the simulation. Rendering effects and audio subscribe; the sim never depends on them. */
export type SimEvent =
  | { type: 'shot'; unit: Unit; weapon: WeaponState; x: number; y: number; angle: number; ammoId: string }
  | { type: 'impact'; x: number; y: number; kind: 'pen' | 'ricochet' | 'ground' | 'building' | 'air' | 'miss'; ammoId: string; size: number }
  | { type: 'explosion'; x: number; y: number; size: number }
  | { type: 'kill'; unit: Unit; killerTeam: TeamId | null; brewUp: boolean }
  | { type: 'spotted'; unit: Unit; by: TeamId }
  | { type: 'status'; unit: Unit; text: string }
  | { type: 'message'; text: string; team?: TeamId | null; level?: 'info' | 'warn' | 'good' }
  | { type: 'missile'; x: number; y: number; ammoId: string }
  | { type: 'order'; team: TeamId; kind: 'move' | 'attack' | 'amove' }
  | { type: 'objective'; id: string; owner: TeamId | null; prev: TeamId | null }
  | { type: 'end'; winner: TeamId | null; reason: string };

type Handler<T extends SimEvent['type']> = (e: Extract<SimEvent, { type: T }>) => void;

export class EventBus {
  private handlers = new Map<string, Array<(e: any) => void>>();
  on<T extends SimEvent['type']>(type: T, fn: Handler<T>) {
    let l = this.handlers.get(type);
    if (!l) this.handlers.set(type, (l = []));
    l.push(fn);
  }
  emit(e: SimEvent) {
    const l = this.handlers.get(e.type);
    if (l) for (const fn of l) fn(e);
  }
}

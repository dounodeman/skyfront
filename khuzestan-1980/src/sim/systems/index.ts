import type { System } from '../world';
import { ordersSystem } from './orders';
import { movementSystem } from './movement';
import { turretSystem } from './turrets';

/** Order in which systems run each simulation step. */
export function defaultSystems(): System[] {
  return [ordersSystem, movementSystem, turretSystem];
}

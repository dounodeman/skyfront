import type { System } from '../world';
import { ordersSystem } from './orders';
import { movementSystem } from './movement';
import { turretSystem } from './turrets';
import { combatSystem } from './combat';
import { projectileSystem } from './projectiles';
import { lifecycleSystem, visionSystem } from './vision';

/** Order in which systems run each simulation step. */
export function defaultSystems(): System[] {
  return [visionSystem, ordersSystem, movementSystem, combatSystem, turretSystem, projectileSystem, lifecycleSystem];
}

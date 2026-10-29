import type { System } from '../world';
import { ordersSystem } from './orders';
import { movementSystem } from './movement';
import { turretSystem } from './turrets';
import { combatSystem } from './combat';
import { projectileSystem } from './projectiles';
import { lifecycleSystem, visionSystem } from './vision';
import { infantrySystem } from './infantry';
import { transportSystem } from './transport';

/** Order in which systems run each simulation step. */
export function defaultSystems(): System[] {
  return [visionSystem, ordersSystem, transportSystem, movementSystem, infantrySystem, combatSystem, turretSystem, projectileSystem, lifecycleSystem];
}

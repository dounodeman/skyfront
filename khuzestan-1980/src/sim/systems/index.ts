import type { System } from '../world';
import { ordersSystem } from './orders';
import { movementSystem } from './movement';
import { turretSystem } from './turrets';
import { combatSystem } from './combat';
import { projectileSystem } from './projectiles';
import { lifecycleSystem, visionSystem } from './vision';
import { infantrySystem } from './infantry';
import { transportSystem } from './transport';
import { airSystem } from './air';
import { objectivesSystem, supplySystem } from './objectives';

/** Order in which systems run each simulation step. */
export function defaultSystems(): System[] {
  return [visionSystem, ordersSystem, transportSystem, movementSystem, airSystem, infantrySystem, combatSystem, turretSystem, projectileSystem, lifecycleSystem, supplySystem, objectivesSystem];
}

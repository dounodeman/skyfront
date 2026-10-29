import type { TeamId } from '../core/constants';
import type { AmmoDef } from '../data/ammo';

/**
 * A round in flight. Hit/miss is decided when fired (accuracy model) and resolved on arrival,
 * so flight time is visible and slow missiles can lose guidance when their shooter dies.
 */
export interface Projectile {
  x: number; y: number;
  fromX: number; fromY: number;
  /** End point (re-aimed at the target each step for hitting rounds and guided missiles). */
  tx: number; ty: number;
  speed: number;
  ammo: AmmoDef;
  team: TeamId;
  shooterId: number;
  targetId: number;
  /** Number of rounds of this volley that hit the target (0 = miss). */
  hits: number;
  /** Rounds represented (bullets in a burst). */
  rounds: number;
  /** Wire/radio guidance still active. */
  guided: boolean;
  alive: boolean;
  age: number;
  /** Altitude of the target when fired (anti-air rounds burst in the air). */
  air: boolean;
  /** Visual heading. */
  angle: number;
}

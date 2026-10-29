import { SIM_DT, TILE, type TeamId } from '../core/constants';
import { Rng } from '../core/rng';
import { unitDef } from '../data/units';
import type { Era, FactionId } from '../data/units/types';
import { Unit } from './entity';
import { EventBus } from './events';
import type { TileMap } from './map';
import { SpatialHash } from './spatial';

export interface TeamInfo {
  id: TeamId;
  faction: FactionId;
  name: string;
  tickets: number;
  ticketsMax: number;
  isHuman: boolean;
}

export interface Objective {
  id: string;
  name: string;
  x: number; y: number; // world metres
  radius: number; // metres
  owner: TeamId | null;
  /** Capture progress: -1 (team 1 owns) .. +1 (team 0 owns). */
  progress: number;
}

export interface Environment {
  /** 0 = full day, 1 = dusk/dawn, 2 = night */
  light: 0 | 1 | 2;
  dust: boolean;
  era: Era;
}

/** A system is a function run once per simulation step. */
export type System = (w: World, dt: number) => void;

/**
 * World = all simulation state: map, units, projectiles, teams, objectives.
 * Systems (in sim/systems) read and mutate it; they are run in order by `step`.
 */
export class World {
  readonly bus = new EventBus();
  readonly rng: Rng;
  units: Unit[] = [];
  byId = new Map<number, Unit>();
  projectiles: import('./projectiles').Projectile[] = [];
  spatial = new SpatialHash(64);
  time = 0;
  tick = 0;
  objectives: Objective[] = [];
  env: Environment = { light: 0, dust: false, era: 1980 };
  teams: [TeamInfo, TeamInfo];
  /** Supply depot positions per team (metres). */
  depots: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  systems: System[] = [];
  /** Tile fog of war for the human team (null = no fog, e.g. headless sims). */
  fog: (import('./systems/vision').FogGrid & { team: TeamId }) | null = null;
  over = false;
  winner: TeamId | null = null;
  /** Free-form per-match data for scenario scripts. */
  vars: Record<string, number | string | boolean> = {};
  private nextId = 1;

  constructor(readonly map: TileMap, teams: [TeamInfo, TeamInfo], seed = 1) {
    this.teams = teams;
    this.rng = new Rng(seed);
  }

  spawn(defId: string, team: TeamId, x: number, y: number, heading = 0): Unit {
    const def = unitDef(defId);
    const u = new Unit(this.nextId++, def, team, x, y, heading);
    this.units.push(u);
    this.byId.set(u.id, u);
    return u;
  }

  get(id: number): Unit | undefined { return this.byId.get(id); }
  /** Live unit lookup: undefined when dead/removed. */
  alive(id: number): Unit | undefined { const u = this.byId.get(id); return u && u.alive ? u : undefined; }

  /** Advance the simulation by one fixed step. */
  step(dt = SIM_DT) {
    if (this.over) return;
    this.time += dt;
    this.tick++;
    this.spatial.clear();
    for (const u of this.units) if (u.onMap) this.spatial.insert(u);
    for (const s of this.systems) s(this, dt);
    // Remove long-dead wrecks to keep the unit list small.
    if (this.tick % 90 === 0) this.cull();
  }

  private cull() {
    // Dead infantry vanish at once; vehicle wrecks linger (they are drawn as burnt-out hulks).
    if (!this.units.some((u) => !u.alive)) return;
    this.units = this.units.filter((u) => {
      if (u.alive || (u.wreck && this.time - u.wreckTime < 240)) return true;
      this.byId.delete(u.id);
      return false;
    });
  }

  tileOf(x: number, y: number): [number, number] { return [Math.floor(x / TILE), Math.floor(y / TILE)]; }
  teamUnits(team: TeamId) { return this.units.filter((u) => u.team === team && u.alive); }
  enemyOf(team: TeamId): TeamId { return team === 0 ? 1 : 0; }
  /** Units that exist on the map and are alive. */
  get active() { return this.units.filter((u) => u.alive && !u.carrier); }
}

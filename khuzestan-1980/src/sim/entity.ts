import type { Vec } from '../core/math';
import { SPRITE_SCALE, type TeamId } from '../core/constants';
import { AMMO } from '../data/ammo';
import { WEAPONS, type WeaponDef } from '../data/weapons';
import type { TargetClass, UnitDef, WeaponMount } from '../data/units/types';

/** Player/AI orders. The first entry of Unit.orders is the active one. */
export type Order =
  | { type: 'move'; x: number; y: number; attackMove?: boolean }
  | { type: 'attack'; targetId: number }
  | { type: 'board'; targetId: number }
  | { type: 'unload'; x: number; y: number }
  | { type: 'hold' };

export interface WeaponState {
  mount: WeaponMount;
  def: WeaponDef;
  ammo: Record<string, number>;
  ammoMax: Record<string, number>;
  cooldown: number;
  /** Aim angle (absolute) of free-mounted weapons; turret weapons use unit.turretAngle. */
  aim: number;
  targetId: number; // 0 = none
  /** Time at which the last volley fired (for muzzle flash / recoil). */
  lastFired: number;
}

export interface InfantryState {
  men: number;
  maxMen: number;
  hpPerMan: number;
  suppression: number; // 0..100
  morale: number; // 0..100
  state: 'ok' | 'pinned' | 'broken';
  /** Cached cover value of the tile the squad stands on (0..1). */
  cover: number;
}

export interface MobilityState {
  fuel: number; // seconds of full-throttle running left
  fuelMax: number;
  path: Vec[];
  pathI: number;
  repath: number; // cooldown timer
  stalled: number; // seconds of engine stall remaining
  bogged: number;
  immobilized: boolean; // permanent until repaired (track/engine/driver)
  immobilizedReason: string;
  stuckTimer: number;
  lastX: number;
  lastY: number;
  moving: boolean;
}

export interface DamageState {
  crew: boolean[]; // alive flags, parallel to def.crew
  engine: number; // 0..1
  gunDisabled: boolean;
  turretJammed: boolean;
  fire: number; // seconds left until burn-out (0 = no fire)
  /** Remaining time before the fire turns into a brew-up wreck. */
  lastHitTime: number;
  lastAttackerId: number;
}

export interface AirState {
  altitude: number; // current
  targetAlt: number;
  landed: boolean;
  /** Orbit centre / drone loiter. */
  orbitX: number;
  orbitY: number;
  rotorPhase: number;
  /** Seconds to stay on the ground after unloading. */
  landTimer: number;
}

export class Unit {
  readonly id: number;
  readonly def: UnitDef;
  team: TeamId;
  x: number; y: number;
  heading: number;
  turretAngle: number;
  /** Desired turret angle (absolute) set by combat/manual aim; null = auto (follow heading). */
  turretWant: number | null = null;
  speed = 0;
  hp: number; maxHp: number;
  alive = true;
  /** Wreck state: unit remains as a burnt-out hulk for a while. */
  wreck = false;
  wreckTime = 0;
  /** Recoil animation 0..1. */
  recoil = 0;

  mob: MobilityState;
  dmg: DamageState;
  weapons: WeaponState[] = [];
  orders: Order[] = [];
  /** 'fire' = fire at will and pursue, 'hold' = hold position and only shoot what is in range. */
  stance: 'fire' | 'hold' = 'fire';
  inf?: InfantryState;
  air?: AirState;

  /** Passengers inside this transport. */
  cargo: Unit[] = [];
  /** Transport this unit is currently inside (unit is then off the map). */
  carrier: Unit | null = null;

  /** Last simulation time this unit was seen by each team (index = team id). */
  seenAt: [number, number] = [-999, -999];
  /** Time of last shot fired (drives visibility: firing reveals position). */
  lastShotTime = -999;
  /** Current auto-engage target (primary turret/hull weapon). */
  targetId = 0;
  /** Hull heading the unit wants while stationary (face threats with frontal armour). */
  faceWant: number | null = null;
  /** True while an attack-move is paused because something is in range. */
  engaged = false;
  /** Last known position of the attack-order target. */
  lastKnown: { x: number; y: number } | null = null;
  /** Remaining crew bailed out / unit abandoned. */
  abandoned = false;
  /** Ticks guiding a wire/radio missile (must stay still). */
  guiding = 0;
  /** Name suffix to tell units apart in lists. */
  label = '';
  /** AI scratch data. */
  ai: Record<string, any> = {};
  /** Time spent cooking off fire etc. for effects. */
  smokeTimer = 0;

  constructor(id: number, def: UnitDef, team: TeamId, x: number, y: number, heading: number) {
    this.id = id; this.def = def; this.team = team;
    this.x = x; this.y = y; this.heading = heading; this.turretAngle = heading;
    const sq = def.squad;
    this.maxHp = sq ? sq.men * sq.hpPerMan : def.hp;
    this.hp = this.maxHp;
    this.mob = {
      fuel: def.mobility.fuel, fuelMax: def.mobility.fuel, path: [], pathI: 0, repath: 0, stalled: 0, bogged: 0,
      immobilized: false, immobilizedReason: '', stuckTimer: 0, lastX: x, lastY: y, moving: false,
    };
    this.dmg = { crew: def.crew.map(() => true), engine: 1, gunDisabled: false, turretJammed: false, fire: 0, lastHitTime: -999, lastAttackerId: 0 };
    if (sq) {
      this.inf = { men: sq.men, maxMen: sq.men, hpPerMan: sq.hpPerMan, suppression: 0, morale: sq.moraleBase, state: 'ok', cover: 0 };
    }
    if (def.air) {
      this.air = { altitude: def.air.altitude, targetAlt: def.air.altitude, landed: false, orbitX: x, orbitY: y, rotorPhase: (id * 1.7) % 6, landTimer: 0 };
    }
    for (const m of def.weapons) {
      const wd = WEAPONS[m.weapon];
      if (!wd) throw new Error(`Unit ${def.id}: unknown weapon ${m.weapon}`);
      for (const a of Object.keys(m.ammo)) if (!AMMO[a]) throw new Error(`Unit ${def.id}: unknown ammo ${a}`);
      this.weapons.push({ mount: m, def: wd, ammo: { ...m.ammo }, ammoMax: { ...m.ammo }, cooldown: 1 + ((id * 0.618034) % 1), aim: heading, targetId: 0, lastFired: -999 });
    }
  }

  get isAir() { return this.def.moveClass === 'air'; }
  get isInfantry() { return !!this.inf; }
  get isVehicle() { return !this.inf && !this.isAir; }
  get hpFrac() { return Math.max(0, this.hp / this.maxHp); }
  get crewAlive() { return this.dmg.crew.filter(Boolean).length; }
  /** Rough radius in metres for collision/selection. */
  get radius() {
    const s = this.def.sprite;
    if (this.inf) return 5;
    // Sprites are drawn SPRITE_SCALE larger than life; collision follows what the player sees.
    return Math.max(s.length, s.width) * 0.5 * SPRITE_SCALE + 0.5;
  }
  get targetClass(): TargetClass { return targetClassOf(this.def); }
  get altitude() { return this.air ? this.air.altitude : 0; }
  /** True while a helicopter is on the ground. */
  get landed() { return !!this.air && this.air.landed; }
  /** Units that exist on the map (not inside a transport, not dead). */
  get onMap() { return this.alive && !this.carrier; }
  get canMove() {
    return this.alive && !this.wreck && !this.mob.immobilized && this.mob.stalled <= 0 && this.mob.bogged <= 0
      && !(this.inf?.state === 'pinned') && (this.mob.fuelMax === 0 || this.mob.fuel > 0) && this.guiding <= 0;
  }
}

export function targetClassOf(def: UnitDef): TargetClass {
  if (def.category === 'infantry') return 'infantry';
  if (def.moveClass === 'air') return 'air';
  const a = def.armor?.hull;
  if (a && Math.max(a.f, a.s) >= 60) return 'armor';
  if (def.category === 'tank' || def.category === 'apc' || def.category === 'aa') return 'light';
  return 'soft';
}

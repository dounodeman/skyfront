import type { MoveClass } from '../terrain';

export type FactionId = 'iraq' | 'iran';
/** Era tiers selectable in the skirmish menu. Units list the earliest era they appear in. */
export type Era = 1980 | 1984 | 1986;

export type UnitCategory =
  | 'tank' | 'apc' | 'jeep' | 'heli' | 'infantry' | 'aa' | 'atgm' | 'drone';

/** Coarse class used by AI/targeting to pick ammunition and priorities. */
export type TargetClass = 'armor' | 'light' | 'soft' | 'infantry' | 'air';

export type CrewRole = 'commander' | 'gunner' | 'loader' | 'driver' | 'pilot' | 'copilot' | 'crew';

export interface ArmorProfile { f: number; s: number; r: number } // front / side / rear, mm effective

export interface WeaponMount {
  /** Key into WEAPONS. */
  weapon: string;
  /**
   * turret: rotates with the turret (shares its aim); hull: fixed to the body, fires inside `arc`;
   * free: independent pintle/door gun that tracks any target quickly.
   */
  mount: 'turret' | 'hull' | 'free';
  /** Half-angle (degrees) of the firing arc for hull mounts. */
  arc?: number;
  /** Rounds carried, per AMMO id. The first entry is the default ammunition. */
  ammo: Record<string, number>;
  /** Marks the unit's primary weapon (drives turret aim). First weapon is primary by default. */
  primary?: boolean;
}

export interface SpriteSpec {
  kind: 'tank' | 'apc' | 'wheeled' | 'heli' | 'infantry' | 'aa' | 'jeep' | 'drone' | 'gun';
  length: number; // hull length, metres
  width: number;
  turret?: {
    radius: number; // metres
    x: number; // offset along hull from centre (+ forward)
    gunLength: number;
    gunWidth: number;
    shape: 'round' | 'wide' | 'low' | 'box' | 'cupola';
    brake?: boolean; // muzzle brake / fume extractor
  };
  tracks?: boolean;
  wheels?: number; // per side
  rotor?: { radius: number; blades: number; tail: boolean; tandem?: boolean };
  extras?: Array<'skirts' | 'wings' | 'pods' | 'radar' | 'snorkel' | 'ir' | 'float' | 'mgRing' | 'stowage' | 'canopy' | 'launcher'>;
  /** Overrides the faction paint for this unit (CSS colours). */
  paint?: { base?: string; dark?: string };
}

export interface UnitDef {
  id: string;
  faction: FactionId;
  era: Era;
  name: string; // short in-game name
  category: UnitCategory;
  moveClass: MoveClass;
  role: string; // AI hint: assault, support, at, aa, transport, gunship, recon, scout
  cost: number;
  intel: { realName: string; role: string; note: string };

  hp: number; // hull integrity (vehicles) – infantry derive HP from squad
  armor?: { hull: ArmorProfile; turret?: ArmorProfile };
  /** Chance a penetrating/hit shot lands on the turret rather than hull. */
  turretShare?: number;
  /** 0..1 chance that an ammunition hit causes a catastrophic brew-up. */
  ammoVulnerability?: number;
  crew: CrewRole[];
  squad?: { men: number; hpPerMan: number; moraleBase: number; moraleResilience: number };

  mobility: {
    speed: number; // m/s on open ground
    turnRate: number; // deg/s hull turn
    accel: number; // m/s^2
    fuel: number; // seconds of full-throttle operation (0 = unlimited)
    reliability: number; // 0..1 – chance-of-breakdown scale
    bogRisk: number; // 0..1 – chance scale of bogging in marsh
    /** Can the unit fire while moving (stabilised gun)? 1 = no penalty. */
    moveFirePenalty: number;
  };
  turret?: { rate: number; arc?: number }; // deg/s; arc = half-angle limit (undefined = 360)
  weapons: WeaponMount[];

  vision: { range: number; night: number; signature: number };
  /** Altitude (m) for aircraft; rotor etc. */
  air?: { altitude: number; vtol: boolean; climb: number };
  /** Passenger capacity in squad slots. */
  transport?: { capacity: number };
  /** Squad slots this unit takes inside a transport (infantry = 1). */
  slots?: number;
  /** One-way attack drone: detonates on target. */
  kamikaze?: boolean;
  /** Spotting only: has no weapons. */
  spotter?: boolean;
  sprite: SpriteSpec;
  tags?: string[];
}

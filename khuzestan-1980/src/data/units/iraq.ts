import type { UnitDef } from './types';

/** Iraqi 1980 roster. Add a unit by adding an object here (and a registry entry is automatic). */
export const IRAQ_UNITS: UnitDef[] = [
  {
    id: 'iq_t55', faction: 'iraq', era: 1980, name: 'T-55', category: 'tank', moveClass: 'tracked', role: 'assault', cost: 100,
    intel: {
      realName: 'T-55A medium tank',
      role: 'Main battle tank – the backbone of Iraqi armour.',
      note: 'Rugged and plentiful with a 100mm gun, but its low-slung turret leaves it outmatched by Chieftains at range and prone to ammunition fires when penetrated.',
    },
    hp: 100,
    armor: { hull: { f: 190, s: 80, r: 45 }, turret: { f: 200, s: 150, r: 65 } },
    turretShare: 0.42, ammoVulnerability: 0.32,
    crew: ['commander', 'gunner', 'loader', 'driver'],
    mobility: { speed: 7.5, turnRate: 38, accel: 2.2, fuel: 900, reliability: 0.9, bogRisk: 0.35, moveFirePenalty: 0.3 },
    turret: { rate: 18 },
    weapons: [
      { weapon: 'd10t', mount: 'turret', primary: true, ammo: { ap100: 14, heat100: 6, he100: 18 } },
      { weapon: 'pkt', mount: 'turret', ammo: { ball762m: 1000 } },
    ],
    vision: { range: 1100, night: 0.5, signature: 1.0 },
    sprite: {
      kind: 'tank', length: 6.4, width: 3.3, tracks: true,
      turret: { radius: 1.35, x: -0.2, gunLength: 4.4, gunWidth: 0.26, shape: 'round', brake: false },
      extras: ['ir', 'stowage'],
    },
    tags: ['armor', 'mbt'],
  },
];

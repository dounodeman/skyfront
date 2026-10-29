import type { UnitDef } from './types';

/**
 * Later-era drone tier, gated by the skirmish "era" setting so 1980 matches stay historically clean.
 *  - 1984 tier: fixed-wing reconnaissance RPVs. Iran's Mohajer-1 entered service around 1985; the
 *    Iraqi counterpart is fictionalized.
 *  - 1986+ tier: a recon quadcopter and loitering one-way attack drones. These are an explicitly
 *    fictional / anachronistic "what-if" tech tier for gameplay, flagged as such on their intel cards.
 * Drones fly above terrain (they ignore line-of-sight blockers), are small and hard to spot,
 * and extend fog-of-war vision. Recon drones never fire; loitering munitions dive onto a target.
 */
const recon = (o: Partial<UnitDef> & Pick<UnitDef, 'id' | 'faction' | 'era' | 'name' | 'cost' | 'intel'>): UnitDef => ({
  category: 'drone', moveClass: 'air', role: 'recon', hp: 15, crew: [], spotter: true,
  armor: { hull: { f: 0, s: 0, r: 0 } },
  mobility: { speed: 32, turnRate: 40, accel: 6, fuel: 1500, reliability: 0.95, bogRisk: 0, moveFirePenalty: 1 },
  weapons: [],
  vision: { range: 1400, night: 0.2, signature: 0.45 },
  air: { altitude: 280, vtol: false, climb: 15 },
  sprite: { kind: 'drone', length: 3.6, width: 4.2, paint: { base: '#8e9188', dark: '#5f625c' } },
  tags: ['air', 'drone', 'recon'],
  ...o,
});

export const DRONE_UNITS: UnitDef[] = [
  // ---------------------------------------------------------------- 1984 tier: fixed-wing recon
  recon({
    id: 'ir_mohajer1', faction: 'iran', era: 1984, name: 'Mohajer-1 RPV', cost: 50,
    intel: {
      realName: 'Mohajer-1 reconnaissance drone (Qods)',
      role: 'Fixed-wing recon RPV: spots for artillery and extends vision.',
      note: 'One of the first Iranian drones, flown from about 1985 to photograph Iraqi positions; unarmed and launched from a rail. (Mid-war tech tier.)',
    },
  }),
  recon({
    id: 'iq_rpv', faction: 'iraq', era: 1984, name: 'Recon RPV', cost: 50,
    intel: {
      realName: '"Al-Rased" reconnaissance RPV (fictionalized)',
      role: 'Fixed-wing recon RPV: spots for the army and extends vision.',
      note: 'FICTIONALIZED – a stand-in for Iraq\'s mid-war interest in unmanned reconnaissance; no specific historical type is modelled.',
    },
  }),
  // ---------------------------------------------------------------- 1986+ tier: quadcopters and loitering munitions
  ...(['iraq', 'iran'] as const).map((f) => recon({
    id: f === 'iraq' ? 'iq_quad' : 'ir_quad', faction: f, era: 1986, name: 'Recon quadcopter', cost: 25,
    intel: {
      realName: 'Small recon quadcopter (fictional tech tier)',
      role: 'Short-range spotter that can hover over cover and look into groves and towns.',
      note: 'ANACHRONISTIC / FICTIONAL – no such platform existed during the war; included only as an optional what-if era for gameplay.',
    },
    hp: 6,
    mobility: { speed: 16, turnRate: 180, accel: 8, fuel: 700, reliability: 0.95, bogRisk: 0, moveFirePenalty: 1 },
    vision: { range: 750, night: 0.3, signature: 0.3 },
    air: { altitude: 90, vtol: true, climb: 10 },
    sprite: { kind: 'drone', length: 0.9, width: 0.9, rotor: { radius: 0.32, blades: 2, tail: false }, paint: { base: '#55584f', dark: '#33352f' } },
  })),
  {
    id: 'ir_loiter', faction: 'iran', era: 1986, name: 'Loitering munition', category: 'drone', moveClass: 'air', role: 'strike', cost: 70,
    intel: {
      realName: 'One-way attack drone, "Mohajer strike" variant (fictionalized)',
      role: 'Loiters over the battlefield, then dives onto a vehicle with a shaped-charge warhead.',
      note: 'FICTIONALIZED – Iran\'s wartime Mohajer drones were reconnaissance types; this armed variant is a what-if for the late-era tier.',
    },
    hp: 10, crew: [], kamikaze: true,
    armor: { hull: { f: 0, s: 0, r: 0 } },
    mobility: { speed: 42, turnRate: 60, accel: 8, fuel: 900, reliability: 0.95, bogRisk: 0, moveFirePenalty: 1 },
    weapons: [{ weapon: 'kamikaze', mount: 'hull', primary: true, ammo: { dronewarhead: 1 } }],
    vision: { range: 1000, night: 0.3, signature: 0.4 },
    air: { altitude: 180, vtol: false, climb: 25 },
    sprite: { kind: 'drone', length: 2.6, width: 2.4, paint: { base: '#7d7a62', dark: '#55523f' } },
    tags: ['air', 'drone', 'strike'],
  },
  {
    id: 'iq_loiter', faction: 'iraq', era: 1986, name: 'Loitering munition', category: 'drone', moveClass: 'air', role: 'strike', cost: 70,
    intel: {
      realName: '"Al-Saqr" one-way attack drone (fictionalized)',
      role: 'Loiters over the battlefield, then dives onto a vehicle with a shaped-charge warhead.',
      note: 'FICTIONALIZED – a fictional Iraqi counterpart for the optional late-era tier; not a historical weapon of the war.',
    },
    hp: 10, crew: [], kamikaze: true,
    armor: { hull: { f: 0, s: 0, r: 0 } },
    mobility: { speed: 42, turnRate: 60, accel: 8, fuel: 900, reliability: 0.95, bogRisk: 0, moveFirePenalty: 1 },
    weapons: [{ weapon: 'kamikaze', mount: 'hull', primary: true, ammo: { dronewarhead: 1 } }],
    vision: { range: 1000, night: 0.3, signature: 0.4 },
    air: { altitude: 180, vtol: false, climb: 25 },
    sprite: { kind: 'drone', length: 2.6, width: 2.4, paint: { base: '#9a9070', dark: '#6b6450' } },
    tags: ['air', 'drone', 'strike'],
  },
];

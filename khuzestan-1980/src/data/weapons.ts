/**
 * Weapon platforms (the gun/launcher itself). Which ammunition a unit carries, and how much,
 * is declared on the unit (see units/types.ts WeaponMount). Ranges are in game metres and are
 * tuned for play; relative balance follows real-world reach.
 */
export interface WeaponDef {
  id: string;
  name: string;
  range: number; // m
  minRange?: number; // m
  reload: number; // seconds between shots/volleys
  /** Rounds consumed and bullets simulated per volley (automatic weapons fire in volleys). */
  burst: number;
  /** Visual projectiles per volley (rockets use burst == pellets, MGs use 1). */
  pellets: number;
  spread: number; // degrees of dispersion
  accuracy: number; // base hit chance at reference conditions (0..1)
  targets: { ground: boolean; air: boolean };
  /** Wire/radio guided weapons need the shooter to stand still and keep sight of the target. */
  guidesStationary?: boolean;
  sound: string; // audio hook id (see audio/sound.ts)
}

const W = (w: Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'name' | 'range' | 'reload' | 'sound'>): WeaponDef => ({
  burst: 1, pellets: 1, spread: 0.5, accuracy: 0.75, targets: { ground: true, air: false }, ...w,
});
const AIR = { ground: true, air: true };
const AIR_ONLY = { ground: false, air: true };

export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries([
  // Tank guns
  W({ id: 'd10t', name: '100mm D-10T', range: 1000, reload: 5.5, accuracy: 0.8, spread: 0.45, sound: 'cannon' }),
  W({ id: 'u5ts', name: '115mm U-5TS', range: 1050, reload: 6, accuracy: 0.78, spread: 0.5, sound: 'cannon' }),
  W({ id: 'd81', name: '125mm 2A26', range: 1150, reload: 6.5, accuracy: 0.8, spread: 0.45, sound: 'cannon' }),
  W({ id: 'd56t', name: '76mm D-56T', range: 900, reload: 4.5, accuracy: 0.72, spread: 0.55, sound: 'cannon' }),
  W({ id: '2a28', name: '73mm 2A28 Grom', range: 700, reload: 5, accuracy: 0.62, spread: 0.8, sound: 'cannon' }),
  W({ id: 'l11', name: '120mm L11A5', range: 1100, reload: 8, accuracy: 0.9, spread: 0.35, sound: 'cannon' }),
  W({ id: 'm68', name: '105mm M68', range: 1050, reload: 5, accuracy: 0.85, spread: 0.4, sound: 'cannon' }),
  W({ id: 'm41', name: '90mm M41', range: 950, reload: 4.5, accuracy: 0.75, spread: 0.5, sound: 'cannon' }),
  W({ id: 'l23', name: '76mm L23A1', range: 800, reload: 3.5, accuracy: 0.75, spread: 0.5, sound: 'cannon' }),
  // Vehicle / pintle machine guns
  W({ id: 'pkt', name: '7.62mm PKT coax', range: 600, reload: 0.4, burst: 5, spread: 2.2, accuracy: 0.55, sound: 'mg' }),
  W({ id: 'dshk', name: '12.7mm DShK', range: 750, reload: 0.4, burst: 4, spread: 2, accuracy: 0.55, targets: AIR, sound: 'hmg' }),
  W({ id: 'kpvt', name: '14.5mm KPVT', range: 800, reload: 0.4, burst: 4, spread: 1.6, accuracy: 0.6, targets: AIR, sound: 'hmg' }),
  W({ id: 'm2', name: '12.7mm M2HB', range: 800, reload: 0.4, burst: 4, spread: 1.6, accuracy: 0.62, targets: AIR, sound: 'hmg' }),
  W({ id: 'l8a1', name: '7.62mm L8A1 coax', range: 600, reload: 0.4, burst: 5, spread: 2, accuracy: 0.58, sound: 'mg' }),
  W({ id: 'm73', name: '7.62mm M73 coax', range: 600, reload: 0.4, burst: 5, spread: 2.2, accuracy: 0.56, sound: 'mg' }),
  W({ id: 'mgdoor', name: '7.62mm door gun', range: 650, reload: 0.4, burst: 5, spread: 3, accuracy: 0.45, targets: AIR, sound: 'mg' }),
  // Missiles
  W({ id: 'sagger_l', name: '9M14 launcher', range: 1500, minRange: 150, reload: 12, accuracy: 0.75, guidesStationary: true, sound: 'missile' }),
  W({ id: 'tow_l', name: 'TOW launcher', range: 2000, minRange: 100, reload: 9, accuracy: 0.85, guidesStationary: true, sound: 'missile' }),
  W({ id: 'hot_l', name: 'HOT launcher', range: 2000, minRange: 150, reload: 8, accuracy: 0.85, guidesStationary: true, sound: 'missile' }),
  W({ id: 'swatter_l', name: 'Falanga launcher', range: 1800, minRange: 200, reload: 10, accuracy: 0.7, guidesStationary: true, sound: 'missile' }),
  W({ id: 'strela_l', name: 'Strela-2 launcher', range: 1500, minRange: 150, reload: 9, accuracy: 0.68, targets: AIR_ONLY, sound: 'missile' }),
  // Rockets and heli guns
  W({ id: 'ub32', name: 'UB-32 rocket pod', range: 1000, minRange: 200, reload: 2.2, burst: 6, pellets: 6, spread: 3.5, accuracy: 0.5, sound: 'rocket' }),
  W({ id: 'ub16', name: 'UB-16 rocket pod', range: 950, minRange: 200, reload: 2.5, burst: 4, pellets: 4, spread: 3.5, accuracy: 0.5, sound: 'rocket' }),
  W({ id: 'hydra_pod', name: '2.75in rocket pod', range: 1050, minRange: 200, reload: 2.2, burst: 6, pellets: 6, spread: 3, accuracy: 0.55, sound: 'rocket' }),
  W({ id: 'yakb', name: '12.7mm YaKB-12.7', range: 850, reload: 0.3, burst: 8, spread: 1.4, accuracy: 0.6, sound: 'hmg' }),
  W({ id: 'm197', name: '20mm M197', range: 950, reload: 0.25, burst: 10, spread: 1.6, accuracy: 0.6, sound: 'hmg' }),
  // Anti-aircraft guns
  W({ id: 'zu23', name: '23mm ZU-23-2', range: 1200, reload: 0.25, burst: 6, spread: 1.8, accuracy: 0.14, targets: AIR, sound: 'flak' }),
  W({ id: 'zsu234', name: '23mm AZP-23 Amur', range: 1300, reload: 0.2, burst: 10, spread: 1.4, accuracy: 0.16, targets: AIR, sound: 'flak' }),
  W({ id: 'gdf35', name: '35mm twin AA gun', range: 1450, reload: 0.4, burst: 5, spread: 1.2, accuracy: 0.2, targets: AIR, sound: 'flak' }),
  W({ id: 'vulcan', name: '20mm M168 Vulcan', range: 1100, reload: 0.2, burst: 12, spread: 1.8, accuracy: 0.14, targets: AIR, sound: 'flak' }),
  // Infantry weapons
  W({ id: 'ak47', name: '7.62mm AK-47', range: 360, reload: 0.5, burst: 6, spread: 4, accuracy: 0.43, targets: AIR, sound: 'rifle' }),
  W({ id: 'g3', name: '7.62mm G3', range: 380, reload: 0.5, burst: 5, spread: 3, accuracy: 0.47, targets: AIR, sound: 'rifle' }),
  W({ id: 'irr_rifles', name: '7.62mm rifles (volunteers)', range: 340, reload: 0.5, burst: 6, spread: 4.5, accuracy: 0.33, targets: AIR, sound: 'rifle' }),
  W({ id: 'akm_elite', name: '7.62mm AKM (trained)', range: 380, reload: 0.45, burst: 6, spread: 3.2, accuracy: 0.55, targets: AIR, sound: 'rifle' }),
  W({ id: 'militia', name: 'Mixed rifles', range: 320, reload: 0.55, burst: 6, spread: 5, accuracy: 0.28, targets: AIR, sound: 'rifle' }),
  W({ id: 'pkm', name: '7.62mm PKM', range: 700, reload: 0.35, burst: 6, spread: 2.5, accuracy: 0.5, targets: AIR, sound: 'mg' }),
  W({ id: 'mg3', name: '7.62mm MG3', range: 700, reload: 0.3, burst: 8, spread: 2.8, accuracy: 0.5, targets: AIR, sound: 'mg' }),
  W({ id: 'rpg7', name: 'RPG-7', range: 350, minRange: 30, reload: 6, accuracy: 0.6, sound: 'rocket' }),
  W({ id: 'm40', name: '106mm M40 recoilless', range: 800, minRange: 60, reload: 6.5, accuracy: 0.7, sound: 'cannon' }),
  // Drone tier
  W({ id: 'kamikaze', name: 'Loitering warhead', range: 40, reload: 1, accuracy: 0.8, sound: 'explosion' }),
].map((w) => [w.id, w]));

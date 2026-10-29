/**
 * Ammunition types. Penetration is millimetres of rolled homogeneous armour at the muzzle.
 * Kinetic rounds (AP/APDS) lose `penFalloff` (fraction) per km; chemical rounds (HEAT/ATGM) do not.
 * Edit numbers here to rebalance; nothing in the game logic hardcodes a weapon effect.
 */
export type AmmoKind = 'AP' | 'APDS' | 'HEAT' | 'HESH' | 'HE' | 'ATGM' | 'BULLET' | 'FLAK' | 'ROCKET' | 'SAM';

export interface AmmoDef {
  id: string;
  name: string;
  kind: AmmoKind;
  caliber: number; // mm (display)
  pen: number; // mm RHA at muzzle
  penFalloff: number; // fraction lost per km (kinetic only)
  damage: number; // hit points removed on a penetrating hit / direct hit on soft target
  blast: number; // splash radius in metres (0 = none)
  blastDamage: number; // splash damage at centre vs soft targets (infantry, buildings)
  supp: number; // suppression applied per round to infantry near the impact
  speed: number; // m/s
  /** Guided rounds follow their target while the shooter keeps guiding. */
  guided?: 'wire' | 'radio' | 'ir';
  canHitAir?: boolean;
  /** HESH ignores slope. */
  ignoresSlope?: boolean;
  tracer?: string; // CSS colour of the in-flight effect
}

const A = (a: Partial<AmmoDef> & Pick<AmmoDef, 'id' | 'name' | 'kind' | 'caliber' | 'speed'>): AmmoDef => ({
  pen: 0, penFalloff: 0, damage: 0, blast: 0, blastDamage: 0, supp: 0, ...a,
});

export const AMMO: Record<string, AmmoDef> = Object.fromEntries([
  // ---- Soviet / Iraqi tank guns ----
  A({ id: 'ap100', name: '100mm AP (BR-412)', kind: 'AP', caliber: 100, pen: 185, penFalloff: 0.22, damage: 55, speed: 895, supp: 10, tracer: '#ffd27a' }),
  A({ id: 'heat100', name: '100mm HEAT (BK-5)', kind: 'HEAT', caliber: 100, pen: 380, damage: 70, blast: 3, blastDamage: 30, speed: 900, supp: 12, tracer: '#ffd27a' }),
  A({ id: 'he100', name: '100mm HE-Frag (OF-412)', kind: 'HE', caliber: 100, pen: 30, damage: 14, blast: 14, blastDamage: 100, speed: 700, supp: 35, tracer: '#ffd27a' }),
  A({ id: 'apfsds115', name: '115mm APFSDS (BM-6)', kind: 'APDS', caliber: 115, pen: 280, penFalloff: 0.08, damage: 65, speed: 1600, supp: 12, tracer: '#ffe6a0' }),
  A({ id: 'heat115', name: '115mm HEAT (BK-4M)', kind: 'HEAT', caliber: 115, pen: 400, damage: 75, blast: 3, blastDamage: 32, speed: 950, supp: 12, tracer: '#ffd27a' }),
  A({ id: 'he115', name: '115mm HE-Frag (OF-18)', kind: 'HE', caliber: 115, pen: 35, damage: 16, blast: 16, blastDamage: 120, speed: 750, supp: 38, tracer: '#ffd27a' }),
  A({ id: 'apfsds125', name: '125mm APFSDS (BM-15)', kind: 'APDS', caliber: 125, pen: 330, penFalloff: 0.06, damage: 75, speed: 1700, supp: 14, tracer: '#ffe6a0' }),
  A({ id: 'heat125', name: '125mm HEAT (BK-14M)', kind: 'HEAT', caliber: 125, pen: 450, damage: 80, blast: 3, blastDamage: 35, speed: 905, supp: 14, tracer: '#ffd27a' }),
  A({ id: 'he125', name: '125mm HE-Frag (OF-19)', kind: 'HE', caliber: 125, pen: 40, damage: 18, blast: 18, blastDamage: 140, speed: 850, supp: 42, tracer: '#ffd27a' }),
  A({ id: 'ap76', name: '76mm AP (BR-354)', kind: 'AP', caliber: 76, pen: 110, penFalloff: 0.25, damage: 38, speed: 960, supp: 8, tracer: '#ffd27a' }),
  A({ id: 'heat76', name: '76mm HEAT (BK-354)', kind: 'HEAT', caliber: 76, pen: 200, damage: 50, blast: 2, blastDamage: 22, speed: 450, supp: 8, tracer: '#ffd27a' }),
  A({ id: 'he76', name: '76mm HE-Frag (OF-350)', kind: 'HE', caliber: 76, pen: 20, damage: 10, blast: 9, blastDamage: 70, speed: 680, supp: 28, tracer: '#ffd27a' }),
  A({ id: 'pg9', name: '73mm HEAT (PG-15V)', kind: 'HEAT', caliber: 73, pen: 280, damage: 52, blast: 2, blastDamage: 20, speed: 450, supp: 8, tracer: '#ffd27a' }),
  A({ id: 'og9', name: '73mm HE (OG-15V)', kind: 'HE', caliber: 73, pen: 15, damage: 8, blast: 8, blastDamage: 60, speed: 400, supp: 25, tracer: '#ffd27a' }),
  // ---- Western tank guns (Iran) ----
  A({ id: 'apds120', name: '120mm APDS (L15)', kind: 'APDS', caliber: 120, pen: 360, penFalloff: 0.12, damage: 75, speed: 1370, supp: 14, tracer: '#ffe6a0' }),
  A({ id: 'hesh120', name: '120mm HESH (L31)', kind: 'HESH', caliber: 120, pen: 170, damage: 52, blast: 8, blastDamage: 125, speed: 670, ignoresSlope: true, supp: 40, tracer: '#ffd27a' }),
  A({ id: 'apds105', name: '105mm APDS (M392)', kind: 'APDS', caliber: 105, pen: 280, penFalloff: 0.14, damage: 62, speed: 1500, supp: 12, tracer: '#ffe6a0' }),
  A({ id: 'heat105', name: '105mm HEAT (M456)', kind: 'HEAT', caliber: 105, pen: 380, damage: 72, blast: 3, blastDamage: 32, speed: 1170, supp: 12, tracer: '#ffd27a' }),
  A({ id: 'he105', name: '105mm HEP (M393)', kind: 'HE', caliber: 105, pen: 38, damage: 16, blast: 15, blastDamage: 110, speed: 730, supp: 36, tracer: '#ffd27a' }),
  A({ id: 'ap90', name: '90mm APC-T (M82)', kind: 'AP', caliber: 90, pen: 170, penFalloff: 0.2, damage: 50, speed: 1000, supp: 9, tracer: '#ffd27a' }),
  A({ id: 'heat90', name: '90mm HEAT (M431)', kind: 'HEAT', caliber: 90, pen: 250, damage: 60, blast: 2, blastDamage: 26, speed: 1000, supp: 9, tracer: '#ffd27a' }),
  A({ id: 'he90', name: '90mm HE (M71)', kind: 'HE', caliber: 90, pen: 25, damage: 12, blast: 11, blastDamage: 90, speed: 800, supp: 30, tracer: '#ffd27a' }),
  A({ id: 'hesh76', name: '76mm HESH (L23)', kind: 'HESH', caliber: 76, pen: 110, damage: 36, blast: 6, blastDamage: 85, speed: 530, ignoresSlope: true, supp: 28, tracer: '#ffd27a' }),
  A({ id: 'heat76s', name: '76mm HEAT (L23)', kind: 'HEAT', caliber: 76, pen: 190, damage: 46, blast: 2, blastDamage: 20, speed: 600, supp: 8, tracer: '#ffd27a' }),
  // ---- Missiles & rockets ----
  A({ id: 'sagger', name: '9M14 Malyutka (AT-3 Sagger)', kind: 'ATGM', caliber: 125, pen: 400, damage: 75, blast: 3, blastDamage: 25, speed: 120, guided: 'wire', supp: 15, tracer: '#fff1b8' }),
  A({ id: 'swatter', name: '9M17 Falanga (AT-2 Swatter)', kind: 'ATGM', caliber: 148, pen: 500, damage: 80, blast: 3, blastDamage: 30, speed: 150, guided: 'radio', supp: 15, tracer: '#fff1b8' }),
  A({ id: 'tow', name: 'BGM-71A TOW', kind: 'ATGM', caliber: 152, pen: 430, damage: 82, blast: 3, blastDamage: 30, speed: 200, guided: 'wire', supp: 15, tracer: '#fff1b8' }),
  A({ id: 'hot', name: 'HOT', kind: 'ATGM', caliber: 136, pen: 800, damage: 90, blast: 3, blastDamage: 30, speed: 250, guided: 'wire', supp: 15, tracer: '#fff1b8' }),
  A({ id: 'pg7', name: 'PG-7V HEAT rocket', kind: 'HEAT', caliber: 85, pen: 260, damage: 55, blast: 3, blastDamage: 35, speed: 140, supp: 18, tracer: '#e8e8e8' }),
  A({ id: 'm344', name: '106mm HEAT (M344)', kind: 'HEAT', caliber: 106, pen: 400, damage: 70, blast: 3, blastDamage: 32, speed: 500, supp: 18, tracer: '#ffd27a' }),
  A({ id: 's5', name: 'S-5 57mm rockets', kind: 'ROCKET', caliber: 57, pen: 110, damage: 14, blast: 8, blastDamage: 70, speed: 420, supp: 45, tracer: '#ffc27a' }),
  A({ id: 'hydra', name: '2.75in Hydra rockets', kind: 'ROCKET', caliber: 70, pen: 120, damage: 15, blast: 7, blastDamage: 62, speed: 480, supp: 42, tracer: '#ffc27a' }),
  A({ id: 'strela', name: '9M32 Strela-2 (SA-7)', kind: 'SAM', caliber: 72, pen: 30, damage: 70, blast: 4, blastDamage: 0, speed: 430, guided: 'ir', canHitAir: true, supp: 0, tracer: '#f2f2f2' }),
  // ---- Small arms & automatic cannon ----
  A({ id: 'ball762', name: '7.62mm ball', kind: 'BULLET', caliber: 7.62, pen: 7, penFalloff: 0.5, damage: 2.4, speed: 800, supp: 1.6, canHitAir: true, tracer: '#ffe9a8' }),
  A({ id: 'ball762m', name: '7.62mm belt', kind: 'BULLET', caliber: 7.62, pen: 8, penFalloff: 0.5, damage: 2.6, speed: 820, supp: 2.0, canHitAir: true, tracer: '#ffe9a8' }),
  A({ id: 'bullet127', name: '12.7mm', kind: 'BULLET', caliber: 12.7, pen: 22, penFalloff: 0.35, damage: 5.5, speed: 850, supp: 3.2, canHitAir: true, tracer: '#ffd48a' }),
  A({ id: 'bullet145', name: '14.5mm', kind: 'BULLET', caliber: 14.5, pen: 32, penFalloff: 0.3, damage: 8, speed: 990, supp: 4, canHitAir: true, tracer: '#ffd48a' }),
  A({ id: 'flak23', name: '23mm HEI-T', kind: 'FLAK', caliber: 23, pen: 28, penFalloff: 0.3, damage: 6, blast: 2.5, blastDamage: 8, speed: 970, supp: 5, canHitAir: true, tracer: '#ff9a6a' }),
  A({ id: 'hei20', name: '20mm HEI', kind: 'FLAK', caliber: 20, pen: 20, penFalloff: 0.3, damage: 7, blast: 2, blastDamage: 6, speed: 1050, supp: 4, canHitAir: true, tracer: '#ff9a6a' }),
  A({ id: 'hei35', name: '35mm HEI', kind: 'FLAK', caliber: 35, pen: 40, penFalloff: 0.3, damage: 14, blast: 3.5, blastDamage: 14, speed: 1175, supp: 6, canHitAir: true, tracer: '#ff9a6a' }),
  // ---- Later-era (drone tier) ----
  A({ id: 'dronewarhead', name: 'Loitering munition warhead', kind: 'HE', caliber: 0, pen: 140, damage: 60, blast: 10, blastDamage: 120, speed: 60, supp: 50, tracer: '#ffffff' }),
].map((a) => [a.id, a]));

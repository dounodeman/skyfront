import type { UnitDef } from './types';
import { infantry } from './helpers';

/**
 * Iraqi roster. Numbers are approximate real-world characteristics, tuned for play:
 * armour = effective mm, speed = m/s on open ground, ranges in game metres.
 * Add a unit by appending an object here – the registry, purchase screen, AI and sprites pick it up.
 */
export const IRAQ_UNITS: UnitDef[] = [
  // ------------------------------------------------------------------ tanks
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
      turret: { radius: 1.35, x: -0.2, gunLength: 4.4, gunWidth: 0.26, shape: 'round' },
      extras: ['ir', 'stowage'],
    },
    tags: ['armor', 'mbt'],
  },
  {
    id: 'iq_t62', faction: 'iraq', era: 1980, name: 'T-62', category: 'tank', moveClass: 'tracked', role: 'assault', cost: 130,
    intel: {
      realName: 'T-62 main battle tank',
      role: 'Main battle tank with the first smoothbore tank gun in service.',
      note: 'Its 115mm fin-stabilised rounds hit hard and flat, but the cramped turret and slow manual reloading after each ejected case limited its rate of fire.',
    },
    hp: 105,
    armor: { hull: { f: 200, s: 80, r: 45 }, turret: { f: 240, s: 160, r: 70 } },
    turretShare: 0.42, ammoVulnerability: 0.35,
    crew: ['commander', 'gunner', 'loader', 'driver'],
    mobility: { speed: 7.5, turnRate: 36, accel: 2.1, fuel: 850, reliability: 0.88, bogRisk: 0.38, moveFirePenalty: 0.35 },
    turret: { rate: 16 },
    weapons: [
      { weapon: 'u5ts', mount: 'turret', primary: true, ammo: { apfsds115: 12, heat115: 8, he115: 16 } },
      { weapon: 'pkt', mount: 'turret', ammo: { ball762m: 1000 } },
      { weapon: 'dshk', mount: 'free', ammo: { bullet127: 300 } },
    ],
    vision: { range: 1100, night: 0.5, signature: 1.0 },
    sprite: {
      kind: 'tank', length: 6.6, width: 3.3, tracks: true,
      turret: { radius: 1.45, x: -0.1, gunLength: 5.2, gunWidth: 0.25, shape: 'round' },
      extras: ['ir'],
    },
    tags: ['armor', 'mbt'],
  },
  {
    id: 'iq_t72', faction: 'iraq', era: 1980, name: 'T-72', category: 'tank', moveClass: 'tracked', role: 'assault', cost: 190,
    intel: {
      realName: 'T-72 (export) main battle tank',
      role: 'Premium MBT – Iraq had only small numbers in 1980.',
      note: 'A 125mm autoloader and laminated glacis made it the best tank on the Iraqi side, but its carousel of rounds under the turret made catastrophic hits likely once it was penetrated.',
    },
    hp: 115,
    armor: { hull: { f: 305, s: 80, r: 50 }, turret: { f: 370, s: 200, r: 80 } },
    turretShare: 0.4, ammoVulnerability: 0.5,
    crew: ['commander', 'gunner', 'driver'],
    mobility: { speed: 8.2, turnRate: 40, accel: 2.4, fuel: 900, reliability: 0.88, bogRisk: 0.4, moveFirePenalty: 0.45 },
    turret: { rate: 22 },
    weapons: [
      { weapon: 'd81', mount: 'turret', primary: true, ammo: { apfsds125: 12, heat125: 8, he125: 18 } },
      { weapon: 'pkt', mount: 'turret', ammo: { ball762m: 1250 } },
    ],
    vision: { range: 1150, night: 0.55, signature: 1.0 },
    sprite: {
      kind: 'tank', length: 6.9, width: 3.6, tracks: true,
      turret: { radius: 1.45, x: -0.1, gunLength: 5.6, gunWidth: 0.26, shape: 'low' },
      extras: ['skirts', 'ir'],
    },
    tags: ['armor', 'mbt'],
  },
  {
    id: 'iq_pt76', faction: 'iraq', era: 1980, name: 'PT-76', category: 'tank', moveClass: 'amphibious', role: 'scout', cost: 70,
    intel: {
      realName: 'PT-76 amphibious light tank',
      role: 'Reconnaissance and river-crossing light tank.',
      note: 'Swims canals and marsh with water jets, which mattered in the Khuzestan wetlands – but its thin armour stops little more than heavy machine-gun fire.',
    },
    hp: 70,
    armor: { hull: { f: 14, s: 14, r: 7 }, turret: { f: 17, s: 16, r: 10 } },
    turretShare: 0.35, ammoVulnerability: 0.25,
    crew: ['commander', 'loader', 'driver'],
    mobility: { speed: 8.5, turnRate: 45, accel: 2.6, fuel: 900, reliability: 0.9, bogRisk: 0, moveFirePenalty: 0.3 },
    turret: { rate: 20 },
    weapons: [
      { weapon: 'd56t', mount: 'turret', primary: true, ammo: { ap76: 10, heat76: 6, he76: 24 } },
      { weapon: 'pkt', mount: 'turret', ammo: { ball762m: 1000 } },
    ],
    vision: { range: 1150, night: 0.4, signature: 0.9 },
    sprite: {
      kind: 'tank', length: 6.9, width: 3.15, tracks: true,
      turret: { radius: 1.2, x: 0.6, gunLength: 4.4, gunWidth: 0.2, shape: 'round' },
      extras: ['float'],
    },
    tags: ['light', 'amphibious'],
  },
  // ------------------------------------------------------------------ APC / IFV
  {
    id: 'iq_bmp1', faction: 'iraq', era: 1980, name: 'BMP-1', category: 'apc', moveClass: 'amphibious', role: 'ifv', cost: 90,
    intel: {
      realName: 'BMP-1 infantry fighting vehicle',
      role: 'IFV: carries a rifle squad, fights with a 73mm gun and Malyutka missile.',
      note: 'Revolutionary when it appeared – troops could fight from inside – yet its thin hull and fuel stored in the rear doors made it a fragile ride under fire.',
    },
    hp: 80,
    armor: { hull: { f: 33, s: 18, r: 16 }, turret: { f: 23, s: 18, r: 18 } },
    turretShare: 0.25, ammoVulnerability: 0.25,
    crew: ['commander', 'gunner', 'driver'],
    mobility: { speed: 8.5, turnRate: 50, accel: 2.8, fuel: 850, reliability: 0.88, bogRisk: 0.05, moveFirePenalty: 0.3 },
    turret: { rate: 30 },
    weapons: [
      { weapon: '2a28', mount: 'turret', primary: true, ammo: { pg9: 20, og9: 20 } },
      { weapon: 'pkt', mount: 'turret', ammo: { ball762m: 2000 } },
      { weapon: 'sagger_l', mount: 'turret', ammo: { sagger: 4 } },
    ],
    vision: { range: 1000, night: 0.4, signature: 0.85 },
    transport: { capacity: 1 },
    sprite: {
      kind: 'apc', length: 6.7, width: 2.94, tracks: true,
      turret: { radius: 0.95, x: 0.3, gunLength: 2.2, gunWidth: 0.18, shape: 'cupola' },
      extras: ['float'],
    },
    tags: ['light', 'transport', 'amphibious'],
  },
  {
    id: 'iq_btr60', faction: 'iraq', era: 1980, name: 'BTR-60PB', category: 'apc', moveClass: 'amphibious', role: 'apc', cost: 55,
    intel: {
      realName: 'BTR-60PB armoured personnel carrier',
      role: 'Wheeled 8x8 APC with a 14.5mm machine-gun turret.',
      note: 'Fast on roads and able to swim, but the twin petrol engines and side hatches made dismounting under fire slow and dangerous.',
    },
    hp: 60,
    armor: { hull: { f: 10, s: 7, r: 7 } },
    ammoVulnerability: 0.15,
    crew: ['gunner', 'driver'],
    mobility: { speed: 10, turnRate: 40, accel: 2.6, fuel: 950, reliability: 0.85, bogRisk: 0.05, moveFirePenalty: 0.4 },
    turret: { rate: 40 },
    weapons: [
      { weapon: 'kpvt', mount: 'turret', primary: true, ammo: { bullet145: 500 } },
      { weapon: 'pkt', mount: 'turret', ammo: { ball762m: 2000 } },
    ],
    vision: { range: 950, night: 0.25, signature: 0.85 },
    transport: { capacity: 1 },
    sprite: {
      kind: 'wheeled', length: 7.56, width: 2.83, wheels: 4,
      turret: { radius: 0.75, x: 0.8, gunLength: 1.9, gunWidth: 0.16, shape: 'cupola' },
    },
    tags: ['light', 'transport', 'amphibious'],
  },
  {
    id: 'iq_btr50', faction: 'iraq', era: 1980, name: 'BTR-50', category: 'apc', moveClass: 'amphibious', role: 'apc', cost: 50,
    intel: {
      realName: 'BTR-50PK tracked APC',
      role: 'Tracked amphibious carrier built on the PT-76 chassis.',
      note: 'Roomy enough for two squads and at home in the marshes, though by 1980 it was an ageing design with only a pintle machine gun.',
    },
    hp: 65,
    armor: { hull: { f: 11, s: 14, r: 7 } },
    ammoVulnerability: 0.1,
    crew: ['commander', 'driver'],
    mobility: { speed: 7.5, turnRate: 42, accel: 2.2, fuel: 900, reliability: 0.88, bogRisk: 0, moveFirePenalty: 0.4 },
    weapons: [{ weapon: 'pkt', mount: 'free', primary: true, ammo: { ball762m: 1500 } }],
    vision: { range: 900, night: 0.2, signature: 0.9 },
    transport: { capacity: 2 },
    sprite: { kind: 'apc', length: 7.08, width: 3.14, tracks: true, extras: ['float'] },
    tags: ['light', 'transport', 'amphibious'],
  },
  // ------------------------------------------------------------------ air defence
  {
    id: 'iq_zsu234', faction: 'iraq', era: 1980, name: 'ZSU-23-4', category: 'aa', moveClass: 'tracked', role: 'aa', cost: 110,
    intel: {
      realName: 'ZSU-23-4 "Shilka" self-propelled AA gun',
      role: 'Radar-directed anti-aircraft gun – deadly to helicopters.',
      note: 'Four water-cooled 23mm cannon slaved to a Gun Dish radar; it kept firing at night and in dust, and its fire was just as feared by infantry.',
    },
    hp: 65,
    armor: { hull: { f: 15, s: 9, r: 9 }, turret: { f: 9, s: 8, r: 8 } },
    turretShare: 0.4, ammoVulnerability: 0.3,
    crew: ['commander', 'gunner', 'loader', 'driver'],
    mobility: { speed: 7.5, turnRate: 40, accel: 2.2, fuel: 800, reliability: 0.85, bogRisk: 0.1, moveFirePenalty: 0.7 },
    turret: { rate: 70 },
    weapons: [{ weapon: 'zsu234', mount: 'turret', primary: true, ammo: { flak23: 2000 } }],
    vision: { range: 1300, night: 0.85, signature: 0.95 },
    sprite: {
      kind: 'aa', length: 6.5, width: 3.1, tracks: true,
      turret: { radius: 1.25, x: 0, gunLength: 2.6, gunWidth: 0.12, shape: 'box' },
      extras: ['radar'],
    },
    tags: ['aa', 'radar'],
  },
  {
    id: 'iq_zu23', faction: 'iraq', era: 1980, name: 'ZU-23-2', category: 'aa', moveClass: 'foot', role: 'aa', cost: 40,
    intel: {
      realName: 'ZU-23-2 towed twin 23mm AA gun',
      role: 'Towed light AA gun, manhandled into position by its crew.',
      note: 'Cheap and everywhere on both sides of the war – optically aimed, so effective only in daylight, and often turned against ground targets.',
    },
    hp: 30,
    armor: { hull: { f: 6, s: 0, r: 0 } },
    crew: ['gunner', 'loader', 'commander'],
    mobility: { speed: 1.6, turnRate: 40, accel: 1, fuel: 0, reliability: 1, bogRisk: 0, moveFirePenalty: 0 },
    weapons: [{ weapon: 'zu23', mount: 'free', primary: true, ammo: { flak23: 1000 } }],
    vision: { range: 1100, night: 0.15, signature: 0.6 },
    sprite: { kind: 'gun', length: 4.6, width: 1.8, turret: { radius: 0.5, x: 0, gunLength: 2.4, gunWidth: 0.1, shape: 'box' } },
    tags: ['aa', 'towed'],
  },
  // ------------------------------------------------------------------ infantry
  infantry({
    id: 'iq_rifle', faction: 'iraq', era: 1980, name: 'Rifle squad', role: 'rifle', cost: 25,
    intel: { realName: 'Iraqi Army rifle squad (AK-47)', role: 'Regular infantry: holds ground, clears buildings and palm groves.', note: 'Conscript-heavy regular army infantry; steady in prepared positions, less so when caught in the open by armour.' },
    squad: { men: 9, hpPerMan: 10, moraleBase: 62, moraleResilience: 0.5 },
    weapons: [{ weapon: 'ak47', mount: 'free', primary: true, ammo: { ball762: 3000 } }],
  }),
  infantry({
    id: 'iq_rpg', faction: 'iraq', era: 1980, name: 'RPG-7 team', role: 'at', cost: 40,
    intel: { realName: 'RPG-7 anti-tank team', role: 'Short-range anti-armour team.', note: 'The RPG-7\'s 85mm HEAT rocket could defeat the side armour of any tank in the theatre – if the team survived to get within 300 metres.' },
    squad: { men: 4, hpPerMan: 10, moraleBase: 62, moraleResilience: 0.55 },
    weapons: [
      { weapon: 'rpg7', mount: 'free', primary: true, ammo: { pg7: 10 } },
      { weapon: 'ak47', mount: 'free', ammo: { ball762: 800 } },
    ],
  }),
  infantry({
    id: 'iq_pkm', faction: 'iraq', era: 1980, name: 'PKM team', role: 'mg', cost: 30,
    intel: { realName: 'PKM machine-gun team', role: 'Suppressive fire against infantry.', note: 'A light, belt-fed general-purpose machine gun; pins enemy infantry so riflemen and tanks can manoeuvre.' },
    squad: { men: 3, hpPerMan: 10, moraleBase: 62, moraleResilience: 0.55 },
    weapons: [{ weapon: 'pkm', mount: 'free', primary: true, ammo: { ball762m: 2500 } }],
    vision: { range: 700 },
  }),
  infantry({
    id: 'iq_rg', faction: 'iraq', era: 1980, name: 'Republican Guard', role: 'elite', cost: 55,
    intel: { realName: 'Republican Guard infantry squad', role: 'Elite assault infantry with organic RPG.', note: 'In 1980 the Guard was still a small, politically trusted formation; better trained, equipped and motivated than regular conscripts.' },
    squad: { men: 8, hpPerMan: 12, moraleBase: 85, moraleResilience: 0.85 },
    weapons: [
      { weapon: 'akm_elite', mount: 'free', primary: true, ammo: { ball762: 3000 } },
      { weapon: 'rpg7', mount: 'free', ammo: { pg7: 3 } },
    ],
    mobility: { speed: 3.4 },
  }),
  infantry({
    id: 'iq_sa7', faction: 'iraq', era: 1980, name: 'SA-7 team', role: 'aa', cost: 45,
    intel: { realName: 'Strela-2 (SA-7 "Grail") MANPADS team', role: 'Shoulder-fired heat-seeking SAM against helicopters.', note: 'A first-generation tail-chasing seeker: unreliable against fast jets but a real threat to low, slow helicopters.' },
    squad: { men: 3, hpPerMan: 10, moraleBase: 62, moraleResilience: 0.55 },
    weapons: [
      { weapon: 'strela_l', mount: 'free', primary: true, ammo: { strela: 4 } },
      { weapon: 'ak47', mount: 'free', ammo: { ball762: 600 } },
    ],
    vision: { range: 900 },
  }),
];

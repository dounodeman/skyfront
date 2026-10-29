# Khuzestan 1980 – combined-arms tactics

A top-down 2D real-time tactics game set in September 1980, at the opening of the Iran–Iraq War on the
Khuzestan front: flat desert, marsh, date-palm groves, irrigation canals and small towns. Play **Iraq** or
**Iran** in a skirmish against the AI, or in the scripted **Border Crossing** scenario.

The tone is a sober, grounded "sim-lite". There is no gore: destroyed vehicles become smoking wrecks and
squads shrink as they take casualties. The war killed hundreds of thousands of people on both sides; the
game depicts its equipment and tactics without glorifying it.

TypeScript + Vite + HTML5 Canvas 2D. There are no art assets: every unit is a procedural vector sprite
(hulls, independently rotating turrets, rotor blur, ground shadows), the terrain is painted
procedurally, and all sound is synthesised with WebAudio.

```bash
cd khuzestan-1980
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

## Controls

| Action | Input |
|---|---|
| Select | Left-click · drag a box · Shift+click to add/remove · double-click selects all of that type on screen |
| Move / attack / board | Right-click ground / enemy / own transport (with infantry selected) |
| Queue waypoints | Shift+right-click |
| Attack-move | **Q**, then left-click (advance and engage anything met on the way) |
| Stop / hold position | **X** / **H** |
| Formation | **F** cycles none → line → column → wedge → box (used by the next move order) |
| Dismount / unload at point | **E** (unload here) / **U**, then left-click (APCs drive there, helicopters land there) |
| Point turrets at the cursor | hold **C** |
| Control groups | **Ctrl+1–9** to set, **1–9** to recall, press twice to centre the camera |
| Camera | **WASD** / arrow keys / screen edge to pan, mouse wheel to zoom, **Space** centres on the selection |
| Minimap | left-click / drag pans, right-click orders the selection |
| Game speed | **[** / **]** (0.25× – 8×) |
| Pause menu / mute | **Esc** or **P** / **M** |

Hover any unit, or any row on the purchase screen, to see its **intel card**: its real name, role, key
numbers and a one-line historical note. All cards are also collected under *Intel cards* in the main menu.

## What is simulated

- **Vehicles.** Hulls and turrets rotate separately, and turrets traverse at their real relative speeds.
  Armour has front/side/rear values for both hull and turret, and slope matters. Kinetic rounds lose
  penetration with range; HEAT and ATGMs don't; HESH ignores slope and spalls. Ammunition types are
  chosen per target: AP/APDS against armour, HEAT, HE against soft targets.
  Penetrating hits can kill crew members, damage the engine, disable the gun, jam the turret, start
  fires, detonate the ammunition (a brew-up) or make the crew bail out. Vehicles carry limited fuel
  and ammunition. Unreliable engines stall or fail (the Chieftain's notorious L60), and heavy tanks
  can bog down in marsh.
- **Infantry squads.**
  - *Cover:* buildings 62 %, trenches 75 %, palm groves 38 %, rubble and dunes less.
  - *Suppression:* a squad under fire goes to ground and is pinned.
  - *Morale:* casualties and suppression drain it; a squad that breaks retreats and later rallies.
  - *AT teams* kill armour at short range but are exposed in the open.
  - Squads mount and dismount APCs and helicopters, and APCs on attack-move drop their squads on contact.
- **Helicopters.** They fly above terrain, show altitude through their shadow, attack from stand-off
  range while hovering, and are vulnerable to MANPADS (rear-aspect heat-seekers) and AA guns.
  Transports land at a landing zone, unload, and lift off again.
- **Fog of war and spotting.**
  - *Line of sight* is blocked by buildings, palm groves, dunes and reeds. Aircraft see over everything.
  - *Spotting range* depends on the observer's sight and the target's signature. Moving, firing and
    flying raise a signature; cover and being dug in lower it.
  - *Night and dust storms* shrink sight, scaled by each unit's night-sight rating; the Shilka's radar
    still works in dust.
- **Terrain.**
  - Sand and dunes are open ground; roads are fast.
  - Marsh slows wheeled vehicles badly and can bog tanks.
  - Canals are impassable except to amphibious units (PT-76, BMP-1, BTR-50/60, M113), so bridges are chokepoints.
  - Buildings can be destroyed by HE and HESH and become rubble.
- **Supply.** Units near their own depot rearm, refuel, repair, and get replacement crews and men.
- **Match rules.** Capture objectives by being the only side inside their radius. Every objective you
  hold drains the enemy's tickets, and every unit lost costs tickets in proportion to its price. The
  match ends when a side's tickets reach zero or it has no fighting units left.

### Enemy AI

The AI uses the same order API as the player. Each AI team:

- picks objectives to take, or defends threatened ones, and sends armour, mechanised and infantry
  groups forward with attack-move;
- pulls damaged, empty or low-fuel vehicles back to the depot and sends them in again once repaired;
- concentrates its tanks' fire on the most dangerous weakened target;
- moves infantry into nearby buildings, groves or trenches when the enemy is close;
- calls gunships onto spotted armour, avoiding targets covered by known AA, and sends them home to rearm;
- lifts infantry to landing zones with transport helicopters;
- keeps AA vehicles behind its armour.

Difficulty sets how often it thinks, whether it focus-fires and uses helicopters, and a points bonus.

## Game modes

1. **Skirmish vs AI** on the handcrafted *Khuzestan Plain* map: an irrigation canal with three bridges,
   marsh, palm groves, a village and a town. Before deploying, choose your side, era, points budget
   (1000–4000), time of day (day/dusk/night), weather (clear/dust storm) and AI difficulty. Then buy
   your force on the points-based purchase screen, or start from an auto-fill preset.
2. **Scenario: The Border Crossing** (22 September 1980). Play the Iraqi assault or the Iranian delaying
   defence. The attacker must hold the bridge, the canal trench line and the town together for 30 s
   within 20 minutes. Scripted events add sunrise, a Hind at 03:00, T-62 reinforcements, Iranian
   Cobras, a Republican Guard airlift and volunteers from Ahvaz.

### Era system and drone tier

The era setting (1980 / 1984 / 1986+) filters the roster by each unit's `era` field, so 1980 matches stay
historically clean.

- **1984 tier:** fixed-wing reconnaissance RPVs. Iran's Mohajer-1 entered service around 1985; Iraq gets
  a fictionalized counterpart.
- **1986+ tier:** a recon quadcopter and loitering one-way attack drones. These are explicitly
  **fictional, anachronistic what-if** units, and their intel cards say so.

Recon drones never fire and extend your fog-of-war vision. Loitering munitions orbit until you order an
attack, then dive onto the target with a top-attack warhead.

## Adding a unit (data only)

Everything about a unit lives in `src/data/units/*.ts`. Weapons are in `src/data/weapons.ts`, ammunition
in `src/data/ammo.ts` and terrain in `src/data/terrain.ts`. The registry
(`src/data/units/index.ts`) collects every faction file, so the purchase screen, AI, sprites, intel
cards and balance table all pick a new unit up automatically.

Example: an Iraqi BRDM-2 scout car. Append this to `IRAQ_UNITS` in `src/data/units/iraq.ts`:

```ts
{
  id: 'iq_brdm2', faction: 'iraq', era: 1980, name: 'BRDM-2', category: 'apc', moveClass: 'amphibious', role: 'scout', cost: 45,
  intel: {
    realName: 'BRDM-2 amphibious scout car',
    role: 'Wheeled reconnaissance vehicle with a 14.5mm turret.',
    note: 'Fast, amphibious and quiet – used to probe ahead of armoured columns.',
  },
  hp: 45,
  armor: { hull: { f: 10, s: 7, r: 7 } },        // effective mm front / side / rear (optional turret profile)
  crew: ['commander', 'gunner', 'driver'],          // roles drive crew-casualty effects
  mobility: { speed: 11, turnRate: 55, accel: 3, fuel: 900, reliability: 0.9, bogRisk: 0, moveFirePenalty: 0.4 },
  turret: { rate: 40 },                            // deg/s; add `arc` for limited traverse
  weapons: [
    { weapon: 'kpvt', mount: 'turret', primary: true, ammo: { bullet145: 500 } },
    { weapon: 'pkt', mount: 'turret', ammo: { ball762m: 1250 } },
  ],
  vision: { range: 1150, night: 0.3, signature: 0.7 },
  sprite: { kind: 'wheeled', length: 5.75, width: 2.35, wheels: 2,
            turret: { radius: 0.7, x: 0.3, gunLength: 1.6, gunWidth: 0.14, shape: 'cupola' } },
  tags: ['light', 'amphibious'],
},
```

Notes:

- **New weapon or round:** add it to `WEAPONS` / `AMMO`. Penetration is mm RHA at the muzzle, `penFalloff`
  is the fraction lost per km, and damage is in hit points.
- **Infantry:** use the `infantry({...})` helper in `src/data/units/helpers.ts` and give a `squad` block
  (men, HP per man, morale).
- **Aircraft:** use `moveClass: 'air'` with an `air: { altitude, vtol, climb }` block and a sprite with `rotor`.
- **Transports:** add `transport: { capacity }`, counted in squad slots.
- **Sprites:** drawn from `sprite` – `kind` (tank / apc / wheeled / jeep / aa / gun / heli / drone /
  infantry), dimensions in metres, turret, wheels or tracks, rotor, `extras`, and an optional `paint`
  override.
- **New faction:** create a file like `iraq.ts`, add its id to `FactionId` in
  `src/data/units/types.ts`, and list the file in `src/data/units/index.ts`.
- **New era:** add the value to `Era` and to the era buttons in `src/ui/menus.ts`.
- **AI composition and unit caps:** `src/data/aiPresets.ts`.
- **Maps** are declarative paint operations (`src/data/maps/`). **Scenarios** are data too: placements,
  triggers and victory rules in `src/data/scenarios/`.

After editing unit data, run `npm run balance` to regenerate the table below. Balance tools:

```bash
npm run sim -- iq_t55 3 ir_chieftain 2 1000 150 12   # A, count, B, count, range m, seconds, runs
npm run aimatch -- 1500 25 3                           # AI vs AI skirmish: budget, minutes, seed
npx tsx tools/scenario-match.ts 1                      # AI vs AI Border Crossing: seed
```

## Architecture

```
src/
  core/      fixed-timestep loop (30 Hz sim, render every frame), camera, maths, seeded RNG
  data/      ALL game data: terrain, ammo, weapons, units/*, AI presets, maps, scenarios
  sim/       the simulation (no DOM): World, Unit entity with component-like state
             (mobility, damage, weapons, infantry, air, cargo), event bus, map + pathfinding (A*),
             commands API, AI, match setup, scenario runner
    systems/ run in order every step: vision → orders → transport → movement → air → infantry →
             combat → turrets → projectiles → fires → supply → objectives (+ AI, scenario script)
  render/    canvas renderer: cached procedural terrain, procedural sprites, effects/particles, fog
  ui/        input/selection/control groups, HUD (selection panel, command card, intel cards), minimap, menus
  audio/     WebAudio synthesised sounds driven by simulation events
tools/       headless runners (balance duels, AI matches, scenario) and the README balance-table generator
```

The simulation is deterministic for a given seed and runs headless in Node, so the balance tools exercise
exactly the code the game runs. Rendering, audio and UI only *read* the World and listen to its events.

## Unit balance table

Generated from the data files by `npm run balance`. Armour values are effective hull figures; speed is
cross-country in the data's units (the game scales all ground speeds by 1.3 for pacing). Ranges are
tuned for play while keeping real relative reach: ATGMs outrange tank guns, which outrange RPGs.

<!-- BALANCE:START -->
| Unit | Side | Era | Type | Cost | HP / men | Armour F/S/R (mm) | Main weapon | Range (m) | Best pen (mm) | Speed (km/h) | Sight (m) | Night | Reliability |
|---|---|---|---|---:|---:|---|---|---:|---:|---:|---:|---:|---:|
| Oerlikon 35mm | Iran | 1980 | aa | 45 | 35 | 6/0/0 | 35mm twin AA gun | 1450 | – | 5 | 1200 | 20% | 100% |
| M113 | Iran | 1980 | apc | 55 | 60 | 22/18/15 | 12.7mm M2HB | 800 | – | 29 | 950 | 20% | 93% |
| TOW jeep | Iran | 1980 | atgm | 70 | 25 | 0/0/0 | TOW launcher | 2000 | 430 | 40 | 1300 | 20% | 92% |
| AH-1J Cobra | Iran | 1980 | heli | 250 | 70 | 8/7/5 | TOW launcher | 2000 | 430 | 180 | 1500 | 35% | 93% |
| CH-47 Chinook | Iran | 1980 | heli | 180 | 110 | 6/5/4 | 7.62mm door gun | 650 | – | 162 | 1400 | 20% | 92% |
| Bell 214 | Iran | 1980 | heli | 110 | 70 | 5/4/3 | 7.62mm door gun | 650 | – | 162 | 1400 | 20% | 92% |
| AB-205 | Iran | 1980 | heli | 90 | 60 | 5/4/3 | 7.62mm door gun | 650 | – | 151 | 1400 | 20% | 93% |
| 106mm RR team | Iran | 1980 | infantry | 40 | 4 men | – | 106mm M40 recoilless | 800 | 400 | 10 | 650 | 15% | 100% |
| RPG-7 team | Iran | 1980 | infantry | 38 | 4 men | – | RPG-7 | 350 | 260 | 12 | 650 | 15% | 100% |
| MG3 team | Iran | 1980 | infantry | 32 | 3 men | – | 7.62mm MG3 | 700 | – | 12 | 700 | 15% | 100% |
| Rifle squad | Iran | 1980 | infantry | 28 | 9 men | – | 7.62mm G3 | 380 | – | 12 | 650 | 15% | 100% |
| IRGC squad | Iran | 1980 | infantry | 22 | 10 men | – | 7.62mm rifles (volunteers) | 340 | 260 | 12 | 650 | 15% | 100% |
| Basij militia | Iran | 1980 | infantry | 14 | 10 men | – | Mixed rifles | 320 | – | 12 | 600 | 15% | 100% |
| Chieftain | Iran | 1980 | tank | 185 | 130 | 245/70/40 | 120mm L11A5 | 1100 | 360 | 19 | 1200 | 55% | 70% |
| M60A1 | Iran | 1980 | tank | 150 | 115 | 215/75/40 | 105mm M68 | 1050 | 380 | 23 | 1150 | 50% | 90% |
| M47/M48 | Iran | 1980 | tank | 100 | 105 | 190/76/30 | 90mm M41 | 950 | 250 | 21 | 1050 | 30% | 85% |
| Scorpion | Iran | 1980 | tank | 80 | 60 | 30/16/12 | 76mm L23A1 | 800 | 190 | 36 | 1200 | 45% | 85% |
| Mohajer-1 RPV | Iran | 1984 | drone | 50 | 15 | 0/0/0 | – | – | – | 115 | 1400 | 20% | 95% |
| Loitering munition | Iran | 1986+ | drone | 70 | 10 | 0/0/0 | Loitering warhead | 40 | 140 | 151 | 1000 | 30% | 95% |
| Recon quadcopter | Iran | 1986+ | drone | 25 | 6 | 0/0/0 | – | – | – | 58 | 750 | 30% | 95% |
| ZSU-23-4 | Iraq | 1980 | aa | 110 | 65 | 15/9/9 | 23mm AZP-23 Amur | 1300 | – | 27 | 1300 | 85% | 85% |
| ZU-23-2 | Iraq | 1980 | aa | 40 | 30 | 6/0/0 | 23mm ZU-23-2 | 1200 | – | 6 | 1100 | 15% | 100% |
| BMP-1 | Iraq | 1980 | apc | 90 | 80 | 33/18/16 | 73mm 2A28 Grom | 700 | 400 | 31 | 1000 | 40% | 88% |
| BTR-60PB | Iraq | 1980 | apc | 55 | 60 | 10/7/7 | 14.5mm KPVT | 800 | – | 36 | 950 | 25% | 85% |
| BTR-50 | Iraq | 1980 | apc | 50 | 65 | 11/14/7 | 7.62mm PKT coax | 600 | – | 27 | 900 | 20% | 88% |
| Mi-24 Hind-D | Iraq | 1980 | heli | 260 | 110 | 14/10/7 | Falanga launcher | 1800 | 500 | 180 | 1500 | 30% | 95% |
| SA-342 Gazelle | Iraq | 1980 | heli | 150 | 55 | 4/3/3 | HOT launcher | 2000 | 800 | 198 | 1500 | 35% | 94% |
| Mi-8 Hip | Iraq | 1980 | heli | 140 | 90 | 7/6/5 | UB-16 rocket pod | 950 | 110 | 151 | 1400 | 20% | 95% |
| Republican Guard | Iraq | 1980 | infantry | 55 | 8 men | – | 7.62mm AKM (trained) | 380 | 260 | 12 | 650 | 15% | 100% |
| SA-7 team | Iraq | 1980 | infantry | 45 | 3 men | – | Strela-2 launcher | 1500 | 30 | 12 | 900 | 15% | 100% |
| RPG-7 team | Iraq | 1980 | infantry | 40 | 4 men | – | RPG-7 | 350 | 260 | 12 | 650 | 15% | 100% |
| PKM team | Iraq | 1980 | infantry | 30 | 3 men | – | 7.62mm PKM | 700 | – | 12 | 700 | 15% | 100% |
| Rifle squad | Iraq | 1980 | infantry | 25 | 9 men | – | 7.62mm AK-47 | 360 | – | 12 | 650 | 15% | 100% |
| T-72 | Iraq | 1980 | tank | 190 | 115 | 305/80/50 | 125mm 2A26 | 1150 | 450 | 30 | 1150 | 55% | 88% |
| T-62 | Iraq | 1980 | tank | 130 | 105 | 200/80/45 | 115mm U-5TS | 1050 | 400 | 27 | 1100 | 50% | 88% |
| T-55 | Iraq | 1980 | tank | 100 | 100 | 190/80/45 | 100mm D-10T | 1000 | 380 | 27 | 1100 | 50% | 90% |
| PT-76 | Iraq | 1980 | tank | 70 | 70 | 14/14/7 | 76mm D-56T | 900 | 200 | 31 | 1150 | 40% | 90% |
| Recon RPV | Iraq | 1984 | drone | 50 | 15 | 0/0/0 | – | – | – | 115 | 1400 | 20% | 95% |
| Loitering munition | Iraq | 1986+ | drone | 70 | 10 | 0/0/0 | Loitering warhead | 40 | 140 | 151 | 1000 | 30% | 95% |
| Recon quadcopter | Iraq | 1986+ | drone | 25 | 6 | 0/0/0 | – | – | – | 58 | 750 | 30% | 95% |
<!-- BALANCE:END -->

## Historical notes and liberties

- Statistics approximate real-world characteristics: armour, gun calibre and penetration, speed, crew,
  ATGM range, night sights and reliability. They are tuned for fun and fairness, not reproduced exactly.
- The towns, bridges and the Border Crossing scenario are fictional composites of the Khuzestan front.
- The Iraqi recon RPV, both loitering munitions and the quadcopters are fictionalized, and their intel
  cards say so. Iran's Mohajer-1 is real but appears in the 1984 tier, slightly before its c. 1985 service entry.

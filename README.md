# Skyfront

An original low-poly 3D air combat game set in 1944–1953. Fly late-war props and early jets
in an "Air Realistic Battle": take off from your airfield, fight other aircraft that use the same
flight model as you, bomb enemy bases and ground units to drain their tickets, and land on your own
runway to rearm and repair.

The current aircraft models are lofted from cross-sections in code, the terrain is procedural, the
textures are painted on a canvas and the sound is synthesized with the Web Audio API. Downloaded assets
(models, textures, sounds) are allowed too: see [Adding assets](#adding-assets).

Built with TypeScript, Three.js and Vite.

---

## Maps

The main menu has a map picker (the game reloads when you change it). **Skyfront Island** is the original single-island
map. **Trident Isles** has three equal home islands around an inner sea (US north-west, Russia north-east, Western Europe
south) with a contested atoll and stepping-stone islets in between; the islands are not linked by land, so for now the
ground forces only defend their own shores. Maps are plain data in `src/world/maps.ts`; you can also force one with `?map=trident`.

**Operation Landfall** (`?map=landfall`) is a mission, not a match. The island is traced from an aerial photo; Russia (MiG-15bis) holds the
airfield and five camps, the US (F9F-2 Panther, flown from two carriers) lands troops on the south-east beaches. There are no tickets:
the US wins by capturing all six points with no time limit; Russia wins by sinking a US carrier
(it takes six Kh-22 hits). Once the US holds two thirds of the points Russia sends two Tu-22 anti-ship bombers every five minutes.
Ground forces are bought with credits earned from kills: press 1-6 to order troops to a point, 0 for the nearest, U to deploy a
squad. The other side's commander does the same. Progress autosaves; use "Continue mission" in the menu. US troops are not placed on the island: fly them in by H-34 from a carrier to the Red or Blue Beach landing zone and set them down (squads bought with U deploy only at points the US already holds). When the computer commands the US, AI H-34s fly its troops in.

---

## Carrier flight deck

Carriers (any ship with a `deck` in `src/world/ships.ts`) run a shared catapult queue. Naval aircraft (the player's and the AI's) can
start on their team's carrier; AI aircraft park on the deck's `park` spots, creep forward as the line moves, taxi to a free catapult
track when cleared, hold full power and ride the shuttle. One aircraft is cleared at a time with a short gap between shots. The
player joins the same line: with power up on a track you are told how many aircraft are ahead, and you fire only when it is your turn
(a player who is not ready when they reach the front goes to the back). `npm run cattest -- 4 player` simulates a deck headless.

---

## Play online (GitHub Pages)

This repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds the game and
publishes it to GitHub Pages on every push to `main`. One-time setup:

1. Push this project to a GitHub repository (public, or private on a plan that includes Pages).
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab). When it finishes, the game is
   live at `https://<your-username>.github.io/<repo-name>/`.

---

## Running on macOS (Apple Silicon)

You need [Node.js](https://nodejs.org) 18 or newer (tested with Node 24). Check with `node -v`.

```bash
cd skyfront
npm install
npm run dev
```

`npm run dev` starts a local server and opens **http://localhost:5173** in your default browser.
Chrome and Safari both work.

**Other builds**

| Command | What it does |
|---|---|
| `npm run build` | Typecheck + optimized production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run build:single` | One self-contained `dist-single/index.html` you can double-click to play, no server needed |
| `npm run fltest` | Headless flight-model test: top speed, turn, and takeoff for every aircraft |

**Performance:** the default graphics quality is *High*. If the frame rate drops (for example on a
large external monitor), choose *Medium* or *Low* in Settings and reload the page. Low turns off shadows,
lowers the render resolution and plants fewer trees.

---

## How to play

1. In the hangar, pick an aircraft, a **payload**, an era, an AI difficulty and the team size, then press
   **TAKE OFF**. With a bomb payload you can tick **Air spawn** to start in the air at bomber altitude
   (3,000 m for props, 4,500 m for jets, 9,000 m for the B-58) instead of on the runway.
2. Click the game window to capture the mouse.
3. You start on the runway with the engine idling. Raise the throttle with **Shift** (all the way to
   *WEP* for maximum power) and raise the mouse aim point a little. The plane rolls, lifts its tail and
   leaves the ground on its own once it's fast enough.
4. Once airborne, raise the gear (**G**) and flaps (**F**). Don't leave flaps or gear out at high speed,
   because the airflow tears them off.
5. Win by draining the enemy's tickets or shooting down every enemy aircraft. Each player and AI pilot
   gets **one life**.

**Three teams.** Every match has three sides, each with its own airfield, bases, ground forces, colours and
national markings: the **United States** (west, blue), **Western Europe** (south, gold,
ringed roundel) and **Russia** (east, red, star). Everyone fights everyone. You fly for the nation that built the
aircraft you pick, and the AI pilots on each team fly their own nation's types. The match ends when only one team
is left, or when yours is knocked out (tickets gone or no aircraft left). Teams, nations and aircraft assignments
live in `src/world/layout.ts` (`TEAMS`, `AIRCRAFT_TEAM`, `AIRFIELDS`, `BASES`, `UNIT_GROUPS`).

**Tickets** (each team starts with 500)

| Event | Tickets lost |
|---|---|
| Aircraft shot down | −45 |
| Forward base destroyed (all of its buildings) | −90 |
| Airfield bombed out (hangars, tower and fuel depot mostly destroyed) | −70; that team also can't rearm for 3 minutes |
| Tank / truck / pillbox / AA gun | −8 / −4 / −6 / −5 |

**Rearm, refuel, repair:** land on your own airfield (runway, taxiway or apron) and come to a full stop
with the gear down. A progress bar appears; servicing takes 15–45 s depending on damage. Moving cancels it.
Friendly airfield flak shoots at enemies who chase you home.

**Realistic rules**
- Ammo and bombs are limited, and guns don't reload in the air.
- Enemy markers appear only within about 3.8 km and are hidden by clouds and terrain. There's no lead
  indicator by default; you can turn one on in Settings.
- Your speed, altitude and throttle, the engine temperature (props) or RPM (jets), G load, fuel, ammo,
  bombs, gear/flap state and a minimap are shown.

**Payloads:** each plane can fly with guns only, rockets or bombs:

| Aircraft | Rockets | Bombs |
|---|---|---|
| P-51D | 6× HVAR 5" | 2× 500 lb |
| Bf 109 K-4 | 2× WGr. 21 | 1× 250 kg |
| Yak-9U | 6× RS-82 | 2× 100 kg |
| Me 262 | 24× R4M | 2× 250 kg |
| F9F-2 | 6× HVAR 5" | 2× 1000 lb |
| F-86F | 8× HVAR 5" | 2× 1000 lb |
| MiG-15bis | 2× ARS-212 | 2× 250 kg |
| B-58A | — | 4× 1000 lb + fuel pod, **or** a nuclear bomb with the fuel pod removed |
| Tu-22 | — | 8× 500 kg + bay fuel tank, **or** a nuclear bomb with the bay tank removed |
| Il-28 | — | 6× 500 kg, **or** a nuclear bomb (RDS-4) |
| B-66B | — | 12× 1000 lb, **or** a nuclear bomb (Mk 7) |
| Su-15 | 4× R-8M homing missiles, **or** 32× S-5 57 mm (two 16-tube pods) | — |
| F-102A | 6× AIM-4 Falcon homing missiles, **or** 24× Mk 4 FFAR 2.75" (bay doors) | — |
| Vulcan B.2 | — | 21× 1000 lb (a row of three per press), **or** one nuclear bomb |
| Lightning F.6 | 2× Red Top **or** 2× Firestreak homing missiles | — |

Hold the bomb key (**B** / middle mouse) to fire rockets in pairs (the R4M fires in salvos of six). Rockets
burn for about a second, then fall like a shell, so aim a little high at long range. With **Settings →
Bomb/rocket impact marker** on, a diamond shows where they'll hit. Stores add drag and weight until they're
gone. Landing to rearm reloads the payload you took off with. AI attackers carry bombs or rockets too, and
AI bombers start in the air.

**Nuclear bomb (B-58, Tu-22, Il-28, B-66 and Vulcan):** taking it removes the fuel pod (B-58, 40% less fuel) or the bomb-bay tank (Tu-22, 20% less fuel). The bomb
air-bursts about 550 m above the ground. Everything within about 1.3 km is destroyed: buildings, units,
AA guns and aircraft, enemy *and* friendly, including a whole base or airfield. The shock front damages
everything out to about 2.6 km. Drop it from high altitude and run: the fall takes 30–45 s, and the B-58
can outrun the shock.

**B-58A Hustler (bonus, outside the era):** a 1956 Mach 2 delta-wing bomber with four afterburning
engines and four 1000 lb bombs. Its only gun is a radar-aimed 20mm tail gun: hold Fire and it shoots
*backward* at the nearest enemy within 1.5 km behind you (the HUD shows the radar lock). It's player-only,
so AI pilots never fly it. It pulls only about 3 g, so outrun fighters rather than turning with them.

**Tu-22 Blinder (bonus, outside the era):** an early Soviet Mach 1.4 bomber with two afterburning engines
on the tail and a radar-aimed twin 23mm tail gun that works like the B-58's. It is heavier, slower and
thirstier than the B-58 and rolls sluggishly, so plan the bomb run early. Player-only, unlocks at 7,000.

**Early jet bombers (bonus, outside the era):** two straight-forward twin-jet bombers with no afterburners and a radar-aimed tail gun
that works like the B-58's. Both fly a level bomb run, so they're slow to turn and climb; hold the brakes (**H**, an airbrake in flight) to get down for landing.
Unlike the supersonic bombers above, AI pilots fly them too: they cruise at 2,200–3,200 m, bomb in a shallow level run, then head home
and land, defended only by their tail gunner.
- **Il-28 Beagle** (Soviet, 1948): a light straight-wing bomber with two VK-1 engines in wing nacelles, a glazed bombardier nose, two fixed
  forward 23mm guns and a twin 23mm tail turret. Agile for a bomber, but it tops out near 900 km/h. Unlocks at 3,500.
- **B-66B Destroyer** (American, 1954): a swept-wing bomber with two J71 engines in underwing pods and a twin 20mm radar-aimed tail gun.
  Faster and with a bigger bomb load than the Il-28, but heavy and slow to roll. Unlocks at 5,000.

**Avro Vulcan B.2 (bonus, outside the era, Western Europe):** Britain's V-bomber: a huge tailless delta with four Olympus engines buried in the
wing roots (no afterburners) and no guns at all. Pick **21× 1000 lb bombs** (each press of the bomb key drops a row of three) or the Yellow Sun
nuclear bomb. It is subsonic, so it relies on altitude, but the big delta wing rolls and turns far better than the other bombers. Player-only, unlocks at 9,000.

**Early Cold War interceptors (bonus, outside the era):** the missiles of the day aren't in the game, so both fight with what they can
carry in it.
- **Su-15 Flagon** (Soviet, 1965): a Mach 2 delta with two afterburning R-11 engines and two fixed 23mm UPK-23 gun pods, so it plays like a
  very fast gun fighter. It climbs superbly but has a heavy wing, so it loses a turning fight. Pick **4× R-8M** homing missiles or S-5 rocket pods as its payload. Unlocks at 8,000.
- **F-102A Delta Dagger** (American, 1956): a single-engine area-ruled delta with no guns at all. Its weapons are six homing AIM-4 Falcon
  missiles (default) or a 24-rocket Mk 4 FFAR pack in the bay doors, both fired with the bomb key (**B** / middle mouse). Easy to fly and
  fast, but few shots. Player-only (AI pilots can't fight with missiles or rockets), unlocks at 7,500.
- **English Electric Lightning F.6** (British, 1965): Mach 2 with two stacked afterburning Avons, two 30mm Aden cannon in the ventral tank and a
  Red Top (all-aspect, 6 km) or Firestreak (rear hemisphere, narrower cone, 4 km) missile on each side of the forward fuselage. It climbs like a
  rocket but carries little fuel. Unlocks at 9,500.

**F9F-2 Panther (Korean War):** Grumman's straight-wing Navy jet: one J42 engine, four 20mm nose cannons and wingtip tanks. Forgiving and fast in a dive, but its unswept wing hits compressibility early and its single engine gives only modest thrust, so keep your speed up and use the cannons. Unlocks at 3,400.

**Homing missiles (AIM-4, R-8M, Red Top, Firestreak):** point the nose at an enemy within the seeker cone (about 25-30°, up to 4.5-5.5 km) and a red bracket
and `MISSILE LOCK` with the range appear. Press the bomb key to fire one missile; with no lock nothing launches. The missile boosts,
turns toward where the target will be (it can only turn so hard, so a tight break at close range can shake it), and explodes by proximity.
If the target leaves its view, it flies on unguided.

**Afterburners (Su-15, F-102A, Lightning, B-58, Tu-22):** push the throttle past the 100% detent (hold **Shift**) and the afterburners
light after about a second: thrust goes up by 45-65% depending on the engine, fuel burn roughly triples, and a
flame trails each engine. The HUD shows `AB` next to the throttle. Back the throttle off to shut them down.
Top speed and climb need the afterburners; cruise on dry thrust to save fuel.

**Helicopters (first test): H-34 Choctaw (US) and Mi-4AV Hound (Russia).** The AI flies them too (see below). In mouse-aim the throttle keys become a speed lever: zero is a hover, 100% is cruise and the WEP zone is
full speed. **W** climbs, **S** descends (hold it over flat ground to land), **Q/E** sidestep, **A/D** and the mouse turn
the nose. In a hover the mouse also tilts the nose up or down about 10° to aim guns and rockets without drifting. Full
manual (**M**) puts the collective on the throttle keys and cyclic and pedals on the stick keys. The HUD shows collective,
rotor rpm and vertical speed instead of throttle, engine and G. Loads: troops (12 in the H-34, 14 in the Mi-4), FFAR or
S-5 rocket pods, and FAB-100 bombs on the Mi-4. To set troops down, land and stop, then press the bomb key; they get out
as infantry sections of six that march on the nearest objective, shoot at ground units and low aircraft, and count
toward capturing a point. In Operation Landfall they can only be landed inside a landing zone (`LZ` markers): the US
beaches (Red and Blue Beach) and any point your side holds firmly. Land back on a carrier deck or your airfield to
pick up more. The H-34 starts on its own spot on the carrier deck (no catapult). If the engine or main gearbox is lost
the rotor autorotates: the autopilot glides at about 110 km/h, flares near the ground and cushions the landing. Losing
the main rotor is fatal; losing the tail rotor spins the fuselage.

**AI helicopters.** Every battle fields AI helicopters of two kinds, flown by the same autopilot as yours. A *troop lift*
(H-34 or Mi-4 with troops) flies low to a landing zone, lands, sets its troops down and returns to its carrier or airfield
to load more; outside missions it puts them down on dry land short of the nearest enemy base, and they march on it. A
*gunship* (armed with rockets and its gun) picks enemy tanks, infantry, trucks and guns (preferring targets near friendly
troops and away from heavy air defences), makes low rocket and gun passes, then goes home to rearm. In Operation Landfall
the US sends H-34 troop lifts (two beside you, four when the computer is the US commander) and one gunship; Russia sends two
Mi-4 gunships. The computer's squads still deploy only at points it holds, so its troops reach the beaches in AI H-34s: shoot
them down to stop a landing. Shot-down AI helicopters respawn like other AI aircraft.

**Score and unlocks:** you earn score for air kills (100), assists (40), ground units (30–60), buildings,
destroying bases (200), disabling the enemy airfield (300), safe landings (50), winning (250) and surviving
(50). You start with the three props. The Me 262 unlocks at 1,200 career score, the MiG-15bis at 2,600,
the F9F-2 Panther at 3,400, the Il-28 at 3,500, the F-86F at 4,500, the B-66B at 5,000, the B-58A Hustler at 6,000, the Tu-22 at 7,000, the F-102A at 7,500, the Su-15 at 8,000, the Vulcan at 9,000 and the Lightning at 9,500. Progress is saved in your browser's localStorage. **Settings → Unlock all aircraft**
skips the grind.

---

## Controls

Every key can be remapped in **Controls** (click a key, press the new key; Backspace clears).
Bindings are saved to localStorage.

| Action | Default |
|---|---|
| Steer (mouse-aim mode) | Move the mouse |
| Pitch down / up | W / S |
| Yaw left / right (rudder) | A / D |
| Roll left / right | Q / E |
| Fire guns | Left mouse / Space |
| Drop bomb / fire rockets (hold) / unload troops | Middle mouse / B |
| Throttle up (WEP above 100%) / down | Shift / Ctrl |
| Landing gear | G |
| Flaps: up → combat → takeoff → landing | F |
| Wheel brakes (hold) | H |
| Free-look camera (hold) | C |
| Cycle view: chase / cockpit / bomb sight | V |
| Camera zoom (chase view) | Mouse wheel |
| Toggle mouse-aim / full manual | M |
| Minimap zoom | N |
| Pause | Esc / P |

**Control modes**
- **Mouse-aim (default):** the mouse moves the aim circle. An instructor autopilot flies the plane
  toward it using the normal control surfaces. It still obeys the flight model: it won't pull past
  the stall angle or the structural G limit, but it can't beat physics either. The keyboard axes still
  work as overrides.
- **Full manual:** W/S/A/D/Q/E move the control surfaces directly, and the mouse looks around (it
  re-centers after a moment). You can stall, spin and over-G the wings off.

**Views:** the chase camera follows your aim. The cockpit view has a reflector sight; the F-86 also gets
a green lead-computing gyro sight. The bomb sight looks down at the predicted impact point. While
spectating after you're shot down, press Fire to cycle through aircraft.

---

## The flight model

`src/flight/` is a force-based 6-DOF rigid-body simulation running at 240 Hz:

- **Lift:** a lift curve with a stall break, post-stall flat-plate behavior and flap effects.
- **Drag:** parasitic, induced (K·CL²) and wave drag past the critical Mach number, plus gear and flap drag.
- **Atmosphere:** standard (ISA); air density, and with it lift and drag, falls with altitude.
- **Thrust:** a piston engine with propeller efficiency, a supercharger critical altitude and a WEP zone.
  Jets have thrust lapse with altitude, ram drag, slow spool-up, and flameouts if the throttle is
  slammed at low RPM.
- **Moments:** static stability, rate damping and control power, all scaled by dynamic pressure.
  Propeller wash keeps the elevator and rudder effective on the ground.
- **Compressibility:** controls stiffen at high indicated airspeed (manual controls), and past Mcrit
  the elevator loses authority and the nose tucks.
- **Stalls:** wing drop and spin autorotation.
- **Prop effects:** torque and P-factor at low speed and high power.
- **Engine heat:** props overheat at WEP; oil leaks make it worse.
- **Structure:** over-G and overspeed tear the wings off. Gear and flaps fail if extended too fast.
- **Damage:** each part has its own hitbox (engines, fuel, wings, tail, pilot, fuselage). Damage
  changes lift, drag, stability and control effectiveness, and can cause fuel leaks, fires,
  flameouts and jammed control surfaces.
- **Landing gear:** spring/damper struts with tail- or nose-wheel steering, brakes, hard-landing
  collapse, belly scrapes and prop strikes.

The AI flies the **same** flight model through the **same** instructor as mouse-aim. It gets no
special physics.

---

## Editing aircraft stats

All aircraft data lives in **`src/aircraft/aircraft.ts`**. Save the file and the dev server reloads
the game instantly. The main knobs:

| Field | Meaning |
|---|---|
| `topSpeedKmh`, `topSpeedAlt` | Target top speed at an altitude. Zero-lift drag is solved automatically so max power equals drag there. |
| `engine.powerHp`, `engine.wepHp`, `engine.criticalAlt` | Prop power at 100% and in the WEP zone, and the altitude where power starts to fall off |
| `engine.thrustKn`, `engine.spoolTime`, `engine.flameoutRisk` | Jet thrust (dry rating when `afterburner` is set), spool-up time and flameout risk |
| `engine.afterburner` | `{ thrustMul, fuelMul }`: thrust and fuel-flow multipliers when the throttle is past 100%. `topSpeedKmh` is the afterburning top speed. |
| `emptyMass`, `fuelMass`, `wingArea` | Weight and wing loading, which drive turning and climbing |
| `clMax` | Max lift coefficient: higher means a better instantaneous turn and a lower stall speed |
| `rollRate`, `rollSpeedKmh` | Full-aileron roll rate (deg/s) at a given indicated airspeed |
| `stiffSpeedKmh`, `rollStiffSpeedKmh` | Above this IAS the pilot can no longer deflect the controls fully. Use a huge value for hydraulic controls. |
| `mcrit`, `machLock`, `machTuck` | Compressibility: drag rise, loss of elevator authority and nose-down tuck |
| `gLimit`, `vneKmh` | Structural limits |
| `guns[]` | Caliber, rate of fire, muzzle velocity, ammo, damage, HE splash, mount positions |
| `bombs` | Standard bomb load: mass, count and mounts (`nuclear` makes it a nuclear weapon) |
| `rockets` | Standard rocket load: rocket type, count, salvo size and launch rails |
| `payloads` | Optional explicit payload list (the B-58 uses it for the nuclear option: `fuelFrac`, `hideParts`, `dragDelta`) |
| `bomberSpawnAlt` | Air-spawn altitude with a bomb load |
| `hp` | Hit points of each damageable part |
| `unlockScore` | Career score needed to unlock |
| `style` | AI tactics hint: `turn`, `energy` or `balanced` |

After editing, `npm run fltest` prints each aircraft's achieved top speed, turn rate and takeoff run,
so you can check your changes did what you wanted.

Other tuning spots:
- **Tickets and score values:** `src/game/match.ts`
- **AI skill per difficulty** (aim error, reaction time, spotting range, G tolerance): `SKILLS` in `src/ai/pilot.ts`
- **Ground target toughness:** `KIND` in `src/world/targets.ts`
- **Map layout** (airfields, bases, front-line units): `src/world/layout.ts`

---

## Adding assets

Put downloaded files (glTF models, textures, audio) in **`public/media/`**. Vite serves them in dev and
copies them into `dist/` on build, so load them with relative URLs such as `./media/engine.ogg` (with
Three.js loaders, `fetch`, or `new Audio()`). Keep the license of each third-party asset next to it,
for example `public/media/LICENSES.md`.

The B-58 uses one: `public/media/b58.glb`, loaded by `src/aircraft/b58.ts`. To change its shape, edit
`tools/b58/b58_model.py` and re-export (Blender 4.2 or newer):

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/b58/export_glb.py
```

The fighters, the Tu-22, the Il-28, the B-66, the Vulcan and the interceptors are built from one Blender script, `tools/aircraft/model.py` (a design per aircraft),
exported by `tools/aircraft/export_glb.py` and loaded by `src/aircraft/glbAircraft.ts`. Add `-- tu22` to
export just one. `tools/aircraft/preview.py <id> <out_dir>` renders side, front, three-quarter, top and rear views with headless Blender (`pip install bpy`).

The single-file build (`npm run build:single`) only bundles code, so it can't include these files. Once
the game uses assets, publish the multi-file `dist/` build instead: either the GitHub Actions workflow,
or upload the contents of `dist/` to the Pages repo.

---

## Project structure

```
src/
  main.ts            boot + loading screen
  core/              math helpers, seeded RNG, simplex noise, input, settings + key bindings
  flight/            atmosphere, engines, 6-DOF flight model, instructor autopilot
  aircraft/          aircraft.ts (all stats), models.ts (procedural meshes), entity.ts (aircraft + damage)
  weapons/           ballistic bullets + tracers, bombs, particle effects
  ai/                AI pilot state machine (takeoff, climb, patrol, engage, boom & zoom, defend,
                     bomb, strafe, return to base, landing, rearm)
  world/             terrain (noise + LOD chunks), sky, clouds, trees/villages, airfields, bases, targets/AA
  ui/                HUD, minimap, menus
  audio/             Web Audio synthesis
  game/              game loop, camera rig, player controller, match rules, progression
scripts/             headless flight-model test, single-file builder
tools/b58/           Blender scripts that build the B-58 model and export public/media/b58.glb
public/media/        downloaded / exported assets (see LICENSES.md)
```

## Known limitations

- Aircraft don't collide with each other or with buildings and trees, only with the ground and water.
- AI pilots occasionally fly into the ground, mostly on Rookie (some of that is deliberate).
- No multiplayer. The match is you plus AI.

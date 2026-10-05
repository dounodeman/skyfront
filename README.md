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
| F-86F | 8× HVAR 5" | 2× 1000 lb |
| MiG-15bis | 2× ARS-212 | 2× 250 kg |
| B-58A | — | 4× 1000 lb + fuel pod, **or** a nuclear bomb with the fuel pod removed |
| Tu-22 | — | 8× 500 kg + bay fuel tank, **or** a nuclear bomb with the bay tank removed |

Hold the bomb key (**B** / middle mouse) to fire rockets in pairs (the R4M fires in salvos of six). Rockets
burn for about a second, then fall like a shell, so aim a little high at long range. With **Settings →
Bomb/rocket impact marker** on, a diamond shows where they'll hit. Stores add drag and weight until they're
gone. Landing to rearm reloads the payload you took off with. AI attackers carry bombs or rockets too, and
AI bombers start in the air.

**Nuclear bomb (B-58 and Tu-22):** taking it removes the fuel pod (B-58, 40% less fuel) or the bomb-bay tank (Tu-22, 20% less fuel). The bomb
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

**Afterburners (B-58, Tu-22):** push the throttle past the 100% detent (hold **Shift**) and the afterburners
light after about a second: thrust goes up by half (B-58) or 45% (Tu-22), fuel burn roughly triples, and a
flame trails each engine. The HUD shows `AB` next to the throttle. Back the throttle off to shut them down.
Top speed and climb need the afterburners; cruise on dry thrust to save fuel.

**Score and unlocks:** you earn score for air kills (100), assists (40), ground units (30–60), buildings,
destroying bases (200), disabling the enemy airfield (300), safe landings (50), winning (250) and surviving
(50). You start with the three props. The Me 262 unlocks at 1,200 career score, the MiG-15bis at 2,600,
the F-86F at 4,500, the B-58A Hustler at 6,000 and the Tu-22 at 7,000. Progress is saved in your browser's localStorage. **Settings → Unlock all aircraft**
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
| Drop bomb / fire rockets (hold) | Middle mouse / B |
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

The fighters and the Tu-22 are built from one Blender script, `tools/aircraft/model.py` (a design per aircraft),
exported by `tools/aircraft/export_glb.py` and loaded by `src/aircraft/glbAircraft.ts`. Add `-- tu22` to
export just one.

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

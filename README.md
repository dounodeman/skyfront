# Skyfront

**▶ Play in your browser: https://dounodeman.github.io/skyfront/**

An original low-poly 3D air combat game set in 1944–1953. You take off from your airfield, fight AI
pilots who use the same realistic flight model as you, and bomb enemy bases and ground units to drain
their tickets. Land on your own runway to rearm and repair.

The island terrain, textures and sound (Web Audio) are generated in code, as are most aircraft models.
Built with TypeScript and Three.js.

## Aircraft
- **Late props:** P-51D Mustang, Bf 109 K-4, Yak-9U
- **Early jets** (unlock with career score): Me 262 A-1a, MiG-15bis, F-86F Sabre
- **Bonus:** B-58A Hustler, a Mach 2 delta bomber with a radar-aimed tail gun that fires backward (unlocks at 6,000)

## Controls (remappable in-game)

| Action | Key |
|---|---|
| Steer (mouse-aim) | Move the mouse; click the game first to capture it |
| Pitch / yaw / roll (manual) | W S / A D / Q E |
| Fire / bomb | Left mouse or Space / Middle mouse or B |
| Throttle up (WEP above 100%) / down | Shift / Ctrl |
| Gear / flaps / brakes | G / F / H (hold) |
| Free look / cycle view | C (hold) / V |
| Mouse-aim ↔ manual / minimap zoom | M / N |
| Pause | Esc |

**How to play:** throttle up with Shift, raise the aim point a little to take off, then raise the gear and
flaps. Win by draining the enemy's tickets: shoot down aircraft and destroy bases, ground units and the
enemy airfield. To rearm and repair, land on your own runway and come to a full stop.

## Files
- `index.html`, `assets/` and `media/` are the game (the production build). It needs a web server, so
  play it at the link above or run it from source.
- `skyfront-source.zip` is the full TypeScript source. To run it from source:
  ```
  unzip skyfront-source.zip -d skyfront && cd skyfront
  npm install
  npm run dev
  ```
  The source README explains the controls, the flight model, and how to edit the aircraft stats in
  `src/aircraft/aircraft.ts`.

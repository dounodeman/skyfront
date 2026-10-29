import { DEG, angleDiff, turnToward, wrapAngle } from '../../core/math';
import type { World } from '../world';

/**
 * Rotates turrets independently of the hull toward `turretWant`.
 * With no aim order the turret re-centres on the hull heading (travel position) while moving.
 */
export function turretSystem(w: World, dt: number) {
  for (const u of w.units) {
    if (!u.onMap) continue;
    const t = u.def.turret;
    if (!t) continue;
    if (u.dmg.turretJammed || u.crewAlive === 0) continue;
    let want = u.turretWant;
    if (want === null) want = u.mob.moving ? u.heading : null;
    // Gunner dead: slower traverse. Hydraulics are modelled by the crew count only.
    const crewFactor = u.def.crew.length ? 0.4 + 0.6 * (u.crewAlive / u.def.crew.length) : 1;
    if (want !== null) {
      if (t.arc !== undefined) {
        // Limited-traverse mounts (e.g. helicopter chin turrets): clamp relative to hull.
        const rel = Math.max(-t.arc * DEG, Math.min(t.arc * DEG, angleDiff(u.heading, want)));
        want = wrapAngle(u.heading + rel);
      }
      u.turretAngle = turnToward(u.turretAngle, want, t.rate * DEG * dt * crewFactor);
    }
    if (u.recoil > 0) u.recoil = Math.max(0, u.recoil - dt * 3);
  }
}

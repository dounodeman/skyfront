import { angleTo, dist } from '../../core/math';
import { applyHit, applySplash } from '../damage';
import type { Projectile } from '../projectiles';
import type { World } from '../world';
import { lineOfFire } from './combat';

/** Moves rounds in flight, keeps guided missiles on target, and resolves impacts. */
export function projectileSystem(w: World, dt: number) {
  for (const p of w.projectiles) {
    if (!p.alive) continue;
    p.age += dt;
    if (p.age < 0) continue; // staggered rocket salvo
    const t = w.get(p.targetId);
    const shooter = w.alive(p.shooterId);
    if (p.guided) {
      if (p.ammo.guided === 'ir') {
        // Heat-seeker: flies on its own; loses lock if the target is gone or lands.
        if (!t || !t.alive || !t.onMap || t.altitude < 5) { p.guided = false; p.hits = 0; }
      } else {
        // Command guidance: needs a living, steady shooter with sight of the target.
        const lost = !shooter || !t || !t.alive || !t.onMap || shooter.mob.moving && !shooter.isAir
          || (w.tick % 10 === 0 && !lineOfFire(w, shooter, t)) || (shooter.inf && shooter.inf.state !== 'ok');
        if (lost) {
          p.guided = false; p.hits = 0;
          if (shooter) shooter.guiding = Math.max(0, shooter.guiding - 1);
          const a = p.angle;
          p.tx = p.x + Math.cos(a) * 250; p.ty = p.y + Math.sin(a) * 250;
        }
      }
      if (p.guided && t) {
        if (p.hits) { p.tx = t.x; p.ty = t.y; }
        else { // a guided miss still tracks closely, then passes by
          p.tx = t.x + Math.cos(p.angle + 1.3) * 7; p.ty = t.y + Math.sin(p.angle + 1.3) * 7;
        }
      }
    } else if (p.hits > 0 && t && t.alive && t.onMap) {
      p.tx = t.x; p.ty = t.y;
    }
    const d = dist(p.x, p.y, p.tx, p.ty);
    const step = p.speed * dt;
    p.angle = angleTo(p.x, p.y, p.tx, p.ty);
    if (step >= d) {
      p.x = p.tx; p.y = p.ty;
      impact(w, p);
    } else {
      p.x += Math.cos(p.angle) * step; p.y += Math.sin(p.angle) * step;
      if (p.ammo.guided && p.ammo.kind !== 'BULLET' && w.tick % 2 === 0) w.bus.emit({ type: 'missile', x: p.x, y: p.y, ammoId: p.ammo.id });
    }
    if (p.age > 25) p.alive = false;
  }
  if (w.tick % 15 === 0) w.projectiles = w.projectiles.filter((p) => p.alive);
}

function impact(w: World, p: Projectile) {
  p.alive = false;
  const shooter = w.alive(p.shooterId);
  if (p.guided && p.ammo.guided !== 'ir' && shooter) shooter.guiding = Math.max(0, shooter.guiding - 1);
  const t = w.get(p.targetId);
  const range = dist(p.fromX, p.fromY, p.x, p.y);
  if (p.hits > 0 && t && t.alive && t.onMap) {
    applyHit(w, t, p.ammo, p.angle, range, p.hits, shooter, p.team);
    if (p.ammo.blast > 0) applySplash(w, p.x, p.y, p.ammo, p.team, t, p.air);
    else if (t.inf) applySplash(w, p.x, p.y, p.ammo, p.team, t);
  } else {
    w.bus.emit({ type: 'impact', x: p.x, y: p.y, kind: p.air ? 'air' : 'miss', ammoId: p.ammo.id, size: p.ammo.caliber });
    applySplash(w, p.x, p.y, p.ammo, p.team, null, p.air);
  }
  if (p.ammo.blast >= 6 && !p.air) w.bus.emit({ type: 'explosion', x: p.x, y: p.y, size: Math.min(1.6, p.ammo.blast / 12) });
}

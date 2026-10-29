import { SPRITE_SCALE, TEAM_COLORS } from '../core/constants';
import type { FactionId, UnitDef } from '../data/units/types';
import type { Unit } from '../sim/entity';

/**
 * Procedural vector sprites. Everything is drawn from the SpriteSpec in the unit's data,
 * so a new unit only needs a spec (dimensions, turret, wheels/tracks, rotor, extras).
 * Local coordinates: metres, +x = forward, +y = right of the hull.
 */
interface Paint { base: string; dark: string; light: string; track: string; metal: string; glass: string }
const PAINT: Record<FactionId, Paint> = {
  iraq: { base: '#a99869', dark: '#6e6b45', light: '#c0b07f', track: '#34322b', metal: '#4a4a44', glass: '#3a4a52' },
  iran: { base: '#6f7747', dark: '#4a5230', light: '#8b8d5d', track: '#2d2e28', metal: '#40423a', glass: '#33454d' },
};

const rnd = (id: number, k: number) => { const v = Math.sin(id * 91.7 + k * 17.3) * 43758.5453; return v - Math.floor(v); };

function paintFor(def: UnitDef): Paint {
  const p = PAINT[def.faction];
  const o = def.sprite.paint;
  return o ? { ...p, base: o.base ?? p.base, dark: o.dark ?? p.dark } : p;
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export interface SpriteFlags { selected: boolean; hover: boolean; time: number; zoom: number; friendlyView: boolean }

/** Pixel length below which a unit is drawn as a map icon instead of a full sprite. */
export const ICON_THRESHOLD = 15;

export function drawUnit(ctx: CanvasRenderingContext2D, u: Unit, sx: number, sy: number, f: SpriteFlags) {
  const def = u.def;
  const k = f.zoom * SPRITE_SCALE;
  const sizePx = Math.max(def.sprite.length, def.sprite.width) * k;
  const team = TEAM_COLORS[u.team];
  const isAir = u.isAir;

  ctx.save();
  ctx.translate(sx, sy);

  // Team underlay – a coloured pad so allegiance reads at any zoom.
  if (!isAir) {
    ctx.fillStyle = team + '40';
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(sizePx * 0.62, 6), Math.max(sizePx * 0.62, 6), 0, 0, 6.3);
    ctx.fill();
  }

  if (sizePx < ICON_THRESHOLD && !u.wreck) {
    drawIcon(ctx, u, Math.max(ICON_THRESHOLD, sizePx) * 0.5, team, f);
  } else {
    ctx.scale(k, k);
    ctx.rotate(u.heading);
    if (u.wreck) drawWreckBody(ctx, u);
    else switch (def.sprite.kind) {
      case 'tank': drawTank(ctx, u, f); break;
      case 'apc': drawApc(ctx, u, f); break;
      case 'wheeled': drawWheeled(ctx, u, f); break;
      case 'jeep': drawJeep(ctx, u, f); break;
      case 'aa': drawAA(ctx, u, f); break;
      case 'gun': drawGun(ctx, u, f); break;
      case 'heli': drawHeli(ctx, u, f); break;
      case 'drone': drawDrone(ctx, u, f); break;
      case 'infantry': ctx.rotate(-u.heading); drawInfantry(ctx, u, f); break;
    }
  }
  ctx.restore();
}

/** Ground shadow for aircraft, drawn in a separate pass beneath everything. */
export function drawAirShadow(ctx: CanvasRenderingContext2D, u: Unit, sx: number, sy: number, zoom: number) {
  const k = zoom * SPRITE_SCALE;
  const alt = u.altitude;
  const off = alt * 0.28 * zoom;
  ctx.save();
  ctx.translate(sx + off, sy + off * 0.8);
  ctx.globalAlpha = Math.max(0.12, 0.34 - alt * 0.0012);
  ctx.fillStyle = '#000';
  const s = u.def.sprite;
  ctx.scale(k, k);
  ctx.rotate(u.heading);
  if (s.kind === 'drone') {
    ctx.beginPath(); ctx.ellipse(0, 0, s.length * 0.5, s.width * 0.5, 0, 0, 6.3); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(0, 0, s.length * 0.42, s.width * 0.4, 0, 0, 6.3); ctx.fill();
    if (s.rotor) {
      ctx.globalAlpha *= 0.55;
      if (s.rotor.tandem) {
        for (const dx of [s.length * 0.33, -s.length * 0.33]) { ctx.beginPath(); ctx.arc(dx, 0, s.rotor.radius, 0, 6.3); ctx.fill(); }
      } else { ctx.beginPath(); ctx.arc(s.length * 0.05, 0, s.rotor.radius, 0, 6.3); ctx.fill(); }
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ icons
function drawIcon(ctx: CanvasRenderingContext2D, u: Unit, r: number, team: string, f: SpriteFlags) {
  ctx.rotate(u.isInfantry ? 0 : u.heading);
  ctx.fillStyle = team; ctx.strokeStyle = '#0b0f14'; ctx.lineWidth = Math.max(1.2, r * 0.18);
  const cat = u.def.category;
  ctx.beginPath();
  if (cat === 'infantry') { ctx.arc(0, 0, r * 0.75, 0, 6.3); }
  else if (cat === 'heli') {
    ctx.moveTo(-r, -r * 0.55); ctx.lineTo(r, r * 0.55); ctx.moveTo(-r, r * 0.55); ctx.lineTo(r, -r * 0.55);
    ctx.stroke();
    ctx.lineWidth = Math.max(2.2, r * 0.38); ctx.strokeStyle = team; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, 6.3); ctx.fillStyle = team; ctx.fill(); ctx.strokeStyle = '#0b0f14'; ctx.lineWidth = 1.2; ctx.stroke();
    return;
  } else if (cat === 'drone') { ctx.moveTo(r, 0); ctx.lineTo(0, r * 0.7); ctx.lineTo(-r, 0); ctx.lineTo(0, -r * 0.7); ctx.closePath(); ctx.fillStyle = team + 'aa'; }
  else if (cat === 'aa') { ctx.moveTo(r, 0); ctx.lineTo(-r * 0.8, r * 0.85); ctx.lineTo(-r * 0.8, -r * 0.85); ctx.closePath(); }
  else if (cat === 'tank') { rrect(ctx, -r, -r * 0.6, r * 2, r * 1.2, r * 0.25); }
  else if (cat === 'atgm' || cat === 'jeep') { ctx.moveTo(r, 0); ctx.lineTo(0, r * 0.7); ctx.lineTo(-r, 0); ctx.lineTo(0, -r * 0.7); ctx.closePath(); }
  else { rrect(ctx, -r, -r * 0.5, r * 2, r, r * 0.3); }
  ctx.fill(); ctx.stroke();
  if (cat === 'tank') { ctx.fillStyle = '#0b0f14'; ctx.fillRect(0, -r * 0.1, r * 1.3, r * 0.2); }
  if (cat === 'apc') { ctx.fillStyle = '#0b0f14'; ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.25, 0, 6.3); ctx.fill(); }
  if (cat === 'infantry' && u.inf && u.inf.state === 'broken') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.5); ctx.lineTo(r * 0.5, r * 0.5); ctx.stroke(); }
}

// ------------------------------------------------------------------ vehicles
function patches(ctx: CanvasRenderingContext2D, u: Unit, p: Paint, L: number, W: number) {
  ctx.fillStyle = p.dark + 'aa';
  for (let i = 0; i < 4; i++) {
    const x = (rnd(u.id, i) - 0.5) * L * 0.7, y = (rnd(u.id, i + 5) - 0.5) * W * 0.5;
    ctx.beginPath(); ctx.ellipse(x, y, L * (0.07 + rnd(u.id, i + 9) * 0.1), W * 0.1, rnd(u.id, i + 3), 0, 6.3); ctx.fill();
  }
}

function drawTracks(ctx: CanvasRenderingContext2D, p: Paint, L: number, W: number, f: SpriteFlags, phase: number) {
  const tw = W * 0.24;
  ctx.fillStyle = p.track;
  rrect(ctx, -L / 2, -W / 2, L, tw, tw * 0.4); ctx.fill();
  rrect(ctx, -L / 2, W / 2 - tw, L, tw, tw * 0.4); ctx.fill();
  if (f.zoom > 1.4) { // tread links
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.07;
    ctx.beginPath();
    for (let x = -L / 2 + 0.2 + (phase % 0.36); x < L / 2 - 0.1; x += 0.36) {
      ctx.moveTo(x, -W / 2); ctx.lineTo(x, -W / 2 + tw); ctx.moveTo(x, W / 2 - tw); ctx.lineTo(x, W / 2);
    }
    ctx.stroke();
  }
}

function hullBody(ctx: CanvasRenderingContext2D, p: Paint, L: number, W: number, taper = 0.9) {
  const hw = W * 0.37;
  ctx.beginPath();
  ctx.moveTo(-L / 2, -hw); ctx.lineTo(L / 2 - taper, -hw); ctx.lineTo(L / 2, -hw * 0.6);
  ctx.lineTo(L / 2, hw * 0.6); ctx.lineTo(L / 2 - taper, hw); ctx.lineTo(-L / 2, hw); ctx.closePath();
  ctx.fillStyle = p.base; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.07; ctx.stroke();
}

function teamPanel(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number) {
  ctx.fillStyle = TEAM_COLORS[u.team];
  ctx.fillRect(x - 0.28, y - 0.18, 0.56, 0.36);
}

function drawTurret(ctx: CanvasRenderingContext2D, u: Unit, p: Paint, f: SpriteFlags, barrels = 1) {
  const t = u.def.sprite.turret;
  if (!t) return;
  ctx.save();
  ctx.translate(t.x, 0);
  ctx.rotate(u.turretAngle - u.heading);
  const recoil = u.recoil * 0.35;
  // Barrel(s)
  ctx.fillStyle = p.metal;
  if (barrels === 1) {
    ctx.fillRect(t.radius * 0.4 - recoil, -t.gunWidth / 2, t.gunLength - recoil, t.gunWidth);
    if (t.brake) ctx.fillRect(t.radius * 0.4 + t.gunLength - recoil - 0.45, -t.gunWidth * 0.9, 0.45, t.gunWidth * 1.8);
    else if (t.gunLength > 3) { ctx.fillStyle = '#2a2b27'; ctx.fillRect(t.radius * 0.4 + t.gunLength * 0.6 - recoil, -t.gunWidth * 0.75, 0.5, t.gunWidth * 1.5); }
    // Thermal sleeve / mantlet
    ctx.fillStyle = p.dark;
    ctx.fillRect(t.radius * 0.2, -t.gunWidth * 1.2, t.radius * 0.55, t.gunWidth * 2.4);
  } else {
    const gap = Math.max(0.28, t.radius * 0.35);
    const rows = barrels === 4 ? [-1.5, -0.5, 0.5, 1.5] : barrels === 2 ? [-0.5, 0.5] : [0];
    for (const r of rows) ctx.fillRect(t.radius * 0.2 - recoil, r * gap - t.gunWidth / 2, t.gunLength - recoil, t.gunWidth);
  }
  // Turret body
  ctx.fillStyle = p.base;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.07;
  const r = t.radius;
  ctx.beginPath();
  switch (t.shape) {
    case 'round': ctx.ellipse(0, 0, r * 1.05, r * 0.95, 0, 0, 6.3); break;
    case 'wide': ctx.ellipse(-0.1, 0, r * 1.25, r * 1.05, 0, 0, 6.3); break;
    case 'low': ctx.ellipse(0, 0, r * 1.15, r * 0.85, 0, 0, 6.3); break;
    case 'box': rrect(ctx, -r * 1.1, -r * 1.0, r * 2.2, r * 2.0, r * 0.25); break;
    case 'cupola': ctx.arc(0, 0, r, 0, 6.3); break;
  }
  ctx.fill(); ctx.stroke();
  // Highlight + hatches
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.25, r * 0.6, r * 0.4, 0, 0, 6.3); ctx.fill();
  if (t.shape !== 'box') {
    ctx.fillStyle = p.dark;
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.35, r * 0.28, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.35, r * 0.4, r * 0.2, 0, 6.3); ctx.fill();
  }
  teamPanel(ctx, u, -r * 0.55, 0);
  ctx.restore();
}

function drawTank(ctx: CanvasRenderingContext2D, u: Unit, f: SpriteFlags) {
  const s = u.def.sprite, p = paintFor(u.def);
  const L = s.length, W = s.width;
  // Soft drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; rrect(ctx, -L / 2 + 0.2, -W / 2 + 0.25, L, W, 0.4); ctx.fill();
  drawTracks(ctx, p, L, W, f, u.id * 0.37 + (u.mob.moving ? f.time * u.speed * 0.7 : 0));
  hullBody(ctx, p, L, W);
  patches(ctx, u, p, L, W);
  // Engine deck grille
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.06;
  for (let i = 0; i < 4; i++) { const x = -L / 2 + 0.3 + i * 0.22; ctx.beginPath(); ctx.moveTo(x, -W * 0.25); ctx.lineTo(x, W * 0.25); ctx.stroke(); }
  if (s.extras?.includes('skirts')) { ctx.fillStyle = p.dark; ctx.fillRect(-L / 2 + 0.6, -W / 2 + 0.02, L - 1.4, 0.18); ctx.fillRect(-L / 2 + 0.6, W / 2 - 0.2, L - 1.4, 0.18); }
  if (s.extras?.includes('stowage')) { ctx.fillStyle = p.dark; ctx.fillRect(-L / 2 + 0.1, -W * 0.33, 0.5, W * 0.66); ctx.fillStyle = '#5b5a44'; ctx.fillRect(-L / 2 + 0.7, W * 0.26, 0.9, 0.35); }
  if (s.extras?.includes('snorkel')) { ctx.fillStyle = p.metal; ctx.fillRect(-L / 2 + 0.05, -0.2, 0.6, 0.4); }
  if (s.extras?.includes('float')) { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.1; ctx.strokeRect(-L / 2 + 0.3, -W * 0.34, L - 1.2, W * 0.68); }
  drawTurret(ctx, u, p, f);
  if (s.extras?.includes('ir')) { // IR searchlight on the mantlet
    ctx.save(); ctx.translate(s.turret?.x ?? 0, 0); ctx.rotate(u.turretAngle - u.heading);
    ctx.fillStyle = '#2a2c28'; ctx.fillRect((s.turret?.radius ?? 1) * 0.5, -(s.turret?.radius ?? 1) * 0.75, 0.55, 0.4); ctx.restore();
  }
}

function drawApc(ctx: CanvasRenderingContext2D, u: Unit, f: SpriteFlags) {
  const s = u.def.sprite, p = paintFor(u.def);
  const L = s.length, W = s.width;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; rrect(ctx, -L / 2 + 0.2, -W / 2 + 0.25, L, W, 0.4); ctx.fill();
  if (s.tracks) drawTracks(ctx, p, L, W, f, u.id * 0.37 + (u.mob.moving ? f.time * u.speed * 0.7 : 0));
  ctx.beginPath();
  const hw = s.tracks ? W * 0.38 : W * 0.46;
  ctx.moveTo(-L / 2, -hw); ctx.lineTo(L / 2 - 1.1, -hw); ctx.lineTo(L / 2, -hw * 0.55); ctx.lineTo(L / 2, hw * 0.55); ctx.lineTo(L / 2 - 1.1, hw); ctx.lineTo(-L / 2, hw); ctx.closePath();
  ctx.fillStyle = p.base; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.07; ctx.stroke();
  patches(ctx, u, p, L, W);
  // Roof hatches
  ctx.fillStyle = p.dark;
  for (let i = 0; i < 3; i++) ctx.fillRect(-L * 0.38 + i * 0.7, -hw * 0.55, 0.5, hw * 1.1);
  if (s.extras?.includes('float')) { ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.1; ctx.strokeRect(-L / 2 + 0.25, -hw + 0.1, L - 1.2, hw * 2 - 0.2); }
  if (s.turret) drawTurret(ctx, u, p, f);
  else if (u.weapons.length) { // pintle gun
    ctx.save(); ctx.translate(-L * 0.1, 0); ctx.rotate(u.weapons[0].aim - u.heading);
    ctx.fillStyle = p.metal; ctx.fillRect(0, -0.07, 1.1, 0.14); ctx.fillStyle = p.dark; ctx.beginPath(); ctx.arc(0, 0, 0.3, 0, 6.3); ctx.fill(); ctx.restore();
    teamPanel(ctx, u, -L * 0.3, 0);
  }
}

function wheelsRow(ctx: CanvasRenderingContext2D, p: Paint, L: number, W: number, n: number, r: number, phase: number) {
  for (let i = 0; i < n; i++) {
    const x = -L * 0.38 + (i / Math.max(1, n - 1)) * L * 0.76;
    for (const y of [-W / 2 + r * 0.4, W / 2 - r * 0.4]) {
      ctx.fillStyle = '#1b1c19'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.55, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#4a4a44'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(x - r * 0.9 * Math.cos(phase), y - r * 0.45 * Math.sin(phase)); ctx.lineTo(x + r * 0.9 * Math.cos(phase), y + r * 0.45 * Math.sin(phase)); ctx.stroke();
    }
  }
}

function drawWheeled(ctx: CanvasRenderingContext2D, u: Unit, f: SpriteFlags) {
  const s = u.def.sprite, p = paintFor(u.def);
  const L = s.length, W = s.width;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; rrect(ctx, -L / 2 + 0.2, -W / 2 + 0.25, L, W, 0.4); ctx.fill();
  wheelsRow(ctx, p, L, W, s.wheels ?? 4, 0.62, f.time * u.speed * 2);
  const hw = W * 0.4;
  ctx.beginPath();
  ctx.moveTo(-L / 2, -hw); ctx.lineTo(L / 2 - 1.5, -hw); ctx.lineTo(L / 2, -hw * 0.5); ctx.lineTo(L / 2, hw * 0.5); ctx.lineTo(L / 2 - 1.5, hw); ctx.lineTo(-L / 2, hw); ctx.closePath();
  ctx.fillStyle = p.base; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.07; ctx.stroke();
  patches(ctx, u, p, L, W);
  ctx.fillStyle = p.dark; // roof hatches and engine deck
  ctx.fillRect(-L * 0.45, -hw * 0.6, 0.9, hw * 1.2);
  ctx.fillStyle = p.glass; ctx.fillRect(L * 0.18, -hw * 0.7, 0.35, hw * 1.4);
  if (s.turret) drawTurret(ctx, u, p, f);
  else if (u.weapons.length) {
    ctx.save(); ctx.translate(-L * 0.05, 0); ctx.rotate(u.weapons[0].aim - u.heading);
    ctx.fillStyle = p.metal; ctx.fillRect(0, -0.06, 1, 0.12); ctx.restore();
  }
}

function drawJeep(ctx: CanvasRenderingContext2D, u: Unit, f: SpriteFlags) {
  const s = u.def.sprite, p = paintFor(u.def);
  const L = s.length, W = s.width;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; rrect(ctx, -L / 2 + 0.1, -W / 2 + 0.15, L, W, 0.2); ctx.fill();
  wheelsRow(ctx, p, L, W, 2, 0.4, f.time * u.speed * 2);
  rrect(ctx, -L / 2, -W * 0.42, L, W * 0.84, 0.2); ctx.fillStyle = p.base; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.05; ctx.stroke();
  ctx.fillStyle = p.glass; ctx.fillRect(L * 0.1, -W * 0.38, 0.12, W * 0.76); // windscreen
  ctx.fillStyle = p.dark; ctx.fillRect(L * 0.28, -W * 0.2, L * 0.2, W * 0.4); // bonnet
  if (s.extras?.includes('launcher')) { // ATGM launcher on a pedestal
    ctx.save(); ctx.translate(-L * 0.22, 0); ctx.rotate(u.turretAngle - u.heading);
    ctx.fillStyle = p.metal; ctx.fillRect(-0.3, -0.35, 1.5, 0.28); ctx.fillRect(-0.3, 0.07, 1.5, 0.28); ctx.fillStyle = p.dark; ctx.fillRect(-0.4, -0.2, 0.5, 0.4);
    ctx.restore();
  } else if (u.weapons.length) {
    ctx.save(); ctx.translate(-L * 0.2, 0); ctx.rotate(u.weapons[0].aim - u.heading);
    ctx.fillStyle = p.metal; ctx.fillRect(0, -0.06, 1, 0.12); ctx.restore();
  }
  teamPanel(ctx, u, -L * 0.42, 0);
}

function drawAA(ctx: CanvasRenderingContext2D, u: Unit, f: SpriteFlags) {
  const s = u.def.sprite, p = paintFor(u.def);
  const L = s.length, W = s.width;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; rrect(ctx, -L / 2 + 0.2, -W / 2 + 0.25, L, W, 0.4); ctx.fill();
  drawTracks(ctx, p, L, W, f, u.id * 0.37 + (u.mob.moving ? f.time * u.speed * 0.7 : 0));
  hullBody(ctx, p, L, W, 0.7);
  patches(ctx, u, p, L, W);
  if (s.turret) drawTurret(ctx, u, p, f, 4);
  if (s.extras?.includes('radar')) { // folded/rotating radar dish on the turret
    ctx.save(); ctx.translate(s.turret?.x ?? 0, 0); ctx.rotate(u.turretAngle - u.heading + (f.time * 3 % 6.283));
    ctx.fillStyle = p.metal; ctx.beginPath(); ctx.ellipse(-0.2, 0, 0.12, (s.turret?.radius ?? 1) * 0.55, 0, 0, 6.3); ctx.fill(); ctx.restore();
  }
}

function drawGun(ctx: CanvasRenderingContext2D, u: Unit, f: SpriteFlags) {
  const s = u.def.sprite, p = paintFor(u.def);
  const L = s.length, W = s.width;
  // Trail legs and wheels
  ctx.strokeStyle = p.metal; ctx.lineWidth = 0.14;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-L * 0.55, -W * 0.45); ctx.moveTo(0, 0); ctx.lineTo(-L * 0.55, W * 0.45); ctx.stroke();
  ctx.fillStyle = '#1b1c19';
  ctx.beginPath(); ctx.ellipse(0, -W * 0.55, 0.38, 0.14, 0, 0, 6.3); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, W * 0.55, 0.38, 0.14, 0, 0, 6.3); ctx.fill();
  // Gun on the mount, rotating with its own aim
  ctx.save(); ctx.rotate((u.weapons[0]?.aim ?? u.heading) - u.heading);
  const gl = s.turret?.gunLength ?? 2;
  const rec = u.recoil * 0.3;
  ctx.fillStyle = p.metal;
  ctx.fillRect(0.2 - rec, -0.38, gl - rec, 0.1); ctx.fillRect(0.2 - rec, 0.28, gl - rec, 0.1);
  ctx.fillStyle = p.base; rrect(ctx, -0.6, -0.55, 1.1, 1.1, 0.25); ctx.fill();
  ctx.fillStyle = p.dark; ctx.fillRect(0.35, -0.7, 0.14, 1.4); // gun shield
  teamPanel(ctx, u, -0.2, 0);
  ctx.restore();
}

function drawWreckBody(ctx: CanvasRenderingContext2D, u: Unit) {
  const s = u.def.sprite;
  const L = s.length, W = s.width;
  if (s.kind === 'heli') {
    ctx.fillStyle = '#1d1c1a'; ctx.beginPath(); ctx.ellipse(0, 0, L * 0.38, W * 0.38, 0, 0, 6.3); ctx.fill();
    ctx.fillRect(-L * 0.5, -0.12, L * 0.3, 0.24);
    ctx.strokeStyle = '#2b2a27'; ctx.lineWidth = 0.18; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo((s.rotor?.radius ?? 5) * 0.9, 1.2); ctx.moveTo(0, 0); ctx.lineTo(-(s.rotor?.radius ?? 5) * 0.7, -2); ctx.stroke();
    return;
  }
  if (s.kind === 'infantry') return;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, -L / 2 + 0.2, -W / 2 + 0.25, L, W, 0.4); ctx.fill();
  ctx.fillStyle = '#26241f'; rrect(ctx, -L / 2, -W / 2, L, W, 0.35); ctx.fill();
  ctx.fillStyle = '#3a342b'; rrect(ctx, -L / 2 + 0.3, -W * 0.33, L - 0.8, W * 0.66, 0.3); ctx.fill();
  ctx.fillStyle = '#5a3a22aa';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse((rnd(u.id, i) - 0.5) * L * 0.6, (rnd(u.id, i + 4) - 0.5) * W * 0.4, 0.5, 0.35, 0, 0, 6.3); ctx.fill(); } // rust/scorch
  if (s.turret) { // blown turret, thrown slightly askew
    ctx.save(); ctx.translate(s.turret.x + (rnd(u.id, 9) - 0.5) * 1.4, (rnd(u.id, 10) - 0.5) * 1.2); ctx.rotate(rnd(u.id, 11) * 6.28);
    ctx.fillStyle = '#2d2a24'; ctx.beginPath(); ctx.ellipse(0, 0, s.turret.radius, s.turret.radius * 0.9, 0, 0, 6.3); ctx.fill();
    if (s.turret.gunLength > 1) { ctx.fillStyle = '#1e1d1a'; ctx.fillRect(0, -s.turret.gunWidth / 2, s.turret.gunLength * 0.8, s.turret.gunWidth); }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ aircraft
function drawHeli(ctx: CanvasRenderingContext2D, u: Unit, f: SpriteFlags) {
  const s = u.def.sprite, p = paintFor(u.def);
  const L = s.length, W = s.width;
  const R = s.rotor?.radius ?? 5;
  const tandem = s.rotor?.tandem;
  const spin = u.air && !u.air.landed || (u.air && u.air.landed && u.cargo.length >= 0) ? f.time * 38 + u.id : 0;

  if (tandem) {
    // Chinook-style: long box fuselage, two rear/front pylons.
    rrect(ctx, -L / 2, -W / 2, L, W, W * 0.45); ctx.fillStyle = p.base; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.1; ctx.stroke();
    ctx.fillStyle = p.dark; ctx.fillRect(-L * 0.45, -W * 0.18, L * 0.5, W * 0.36);
    ctx.fillStyle = p.glass; ctx.beginPath(); ctx.ellipse(L * 0.4, 0, L * 0.06, W * 0.3, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = p.metal; ctx.fillRect(-L * 0.55, -W * 0.12, L * 0.12, W * 0.24);
    ctx.fillStyle = p.dark; rrect(ctx, -L * 0.5, -0.5, 1.4, 1, 0.3); ctx.fill();
  } else {
    // Tail boom + tail rotor
    ctx.fillStyle = p.dark;
    ctx.beginPath(); ctx.moveTo(-L * 0.1, -0.35); ctx.lineTo(-L * 0.52, -0.16); ctx.lineTo(-L * 0.52, 0.16); ctx.lineTo(-L * 0.1, 0.35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = p.base; ctx.fillRect(-L * 0.53, -0.07, 0.9, 0.14); // fin
    // Wings with pods
    if (s.extras?.includes('wings')) {
      ctx.fillStyle = p.dark; ctx.fillRect(-0.7, -W * 0.82, 1.5, W * 1.64);
      if (s.extras.includes('pods')) { ctx.fillStyle = p.metal; for (const y of [-W * 0.7, -W * 0.45, W * 0.45, W * 0.7]) { ctx.beginPath(); ctx.ellipse(0.4, y, 0.9, 0.22, 0, 0, 6.3); ctx.fill(); } }
    }
    // Fuselage
    ctx.beginPath(); ctx.ellipse(L * 0.02, 0, L * 0.38, W * 0.5, 0, 0, 6.3);
    ctx.fillStyle = p.base; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.1; ctx.stroke();
    patches(ctx, u, p, L * 0.7, W);
    // Canopy glass
    ctx.fillStyle = p.glass; ctx.beginPath(); ctx.ellipse(L * 0.22, 0, L * 0.12, W * 0.34, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(L * 0.25, -W * 0.1, L * 0.05, W * 0.12, 0, 0, 6.3); ctx.fill();
    // Chin turret
    if (u.def.turret) {
      ctx.save(); ctx.translate(L * 0.36, 0); ctx.rotate(u.turretAngle - u.heading);
      ctx.fillStyle = p.metal; ctx.fillRect(0, -0.1, 1.5, 0.2); ctx.beginPath(); ctx.arc(0, 0, 0.4, 0, 6.3); ctx.fill(); ctx.restore();
    }
    // Tail rotor blur
    ctx.save(); ctx.translate(-L * 0.52, 0.2);
    ctx.fillStyle = 'rgba(30,30,30,0.28)'; ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, 6.3); ctx.fill(); ctx.restore();
  }
  teamPanel(ctx, u, -L * 0.15, 0);

  // Main rotor(s): translucent disc + faint spinning blades
  const rotors = tandem ? [L * 0.33, -L * 0.33] : [L * 0.03];
  rotors.forEach((rx, ri) => {
    ctx.save(); ctx.translate(rx, 0);
    ctx.fillStyle = 'rgba(40,40,40,0.13)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.3); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,20,0.22)'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.3); ctx.stroke();
    ctx.lineCap = 'round'; ctx.lineWidth = 0.22;
    const blades = s.rotor?.blades ?? 3;
    for (let b = 0; b < blades; b++) {
      const a = spin * (ri ? -1 : 1) - u.heading + (b / blades) * 6.283;
      ctx.strokeStyle = `rgba(25,25,25,${0.5 - b * 0.05})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke();
      // motion blur: trailing fainter arc
      ctx.strokeStyle = 'rgba(25,25,25,0.12)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.75, a - 0.7, a); ctx.stroke(); ctx.lineWidth = 0.22;
    }
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, 0.35, 0, 6.3); ctx.fill();
    ctx.restore();
  });
}

function drawDrone(ctx: CanvasRenderingContext2D, u: Unit, f: SpriteFlags) {
  const s = u.def.sprite, p = paintFor(u.def);
  const L = s.length, W = s.width;
  if (s.rotor) { // quadcopter
    ctx.strokeStyle = p.metal; ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.moveTo(-L / 2, -W / 2); ctx.lineTo(L / 2, W / 2); ctx.moveTo(-L / 2, W / 2); ctx.lineTo(L / 2, -W / 2); ctx.stroke();
    for (const [x, y] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      ctx.fillStyle = 'rgba(40,40,40,0.25)'; ctx.beginPath(); ctx.arc(x * L / 2, y * W / 2, s.rotor.radius, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(20,20,20,0.5)'; ctx.lineWidth = 0.06;
      const a = f.time * 50 + x * 2 + y;
      ctx.beginPath(); ctx.moveTo(x * L / 2 + Math.cos(a) * s.rotor.radius, y * W / 2 + Math.sin(a) * s.rotor.radius); ctx.lineTo(x * L / 2 - Math.cos(a) * s.rotor.radius, y * W / 2 - Math.sin(a) * s.rotor.radius); ctx.stroke();
    }
    ctx.fillStyle = p.dark; ctx.beginPath(); ctx.arc(0, 0, W * 0.2, 0, 6.3); ctx.fill();
    teamPanel(ctx, u, 0, 0);
  } else { // fixed-wing / delta
    ctx.fillStyle = p.base; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.08;
    ctx.beginPath(); ctx.moveTo(L / 2, 0); ctx.lineTo(-L * 0.3, -W / 2); ctx.lineTo(-L / 2, -W * 0.15); ctx.lineTo(-L / 2, W * 0.15); ctx.lineTo(-L * 0.3, W / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.dark; ctx.fillRect(-L * 0.1, -0.12, L * 0.5, 0.24);
    ctx.fillStyle = 'rgba(40,40,40,0.35)'; ctx.beginPath(); ctx.arc(-L * 0.5, 0, 0.45, 0, 6.3); ctx.fill(); // pusher prop blur
    teamPanel(ctx, u, 0, 0);
  }
}

// ------------------------------------------------------------------ infantry
const SLOTS: [number, number][] = [
  [0, 0], [-1.2, -1.4], [-1.2, 1.4], [-2.4, -2.6], [-2.4, 2.6], [-2.4, 0], [-3.6, -1.3], [-3.6, 1.3], [-0.2, -2.8], [-0.2, 2.8], [-4.6, 0], [-3.6, 3.8], [-3.6, -3.8],
];

function drawInfantry(ctx: CanvasRenderingContext2D, u: Unit, f: SpriteFlags) {
  const inf = u.inf!;
  const p = paintFor(u.def);
  const role = u.def.role;
  const face = u.heading;
  const cos = Math.cos(face), sin = Math.sin(face);
  const prone = inf.state === 'pinned' || inf.suppression > 55;
  const n = Math.max(1, Math.ceil(inf.men));
  const scale = 1.55; // exaggerate soldiers for readability
  const uniform = role === 'elite' ? '#4b4f36' : role === 'militia' ? '#7b7a52' : p.dark;
  for (let i = 0; i < n; i++) {
    const [ox, oy] = SLOTS[i % SLOTS.length];
    const jx = (rnd(u.id, i) - 0.5) * 0.8, jy = (rnd(u.id, i + 20) - 0.5) * 0.8;
    const lx = (ox + jx) * scale * (prone ? 0.8 : 1), ly = (oy + jy) * scale * (prone ? 0.8 : 1);
    const x = lx * cos - ly * sin, y = lx * sin + ly * cos;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(face);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0.12, 0.12, 0.5, 0.42, 0, 0, 6.3); ctx.fill();
    // weapon
    ctx.strokeStyle = '#25251f'; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
    ctx.beginPath();
    if (role === 'at' && i % 3 === 0) { ctx.moveTo(-0.5, 0.15); ctx.lineTo(1.3, 0.15); ctx.lineWidth = 0.22; }
    else if (role === 'aa' && i === 0) { ctx.moveTo(-0.6, 0); ctx.lineTo(1.5, 0); ctx.lineWidth = 0.26; }
    else if (role === 'mg' && i === 0) { ctx.moveTo(0, 0); ctx.lineTo(1.2, 0); ctx.moveTo(0.9, -0.28); ctx.lineTo(1.0, 0.28); }
    else { ctx.moveTo(0.1, 0.15); ctx.lineTo(0.95, 0.15); }
    ctx.stroke();
    // body
    ctx.fillStyle = uniform; ctx.beginPath(); ctx.ellipse(0, 0, prone ? 0.62 : 0.42, prone ? 0.3 : 0.5, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = role === 'elite' ? '#2f3322' : '#585a3c'; ctx.beginPath(); ctx.arc(0.05, 0, prone ? 0.22 : 0.28, 0, 6.3); ctx.fill();
    ctx.restore();
  }
  // Team flag
  ctx.fillStyle = TEAM_COLORS[u.team];
  ctx.beginPath(); ctx.moveTo(0, -4.2); ctx.lineTo(1.7, -3.7); ctx.lineTo(0, -3.2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(0, -4.2); ctx.lineTo(0, -2.2); ctx.stroke();
}

// ------------------------------------------------------------------ overlays
export function drawBars(ctx: CanvasRenderingContext2D, u: Unit, sx: number, sy: number, zoom: number, extra = false) {
  const k = zoom * SPRITE_SCALE;
  const w = Math.max(22, Math.min(54, Math.max(u.def.sprite.length, u.def.sprite.width) * k * 0.9));
  const y = sy - Math.max(u.def.sprite.length, u.def.sprite.width) * k * 0.5 - 8 - (u.isAir ? u.altitude * 0.1 * zoom : 0);
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(sx - w / 2 - 1, y - 1, w + 2, 5);
  const f = u.hpFrac;
  ctx.fillStyle = f > 0.6 ? '#6fd36f' : f > 0.3 ? '#e0c04a' : '#e0553f';
  ctx.fillRect(sx - w / 2, y, w * f, 3);
  if (extra && u.inf) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(sx - w / 2 - 1, y + 5, w + 2, 4);
    ctx.fillStyle = u.inf.state === 'broken' ? '#e0553f' : '#6aa8ff'; ctx.fillRect(sx - w / 2, y + 6, w * (u.inf.morale / 100), 2);
  }
}

export function drawSelection(ctx: CanvasRenderingContext2D, u: Unit, sx: number, sy: number, zoom: number, hover: boolean) {
  const k = zoom * SPRITE_SCALE;
  const r = Math.max(10, Math.max(u.def.sprite.length, u.def.sprite.width) * k * 0.58 + 2);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.strokeStyle = hover ? 'rgba(255,255,255,0.7)' : '#7dff9b';
  ctx.lineWidth = hover ? 1.2 : 1.8;
  ctx.setLineDash(hover ? [] : [5, 3]);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.stroke();
  ctx.restore();
}

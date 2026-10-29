import type { Unit } from '../sim/entity';
import { FONTS, TOKENS } from './theme/tokens';

/**
 * Top-down damage schematic (technical drawing). Each component lights bone (ok), amber (damaged)
 * or red (destroyed): hull, turret/gun, engine, tracks/wheels, crew stations. Helicopters show
 * airframe, rotor and pilots; infantry show the squad roster.
 */
type State = 0 | 1 | 2;
const COL = [TOKENS.boneDim, TOKENS.amber, TOKENS.signal];
const W = 284, H = 304;

export function drawSchematic(c: HTMLCanvasElement, u: Unit, time: number) {
  if (c.width !== W) { c.width = W; c.height = H; }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#191a15'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(232,224,200,0.06)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 16) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 16) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
  ctx.font = `15px ${FONTS.mono}`; ctx.textBaseline = 'middle';
  if (u.inf) roster(ctx, u);
  else if (u.isAir) airframe(ctx, u, time);
  else vehicle(ctx, u, time);
}

const blink = (t: number) => (Math.floor(t * 3) % 2 ? 1 : 0.45);

function tag(ctx: CanvasRenderingContext2D, x: number, y: number, s: string, st: State) {
  ctx.fillStyle = COL[st]; ctx.textAlign = 'left'; ctx.fillText(s, x, y);
}

function part(ctx: CanvasRenderingContext2D, st: State, path: () => void, fill = true) {
  ctx.beginPath(); path();
  if (fill) { ctx.fillStyle = st === 0 ? 'rgba(232,224,200,0.07)' : st === 1 ? 'rgba(233,163,26,0.28)' : 'rgba(208,48,28,0.42)'; ctx.fill(); }
  ctx.strokeStyle = COL[st]; ctx.lineWidth = 2.2; ctx.stroke();
}

function vehicle(ctx: CanvasRenderingContext2D, u: Unit, time: number) {
  const s = u.def.sprite;
  // Fit the hull to the drawing area (vertical, nose up).
  const k = Math.min(150 / s.width, 210 / s.length);
  const L = s.length * k, Wd = s.width * k, cx = 118, cy = 160;
  const hp = u.hpFrac;
  const hull: State = hp > 0.66 ? 0 : hp > 0.33 ? 1 : 2;
  const trackBroken = u.mob.immobilized && /track/i.test(u.mob.immobilizedReason);
  const tracks: State = trackBroken ? 2 : u.mob.bogged > 0 ? 1 : 0;
  const engDead = u.dmg.engine <= 0 || (u.mob.immobilized && /engine/i.test(u.mob.immobilizedReason));
  const eng: State = engDead ? 2 : u.dmg.engine < 1 || u.mob.stalled > 0 ? 1 : 0;
  const tur: State = u.dmg.gunDisabled ? 2 : u.dmg.turretJammed ? 1 : 0;

  const tw = s.tracks || s.wheels ? Wd * 0.22 : 0;
  if (tw) for (const side of [-1, 1]) {
    part(ctx, tracks, () => ctx.rect(cx + side * (Wd / 2) - (side > 0 ? tw : 0), cy - L / 2, tw, L));
    if (s.tracks) { ctx.strokeStyle = COL[tracks]; ctx.lineWidth = 1; for (let y = cy - L / 2 + 6; y < cy + L / 2; y += 8) { ctx.beginPath(); ctx.moveTo(cx + side * (Wd / 2) - (side > 0 ? tw : 0), y); ctx.lineTo(cx + side * (Wd / 2) + (side > 0 ? 0 : tw), y); ctx.stroke(); } }
  }
  const hw = Wd / 2 - tw;
  part(ctx, hull, () => { ctx.moveTo(cx - hw, cy + L / 2); ctx.lineTo(cx - hw, cy - L / 2 + 14); ctx.lineTo(cx - hw * 0.6, cy - L / 2); ctx.lineTo(cx + hw * 0.6, cy - L / 2); ctx.lineTo(cx + hw, cy - L / 2 + 14); ctx.lineTo(cx + hw, cy + L / 2); ctx.closePath(); });
  // Engine bay (rear)
  part(ctx, eng, () => ctx.rect(cx - hw * 0.8, cy + L / 2 - L * 0.24, hw * 1.6, L * 0.2));
  ctx.strokeStyle = COL[eng]; ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) { const x = cx - hw * 0.8 + (hw * 1.6 * i) / 5; ctx.beginPath(); ctx.moveTo(x, cy + L / 2 - L * 0.22); ctx.lineTo(x, cy + L / 2 - L * 0.06); ctx.stroke(); }
  // Turret + gun
  const t = s.turret;
  if (t && u.def.turret) {
    const tr = t.radius * k * 1.05, ty = cy - t.x * k;
    const rel = u.turretAngle - u.heading; // gun shows current traverse
    ctx.save(); ctx.translate(cx, ty); ctx.rotate(rel);
    part(ctx, tur === 2 ? 2 : 0, () => ctx.rect(0, -3, Math.min(110, (t.gunLength + t.radius * 0.4) * k), 6));
    ctx.restore();
    part(ctx, tur, () => ctx.arc(cx, ty, tr, 0, 6.3));
  }
  // Fire
  if (u.dmg.fire > 0) { ctx.fillStyle = `rgba(233,120,26,${0.35 * blink(time) + 0.2})`; ctx.fillRect(cx - hw, cy + L / 2 - L * 0.3, hw * 2, L * 0.3); }
  // Crew stations
  const roles = u.def.crew;
  roles.forEach((r, i) => {
    const alive = u.dmg.crew[i];
    let px = cx, py = cy;
    if (r === 'driver') { px = cx - hw * 0.45; py = cy - L / 2 + 22; }
    else if (r === 'commander') { px = cx - 14; py = cy - (t ? t.x * k : 0) - 10; }
    else if (r === 'gunner') { px = cx + 14; py = cy - (t ? t.x * k : 0) - 10; }
    else if (r === 'loader') { px = cx - 14; py = cy - (t ? t.x * k : 0) + 14; }
    else { px = cx + 14; py = cy + 18 + i * 4; }
    ctx.fillStyle = alive ? TOKENS.bone : TOKENS.signal;
    ctx.strokeStyle = TOKENS.oil; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(px - 6, py - 6, 12, 12); ctx.fill(); ctx.stroke();
    if (!alive) { ctx.strokeStyle = TOKENS.oil; ctx.beginPath(); ctx.moveTo(px - 5, py - 5); ctx.lineTo(px + 5, py + 5); ctx.moveTo(px + 5, py - 5); ctx.lineTo(px - 5, py + 5); ctx.stroke(); }
  });
  // Legend column
  const crewLost = roles.length - u.crewAlive;
  tag(ctx, 210, 30, 'HULL', hull);
  if (t && u.def.turret) tag(ctx, 210, 54, 'TUR', tur);
  tag(ctx, 210, 78, 'ENG', eng);
  if (tw) tag(ctx, 210, 102, s.tracks ? 'TRK' : 'WHL', tracks);
  if (roles.length) tag(ctx, 210, 126, 'CREW', crewLost === 0 ? 0 : crewLost < roles.length ? 1 : 2);
  ctx.fillStyle = TOKENS.boneDim; ctx.font = `12px ${FONTS.mono}`;
  ctx.fillText(`${s.length.toFixed(1)} M`, 210, 280);
}

function airframe(ctx: CanvasRenderingContext2D, u: Unit, time: number) {
  const s = u.def.sprite;
  const hp = u.hpFrac;
  const frame: State = hp > 0.66 ? 0 : hp > 0.33 ? 1 : 2;
  const cx = 110, cy = 150;
  const L = 200, Wd = s.rotor?.tandem ? 40 : 30;
  if (s.kind === 'drone') {
    part(ctx, frame, () => { ctx.moveTo(cx, cy - 70); ctx.lineTo(cx + 70, cy + 40); ctx.lineTo(cx, cy + 20); ctx.lineTo(cx - 70, cy + 40); ctx.closePath(); });
  } else {
    part(ctx, frame, () => ctx.ellipse(cx, cy - 20, Wd, L * 0.36, 0, 0, 6.3));
    part(ctx, frame, () => ctx.rect(cx - 5, cy + 40, 10, 80), false);
    const rotor: State = u.air?.landed ? 0 : frame;
    ctx.setLineDash([6, 6]);
    part(ctx, rotor, () => ctx.arc(cx, cy - 30, 88, 0, 6.3), false);
    ctx.setLineDash([]);
  }
  const fuelLow = u.mob.fuelMax > 0 && u.mob.fuel < u.mob.fuelMax * 0.2;
  const fuel: State = u.mob.fuelMax > 0 && u.mob.fuel <= 0 ? 2 : fuelLow ? 1 : 0;
  u.def.crew.forEach((r, i) => {
    const alive = u.dmg.crew[i];
    const px = cx + (i % 2 ? 9 : -9), py = cy - 80 + Math.floor(i / 2) * 22;
    ctx.fillStyle = alive ? TOKENS.bone : TOKENS.signal; ctx.strokeStyle = TOKENS.oil; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(px - 6, py - 6, 12, 12); ctx.fill(); ctx.stroke();
  });
  tag(ctx, 210, 30, 'FRAME', frame);
  tag(ctx, 210, 54, 'FUEL', fuel);
  if (u.def.crew.length) tag(ctx, 210, 78, 'CREW', u.crewAlive === u.def.crew.length ? 0 : u.crewAlive > 0 ? 1 : 2);
  ctx.fillStyle = TOKENS.amber; ctx.font = `13px ${FONTS.mono}`;
  ctx.fillText(`ALT ${String(Math.round(u.altitude)).padStart(3, '0')}`, 210, 270);
  void time;
}

function roster(ctx: CanvasRenderingContext2D, u: Unit) {
  const inf = u.inf!;
  const n = inf.maxMen, alive = Math.ceil(inf.men);
  const cols = 4;
  for (let i = 0; i < n; i++) {
    const x = 26 + (i % cols) * 44, y = 40 + Math.floor(i / cols) * 58;
    const ok = i < alive;
    const st: State = ok ? (inf.state === 'broken' ? 2 : inf.state === 'pinned' ? 1 : 0) : 2;
    ctx.strokeStyle = COL[st]; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(x + 12, y, 7, 0, 6.3); // head
    ctx.moveTo(x + 12, y + 7); ctx.lineTo(x + 12, y + 28); // body
    ctx.moveTo(x, y + 14); ctx.lineTo(x + 24, y + 14); // arms
    ctx.moveTo(x + 12, y + 28); ctx.lineTo(x + 4, y + 42); ctx.moveTo(x + 12, y + 28); ctx.lineTo(x + 20, y + 42);
    ctx.stroke();
    if (!ok) { ctx.strokeStyle = TOKENS.signal; ctx.beginPath(); ctx.moveTo(x - 2, y - 8); ctx.lineTo(x + 26, y + 44); ctx.stroke(); }
  }
  tag(ctx, 210, 30, `${alive}/${n}`, alive === n ? 0 : alive > n / 2 ? 1 : 2);
  tag(ctx, 210, 54, inf.state === 'ok' ? 'STEADY' : inf.state === 'pinned' ? 'PINNED' : 'BROKEN', inf.state === 'ok' ? 0 : inf.state === 'pinned' ? 1 : 2);
}

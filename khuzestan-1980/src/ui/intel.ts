import { SPRITE_SCALE } from '../core/constants';
import { AMMO } from '../data/ammo';
import { WEAPONS } from '../data/weapons';
import type { UnitDef } from '../data/units/types';
import { drawBody } from '../render/sprites';
import { Unit } from '../sim/entity';
import { FONTS, TOKENS } from './theme/tokens';

/**
 * Recognition dossier (intel card): typewritten sheet with a blueprint plan view (edge-traced from
 * the unit's procedural sprite), a side-profile outline, a stat block and a paper-clipped note.
 */
const FACTION = { iraq: 'IRAQ', iran: 'IRAN' } as const;

function bestPen(def: UnitDef) {
  let best = 0;
  for (const m of def.weapons) for (const a of Object.keys(m.ammo)) {
    const ad = AMMO[a];
    if (ad.pen > best && ad.kind !== 'BULLET' && ad.kind !== 'FLAK') best = ad.pen;
  }
  return best ? `${best} MM` : '—';
}

const art = new Map<string, [string, string]>();

/** Plan view: render the sprite, then keep only its edges in bone on blueprint-dark paper. */
function planView(def: UnitDef): string {
  const W = 180, H = 92;
  const src = document.createElement('canvas');
  src.width = W; src.height = H;
  const sc = src.getContext('2d')!;
  const u = new Unit(-1, def, 0, 0, 0, 0);
  const s = def.sprite;
  const span = s.kind === 'heli' && s.rotor ? Math.max(s.length, s.rotor.radius * 2) : Math.max(s.length, s.width * 1.6, 6);
  const k = Math.min((W - 30) / (span * SPRITE_SCALE), (H - 22) / (Math.max(s.width, s.rotor ? s.rotor.radius * 2 : 0, 4) * SPRITE_SCALE));
  sc.translate(W / 2, H / 2);
  sc.scale(k * SPRITE_SCALE, k * SPRITE_SCALE);
  drawBody(sc, u, { selected: false, hover: false, time: 0.3, zoom: 1, friendlyView: true });
  const img = sc.getImageData(0, 0, W, H);
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const oc = out.getContext('2d')!;
  oc.fillStyle = '#23251f'; oc.fillRect(0, 0, W, H);
  oc.strokeStyle = 'rgba(232,224,200,0.08)';
  for (let x = 0; x < W; x += 10) { oc.beginPath(); oc.moveTo(x + 0.5, 0); oc.lineTo(x + 0.5, H); oc.stroke(); }
  for (let y = 0; y < H; y += 10) { oc.beginPath(); oc.moveTo(0, y + 0.5); oc.lineTo(W, y + 0.5); oc.stroke(); }
  const o = oc.getImageData(0, 0, W, H);
  const lum = (i: number) => (img.data[i + 3] < 30 ? -100 : 0.3 * img.data[i] + 0.59 * img.data[i + 1] + 0.11 * img.data[i + 2]);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4;
    const gx = lum(i + 4) - lum(i - 4), gy = lum(i + W * 4) - lum(i - W * 4);
    const e = Math.hypot(gx, gy);
    if (e > 34) { const a = Math.min(1, e / 90); o.data[i] = 232; o.data[i + 1] = 224; o.data[i + 2] = 200; o.data[i + 3] = 255 * a; }
  }
  oc.putImageData(o, 0, 0);
  oc.fillStyle = 'rgba(232,224,200,0.75)'; oc.font = `9px ${FONTS.mono}`;
  oc.fillText('PLAN', 5, 11);
  // Dimension line
  const lpx = s.length * SPRITE_SCALE * k;
  oc.strokeStyle = 'rgba(233,163,26,0.8)'; oc.beginPath();
  oc.moveTo(W / 2 - lpx / 2, H - 7); oc.lineTo(W / 2 + lpx / 2, H - 7);
  oc.moveTo(W / 2 - lpx / 2, H - 10); oc.lineTo(W / 2 - lpx / 2, H - 4); oc.moveTo(W / 2 + lpx / 2, H - 10); oc.lineTo(W / 2 + lpx / 2, H - 4); oc.stroke();
  oc.fillStyle = TOKENS.amber; oc.textAlign = 'center'; oc.fillText(`${s.length.toFixed(1)} M`, W / 2, H - 11);
  return out.toDataURL();
}

/** Side profile: generic outline per sprite kind, scaled from the data's length/width. */
function profileView(def: UnitDef): string {
  const W = 150, H = 92;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#23251f'; x.fillRect(0, 0, W, H);
  x.strokeStyle = TOKENS.bone; x.lineWidth = 1.4; x.lineJoin = 'round';
  const s = def.sprite;
  const gy = H - 18; // ground line
  x.strokeStyle = 'rgba(232,224,200,0.25)'; x.beginPath(); x.moveTo(6, gy + 0.5); x.lineTo(W - 6, gy + 0.5); x.stroke();
  x.strokeStyle = TOKENS.bone;
  const L = Math.min(W - 26, s.kind === 'infantry' ? 40 : 110), x0 = (W - L) / 2;
  x.beginPath();
  switch (s.kind) {
    case 'tank': case 'aa': {
      const hh = L * 0.2;
      x.moveTo(x0, gy - hh * 0.4); x.lineTo(x0 + L * 0.08, gy - hh); x.lineTo(x0 + L * 0.85, gy - hh); x.lineTo(x0 + L, gy - hh * 0.5); x.lineTo(x0 + L * 0.95, gy - 2); x.lineTo(x0 + L * 0.06, gy - 2); x.closePath();
      for (let i = 0; i < 5; i++) { const cx = x0 + L * (0.15 + i * 0.175); x.moveTo(cx + L * 0.065, gy - L * 0.07); x.arc(cx, gy - L * 0.07, L * 0.065, 0, 6.3); }
      const tw = L * 0.36, tx = x0 + L * 0.3, th = L * (s.turret?.shape === 'low' ? 0.1 : 0.13);
      x.moveTo(tx, gy - hh); x.quadraticCurveTo(tx + tw * 0.5, gy - hh - th * 1.6, tx + tw, gy - hh);
      if (s.kind === 'tank' && s.turret) { x.moveTo(tx + tw * 0.8, gy - hh - th * 0.55); x.lineTo(tx + tw * 0.8 + (s.turret.gunLength / s.length) * L, gy - hh - th * 0.6); }
      else { x.moveTo(tx + tw * 0.6, gy - hh - th); x.lineTo(tx + tw * 1.3, gy - hh - th * 2.4); }
      break;
    }
    case 'apc': case 'wheeled': {
      const hh = L * 0.24;
      x.moveTo(x0, gy - hh * 0.4); x.lineTo(x0 + L * 0.05, gy - hh); x.lineTo(x0 + L * 0.8, gy - hh); x.lineTo(x0 + L, gy - hh * 0.35); x.lineTo(x0 + L, gy - 6); x.lineTo(x0, gy - 6); x.closePath();
      const n = s.wheels ?? 5;
      for (let i = 0; i < n; i++) { const cx = x0 + L * (0.14 + (i * 0.72) / Math.max(1, n - 1)); x.moveTo(cx + L * 0.06, gy - L * 0.06); x.arc(cx, gy - L * 0.06, L * 0.06, 0, 6.3); }
      if (s.turret) { x.moveTo(x0 + L * 0.42, gy - hh); x.lineTo(x0 + L * 0.48, gy - hh - L * 0.07); x.lineTo(x0 + L * 0.58, gy - hh - L * 0.07); x.lineTo(x0 + L * 0.62, gy - hh); }
      break;
    }
    case 'jeep': case 'gun': {
      x.moveTo(x0 + L * 0.1, gy - L * 0.12); x.lineTo(x0 + L * 0.2, gy - L * 0.25); x.lineTo(x0 + L * 0.85, gy - L * 0.25); x.lineTo(x0 + L * 0.9, gy - L * 0.12); x.closePath();
      for (const f of [0.25, 0.75]) { x.moveTo(x0 + L * f + L * 0.09, gy - L * 0.09); x.arc(x0 + L * f, gy - L * 0.09, L * 0.09, 0, 6.3); }
      x.moveTo(x0 + L * 0.4, gy - L * 0.25); x.lineTo(x0 + L * 0.85, gy - L * 0.42);
      break;
    }
    case 'heli': {
      const fy = gy - 22;
      x.moveTo(x0 + L * 0.65, fy - 14); x.quadraticCurveTo(x0 + L, fy - 8, x0 + L * 0.95, fy + 6); x.lineTo(x0 + L * 0.35, fy + 8); x.lineTo(x0, fy - 4); x.lineTo(x0 + L * 0.04, fy - 10); x.lineTo(x0 + L * 0.35, fy - 6); x.closePath();
      x.moveTo(x0 + L * 0.55, fy - 14); x.lineTo(x0 + L * 0.55, fy - 22); x.moveTo(x0 + L * 0.1, fy - 23); x.lineTo(x0 + L, fy - 23);
      x.moveTo(x0 + L * 0.45, fy + 8); x.lineTo(x0 + L * 0.42, gy); x.moveTo(x0 + L * 0.8, fy + 8); x.lineTo(x0 + L * 0.82, gy);
      break;
    }
    case 'drone': {
      const fy = gy - 28;
      x.moveTo(x0, fy); x.lineTo(x0 + L, fy - 3); x.lineTo(x0 + L * 0.9, fy + 5); x.lineTo(x0 + L * 0.1, fy + 6); x.closePath();
      x.moveTo(x0 + L * 0.3, fy - 2); x.lineTo(x0 + L * 0.7, fy - 2);
      break;
    }
    case 'infantry': {
      const cx = W / 2;
      x.moveTo(cx + 5, gy - 52); x.arc(cx, gy - 52, 5, 0, 6.3);
      x.moveTo(cx, gy - 47); x.lineTo(cx - 2, gy - 22); x.lineTo(cx - 8, gy); x.moveTo(cx - 2, gy - 22); x.lineTo(cx + 6, gy);
      x.moveTo(cx, gy - 40); x.lineTo(cx + 14, gy - 36); x.moveTo(cx - 6, gy - 38); x.lineTo(cx + 22, gy - 41);
      break;
    }
  }
  x.stroke();
  x.fillStyle = 'rgba(232,224,200,0.75)'; x.font = `9px ${FONTS.mono}`; x.fillText('PROFILE', 5, 11);
  return c.toDataURL();
}

function artFor(def: UnitDef): [string, string] {
  let a = art.get(def.id);
  if (!a) { a = [planView(def), profileView(def)]; art.set(def.id, a); }
  return a;
}

export function intelCardHTML(def: UnitDef): string {
  const m = def.mobility;
  const armor = def.armor?.hull;
  const tur = def.armor?.turret;
  const primary = def.weapons.find((w) => w.primary) ?? def.weapons[0];
  const w = primary ? WEAPONS[primary.weapon] : undefined;
  const rows: Array<[string, string]> = [];
  rows.push(['Side / era', `${FACTION[def.faction]} · ${def.era === 1980 ? '1980' : def.era + '+'}`]);
  rows.push(def.squad ? ['Squad', `${def.squad.men} MEN`] : ['Crew', `${def.crew.length}`]);
  if (armor) rows.push(['Armour F/S/R', `${armor.f}/${armor.s}/${armor.r} MM${tur ? ` · TURRET ${tur.f}` : ''}`]);
  if (w) rows.push(['Main weapon', `${w.name.toUpperCase()} · ${w.range} M`]);
  if (def.weapons.length) rows.push(['Penetration', bestPen(def)]);
  rows.push(['Speed', `${Math.round(m.speed * 3.6)} KM/H`]);
  rows.push(['Sight', `${def.vision.range} M · NIGHT ${Math.round(def.vision.night * 100)}%`]);
  if (m.reliability < 0.85) rows.push(['Reliability', `<b class="fict">${Math.round(m.reliability * 100)}% — BREAKDOWN RISK</b>`]);
  if (def.transport) rows.push(['Carries', `${def.transport.capacity} SQUAD${def.transport.capacity > 1 ? 'S' : ''}`]);
  rows.push(['Requisition', `${def.cost} PTS`]);
  const [plan, prof] = artFor(def);
  const fictional = /FICTION|ANACHRON/.test(def.intel.note);
  return `<div class="sheet"><div class="top"><span>RECOGNITION DOSSIER · ${def.id.toUpperCase()}</span><span>${def.category.toUpperCase()}</span></div>
    <span class="stamp ${fictional ? '' : 'ink'}">${fictional ? 'FICTIONAL TIER' : 'CONFIDENTIAL'}</span>
    <h4>${def.intel.realName}</h4><div class="role">${def.intel.role}</div>
    <div class="art"><img src="${plan}" alt=""><img src="${prof}" alt=""></div>
    <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    <div class="slip">${def.intel.note}</div></div>`;
}

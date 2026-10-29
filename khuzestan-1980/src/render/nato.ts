import { TOKENS } from '../ui/theme/tokens';
import type { UnitDef } from '../data/units/types';

/**
 * NATO-style (APP-6 inspired) unit symbols for the zoomed-out map, radar and HUD chips.
 * Frame: friendly = rectangle (ground) or dome (air); hostile = diamond (ground) or pointed dome (air).
 * Inner glyph shows the type: armour oval, infantry cross, anti-tank chevron, air-defence arc,
 * rotary wing bow-tie, drone chevron, recon slash.
 */
export function drawNato(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, def: UnitDef, hostile: boolean, alpha = 1) {
  const stroke = hostile ? TOKENS.enemy : TOKENS.friendly;
  const fill = hostile ? TOKENS.enemyFill : TOKENS.friendlyFill;
  const air = def.moveClass === 'air';
  const w = s, h = s * 0.72;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.lineJoin = 'miter';
  // Frame
  ctx.beginPath();
  if (!hostile && !air) ctx.rect(-w / 2, -h / 2, w, h);
  else if (hostile && !air) { const d = s * 0.62; ctx.moveTo(0, -d); ctx.lineTo(d, 0); ctx.lineTo(0, d); ctx.lineTo(-d, 0); ctx.closePath(); }
  else if (!hostile && air) { ctx.moveTo(-w / 2, h / 2); ctx.lineTo(-w / 2, 0); ctx.arc(0, 0, w / 2, Math.PI, 0); ctx.lineTo(w / 2, h / 2); ctx.closePath(); }
  else { ctx.moveTo(-w / 2, h / 2); ctx.lineTo(-w / 2, -h * 0.05); ctx.lineTo(0, -h * 0.75); ctx.lineTo(w / 2, -h * 0.05); ctx.lineTo(w / 2, h / 2); ctx.closePath(); }
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = TOKENS.oil; ctx.lineWidth = Math.max(2.4, s * 0.16); ctx.stroke();
  ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1.3, s * 0.09); ctx.stroke();
  // Glyph (inset box)
  const gw = s * 0.32, gh = s * 0.2;
  ctx.strokeStyle = stroke; ctx.fillStyle = stroke; ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath();
  const cat = def.category, role = def.role;
  const oval = () => { ctx.moveTo(gw, 0); ctx.ellipse(0, 0, gw, gh, 0, 0, 6.3); };
  const cross = () => { ctx.moveTo(-gw, -gh); ctx.lineTo(gw, gh); ctx.moveTo(-gw, gh); ctx.lineTo(gw, -gh); };
  const vee = () => { ctx.moveTo(-gw, gh); ctx.lineTo(0, -gh); ctx.lineTo(gw, gh); };
  const dome = () => { ctx.moveTo(-gw, gh); ctx.arc(0, gh, gw, Math.PI, 0); };
  switch (cat) {
    case 'tank': oval(); if (role === 'scout') { ctx.moveTo(-gw * 1.3, gh * 1.4); ctx.lineTo(gw * 1.3, -gh * 1.4); } break;
    case 'apc': oval(); cross(); break;
    case 'infantry':
      if (role === 'at') vee();
      else if (role === 'aa') { cross(); dome(); }
      else { cross(); if (role === 'mg') { ctx.moveTo(-gw, 0); ctx.lineTo(gw, 0); } if (role === 'elite') { ctx.moveTo(-gw, -gh * 1.6); ctx.lineTo(gw, -gh * 1.6); } }
      break;
    case 'atgm': vee(); ctx.moveTo(-gw * 0.6 + 2, gh * 1.5); ctx.arc(-gw * 0.6, gh * 1.5, 2, 0, 6.3); ctx.moveTo(gw * 0.6 + 2, gh * 1.5); ctx.arc(gw * 0.6, gh * 1.5, 2, 0, 6.3); break;
    case 'aa': dome(); ctx.moveTo(0, gh); ctx.lineTo(0, -gh * 0.2); break;
    case 'heli': ctx.moveTo(-gw, -gh); ctx.lineTo(gw, gh); ctx.lineTo(gw, -gh); ctx.lineTo(-gw, gh); ctx.closePath(); break;
    case 'drone': ctx.moveTo(-gw, -gh * 0.6); ctx.lineTo(0, gh * 0.8); ctx.lineTo(gw, -gh * 0.6); if (def.kamikaze) { ctx.moveTo(2, -gh * 0.2); ctx.arc(0, -gh * 0.2, 2, 0, 6.3); } break;
  }
  ctx.stroke();
  ctx.restore();
}

const cache = new Map<string, string>();
/** Cached data-URL of a symbol for DOM use (chips, dossiers). */
export function natoURL(def: UnitDef, hostile: boolean, size = 30): string {
  const k = `${def.id}:${hostile}:${size}`;
  let v = cache.get(k);
  if (!v) {
    const c = document.createElement('canvas');
    c.width = size * 1.6; c.height = size * 1.4;
    drawNato(c.getContext('2d')!, c.width / 2, c.height / 2, size, def, hostile);
    v = c.toDataURL();
    cache.set(k, v);
  }
  return v;
}

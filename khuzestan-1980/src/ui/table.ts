import { STARTER_MAP } from '../data/maps/starter';
import { TILE } from '../core/constants';
import { buildMap } from '../sim/mapgen';
import { coffeeRing, grainTile, paperTile, scratchTile, stainTile, weaveTile } from './theme/textures';
import { FONTS, PALETTE } from './theme/tokens';

/**
 * The command-post map table drawn procedurally: canvas-covered table, an operations map printed
 * from the real starter map (sepia, gridded, annotated in grease pencil), push-pins on the
 * Khuzestan front, a coffee ring, a pencil and an acetate overlay held with tape.
 */
let mapPrint: HTMLCanvasElement | null = null;
function printedMap(): HTMLCanvasElement {
  if (mapPrint) return mapPrint;
  const m = buildMap(STARTER_MAP);
  // Print the terrain as a map would: blank paper for open sand, inked features for everything else.
  const c = document.createElement('canvas');
  c.width = m.w * 8; c.height = m.h * 8;
  const x = c.getContext('2d')!;
  const px = c.width / (m.w * TILE);
  const img = x.createImageData(c.width, c.height);
  const ink: Record<number, [number, number, number, number]> = {
    1: [120, 100, 70, 150], // road
    2: [110, 130, 100, 120], // marsh
    3: [96, 128, 140, 210], // canal
    4: [60, 50, 40, 230], // bridge
    5: [100, 120, 70, 90], // grove
    6: [60, 55, 45, 200], // building
    7: [110, 100, 90, 140],
    8: [80, 60, 40, 200],
    9: [190, 160, 110, 70], // dune
  };
  for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
    const t = m.get(Math.floor(xx / (TILE * px)), Math.floor(y / (TILE * px)));
    const col = ink[t];
    if (!col) continue;
    const o = (y * c.width + xx) * 4;
    img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = col[3];
  }
  x.putImageData(img, 0, 0);
  // Marsh symbol: short reed strokes.
  x.strokeStyle = 'rgba(60,80,55,0.6)'; x.lineWidth = 1;
  for (let ty = 0; ty < m.h; ty += 2) for (let tx = (ty / 2) % 2; tx < m.w; tx += 2) {
    if (m.get(tx, ty) !== 2) continue;
    const cx = (tx + 0.5) * TILE * px, cy = (ty + 0.5) * TILE * px;
    x.beginPath(); x.moveTo(cx - 4, cy); x.lineTo(cx + 4, cy); x.moveTo(cx - 2, cy - 3); x.lineTo(cx - 2, cy); x.moveTo(cx + 2, cy - 3); x.lineTo(cx + 2, cy); x.stroke();
  }
  // Contour-ish hatching for groves and towns as a print would show them.
  x.fillStyle = 'rgba(40,40,30,0.55)';
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
    const t = m.get(tx, ty);
    if (t === 6) x.fillRect(tx * TILE * px + 1, ty * TILE * px + 1, TILE * px - 2, TILE * px - 2);
    else if (t === 5 && (tx + ty) % 2 === 0) { x.beginPath(); x.arc((tx + 0.5) * TILE * px, (ty + 0.5) * TILE * px, 2.2, 0, 6.3); x.fill(); }
  }
  mapPrint = c;
  return c;
}

export interface TableLayout { map: { x: number; y: number; w: number; h: number; rot: number } }

export function drawTable(canvas: HTMLCanvasElement): TableLayout {
  const W = window.innerWidth, H = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Table: olive canvas cover over steel, stained and worn.
  ctx.fillStyle = '#343424'; ctx.fillRect(0, 0, W, H);
  const pat = (t: HTMLCanvasElement, a: number) => { ctx.globalAlpha = a; ctx.fillStyle = ctx.createPattern(t, 'repeat')!; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; };
  pat(weaveTile(), 1); pat(stainTile(), 1); pat(scratchTile(), 0.6); pat(grainTile(256, 50, 5), 1);
  // Table edge
  ctx.fillStyle = PALETTE.oil; ctx.fillRect(0, H - 14, W, 14); ctx.fillRect(0, 0, W, 6);

  // Operations map sheet
  const mw = Math.min(W * 0.74, (H * 0.86) * 1.5), mh = mw / 1.5 + 70;
  const mx = W * 0.47 - mw / 2, my = H * 0.5 - mh / 2 - 4, rot = -0.018;
  ctx.save();
  ctx.translate(mx + mw / 2, my + mh / 2); ctx.rotate(rot); ctx.translate(-mw / 2, -mh / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(9, 11, mw, mh); // hard shadow on the table
  ctx.fillStyle = PALETTE.paper; ctx.fillRect(0, 0, mw, mh);
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.6;
  ctx.fillStyle = ctx.createPattern(paperTile(), 'repeat')!; ctx.fillRect(0, 0, mw, mh);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // Printed terrain inside a neat line
  const ix = 34, iy = 46, iw = mw - 68, ih = iw / 1.5;
  ctx.drawImage(printedMap(), ix, iy, iw, ih);
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.45; ctx.fillStyle = ctx.createPattern(paperTile(), 'repeat')!; ctx.fillRect(ix, iy, iw, ih); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 2; ctx.strokeRect(ix, iy, iw, ih);
  // 1 km grid with margin numbers
  const sx = iw / (192 * TILE), sy = ih / (128 * TILE);
  ctx.strokeStyle = 'rgba(40,35,25,0.45)'; ctx.lineWidth = 1;
  ctx.font = `10px ${FONTS.mono}`; ctx.fillStyle = PALETTE.ink; ctx.textAlign = 'center';
  for (let k = 0, gx = 0; gx <= 192 * TILE; gx += 500, k++) { ctx.beginPath(); ctx.moveTo(ix + gx * sx, iy); ctx.lineTo(ix + gx * sx, iy + ih); ctx.stroke(); ctx.fillText(String(31 + k).padStart(2, '0'), ix + gx * sx, iy - 6); }
  for (let k = 0, gy = 0; gy <= 128 * TILE; gy += 500, k++) { ctx.beginPath(); ctx.moveTo(ix, iy + gy * sy); ctx.lineTo(ix + iw, iy + gy * sy); ctx.stroke(); ctx.fillText(String(64 - k).padStart(2, '0'), ix - 14, iy + gy * sy + 3); }
  // Title block
  ctx.textAlign = 'left';
  ctx.font = `700 20px ${FONTS.stencilHeavy}`; ctx.fillStyle = PALETTE.ink;
  ctx.fillText('KHUZESTAN 1980', ix, 30);
  ctx.font = `12px ${FONTS.type}`; ctx.fillText('SHEET 7 · KARKHEH–KARUN PLAIN · 1:50 000 · EDITION 2 (UNREVISED)', ix + 210, 29);
  ctx.textAlign = 'right'; ctx.font = `11px ${FONTS.mono}`; ctx.fillText('SERIES K501 · CONFIDENTIAL', ix + iw, 29);

  const P = (tx: number, ty: number): [number, number] => [ix + tx * TILE * sx, iy + ty * TILE * sy];
  // Frontier (dashed) and grease-pencil axes of advance
  ctx.setLineDash([10, 6]); ctx.strokeStyle = 'rgba(30,26,20,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); const f0 = P(36, 0), f1 = P(30, 128); ctx.moveTo(...f0); ctx.lineTo(...f1); ctx.stroke(); ctx.setLineDash([]);
  greaseArrow(ctx, [P(14, 64), P(50, 62), P(82, 64), P(118, 64), P(140, 65)], '#1d1b16', 7);
  greaseArrow(ctx, [P(20, 40), P(60, 34), P(96, 30), P(122, 23)], '#1d1b16', 5);
  greaseArrow(ctx, [P(182, 70), P(160, 74), P(146, 70)], PALETTE.signal, 6);
  greaseArrow(ctx, [P(178, 50), P(140, 40), P(128, 28)], PALETTE.signal, 4.5);
  // Pencilled notes
  ctx.save(); ctx.font = `16px ${FONTS.type}`; ctx.fillStyle = 'rgba(30,28,22,0.85)'; ctx.textAlign = 'left';
  const n1 = P(86, 54); ctx.translate(n1[0], n1[1]); ctx.rotate(-0.08); ctx.fillText('BRIDGE — HOLD!', 0, 0); ctx.restore();
  ctx.save(); ctx.font = `15px ${FONTS.type}`; ctx.fillStyle = 'rgba(160,30,20,0.85)';
  const n2 = P(150, 84); ctx.translate(n2[0], n2[1]); ctx.rotate(0.05); ctx.fillText('ARMD RESERVE?', 0, 0); ctx.restore();
  // Push-pins on the objectives
  const pins: Array<[number, number, string]> = [[82, 64, PALETTE.signal], [126, 21, PALETTE.amber], [147, 65, PALETTE.signal], [62, 101, PALETTE.bone], [14, 64, PALETTE.bone], [178, 64, PALETTE.signal]];
  for (const [tx, ty, col] of pins) pin(ctx, ...P(tx, ty), col);
  // Acetate overlay with tape corners
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(ix + iw * 0.18, iy - 10, iw * 0.6, ih * 0.75);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.strokeRect(ix + iw * 0.18, iy - 10, iw * 0.6, ih * 0.75);
  tape(ctx, ix + iw * 0.18 - 20, iy - 18, 56, 18, -0.4);
  tape(ctx, ix + iw * 0.78 - 30, iy - 18, 56, 18, 0.35);
  ctx.restore();

  // Coffee ring, pencil, paper clip
  ctx.drawImage(coffeeRing(220, 31), mx + mw * 0.68, my + mh * 0.52, 190, 190);
  ctx.drawImage(coffeeRing(160, 37), mx - 70, my + mh - 120, 130, 130);
  pencil(ctx, mx + mw * 0.6, my + mh + 6, 0.12);
  return { map: { x: mx, y: my, w: mw, h: mh, rot } };
}

function greaseArrow(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, col: string, w: number) {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [k, a] of [[1, 0.85], [0.45, 0.5]] as const) { // waxy double pass
    ctx.lineWidth = w * k; ctx.globalAlpha = a;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.5 + (i % 2 ? 4 : -4), y0 + (y1 - y0) * 0.5 + (i % 2 ? -3 : 3), x1, y1);
    }
    ctx.stroke();
  }
  const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2];
  const a = Math.atan2(ay - by, ax - bx), s = w * 3.4;
  ctx.globalAlpha = 0.9; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(ax - Math.cos(a - 0.5) * s, ay - Math.sin(a - 0.5) * s); ctx.lineTo(ax, ay); ctx.lineTo(ax - Math.cos(a + 0.5) * s, ay - Math.sin(a + 0.5) * s); ctx.stroke();
  ctx.restore();
}

function pin(ctx: CanvasRenderingContext2D, x: number, y: number, col: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 5, y + 5, 7, 5, 0, 0, 6.3); ctx.fill();
  ctx.strokeStyle = '#777'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y + 4); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x - 1, y - 2, 6.5, 0, 6.3); ctx.fill();
  ctx.strokeStyle = PALETTE.oil; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x - 3, y - 4, 2, 0, 6.3); ctx.fill();
}

function tape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number) {
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(222,212,170,0.82)'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function pencil(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(6, 7, 300, 14);
  ctx.fillStyle = PALETTE.brass; ctx.fillRect(0, 0, 250, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 9, 250, 5);
  ctx.fillStyle = '#7f7a6c'; ctx.fillRect(250, 0, 22, 14); // ferrule
  ctx.fillStyle = '#9c5a4a'; ctx.fillRect(272, 1, 18, 12); // eraser
  ctx.fillStyle = '#e1caa0'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, 7); ctx.lineTo(0, 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PALETTE.graphite; ctx.beginPath(); ctx.moveTo(-20, 4.7); ctx.lineTo(-30, 7); ctx.lineTo(-20, 9.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PALETTE.ink; ctx.font = `9px ${FONTS.mono}`; ctx.fillText('HB · 2 · FIELD ISSUE', 60, 10);
  ctx.restore();
}

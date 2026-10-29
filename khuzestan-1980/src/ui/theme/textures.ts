/**
 * Procedural surface textures (no image assets). Each generator paints a tile on a canvas;
 * installTextures() publishes them as CSS custom properties (--tex-*) that the stylesheet layers
 * over flat token colours. ":root.clean" (clean-HUD toggle) blanks them all.
 */
import { Rng } from '../../core/rng';
import { vnoise } from '../../sim/mapgen';

function tile(w: number, h: number, paint: (ctx: CanvasRenderingContext2D, r: Rng) => void, seed = 7) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d')!, new Rng(seed));
  return c;
}

/** Fine luminance noise, transparent: film/paper grain. */
export function grainTile(size = 256, strength = 46, seed = 3) {
  return tile(size, size, (ctx, r) => {
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r.next() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = r.next() * strength;
    }
    ctx.putImageData(img, 0, 0);
  }, seed);
}

/** Paper: mottling, fibres and a few foxing spots. */
export function paperTile(size = 320) {
  return tile(size, size, (ctx, r) => {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const n = vnoise(x * 0.03, y * 0.03, 5) * 0.6 + vnoise(x * 0.12, y * 0.12, 9) * 0.4;
      const o = (y * size + x) * 4;
      const dark = n < 0.5;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = dark ? 60 : 255;
      img.data[o + 3] = Math.abs(n - 0.5) * 70 + r.next() * 14;
    }
    ctx.putImageData(img, 0, 0);
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 260; i++) { // fibres
      ctx.strokeStyle = `rgba(80,65,40,${0.05 + r.next() * 0.08})`;
      const x = r.next() * size, y = r.next() * size, a = r.next() * 6.28, l = 3 + r.next() * 9;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    for (let i = 0; i < 6; i++) { // foxing
      ctx.fillStyle = `rgba(120,80,30,${0.05 + r.next() * 0.06})`;
      ctx.beginPath(); ctx.arc(r.next() * size, r.next() * size, 1 + r.next() * 4, 0, 6.3); ctx.fill();
    }
  }, 11);
}

/** Brushed / weathered metal streaks. */
export function brushTile(size = 256) {
  return tile(size, size, (ctx, r) => {
    for (let i = 0; i < 700; i++) {
      const y = r.next() * size, x = r.next() * size, l = 20 + r.next() * 120;
      ctx.strokeStyle = r.next() < 0.5 ? `rgba(255,255,255,${r.next() * 0.06})` : `rgba(0,0,0,${r.next() * 0.08})`;
      ctx.lineWidth = r.next() * 1.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + (r.next() - 0.5) * 2); ctx.stroke();
    }
    const img = ctx.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { // paint wear blotches
      const n = vnoise(x * 0.05, y * 0.05, 21);
      if (n > 0.72) { const o = (y * size + x) * 4; img.data[o] = 30; img.data[o + 1] = 26; img.data[o + 2] = 18; img.data[o + 3] = Math.max(img.data[o + 3], (n - 0.72) * 300); }
    }
    ctx.putImageData(img, 0, 0);
  }, 13);
}

/** Scratches, chips and dents on painted plate. */
export function scratchTile(size = 300) {
  return tile(size, size, (ctx, r) => {
    for (let i = 0; i < 70; i++) {
      const x = r.next() * size, y = r.next() * size, a = r.next() * 6.28, l = 6 + r.next() * 50;
      ctx.strokeStyle = `rgba(235,228,205,${0.1 + r.next() * 0.25})`;
      ctx.lineWidth = 0.5 + r.next() * 0.8;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l * 0.5 + (r.next() - 0.5) * 4, y + Math.sin(a) * l * 0.5 + (r.next() - 0.5) * 4);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 1 + Math.cos(a) * l, y + 1 + Math.sin(a) * l); ctx.stroke();
    }
    for (let i = 0; i < 25; i++) { // paint chips showing primer
      ctx.fillStyle = `rgba(30,25,18,${0.2 + r.next() * 0.3})`;
      const x = r.next() * size, y = r.next() * size;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28, rr = 1 + r.next() * 3; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.fill();
    }
  }, 17);
}

/** Oil / water stains with darker tide-lines. */
export function stainTile(size = 384) {
  return tile(size, size, (ctx, r) => {
    for (let i = 0; i < 5; i++) {
      const x = r.next() * size, y = r.next() * size, rad = 20 + r.next() * 60;
      ctx.fillStyle = `rgba(40,30,15,${0.04 + r.next() * 0.05})`;
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) { const a = (k / 24) * 6.28, rr = rad * (0.75 + vnoise(k * 0.4, i, 3) * 0.5); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.fill();
      ctx.strokeStyle = `rgba(60,40,15,${0.08 + r.next() * 0.06})`; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }, 19);
}

/** Woven canvas (webbing, map case). */
export function weaveTile(size = 48) {
  return tile(size, size, (ctx, r) => {
    for (let y = 0; y < size; y += 3) { ctx.fillStyle = `rgba(0,0,0,${0.06 + r.next() * 0.05})`; ctx.fillRect(0, y, size, 1); }
    for (let x = 0; x < size; x += 3) { ctx.fillStyle = `rgba(255,255,255,${0.04 + r.next() * 0.04})`; ctx.fillRect(x, 0, 1, size); }
  }, 23);
}

/** Coffee-cup ring stain. */
export function coffeeRing(size = 220, seed = 29) {
  return tile(size, size, (ctx, r) => {
    const c = size / 2;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(110,60,20,${0.18 - i * 0.04})`;
      ctx.lineWidth = 3 + r.next() * 4;
      ctx.beginPath();
      for (let k = 0; k <= 60; k++) {
        const a = (k / 60) * 6.283, rr = c * (0.7 + i * 0.05) + vnoise(k * 0.3, i * 3, 7) * 6;
        if (k > 50 && i === 0) break; // broken ring
        ctx.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120,70,25,0.05)'; ctx.beginPath(); ctx.arc(c, c, c * 0.68, 0, 6.3); ctx.fill();
  }, seed);
}

/** Rivet / screw head (tiny tile used in plate corners). */
export function rivetTile(size = 14, slot = false) {
  return tile(size, size, (ctx) => {
    const c = size / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(c + 0.8, c + 0.8, c - 2, 0, 6.3); ctx.fill();
    const g = ctx.createRadialGradient(c - 1.5, c - 1.5, 0.5, c, c, c - 2);
    g.addColorStop(0, '#d8d2c0'); g.addColorStop(0.5, '#8d887a'); g.addColorStop(1, '#3e3b33');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c - 2.5, 0, 6.3); ctx.fill();
    if (slot) { ctx.strokeStyle = '#2a2822'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(c - 3, c + 2); ctx.lineTo(c + 3, c - 2); ctx.stroke(); }
  });
}

const urls = new Map<string, string>();
const url = (k: string, c: () => HTMLCanvasElement) => { if (!urls.has(k)) urls.set(k, c().toDataURL()); return urls.get(k)!; };

/** Publishes textures as CSS variables (and a clean-HUD override). */
export function installTextures() {
  const tex: Record<string, string> = {
    grain: url('grain', () => grainTile()),
    paper: url('paper', () => paperTile()),
    brush: url('brush', () => brushTile()),
    scratch: url('scratch', () => scratchTile()),
    stain: url('stain', () => stainTile()),
    weave: url('weave', () => weaveTile()),
    coffee: url('coffee', () => coffeeRing()),
    rivet: url('rivet', () => rivetTile()),
    screw: url('screw', () => rivetTile(16, true)),
  };
  let style = document.getElementById('tex-vars') as HTMLStyleElement | null;
  if (!style) { style = document.createElement('style'); style.id = 'tex-vars'; document.head.appendChild(style); }
  const on = Object.entries(tex).map(([k, v]) => `--tex-${k}: url(${v});`).join('\n');
  const off = Object.keys(tex).filter((k) => k !== 'rivet' && k !== 'screw').map((k) => `--tex-${k}: none;`).join('\n');
  style.textContent = `:root{${on}}\n:root.clean{${off}}`;
}

/** Shared canvas grain tile for the post-effects layer. */
export const grainCanvas = () => grainTile(256, 60, 41);

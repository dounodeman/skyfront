import { PRESETS, UNIT_CAPS } from '../data/aiPresets';
import type { UnitCategory, UnitDef } from '../data/units/types';
import type { Rng } from '../core/rng';
import type { ForceEntry } from './setup';

/**
 * Spends `budget` points on a roster following a preset's category weights.
 * Each category gets its share; leftovers are spent on whatever still fits.
 */
export function buildForce(roster: UnitDef[], budget: number, presetId: string, rng: Rng): ForceEntry[] {
  const preset = PRESETS[presetId] ?? PRESETS.balanced;
  const counts = new Map<string, number>();
  const cap = (d: UnitDef) => UNIT_CAPS[d.id] ?? 8;
  let left = budget;
  const buy = (d: UnitDef) => { counts.set(d.id, (counts.get(d.id) ?? 0) + 1); left -= d.cost; };
  const fits = (d: UnitDef, money: number) => d.cost <= money && (counts.get(d.id) ?? 0) < cap(d);

  const cats = Object.entries(preset.weights) as [UnitCategory, number][];
  const totalW = cats.reduce((s, [, v]) => s + v, 0);
  for (const [cat, wgt] of cats) {
    let share = (budget * wgt) / totalW;
    const opts = roster.filter((d) => d.category === cat);
    if (!opts.length) continue;
    for (let guard = 0; guard < 40; guard++) {
      const ok = opts.filter((d) => fits(d, Math.min(share + 25, left)));
      if (!ok.length) break;
      // Prefer the cheaper "workhorse" types a little so forces look plausible (lots of T-55s, few T-72s).
      const pick = weightedPick(ok, (d) => 1 / Math.sqrt(d.cost), rng);
      buy(pick); share -= pick.cost;
    }
  }
  // Spend the remainder on infantry first, then anything.
  for (let guard = 0; guard < 60 && left > 0; guard++) {
    const ok = roster.filter((d) => fits(d, left) && d.category === 'infantry');
    const any = ok.length ? ok : roster.filter((d) => fits(d, left));
    if (!any.length) break;
    buy(weightedPick(any, () => 1, rng));
  }
  return [...counts.entries()].map(([defId, count]) => ({ defId, count }));
}

function weightedPick<T>(xs: T[], wf: (x: T) => number, rng: Rng): T {
  const ws = xs.map(wf);
  let r = rng.next() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < xs.length; i++) { r -= ws[i]; if (r <= 0) return xs[i]; }
  return xs[xs.length - 1];
}

export const forceCost = (f: ForceEntry[], roster: UnitDef[]) => f.reduce((s, e) => s + (roster.find((d) => d.id === e.defId)?.cost ?? 0) * e.count, 0);

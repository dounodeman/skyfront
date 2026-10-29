/**
 * Headless battle runner for balance checks: `npm run sim -- <defA> <nA> <defB> <nB> [rangeM] [seconds] [runs]`
 * Lines up two groups facing each other on open sand and lets them fight. Prints survivors and kill stats.
 */
import { TILE } from '../src/core/constants';
import { T } from '../src/data/terrain';
import { buildMap } from '../src/sim/mapgen';
import { defaultSystems } from '../src/sim/systems';
import { World } from '../src/sim/world';
import type { MapDef } from '../src/data/maps/types';

const [a = 'iq_t55', na = '3', b = 'iq_t55', nb = '3', range = '900', secs = '120', runs = '10'] = process.argv.slice(2);
const flat: MapDef = { id: 'flat', name: 'flat', description: '', seed: 1, ops: [{ op: 'fill', t: T.Sand, rect: [0, 0, 191, 127] }], objectives: [], spawn: { iraq: [0, 0, 1, 1], iran: [0, 0, 1, 1] }, depot: { iraq: [0, 0], iran: [0, 0] } };

let winsA = 0, winsB = 0, survA = 0, survB = 0;
const notes: Record<string, number> = {};
for (let r = 0; r < Number(runs); r++) {
  const w = new World(buildMap(flat), [
    { id: 0, faction: 'iraq', name: 'A', tickets: 1, ticketsMax: 1, isHuman: false },
    { id: 1, faction: 'iran', name: 'B', tickets: 1, ticketsMax: 1, isHuman: false },
  ], 100 + r);
  w.systems = defaultSystems();
  w.bus.on('status', (e) => { notes[e.text] = (notes[e.text] ?? 0) + 1; });
  const cx = 96 * TILE, cy = 64 * TILE, R = Number(range);
  for (let i = 0; i < Number(na); i++) w.spawn(a, 0, cx - R / 2, cy + (i - Number(na) / 2) * 30, 0);
  for (let i = 0; i < Number(nb); i++) w.spawn(b, 1, cx + R / 2, cy + (i - Number(nb) / 2) * 30, Math.PI);
  const steps = Number(secs) * 30;
  for (let s = 0; s < steps; s++) w.step();
  const la = w.units.filter((u) => u.team === 0 && u.alive).length, lb = w.units.filter((u) => u.team === 1 && u.alive).length;
  survA += la; survB += lb;
  if (la && !lb) winsA++; else if (lb && !la) winsB++;
}
console.log(`${a} x${na} vs ${b} x${nb} @ ${range} m, ${secs}s, ${runs} runs`);
console.log(`wins A ${winsA} / B ${winsB} · avg survivors A ${(survA / Number(runs)).toFixed(1)} B ${(survB / Number(runs)).toFixed(1)}`);
console.log('events:', JSON.stringify(notes));

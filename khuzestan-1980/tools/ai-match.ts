/** Headless AI-vs-AI skirmish on the starter map: `npm run aimatch -- [budget] [minutes] [seed]` */
import { STARTER_MAP } from '../src/data/maps/starter';
import { rosterFor } from '../src/data/units';
import { Rng } from '../src/core/rng';
import { AIController } from '../src/sim/ai';
import { buildForce } from '../src/sim/forcebuilder';
import { createWorld } from '../src/sim/setup';

const [budget = '1500', minutes = '20', seed = '3'] = process.argv.slice(2);
const rng = new Rng(Number(seed));
const pf = buildForce(rosterFor('iraq', 1980), Number(budget), 'balanced', rng);
const ef = buildForce(rosterFor('iran', 1980), Number(budget), 'balanced', rng);
console.log('Iraq:', pf.map((e) => `${e.count}x${e.defId}`).join(' '));
console.log('Iran:', ef.map((e) => `${e.count}x${e.defId}`).join(' '));
const w = createWorld({ map: STARTER_MAP, playerFaction: 'iraq', era: 1980, light: 0, dust: false, playerForce: pf, enemyForce: ef, seed: Number(seed) });
const a0 = new AIController(w, 0, 'normal'), a1 = new AIController(w, 1, 'normal');
w.systems.push(a0.system, a1.system);
const ev: Record<string, number> = {};
w.bus.on('message', (e) => { ev[e.text] = (ev[e.text] ?? 0) + 1; });
w.bus.on('end', (e) => console.log(`END at ${(w.time / 60).toFixed(1)} min: winner ${e.winner === null ? 'none' : w.teams[e.winner].name} – ${e.reason}`));
const t0 = Date.now();
for (let s = 0; s < Number(minutes) * 60 * 30 && !w.over; s++) {
  w.step();
  if (s % (30 * 120) === 0) {
    const c = (t: number) => w.units.filter((u) => u.team === t && u.alive).length;
    console.log(`t=${(w.time / 60).toFixed(1)}m alive ${c(0)}/${c(1)} tickets ${w.teams[0].tickets.toFixed(0)}/${w.teams[1].tickets.toFixed(0)} obj ${w.objectives.map((o) => o.owner ?? '-').join('')}`);
  }
}
console.log('messages:', JSON.stringify(ev));
console.log(`sim speed: ${(w.time / ((Date.now() - t0) / 1000)).toFixed(0)}x realtime`);
for (const u of w.units.filter((x) => x.alive)) console.log(`  team${u.team} ${u.def.id} at ${(u.x/16).toFixed(0)},${(u.y/16).toFixed(0)} hp ${u.hpFrac.toFixed(2)} task=${u.ai.task} orders=${JSON.stringify(u.orders)} imm=${u.mob.immobilized} fuel=${u.mob.fuel.toFixed(0)} inf=${u.inf?.state ?? ''} carrier=${!!u.carrier} ammo=${JSON.stringify(u.weapons[0]?.ammo)}`);

/** Headless AI-vs-AI run of the border scenario: `npx tsx tools/scenario-match.ts [seed]` */
import { BORDER_SCENARIO } from '../src/data/scenarios/border';
import { AIController } from '../src/sim/ai';
import { createScenarioWorld } from '../src/sim/scenario';

const seed = Number(process.argv[2] ?? 1);
const w = createScenarioWorld(BORDER_SCENARIO, 'iraq', seed);
w.systems.push(new AIController(w, 0, 'normal', 'attack').system, new AIController(w, 1, 'normal', 'defend').system);
w.bus.on('message', (e) => console.log(`[${(w.time / 60).toFixed(1)}m] ${e.text}`));
w.bus.on('end', (e) => console.log(`END ${(w.time / 60).toFixed(1)}m winner=${e.winner === null ? '-' : w.teams[e.winner].name}: ${e.reason}`));
while (!w.over && w.time < 25 * 60) w.step();
console.log(`losses Iraq ${w.stats.lost[0]} (${w.stats.lostValue[0]} pts) / Iran ${w.stats.lost[1]} (${w.stats.lostValue[1]} pts)`);

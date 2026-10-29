/**
 * Regenerates the unit balance table in README.md from the data files:
 *   npm run balance
 * The table sits between <!-- BALANCE:START --> and <!-- BALANCE:END -->.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { UNITS } from '../src/data/units';
import { AMMO } from '../src/data/ammo';
import { WEAPONS } from '../src/data/weapons';

const rows = Object.values(UNITS).sort((a, b) => (a.faction + a.era + a.category).localeCompare(b.faction + b.era + b.category) || b.cost - a.cost);
const best = (id: string) => {
  let pen = 0;
  for (const m of UNITS[id].weapons) for (const a of Object.keys(m.ammo)) if (AMMO[a].kind !== 'BULLET' && AMMO[a].kind !== 'FLAK') pen = Math.max(pen, AMMO[a].pen);
  return pen ? `${pen}` : '–';
};
const lines = [
  '| Unit | Side | Era | Type | Cost | HP / men | Armour F/S/R (mm) | Main weapon | Range (m) | Best pen (mm) | Speed (km/h) | Sight (m) | Night | Reliability |',
  '|---|---|---|---|---:|---:|---|---|---:|---:|---:|---:|---:|---:|',
];
for (const u of rows) {
  const w = u.weapons.find((m) => m.primary) ?? u.weapons[0];
  const wd = w ? WEAPONS[w.weapon] : undefined;
  const a = u.armor?.hull;
  lines.push(`| ${u.name} | ${u.faction === 'iraq' ? 'Iraq' : 'Iran'} | ${u.era === 1986 ? '1986+' : u.era} | ${u.category} | ${u.cost} | ${u.squad ? `${u.squad.men} men` : u.hp} | ${a ? `${a.f}/${a.s}/${a.r}` : '–'} | ${wd ? wd.name : '–'} | ${wd ? wd.range : '–'} | ${best(u.id)} | ${Math.round(u.mobility.speed * 3.6)} | ${u.vision.range} | ${Math.round(u.vision.night * 100)}% | ${Math.round(u.mobility.reliability * 100)}% |`);
}
const readme = readFileSync('README.md', 'utf8');
const start = '<!-- BALANCE:START -->', end = '<!-- BALANCE:END -->';
const out = readme.replace(new RegExp(`${start}[\\s\\S]*${end}`), `${start}\n${lines.join('\n')}\n${end}`);
writeFileSync('README.md', out);
console.log(`Wrote ${rows.length} units to README.md`);

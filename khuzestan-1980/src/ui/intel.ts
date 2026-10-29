import { AMMO } from '../data/ammo';
import { WEAPONS } from '../data/weapons';
import type { UnitDef } from '../data/units/types';

const FACTION_NAME = { iraq: 'Iraq', iran: 'Iran' } as const;

/** Best penetration among a weapon's ammunition (for the intel table). */
function bestPen(def: UnitDef) {
  let best = 0, name = '';
  for (const m of def.weapons) for (const a of Object.keys(m.ammo)) {
    const ad = AMMO[a];
    if (ad.pen > best && ad.kind !== 'BULLET' && ad.kind !== 'FLAK') { best = ad.pen; name = ad.name; }
  }
  return best ? `${best} mm (${name})` : '–';
}

/** Short in-game "intel card": real name, role, one-line historical note, plus key numbers from the data file. */
export function intelCardHTML(def: UnitDef): string {
  const m = def.mobility;
  const armor = def.armor?.hull;
  const tur = def.armor?.turret;
  const primary = def.weapons.find((w) => w.primary) ?? def.weapons[0];
  const w = primary ? WEAPONS[primary.weapon] : undefined;
  const rows: Array<[string, string]> = [];
  rows.push(['Side / era', `${FACTION_NAME[def.faction]} · ${def.era === 1980 ? '1980' : def.era + '+'}`]);
  if (def.squad) rows.push(['Squad', `${def.squad.men} men`]); else rows.push(['Crew', `${def.crew.length}`]);
  if (armor) rows.push(['Armour F/S/R', `${armor.f}/${armor.s}/${armor.r} mm${tur ? ` · turret ${tur.f} mm` : ''}`]);
  if (w) rows.push(['Main weapon', `${w.name} · ${w.range} m`]);
  if (def.weapons.length) rows.push(['Penetration', bestPen(def)]);
  rows.push(['Speed', `${Math.round(m.speed * 3.6)} km/h${def.moveClass === 'air' ? '' : ' (open ground)'}`]);
  rows.push(['Sight', `${def.vision.range} m · night ${Math.round(def.vision.night * 100)}%`]);
  if (m.reliability < 0.85) rows.push(['Reliability', `<span class="flag-warn">${Math.round(m.reliability * 100)}% – prone to breakdowns</span>`]);
  if (def.transport) rows.push(['Carries', `${def.transport.capacity} squad${def.transport.capacity > 1 ? 's' : ''}`]);
  rows.push(['Cost', `${def.cost} pts`]);
  return `<h4>${def.intel.realName}</h4><div class="role">${def.intel.role}</div>`
    + `<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`
    + `<div class="note">${def.intel.note}</div>`;
}

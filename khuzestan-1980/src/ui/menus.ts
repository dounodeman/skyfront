import { Rng } from '../core/rng';
import { PRESETS } from '../data/aiPresets';
import { rosterFor } from '../data/units';
import type { Era, FactionId, UnitCategory, UnitDef } from '../data/units/types';
import type { Difficulty } from '../sim/ai';
import { buildForce, forceCost } from '../sim/forcebuilder';
import type { ForceEntry } from '../sim/setup';
import { HELP_HTML } from '../game';
import { intelCardHTML } from './intel';

/** Settings chosen on the skirmish setup screen. */
export interface SkirmishSettings {
  faction: FactionId;
  era: Era;
  light: 0 | 1 | 2;
  dust: boolean;
  budget: number;
  difficulty: Difficulty;
}

const screens = () => document.getElementById('screens')!;
function show(html: string): HTMLElement {
  screens().innerHTML = '';
  const d = document.createElement('div');
  d.className = 'screen';
  d.innerHTML = html;
  screens().appendChild(d);
  return d;
}

export function mainMenu(actions: { skirmish: () => void; scenario: () => void; codex: () => void }) {
  const d = show(`<div class="panel menu">
    <h1>Khuzestan 1980</h1>
    <div class="tag">A top-down combined-arms tactics game · September 1980, the opening weeks of the Iran–Iraq War on the Khuzestan front.<br>
    A sober simulation of armour, infantry and helicopters fighting over flat desert, marsh, palm groves and canals.</div>
    <div class="row" style="flex-direction:column;align-items:flex-start">
      <button class="btn primary" data-a="skirmish">Skirmish vs AI</button>
      <button class="btn" data-a="scenario">Scenario: The Border Crossing</button>
      <button class="btn" data-a="codex">Intel cards (unit codex)</button>
      <button class="btn" data-a="help">Controls</button>
    </div>
    <h2>About</h2>
    <div class="kv" style="line-height:1.5">All units are drawn procedurally. Unit statistics approximate real-world characteristics (armour, gun calibre,
    speed, crew, missile range, night sights, reliability) tuned for play. The war cost hundreds of thousands of lives on both sides;
    this game depicts its equipment and tactics without glorifying it.</div>
  </div>`);
  d.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a;
    if (a === 'skirmish') actions.skirmish();
    if (a === 'scenario') actions.scenario();
    if (a === 'codex') actions.codex();
    if (a === 'help') {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.innerHTML = `<div class="panel menu"><h1 style="font-size:24px">Controls</h1>${HELP_HTML}<div class="row"><button class="btn primary">Close</button></div></div>`;
      o.querySelector('button')!.addEventListener('click', () => o.remove());
      screens().appendChild(o);
    }
  });
}

function choice<T>(label: string, key: string, opts: Array<[T, string, string?]>, cur: T) {
  return `<h2>${label}</h2><div class="row">${opts.map(([v, name, tip]) => `<button class="btn ${v === cur ? 'sel' : ''}" data-k="${key}" data-v="${String(v)}" ${tip ? `title="${tip}"` : ''}>${name}</button>`).join('')}</div>`;
}

export function skirmishSetup(s: SkirmishSettings, next: (s: SkirmishSettings) => void, back: () => void) {
  const render = () => {
    const d = show(`<div class="panel menu">
      <h1 style="font-size:26px">Skirmish setup</h1>
      <div class="tag">Map: <b>Khuzestan Plain</b> – irrigation canal with three bridges, marsh, palm groves, a village and a town. Capture objectives to drain enemy tickets.</div>
      <div class="grid2"><div>
      ${choice('Your side', 'faction', [['iraq', 'Iraq', 'Soviet-equipped mechanised forces: numerous T-55/T-62s, BMPs, Hinds'], ['iran', 'Iran', 'Western equipment: Chieftains, M60s, Cobras with TOW – plus IRGC and Basij volunteers']], s.faction)}
      ${choice('Era', 'era', [[1980, '1980'], [1984, '1984'], [1986, '1986+']], s.era)}
      <div class="kv">1980 keeps the roster historically clean. Later eras unlock the drone tech tier (recon and loitering munitions).</div>
      ${choice('Points', 'budget', [[1000, '1000'], [1500, '1500'], [2500, '2500'], [4000, '4000']], s.budget)}
      </div><div>
      ${choice('Time of day', 'light', [[0, 'Day'], [1, 'Dusk'], [2, 'Night']], s.light)}
      ${choice('Weather', 'dust', [[false, 'Clear'], [true, 'Dust storm']], s.dust)}
      ${choice('AI', 'difficulty', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], s.difficulty)}
      <div class="kv">Hard AI thinks faster, concentrates fire, calls in gunships and gets 15% more points.</div>
      </div></div>
      <div class="row" style="margin-top:18px"><button class="btn" data-a="back">Back</button><button class="btn primary" data-a="next">Choose forces →</button></div>
    </div>`);
    d.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.k) {
        const k = t.dataset.k as keyof SkirmishSettings, v = t.dataset.v!;
        (s as any)[k] = k === 'faction' || k === 'difficulty' ? v : v === 'true' ? true : v === 'false' ? false : Number(v);
        render();
      }
      if (t.dataset.a === 'next') next(s);
      if (t.dataset.a === 'back') back();
    });
  };
  render();
}

const CAT_ORDER: Array<[UnitCategory, string]> = [
  ['tank', 'Tanks'], ['apc', 'APCs & IFVs'], ['atgm', 'Anti-tank vehicles'], ['infantry', 'Infantry'], ['aa', 'Air defence'], ['heli', 'Helicopters'], ['drone', 'Drones (later-era tier)'],
];

/**
 * Points-based force purchase. Hovering a unit shows its intel card. Presets auto-fill a force.
 */
export function purchaseScreen(s: SkirmishSettings, start: (force: ForceEntry[]) => void, back: () => void) {
  const roster = rosterFor(s.faction, s.era);
  const counts = new Map<string, number>();
  const spent = () => forceCost([...counts.entries()].map(([defId, count]) => ({ defId, count })), roster);
  const d = show(`<div class="panel menu" style="width:min(1100px,96vw)">
    <h1 style="font-size:26px">Force composition – ${s.faction === 'iraq' ? 'Iraq' : 'Iran'}, ${s.era === 1986 ? '1986+' : s.era}</h1>
    <div class="purchase">
      <div class="unitlist"></div>
      <div>
        <div class="budget">Points: <b class="spent">0</b> / ${s.budget} <span class="kv left"></span></div>
        <h2>Auto-fill</h2><div class="row">${Object.entries(PRESETS).map(([id, p]) => `<button class="btn" data-preset="${id}">${p.name}</button>`).join('')}<button class="btn" data-a="clear">Clear</button></div>
        <h2>Your force</h2><div class="summary kv" style="line-height:1.6;min-height:120px"></div>
        <div class="row" style="margin-top:12px"><button class="btn" data-a="back">Back</button><button class="btn primary" data-a="start">Deploy and fight →</button></div>
        <div class="kv" style="margin-top:10px">Infantry starts mounted in your APCs and IFVs if seats are free. Your depot (west or east edge) rearms, refuels and repairs.</div>
      </div>
    </div></div>`);
  const tip = document.createElement('div');
  tip.className = 'panel tooltip';
  tip.style.display = 'none';
  d.appendChild(tip);
  const list = d.querySelector('.unitlist')!;
  for (const [cat, title] of CAT_ORDER) {
    const defs = roster.filter((u) => u.category === cat);
    if (!defs.length) continue;
    list.insertAdjacentHTML('beforeend', `<div class="urow" style="background:#1a2014;font-weight:700;color:var(--accent)">${title}</div>`);
    for (const u of defs) {
      list.insertAdjacentHTML('beforeend', `<div class="urow" data-id="${u.id}"><div>${u.name}<div class="cat">${u.intel.realName}</div></div><div>${u.cost} pts</div>
        <div class="qty"><button data-d="-1">−</button><span class="n">0</span><button data-d="1">+</button></div></div>`);
    }
  }
  const refresh = () => {
    const sp = spent();
    d.querySelector('.spent')!.textContent = String(sp);
    (d.querySelector('.spent') as HTMLElement).style.color = sp > s.budget ? 'var(--enemy)' : '';
    d.querySelector('.left')!.textContent = `(${s.budget - sp} left)`;
    for (const row of Array.from(d.querySelectorAll<HTMLElement>('.urow[data-id]'))) {
      row.querySelector('.n')!.textContent = String(counts.get(row.dataset.id!) ?? 0);
    }
    const items = [...counts.entries()].filter(([, n]) => n > 0).map(([id, n]) => `${n} × ${roster.find((r) => r.id === id)!.name}`);
    d.querySelector('.summary')!.innerHTML = items.length ? items.join('<br>') : 'Nothing bought yet.';
    (d.querySelector('[data-a=start]') as HTMLButtonElement).disabled = !items.length || sp > s.budget;
  };
  const showTip = (def: UnitDef | null, e?: MouseEvent) => {
    if (!def || !e) { tip.style.display = 'none'; return; }
    tip.innerHTML = intelCardHTML(def);
    tip.style.display = 'block';
    tip.style.left = `${Math.min(window.innerWidth - 320, e.clientX + 20)}px`;
    tip.style.top = `${Math.min(window.innerHeight - tip.offsetHeight - 10, e.clientY + 10)}px`;
  };
  d.addEventListener('mousemove', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.urow[data-id]');
    showTip(row ? roster.find((r) => r.id === row.dataset.id) ?? null : null, e);
  });
  d.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const row = t.closest<HTMLElement>('.urow[data-id]');
    if (row && t.dataset.d) {
      const id = row.dataset.id!, def = roster.find((r) => r.id === id)!;
      const n = counts.get(id) ?? 0, dlt = Number(t.dataset.d);
      if (dlt > 0 && spent() + def.cost > s.budget) return;
      counts.set(id, Math.max(0, n + dlt));
      refresh();
    }
    if (t.dataset.preset) {
      counts.clear();
      for (const f of buildForce(roster, s.budget, t.dataset.preset, new Rng(Date.now() % 1e6))) counts.set(f.defId, f.count);
      refresh();
    }
    if (t.dataset.a === 'clear') { counts.clear(); refresh(); }
    if (t.dataset.a === 'back') back();
    if (t.dataset.a === 'start') start([...counts.entries()].filter(([, n]) => n > 0).map(([defId, count]) => ({ defId, count })));
  });
  // Start with a sensible balanced force the player can edit.
  for (const f of buildForce(roster, s.budget, 'balanced', new Rng(7))) counts.set(f.defId, f.count);
  refresh();
}

/** Scenario briefing with side choice. */
export function scenarioBriefing(def: import('../data/scenarios/types').ScenarioDef, start: (side: FactionId, difficulty: Difficulty) => void, back: () => void) {
  let side: FactionId = def.attacker;
  let diff: Difficulty = 'normal';
  const render = () => {
    const b = def.briefing[side];
    const d = show(`<div class="panel menu">
      <h1 style="font-size:26px">${def.name}</h1><div class="tag">${def.date} · ${def.map.name} · ${Math.round(def.timeLimit / 60)} minutes</div>
      ${choice('Play as', 'side', [['iraq', 'Iraq – assault'], ['iran', 'Iran – delaying defence']], side)}
      <h2>${b.title}</h2><div style="line-height:1.55;font-size:14px">${b.text}</div>
      ${choice('Enemy AI', 'diff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], diff)}
      <div class="kv" style="margin-top:8px">Victory: the attacker must hold ${def.required.length} objectives together for ${def.holdFor} s before the time runs out; otherwise the defender wins.</div>
      <div class="row" style="margin-top:16px"><button class="btn" data-a="back">Back</button><button class="btn primary" data-a="go">Begin</button></div></div>`);
    d.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.k === 'side') { side = t.dataset.v as FactionId; render(); }
      if (t.dataset.k === 'diff') { diff = t.dataset.v as Difficulty; render(); }
      if (t.dataset.a === 'go') start(side, diff);
      if (t.dataset.a === 'back') back();
    });
  };
  render();
}

/** Unit codex: every intel card, grouped by side; era filter shows when units become available. */
export function codex(back: () => void) {
  let faction: FactionId = 'iraq';
  const render = () => {
    const units = rosterFor(faction, 1986);
    const d = show(`<div class="panel menu" style="width:min(1150px,96vw)">
      <h1 style="font-size:26px">Intel cards</h1>
      ${choice('Side', 'f', [['iraq', 'Iraq'], ['iran', 'Iran']], faction)}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;max-height:62vh;overflow:auto;margin-top:10px">
      ${units.map((u) => `<div class="panel" style="padding:10px 12px;font-size:12px;position:static">${intelCardHTML(u).replace('<h4>', '<h4 style="margin:0;color:var(--accent);font-size:14px">')}</div>`).join('')}
      </div><div class="row" style="margin-top:14px"><button class="btn" data-a="back">Back</button></div></div>`);
    d.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.k === 'f') { faction = t.dataset.v as FactionId; render(); }
      if (t.dataset.a === 'back') back();
    });
  };
  render();
}

import { uiSound } from '../audio/sound';
import { Rng } from '../core/rng';
import { PRESETS } from '../data/aiPresets';
import { rosterFor } from '../data/units';
import type { Era, FactionId, UnitCategory, UnitDef } from '../data/units/types';
import type { ScenarioDef } from '../data/scenarios/types';
import type { Difficulty } from '../sim/ai';
import { buildForce, forceCost } from '../sim/forcebuilder';
import type { ForceEntry } from '../sim/setup';
import { HELP_HTML } from '../game';
import { natoURL } from '../render/nato';
import { intelCardHTML } from './intel';
import { switchPanel } from './panel';
import { drawTable } from './table';
import { applyFactionTheme, FACTION_THEME, FONTS, PALETTE } from './theme/tokens';

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

/** A scene sits on the map table (the table canvas is redrawn behind every menu). */
function scene(html: string, withTable = true): HTMLElement {
  screens().innerHTML = '';
  const d = document.createElement('div');
  d.className = 'scene';
  if (withTable) {
    const c = document.createElement('canvas');
    c.className = 'table';
    d.appendChild(c);
    drawTable(c);
    const onResize = () => { if (c.isConnected) drawTable(c); else window.removeEventListener('resize', onResize); };
    window.addEventListener('resize', onResize);
  }
  d.insertAdjacentHTML('beforeend', html);
  screens().appendChild(d);
  return d;
}

/** Click sounds for anything that behaves like a physical control. */
function clicks(root: HTMLElement) {
  root.addEventListener('pointerdown', (e) => {
    const t = (e.target as HTMLElement).closest('.btn,.box,.obj,.key,.dfolder,.qty button');
    if (t) uiSound(t.classList.contains('obj') || t.classList.contains('dfolder') ? 'paper' : 'click');
  });
}

// ---------------------------------------------------------------- main menu (map table)
export function mainMenu(actions: { skirmish: () => void; scenario: () => void; codex: () => void }) {
  applyFactionTheme('iraq');
  const d = scene(`
    <div class="obj folder" data-a="skirmish" style="left:6%;bottom:9%;--rot:-5deg;--fold:#c9a96a">
      <span class="shadow"></span><span class="tab">FILE 80/09 · OPS</span>
      <div class="cover"><span class="stamp">Secret</span><h3>Skirmish</h3>
      <p>Field folder. Choose a side, an era and the battle conditions, requisition a force and fight the AI for the Khuzestan plain.</p></div></div>
    <div class="obj telegram" data-a="scenario" style="right:5%;top:12%;--rot:4deg">
      <span class="shadow"></span><div class="paper"><div class="band">TELEGRAM · PRIORITY · FLASH</div>
      <span class="strip">22 SEP 1980 0500 STOP</span><span class="strip">BORDER CROSSING AT CANAL STOP</span><span class="strip">ASSAULT OR DELAY STOP</span>
      <span class="strip">ACKNOWLEDGE STOP</span><div class="label" style="color:#5a4c30;margin-top:6px">Scenario</div></div></div>
    <div class="obj plate switchpanel chamfer" data-a="settings" style="right:6%;bottom:8%;--rot:-2deg">
      <span class="label" style="position:absolute;left:18px;top:7px">Settings panel</span>
      <div class="row"><span class="bigtog on"><span class="lampx"></span><span class="guard"></span><span class="cap">Grain</span></span><span class="bigtog"><span class="lampx"></span><span class="guard"></span><span class="cap">Clean</span></span><span class="bigtog on"><span class="lampx"></span><span class="guard"></span><span class="cap">Sound</span></span></div></div>
    <div class="obj" data-a="codex" style="right:30%;top:5%;--rot:-3deg;transform:rotate(-3deg)">
      <span class="shadow"></span><div style="width:190px;height:120px;background:#5b4a32;background-image:var(--tex-scratch),var(--tex-grain);padding:16px 14px;color:var(--bone);box-shadow:inset 0 0 0 2px #2a2116, inset 10px 0 0 #3d3122">
      <div class="stencil" style="font-size:15px">Recognition</div><div class="typed" style="font-size:12px;margin-top:6px;color:var(--bone-dim)">Binder of intel cards — every vehicle, team and aircraft.</div></div></div>
    <div class="obj" data-a="help" style="left:38%;bottom:5%;--rot:2deg;transform:rotate(2deg)">
      <span class="shadow"></span><div style="width:170px;padding:10px 12px;background:var(--paper);background-image:var(--tex-paper);color:var(--ink);box-shadow:inset 0 0 0 1px rgba(60,45,20,.5)">
      <div class="stencil" style="font-size:12px">FM 80-2</div><div class="typed" style="font-size:12px">Quick reference card — controls</div></div></div>
    <div style="position:absolute;left:6%;top:4%;transform:rotate(-1.5deg)"><span class="tape">Operations map — Khuzestan front</span></div>
    <div class="stamp" style="position:absolute;left:5%;top:11%;font-size:13px">Not for release</div>
  `);
  clicks(d);
  d.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (a === 'skirmish') actions.skirmish();
    if (a === 'scenario') actions.scenario();
    if (a === 'codex') actions.codex();
    if (a === 'settings') screens().appendChild(switchPanel({ title: 'Settings', actions: [['close', 'Close', () => screens().querySelector('.overlay')?.remove()]] }));
    if (a === 'help') {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.innerHTML = `<div class="sheet" style="width:720px;transform:rotate(-0.6deg)"><div class="formno">FM 80-2 · FIELD MANUAL · QUICK REFERENCE CARD</div><h1 style="margin:6px 0 12px">Controls</h1>${HELP_HTML}<div style="margin-top:14px"><button class="btn">Close</button></div></div>`;
      o.querySelector('button')!.addEventListener('click', () => o.remove());
      screens().appendChild(o);
    }
  });
}

// ---------------------------------------------------------------- emblems (invented, abstract)
const emblems = new Map<string, string>();
export function emblemURL(f: FactionId, size = 300): string {
  const k = `${f}:${size}`;
  if (emblems.has(k)) return emblems.get(k)!;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const th = FACTION_THEME[f];
  const s = size / 300;
  x.scale(s, s);
  x.strokeStyle = PALETTE.ink; x.fillStyle = th.accent; x.lineWidth = 10; x.lineJoin = 'miter';
  if (th.emblem === 'chevrons') {
    // Square frame, three stacked chevrons, a pointed base: an invented formation badge.
    x.strokeRect(40, 40, 220, 220);
    for (let i = 0; i < 3; i++) {
      x.beginPath(); x.moveTo(80, 90 + i * 45); x.lineTo(150, 130 + i * 45); x.lineTo(220, 90 + i * 45); x.lineTo(220, 110 + i * 45); x.lineTo(150, 150 + i * 45); x.lineTo(80, 110 + i * 45); x.closePath();
      if (i === 1) x.fill(); x.stroke();
    }
  } else {
    // Octagon frame enclosing a 3x3 lattice of tilted squares, centre one filled.
    x.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; x.lineTo(150 + Math.cos(a) * 125, 150 + Math.sin(a) * 125); }
    x.closePath(); x.stroke();
    for (let r = -1; r <= 1; r++) for (let q = -1; q <= 1; q++) {
      x.save(); x.translate(150 + q * 52, 150 + r * 52); x.rotate(Math.PI / 4);
      x.beginPath(); x.rect(-18, -18, 36, 36);
      if (q === 0 && r === 0) x.fill();
      x.lineWidth = 7; x.stroke(); x.restore();
    }
  }
  const url = c.toDataURL();
  emblems.set(k, url);
  return url;
}

// ---------------------------------------------------------------- faction dossiers + setup
function boxes<T>(key: string, opts: Array<[T, string]>, cur: T) {
  return opts.map(([v, l]) => `<button class="box ${v === cur ? 'on' : ''}" data-k="${key}" data-v="${String(v)}">${l}</button>`).join('');
}

export function skirmishSetup(s: SkirmishSettings, next: (s: SkirmishSettings) => void, back: () => void) {
  let open: FactionId | null = null;
  const folder = (f: FactionId) => {
    const th = FACTION_THEME[f];
    const isOpen = open === f;
    const blurb = f === 'iraq'
      ? 'Soviet-equipped mechanised forces: massed T-55 and T-62 tanks, BMP infantry carriers, Hind gunships, ZSU-23-4 air defence.'
      : 'Western-equipped army: Chieftain and M60 tanks, TOW-armed Cobras — reinforced by IRGC and Basij volunteers.';
    return `<div class="dfolder ${isOpen ? 'open' : open ? 'dim' : ''}" data-f="${f}" style="--dp:${th.paper};--da:${th.accent}">
      <span class="ftab">${f === 'iraq' ? 'FOLDER A' : 'FOLDER B'}</span>
      <div class="back"></div>
      <div class="inside">${isOpen ? setupForm(f) : ''}</div>
      <div class="front"><span class="stamp" style="float:right">Confidential</span>
        <div class="label" style="color:#5a4c30">${th.dossierName}</div>
        <h2>${f === 'iraq' ? 'Iraq' : 'Iran'}</h2><div class="accent"></div>
        <img class="emblem" src="${emblemURL(f)}" alt="">
        <div class="typed" style="font-size:15px;line-height:1.45">${blurb}</div>
        <div class="label" style="color:#5a4c30;margin-top:22px">Open folder to take command →</div></div></div>`;
  };
  const setupForm = (f: FactionId) => `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:26px">
      <div><div class="formno">FORM S-1 · BATTLE CONDITIONS · ${f === 'iraq' ? 'IRAQ' : 'IRAN'}</div>
        <h2 style="font-size:30px;margin:4px 0 0">${f === 'iraq' ? 'Iraq' : 'Iran'}</h2>
        <img src="${emblemURL(f, 120)}" style="width:90px;height:90px;margin-top:10px" alt="">
        <div class="field">Map</div><div class="typed">KHUZESTAN PLAIN — CANAL, 3 BRIDGES, MARSH, TOWN</div>
        <div class="field">Era</div>${boxes('era', [[1980, '1980'], [1984, '1984'], [1986, '1986+']], s.era)}
        <div class="typed" style="font-size:12px;margin-top:4px">1980 = historical roster. Later eras add the drone tier (recon, loitering munitions).</div>
      </div>
      <div>
        <div class="field">Points allotted</div>${boxes('budget', [[1000, '1000'], [1500, '1500'], [2500, '2500'], [4000, '4000']], s.budget)}
        <div class="field">Time of day</div>${boxes('light', [[0, 'Day'], [1, 'Dusk'], [2, 'Night']], s.light)}
        <div class="field">Weather</div>${boxes('dust', [[false, 'Clear'], [true, 'Dust storm']], s.dust)}
        <div class="field">Enemy command</div>${boxes('difficulty', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], s.difficulty)}
        <div style="margin-top:26px"><button class="btn" data-a="close">Close folder</button><button class="btn go" data-a="next">Requisition →</button></div>
      </div>
    </div>`;
  // The scene is built once; opening a folder only toggles classes (so the cover visibly swings open)
  // and form clicks only redraw the folder's inside.
  const d = scene(`<div class="dossiers">${folder('iraq')}${folder('iran')}</div>
    <div style="position:absolute;left:4%;top:4%"><span class="tape">Select command — two folders</span></div>
    <button class="btn metal" data-a="back" style="position:absolute;left:4%;bottom:4%">← Map table</button>`);
  clicks(d);
  const sync = () => {
    for (const el of Array.from(d.querySelectorAll<HTMLElement>('.dfolder'))) {
      const f = el.dataset.f as FactionId;
      el.classList.toggle('open', open === f);
      el.classList.toggle('dim', !!open && open !== f);
      const inside = el.querySelector<HTMLElement>('.inside')!;
      inside.innerHTML = open === f ? setupForm(f) : '';
    }
  };
  d.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const k = t.closest<HTMLElement>('[data-k]');
    if (k) {
      const key = k.dataset.k as keyof SkirmishSettings, v = k.dataset.v!;
      (s as any)[key] = key === 'difficulty' ? v : v === 'true' ? true : v === 'false' ? false : Number(v);
      sync(); return;
    }
    const a = t.closest<HTMLElement>('[data-a]')?.dataset.a;
    if (a === 'back') return back();
    if (a === 'next') return next(s);
    if (a === 'close') { open = null; sync(); return; }
    const f = t.closest<HTMLElement>('.dfolder')?.dataset.f as FactionId | undefined;
    if (f && open !== f) { open = f; s.faction = f; applyFactionTheme(f); sync(); }
  });
}

// ---------------------------------------------------------------- requisition form
const CAT_ORDER: Array<[UnitCategory, string]> = [
  ['tank', 'Tanks'], ['apc', 'Carriers / IFV'], ['atgm', 'Anti-tank vehicles'], ['infantry', 'Infantry'], ['aa', 'Air defence'], ['heli', 'Rotary wing'], ['drone', 'Unmanned (later tier)'],
];

export function purchaseScreen(s: SkirmishSettings, start: (force: ForceEntry[]) => void, back: () => void) {
  applyFactionTheme(s.faction);
  const roster = rosterFor(s.faction, s.era);
  const counts = new Map<string, number>();
  const spent = () => forceCost([...counts.entries()].map(([defId, count]) => ({ defId, count })), roster);
  const th = FACTION_THEME[s.faction];
  const d = scene(`<div class="requisition">
    <div class="sheet" style="transform:rotate(-0.4deg)">
      <div style="display:flex;justify-content:space-between"><span class="formno">FORM 7-B · REQUISITION OF COMBAT ELEMENTS · ${th.callsign} COMMAND</span><span class="formno">ERA ${s.era === 1986 ? '1986+' : s.era}</span></div>
      <h1>Requisition — ${s.faction === 'iraq' ? 'Iraq' : 'Iran'}</h1>
      <div class="lines"><div class="line hdr"><span>QTY</span><span>ITEM</span><span class="r">UNIT PTS</span><span class="r">LINE</span></div><div class="items"></div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="sheet ledger" style="transform:rotate(0.7deg)">
        <div class="formno">LEDGER · POINTS ALLOTMENT</div>
        <div class="row"><span>Allotted</span><span class="mono">${s.budget}</span></div>
        <div class="row"><span>Committed</span><span class="mono spent">0</span></div>
        <div class="row" style="border-top:2px solid var(--ink)"><span>Remaining</span><span class="mono left"></span></div>
        <div class="big mono rem" style="text-align:right">0</div>
        <div class="field">Standard allocations</div>
        <div>${Object.entries(PRESETS).map(([id, p]) => `<button class="box" data-preset="${id}">${p.name}</button>`).join('')}<button class="box" data-a="clear">Clear form</button></div>
        <div class="field">Summary</div><div class="typed summary" style="font-size:13px;line-height:1.5;max-height:22vh;overflow:auto"></div>
      </div>
      <div><button class="btn metal" data-a="back">← Folder</button><button class="btn go metal" data-a="start" style="color:var(--amber);border-color:var(--amber);outline-color:var(--amber)">Submit for approval</button></div>
      <div class="typed" style="font-size:12px;color:var(--bone-dim)">Infantry boards free carrier seats at deployment. Your depot rearms, refuels and repairs.</div>
    </div>
    <span class="stamp slam">Approved</span>
  </div>`);
  clicks(d);
  const tip = document.createElement('div');
  tip.className = 'dossier';
  tip.style.display = 'none';
  d.appendChild(tip);
  const items = d.querySelector('.items')!;
  for (const [cat, title] of CAT_ORDER) {
    const defs = roster.filter((u) => u.category === cat);
    if (!defs.length) continue;
    items.insertAdjacentHTML('beforeend', `<div class="line cat"><span></span><span>${title}</span><span></span><span></span></div>`);
    for (const u of defs) {
      items.insertAdjacentHTML('beforeend', `<div class="line" data-id="${u.id}"><span class="qty"><button data-d="-1">−</button><b class="n">0</b><button data-d="1">+</button></span>
        <span><img src="${natoURL(u, false, 14)}" style="height:15px;vertical-align:-3px;margin-right:6px" alt="">${u.name.toUpperCase()}<span class="sub">${u.intel.realName}</span></span><span class="r">${u.cost}</span><span class="r tot">—</span></div>`);
    }
  }
  const refresh = () => {
    const sp = spent();
    d.querySelector('.spent')!.textContent = String(sp);
    d.querySelector('.left')!.textContent = String(s.budget - sp);
    const rem = d.querySelector<HTMLElement>('.rem')!;
    rem.textContent = String(s.budget - sp).padStart(4, '0');
    rem.classList.toggle('over', sp > s.budget);
    for (const row of Array.from(d.querySelectorAll<HTMLElement>('.line[data-id]'))) {
      const n = counts.get(row.dataset.id!) ?? 0;
      row.querySelector('.n')!.textContent = String(n);
      row.querySelector('.tot')!.textContent = n ? String(n * roster.find((r) => r.id === row.dataset.id)!.cost) : '—';
    }
    const list = [...counts.entries()].filter(([, n]) => n > 0).map(([id, n]) => `${n} × ${roster.find((r) => r.id === id)!.name.toUpperCase()}`);
    d.querySelector('.summary')!.innerHTML = list.length ? list.join('<br>') : 'NIL';
    (d.querySelector('[data-a=start]') as HTMLButtonElement).disabled = !list.length || sp > s.budget;
  };
  d.addEventListener('mousemove', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.line[data-id]');
    const def = row ? roster.find((r) => r.id === row.dataset.id) : null;
    if (!def) { tip.style.display = 'none'; tip.dataset.id = ''; return; }
    if (tip.dataset.id !== def.id) { tip.innerHTML = intelCardHTML(def); tip.dataset.id = def.id; tip.style.display = 'block'; }
    const h = tip.offsetHeight || 420;
    tip.style.left = `${Math.min(window.innerWidth - 400, Math.max(e.clientX + 26, window.innerWidth * 0.62))}px`;
    tip.style.top = `${Math.max(10, Math.min(window.innerHeight - h - 10, e.clientY - 80))}px`;
  });
  d.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const row = t.closest<HTMLElement>('.line[data-id]');
    if (row && t.dataset.d) {
      const id = row.dataset.id!, def = roster.find((r) => r.id === id)!;
      const n = counts.get(id) ?? 0, dlt = Number(t.dataset.d);
      if (dlt > 0 && spent() + def.cost > s.budget) return;
      counts.set(id, Math.max(0, n + dlt));
      refresh();
    }
    const preset = t.closest<HTMLElement>('[data-preset]')?.dataset.preset;
    if (preset) {
      counts.clear();
      for (const f of buildForce(roster, s.budget, preset, new Rng(Date.now() % 1e6))) counts.set(f.defId, f.count);
      refresh();
    }
    const a = t.closest<HTMLElement>('[data-a]')?.dataset.a;
    if (a === 'clear') { counts.clear(); refresh(); }
    if (a === 'back') back();
    if (a === 'start') {
      // APPROVED: the stamp slams down, the desk jolts, then deployment.
      const slam = d.querySelector('.slam')!;
      slam.classList.add('go');
      d.querySelector('.requisition')!.classList.add('shake');
      setTimeout(() => uiSound('stamp', 1), 290);
      const force = [...counts.entries()].filter(([, n]) => n > 0).map(([defId, count]) => ({ defId, count }));
      setTimeout(() => start(force), 1150);
    }
  });
  for (const f of buildForce(roster, s.budget, 'balanced', new Rng(7))) counts.set(f.defId, f.count);
  refresh();
}

// ---------------------------------------------------------------- scenario telegram
export function scenarioBriefing(def: ScenarioDef, start: (side: FactionId, difficulty: Difficulty) => void, back: () => void) {
  let side: FactionId = def.attacker;
  let diff: Difficulty = 'normal';
  const render = () => {
    applyFactionTheme(side);
    const b = def.briefing[side];
    const words = b.text.toUpperCase().replace(/\.\s*/g, ' STOP ').split(/(?<=STOP)\s/).filter(Boolean);
    const d = scene(`<div style="position:absolute;left:50%;top:50%;width:min(760px,92vw);transform:translate(-50%,-50%) rotate(-0.8deg)">
      <div class="telegram" style="width:100%;--rot:0deg"><div class="paper" style="padding:18px 26px 22px">
        <div class="band">TELEGRAM · FLASH · ${def.date.toUpperCase()} · ${FACTION_THEME[side].callsign} COMMAND</div>
        <div class="formno">TO: COMMANDER IN THE FIELD · FROM: CORPS HQ · SUBJ: ${def.name.toUpperCase()}</div>
        <h1 class="stencil" style="font-size:24px;margin:8px 0">${b.title}</h1>
        <div style="max-height:38vh;overflow:auto">${words.map((w) => `<span class="strip">${w}</span>`).join('')}</div>
        <div class="field">Command</div>${boxes('side', [['iraq', 'Iraq — assault'], ['iran', 'Iran — delaying defence']], side)}
        <div class="field">Enemy command</div>${boxes('diff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], diff)}
        <div class="typed" style="font-size:12px;margin-top:8px">VICTORY: ATTACKER MUST HOLD ${def.required.length} OBJECTIVES TOGETHER FOR ${def.holdFor} SEC WITHIN ${Math.round(def.timeLimit / 60)} MIN STOP OTHERWISE DEFENDER PREVAILS STOP</div>
        <div style="margin-top:16px"><button class="btn" data-a="back">Back</button><button class="btn go" data-a="go">Acknowledge</button></div>
      </div></div></div>`);
    clicks(d);
    d.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-k],[data-a]');
      if (!t) return;
      if (t.dataset.k === 'side') { side = t.dataset.v as FactionId; render(); }
      if (t.dataset.k === 'diff') { diff = t.dataset.v as Difficulty; render(); }
      if (t.dataset.a === 'go') start(side, diff);
      if (t.dataset.a === 'back') back();
    });
  };
  render();
}

// ---------------------------------------------------------------- recognition binder (codex)
export function codex(back: () => void) {
  let faction: FactionId = 'iraq';
  const render = () => {
    const units = rosterFor(faction, 1986);
    const d = scene(`<div style="position:absolute;inset:4% 5%;display:flex;gap:0">
      <div style="width:120px;display:flex;flex-direction:column;gap:8px;padding-top:40px">
        ${(['iraq', 'iran'] as FactionId[]).map((f) => `<button class="btn ${f === faction ? 'on' : ''}" data-f="${f}" style="background:${f === faction ? FACTION_THEME[f].accent : FACTION_THEME[f].paper};color:var(--ink);margin:0;transform:translateX(${f === faction ? 0 : 14}px)">${f === 'iraq' ? 'Iraq' : 'Iran'}</button>`).join('')}
        <button class="btn metal" data-a="back" style="margin-top:auto">← Table</button>
      </div>
      <div style="flex:1;background:#4c3d29;background-image:var(--tex-scratch),var(--tex-grain);padding:18px;box-shadow:inset 0 0 0 3px #2a2116">
        <div style="display:flex;justify-content:space-between;color:var(--bone)"><span class="stencil" style="font-size:18px">Recognition binder — ${faction === 'iraq' ? 'Iraq' : 'Iran'}</span><span class="label">${units.length} dossiers</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px;margin-top:12px;max-height:calc(100% - 40px);overflow:auto;padding:6px">
          ${units.map((u, i) => `<div class="dossier" style="position:relative;width:auto;animation-delay:${Math.min(i, 8) * 0.03}s;transform:rotate(${((i % 3) - 1) * 0.4}deg)">${intelCardHTML(u)}</div>`).join('')}
        </div></div></div>`);
    clicks(d);
    d.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-f],[data-a]');
      if (!t) return;
      if (t.dataset.f) { faction = t.dataset.f as FactionId; uiSound('paper'); render(); }
      if (t.dataset.a === 'back') back();
    });
  };
  render();
}

export { FONTS };
export type { UnitDef };

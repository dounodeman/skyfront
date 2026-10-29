import { listen } from './events';
import { TEAM_COLORS } from '../core/constants';
import { AMMO } from '../data/ammo';
import type { UnitDef } from '../data/units/types';
import type { Unit } from '../sim/entity';
import type { World } from '../sim/world';
import type { Controls } from './controls';
import { intelCardHTML } from './intel';
import type { Minimap } from './minimap';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

const pct = (f: number) => `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`;
const barColor = (f: number) => (f > 0.6 ? '#6fd36f' : f > 0.3 ? '#e0c04a' : '#e0553f');

function statusFlags(u: Unit): string[] {
  const f: string[] = [];
  if (u.mob.immobilized) f.push(`<span class="flag-bad">Immobilized (${u.mob.immobilizedReason})</span>`);
  if (u.mob.stalled > 0) f.push('<span class="flag-warn">Engine stalled</span>');
  if (u.mob.bogged > 0) f.push('<span class="flag-warn">Bogged down</span>');
  if (u.mob.fuelMax > 0 && u.mob.fuel <= 0) f.push('<span class="flag-bad">Out of fuel</span>');
  if (u.dmg.gunDisabled) f.push('<span class="flag-bad">Main gun disabled</span>');
  if (u.dmg.turretJammed) f.push('<span class="flag-bad">Turret jammed</span>');
  if (u.dmg.fire > 0) f.push('<span class="flag-bad">ON FIRE</span>');
  if (u.guiding > 0) f.push('<span class="flag-warn">Guiding missile</span>');
  if (u.inf) {
    if (u.inf.state === 'broken') f.push('<span class="flag-bad">Broken – retreating</span>');
    else if (u.inf.state === 'pinned') f.push('<span class="flag-warn">Pinned down</span>');
    else if (u.inf.suppression > 30) f.push('<span class="flag-warn">Suppressed</span>');
    if (u.inf.cover > 0.05) f.push(`<span class="flag-good">In cover (${pct(u.inf.cover)})</span>`);
  }
  if (u.air?.landed) f.push('Landed');
  if (u.stance === 'hold') f.push('Holding position');
  return f;
}

/** DOM overlay: top bar, message feed, selection panel, command card, intel tooltip. */
export class Hud {
  root: HTMLElement;
  private top = el('div', 'panel topbar');
  private feed = el('div', 'feed');
  private sel = el('div', 'panel selpanel');
  private card = el('div', 'panel cmdcard');
  private tip = el('div', 'panel tooltip');
  private statusLine = el('div', 'status-line');
  private timer = 0;
  private lastSelKey = '';
  private tipTimer = 0;
  private tipDef: UnitDef | null = null;
  private tipPos = { x: 0, y: 0 };
  private cardHandlers: Record<string, () => void> = {};

  constructor(private world: World, private controls: Controls, minimap: Minimap, private playerTeam = 0) {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = '';
    const bottom = el('div', 'bottom');
    const mm = el('div', 'panel minimap-wrap');
    mm.appendChild(minimap.canvas);
    bottom.append(mm, this.sel, this.card);
    this.tip.style.display = 'none';
    this.statusLine.style.display = 'none';
    this.root.append(this.top, this.feed, bottom, this.tip, this.statusLine);
    this.buildCard();
    controls.onChange = () => { this.lastSelKey = ''; this.timer = 0; };
    listen(window, 'mousemove', (e) => { this.tipPos = { x: e.clientX, y: e.clientY }; this.placeTip(); });
  }

  message(text: string, level: 'info' | 'warn' | 'good' = 'info') {
    const d = el('div', level, text);
    this.feed.prepend(d);
    while (this.feed.children.length > 6) this.feed.lastChild?.remove();
    setTimeout(() => d.remove(), 9000);
  }

  /** Show an intel card for a unit type near the cursor (null hides). */
  intel(def: UnitDef | null) {
    if (def === this.tipDef) return;
    this.tipDef = def;
    this.tipTimer = 0;
    if (!def) { this.tip.style.display = 'none'; return; }
    this.tip.innerHTML = intelCardHTML(def);
  }

  private placeTip() {
    const w = 300, h = this.tip.offsetHeight || 220;
    let x = this.tipPos.x + 18, y = this.tipPos.y + 18;
    if (x + w > window.innerWidth - 8) x = this.tipPos.x - w - 18;
    if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
    this.tip.style.left = `${x}px`; this.tip.style.top = `${Math.max(40, y)}px`;
  }

  private buildCard() {
    const defs: Array<[string, string, string, string]> = [
      ['attackmove', 'Q', 'Attack-move', 'Advance and engage anything met on the way'],
      ['stop', 'X', 'Stop', 'Cancel orders'],
      ['hold', 'H', 'Hold', 'Hold position: fire only at what comes in range'],
      ['formation', 'F', 'Formation', 'Cycle group formation'],
      ['unload', 'E', 'Dismount', 'Unload passengers here'],
      ['unloadat', 'U', 'Unload at…', 'Move/land and unload at a point'],
      ['pause', 'Esc', 'Pause', 'Pause menu'],
      ['help', '?', 'Controls', 'Show key bindings'],
    ];
    for (const [id, key, name, tip] of defs) {
      const b = el('button', 'cmd', `<span class="k">${key}</span>${name}`);
      b.title = tip;
      b.dataset.cmd = id;
      listen(b, 'click', () => {
        const h = this.cardHandlers[id];
        if (h) h(); else this.controls.exec(id);
      });
      this.card.appendChild(b);
    }
  }
  onCard(id: string, fn: () => void) { this.cardHandlers[id] = fn; }

  update(dt: number) {
    // Hover intel card in the world (delay before showing).
    const hov = this.controls.hoverId ? this.world.get(this.controls.hoverId) : undefined;
    if (!this.selHover) this.intel(hov ? hov.def : null);
    if (this.tipDef) {
      this.tipTimer += dt;
      if (this.tipTimer > 0.35 && this.tip.style.display === 'none') { this.tip.style.display = 'block'; this.placeTip(); }
    }
    const mode = this.controls.mode;
    if (mode !== 'normal') {
      this.statusLine.style.display = 'block';
      this.statusLine.textContent = mode === 'attackmove' ? 'ATTACK-MOVE: left-click destination (Shift queues) · right-click cancels' : 'UNLOAD AT: left-click landing/dismount point';
    } else this.statusLine.style.display = 'none';

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.2;
    this.renderTop();
    this.renderSelection();
    this.renderCard();
  }
  private selHover = false;

  private renderTop() {
    const w = this.world;
    const t = Math.floor(w.time);
    const clock = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    const light = ['Day', 'Dusk', 'Night'][w.env.light] + (w.env.dust ? ' · Dust storm' : '');
    const [a, b] = w.teams;
    const tk = (tm: typeof a, col: string) => `<span class="tickets"><span style="color:${col}">${tm.name}</span><span class="tbar"><i style="width:${pct(tm.tickets / tm.ticketsMax)};background:${col}"></i></span>${Math.ceil(tm.tickets)}</span>`;
    const objs = w.objectives.map((o) => `<span style="color:${o.owner === null ? '#ccc' : TEAM_COLORS[o.owner]}">■</span>`).join('');
    let right = `${tk(a, TEAM_COLORS[0])}${tk(b, TEAM_COLORS[1])}`;
    if (w.vars.timeLimit) {
      // Scenario: countdown and the attacker's hold timer replace the ticket bars.
      const left = Math.max(0, Number(w.vars.timeLimit) - w.time);
      const att = Number(w.vars.attacker);
      const hold = Number(w.vars.holdTimer ?? 0);
      right = `<span>Time left <b>${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}</b></span>`
        + `<span style="color:${TEAM_COLORS[att]}">${w.teams[att].name} attacking${hold > 0 ? ` – holding all objectives ${Math.floor(hold)}s` : ''}</span>`;
    }
    this.top.innerHTML = `<b>KHUZESTAN 1980</b><span>${clock}</span><span class="kv">Era ${w.env.era === 1986 ? '1986+' : w.env.era} · ${light}</span>`
      + `<span class="sp"></span>${objs ? `<span>Objectives ${objs}</span>` : ''}${right}`;
  }

  private renderSelection() {
    const s = this.controls.selection;
    const key = s.map((u) => u.id).join(',');
    if (s.length === 1) { this.sel.innerHTML = this.detailHTML(s[0]); this.lastSelKey = key; this.bindDetail(s[0]); return; }
    if (!s.length) {
      this.sel.innerHTML = `<div class="kv">No units selected. Left-click or drag to select · right-click to move/attack · Q attack-move · Ctrl+1–9 groups · WASD/edge scroll · wheel zoom.</div>`;
      this.lastSelKey = key; return;
    }
    // Multi-selection: chip grid (rebuilt only when membership changes; bars refreshed in place).
    if (key !== this.lastSelKey) {
      this.sel.innerHTML = `<div class="kv" style="margin-bottom:4px">${s.length} units selected</div><div class="selgrid"></div>`;
      const grid = this.sel.querySelector('.selgrid')!;
      for (const u of s) {
        const c = el('div', 'chip', `<span class="nm">${u.def.name}</span><span class="kv">${u.inf ? `${Math.ceil(u.inf.men)} men` : u.def.category}</span><span class="hb"><i></i></span>`);
        c.dataset.id = String(u.id);
        listen(c, 'click', (e) => this.controls.setSelection((e as MouseEvent).shiftKey ? s.filter((x) => x !== u) : [u]));
        listen(c, 'mouseenter', () => { this.selHover = true; this.intel(u.def); });
        listen(c, 'mouseleave', () => { this.selHover = false; this.intel(null); });
        grid.appendChild(c);
      }
      this.lastSelKey = key;
    }
    for (const c of Array.from(this.sel.querySelectorAll<HTMLElement>('.chip'))) {
      const u = this.world.get(Number(c.dataset.id));
      const i = c.querySelector<HTMLElement>('.hb i');
      if (u && i) { i.style.width = pct(u.hpFrac); i.style.background = barColor(u.hpFrac); }
    }
  }

  private bindDetail(u: Unit) {
    const h = this.sel.querySelector<HTMLElement>('h3');
    if (h) {
      listen(h, 'mouseenter', () => { this.selHover = true; this.intel(u.def); });
      listen(h, 'mouseleave', () => { this.selHover = false; this.intel(null); });
    }
  }

  private detailHTML(u: Unit): string {
    const d = u.def;
    const hp = u.hpFrac;
    const rows: string[] = [];
    rows.push(`<div class="stat"><span>${u.inf ? 'Strength' : 'Integrity'}</span><div class="bar"><i style="width:${pct(hp)};background:${barColor(hp)}"></i></div></div>`);
    if (u.inf) {
      rows.push(`<div class="stat"><span>Men</span><span>${Math.ceil(u.inf.men)} / ${u.inf.maxMen}</span></div>`);
      rows.push(`<div class="stat"><span>Morale</span><div class="bar"><i style="width:${pct(u.inf.morale / 100)};background:#6aa8ff"></i></div></div>`);
      rows.push(`<div class="stat"><span>Suppression</span><div class="bar"><i style="width:${pct(u.inf.suppression / 100)};background:#ffb347"></i></div></div>`);
    } else if (d.crew.length) {
      rows.push(`<div class="stat"><span>Crew</span><span class="pips">${d.crew.map((r, i) => `<span class="pip ${u.dmg.crew[i] ? '' : 'dead'}">${r}</span>`).join('')}</span></div>`);
    }
    if (u.mob.fuelMax > 0) rows.push(`<div class="stat"><span>Fuel</span><div class="bar"><i style="width:${pct(u.mob.fuel / u.mob.fuelMax)};background:#c9a24a"></i></div></div>`);
    if (u.isAir) rows.push(`<div class="stat"><span>Altitude</span><span>${Math.round(u.altitude)} m</span></div>`);
    const ammo = u.weapons.map((w) => {
      const parts = Object.keys(w.ammo).map((a) => `${AMMO[a].kind === 'BULLET' || AMMO[a].kind === 'FLAK' ? '' : AMMO[a].kind + ' '}${Math.ceil(w.ammo[a])}`);
      return `<span title="${Object.keys(w.ammo).map((a) => AMMO[a].name).join(', ')}">${w.def.name}: ${parts.join(' · ')}</span>`;
    }).join('');
    if (ammo) rows.push(`<div class="stat"><span>Ammo</span><div class="ammorow">${ammo}</div></div>`);
    if (u.cargo.length) rows.push(`<div class="stat"><span>Carrying</span><span>${u.cargo.map((c) => c.def.name).join(', ')}</span></div>`);
    const flags = statusFlags(u);
    return `<div class="detail"><h3 style="cursor:help">${d.name}${u.label ? ' ' + u.label : ''}</h3><div class="sub">${d.intel.realName} · ${d.intel.role}</div>${rows.join('')}${flags.length ? `<div style="margin-top:4px">${flags.join(' · ')}</div>` : ''}</div>`;
  }

  private renderCard() {
    const s = this.controls.selection;
    const any = s.length > 0;
    const hasCargo = s.some((u) => u.cargo.length > 0);
    for (const b of Array.from(this.card.querySelectorAll<HTMLButtonElement>('.cmd'))) {
      const id = b.dataset.cmd!;
      if (['attackmove', 'stop', 'hold', 'formation'].includes(id)) b.disabled = !any;
      if (id === 'unload' || id === 'unloadat') b.disabled = !hasCargo;
      b.classList.toggle('on', (id === 'attackmove' && this.controls.mode === 'attackmove') || (id === 'unloadat' && this.controls.mode === 'unload') || (id === 'hold' && any && s.every((u) => u.stance === 'hold')));
      if (id === 'formation') b.innerHTML = `<span class="k">F</span>${this.controls.formation === 'none' ? 'Formation' : this.controls.formation}`;
    }
  }
}

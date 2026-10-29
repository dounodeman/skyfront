import type { FactionId, UnitDef } from '../data/units/types';
import { AMMO } from '../data/ammo';
import { natoURL } from '../render/nato';
import type { Unit } from '../sim/entity';
import type { World } from '../sim/world';
import type { Controls } from './controls';
import { DroneFeed } from './dronefeed';
import { listen } from './events';
import { intelCardHTML } from './intel';
import { unitNo } from './labels';
import type { Radar } from './radar';
import { RadioLog } from './radiolog';
import { drawSchematic } from './schematic';
import { FACTION_THEME } from './theme/tokens';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

/** Segmented gauge (never a smooth bar). */
export function segs(frac: number, n = 10, cls = '') {
  const on = Math.max(0, Math.min(n, Math.ceil(frac * n - 0.001)));
  const tone = cls || (frac > 0.6 ? '' : frac > 0.3 ? 'amber' : 'red');
  return `<span class="segs ${tone}">${Array.from({ length: n }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</span>`;
}

function stamps(u: Unit): string {
  const f: string[] = [];
  const s = (t: string, c = '') => f.push(`<span class="stamp ${c}">${t}</span>`);
  if (u.mob.immobilized) s(`Mobility kill`);
  if (u.mob.stalled > 0) s('Stalled', 'amber');
  if (u.mob.bogged > 0) s('Bogged', 'amber');
  if (u.mob.fuelMax > 0 && u.mob.fuel <= 0) s('No fuel');
  if (u.dmg.gunDisabled) s('Firepower kill');
  if (u.dmg.turretJammed) s('Turret jam', 'amber');
  if (u.dmg.fire > 0) s('On fire');
  if (u.guiding > 0) s('Guiding', 'amber');
  if (u.inf) {
    if (u.inf.state === 'broken') s('Broken');
    else if (u.inf.state === 'pinned') s('Suppressed', 'amber');
    if (u.inf.cover > 0.05) s(`Cover ${Math.round(u.inf.cover * 100)}%`, 'green');
  }
  if (u.air?.landed) s('Landed', 'bone');
  if (u.stance === 'hold') s('Hold', 'bone');
  if (u.cargo.length) s(`Cargo ${u.cargo.length}`, 'bone');
  return f.join('');
}

const KEYS: Array<[string, string, string, string]> = [
  ['attackmove', 'Q', 'Attack move', 'Advance and engage anything met on the way'],
  ['stop', 'X', 'Halt', 'Cancel orders'],
  ['hold', 'H', 'Hold', 'Hold position: fire only at what comes in range'],
  ['formation', 'F', 'Formation', 'Cycle group formation'],
  ['unload', 'E', 'Dismount', 'Unload passengers here'],
  ['unloadat', 'U', 'Unload at', 'Move/land and unload at a point'],
  ['pause', 'ESC', 'Panel', 'Pause and settings panel'],
  ['help', '?', 'Manual', 'Field manual: key bindings'],
];
const HOTKEY: Record<string, string> = { q: 'attackmove', x: 'stop', h: 'hold', f: 'formation', e: 'unload', u: 'unloadat', escape: 'pause' };

/** Hardware-style HUD bolted to the screen edges: status strip, radio log, command console. */
export class Hud {
  root: HTMLElement;
  log: RadioLog;
  private top = el('div', 'plate topstrip notch');
  private readout = el('div', 'unit readout recess');
  private keys = el('div', 'unit keys');
  private feed: DroneFeed;
  private dossier = el('div', 'dossier');
  private prompt = el('div', 'prompt');
  private schemCanvas = el('canvas');
  private timer = 0;
  private lastKey = '-';
  private tipDef: UnitDef | null = null;
  private tipTimer = 0;
  private tipPos = { x: 0, y: 0 };
  private selHover = false;
  private radarTimer = 0;
  private cardHandlers: Record<string, () => void> = {};
  onKey: () => void = () => {};

  constructor(private world: World, private controls: Controls, private radar: Radar, faction: FactionId, base: HTMLCanvasElement, isVisible: (u: Unit) => boolean) {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = '';
    const th = FACTION_THEME[faction];
    this.log = new RadioLog(world, faction);
    this.feed = new DroneFeed(world, base, isVisible);
    const consoleEl = el('div', 'plate console');
    consoleEl.innerHTML = `<span class="marking">${th.marking}</span>`;
    consoleEl.append(radar.el, this.readout, this.feed.el, this.keys);
    this.dossier.style.display = 'none';
    this.prompt.style.display = 'none';
    this.root.append(this.top, this.log.el, consoleEl, this.dossier, this.prompt);
    this.buildKeys();
    controls.onChange = () => { this.lastKey = '-'; this.timer = 0; };
    listen(window, 'mousemove', (e) => { this.tipPos = { x: e.clientX, y: e.clientY }; this.placeTip(); });
    listen(window, 'keydown', (e) => {
      const id = HOTKEY[e.key.toLowerCase()];
      const b = id && this.keys.querySelector<HTMLElement>(`[data-cmd="${id}"]`);
      if (b && !(b as HTMLButtonElement).disabled) { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 110); this.onKey(); }
    });
  }

  message(text: string, level: 'info' | 'warn' | 'good' = 'info') { this.log.add(text.toUpperCase(), level); }

  /** Intel dossier near the cursor (null hides). */
  intel(def: UnitDef | null) {
    if (def === this.tipDef) return;
    this.tipDef = def;
    this.tipTimer = 0;
    this.dossier.style.display = 'none';
    if (def) this.dossier.innerHTML = intelCardHTML(def);
  }

  private placeTip() {
    const w = 380, h = this.dossier.offsetHeight || 420;
    let x = this.tipPos.x + 22, y = this.tipPos.y - 40;
    if (x + w > window.innerWidth - 8) x = this.tipPos.x - w - 22;
    if (y + h > window.innerHeight - 214) y = window.innerHeight - 214 - h;
    this.dossier.style.left = `${x}px`; this.dossier.style.top = `${Math.max(44, y)}px`;
  }

  private buildKeys() {
    for (const [id, key, name, tip] of KEYS) {
      const b = el('button', 'key', `<span class="hk">${key}</span><span class="kl">${name}</span>`);
      b.title = tip;
      b.dataset.cmd = id;
      listen(b, 'click', () => {
        this.onKey();
        const h = this.cardHandlers[id];
        if (h) h(); else this.controls.exec(id);
      });
      this.keys.appendChild(b);
    }
  }
  onCard(id: string, fn: () => void) { this.cardHandlers[id] = fn; }

  update(dt: number, time: number) {
    this.log.update(dt);
    this.radarTimer -= dt;
    if (this.radarTimer <= 0) { this.radar.draw(time); this.radarTimer = 1 / 30; }
    this.feed.update(this.controls.selection, time, dt);

    const hov = this.controls.hoverId ? this.world.get(this.controls.hoverId) : undefined;
    if (!this.selHover) this.intel(hov ? hov.def : null);
    if (this.tipDef) {
      this.tipTimer += dt;
      if (this.tipTimer > 0.35 && this.dossier.style.display === 'none') { this.dossier.style.display = 'block'; this.placeTip(); }
    }
    const mode = this.controls.mode;
    this.prompt.style.display = mode === 'normal' ? 'none' : 'block';
    if (mode !== 'normal') this.prompt.innerHTML = `<span class="tape">${mode === 'attackmove' ? 'Attack move — mark destination · right-click cancels' : 'Unload at — mark landing zone'}</span>`;

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.15;
    this.renderTop();
    this.renderReadout(time);
    this.renderKeys();
  }

  private renderTop() {
    const w = this.world;
    const light = ['Day', 'Dusk', 'Night'][w.env.light];
    const [a, b] = w.teams;
    const counter = (tm: typeof a, enemy: boolean) => `<span class="counter"><span class="name">${tm.name}</span><span class="segs recess ${enemy ? 'enemy' : ''}">${Array.from({ length: 20 }, (_, i) => `<i class="${i < Math.ceil((tm.tickets / tm.ticketsMax) * 20) ? 'on' : ''}"></i>`).join('')}</span><span class="window recess">${String(Math.max(0, Math.ceil(tm.tickets))).padStart(4, '0')}</span></span>`;
    let right = counter(a, false) + counter(b, true);
    if (w.vars.timeLimit) {
      const left = Math.max(0, Number(w.vars.timeLimit) - w.time);
      const att = Number(w.vars.attacker);
      const hold = Number(w.vars.holdTimer ?? 0);
      right = `<span class="label">Time left</span><span class="window recess">${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}</span>`
        + `<span class="stamp ${att === 0 ? 'bone' : ''}">${w.teams[att].name} attacking${hold > 0 ? ` · hold ${Math.floor(hold)}s` : ''}</span>`;
    }
    const objs = w.objectives.map((o) => `<span class="objtag ${o.owner === null ? 'none' : o.owner === 0 ? 'mine' : 'foe'}" title="${o.name}">${o.name.split(' ').map((p) => p[0]).join('').slice(0, 3).toUpperCase()}</span>`).join('');
    const t = Math.floor(w.time);
    this.top.innerHTML = `<span class="title">KHUZESTAN 80</span><span class="window recess">${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}</span>`
      + `<span class="stamp bone">Era ${w.env.era === 1986 ? '86+' : w.env.era}</span><span class="stamp bone">${light}</span>${w.env.dust ? '<span class="stamp amber">Dust</span>' : ''}`
      + `<span class="sp"></span>${objs ? `<span class="label">Obj</span><span>${objs}</span>` : ''}${right}`;
  }

  private renderReadout(time: number) {
    const s = this.controls.selection;
    const key = s.map((u) => u.id).join(',');
    if (!s.length) {
      if (key !== this.lastKey) this.readout.innerHTML = `<div class="empty"><b>No units selected.</b><br>Left-click or drag to select · right-click to move, attack or board · <b>Q</b> attack move · <b>Ctrl+1–9</b> groups · <b>WASD</b> pan · wheel zoom · hover a unit for its dossier.</div>`;
      this.lastKey = key;
      return;
    }
    if (s.length === 1) { this.single(s[0], key, time); return; }
    if (key !== this.lastKey) {
      this.readout.innerHTML = `<div class="rcol"><div class="rhead"><span class="nm">${s.length} units</span><span class="sub">Group selection — click to single out, shift-click to drop</span></div><div class="multi"></div></div>`;
      const grid = this.readout.querySelector('.multi')!;
      for (const u of s) {
        const c = el('div', 'chip', `<span class="nm">${u.def.name} #${unitNo(u)}</span><img class="ico" src="${natoURL(u.def, false, 16)}" alt=""><span class="segs"></span>`);
        c.dataset.id = String(u.id);
        listen(c, 'click', (e) => this.controls.setSelection((e as MouseEvent).shiftKey ? s.filter((x) => x !== u) : [u]));
        listen(c, 'mouseenter', () => { this.selHover = true; this.intel(u.def); });
        listen(c, 'mouseleave', () => { this.selHover = false; this.intel(null); });
        grid.appendChild(c);
      }
      this.lastKey = key;
    }
    for (const c of Array.from(this.readout.querySelectorAll<HTMLElement>('.chip'))) {
      const u = this.world.get(Number(c.dataset.id));
      const sg = c.querySelector('.segs');
      if (u && sg) sg.outerHTML = segs(u.hpFrac, 5);
    }
  }

  private single(u: Unit, key: string, time: number) {
    if (key !== this.lastKey) {
      this.readout.innerHTML = `<div class="schem recess"></div><div class="rcol"><div class="rhead"><span class="nm">${u.def.name} #${unitNo(u)}</span><span class="sub">${u.def.intel.realName}</span></div><div class="gauges"></div><div class="flags"></div><div class="wkeys"></div></div>`;
      this.readout.querySelector('.schem')!.appendChild(this.schemCanvas);
      const nm = this.readout.querySelector<HTMLElement>('.nm')!;
      listen(nm, 'mouseenter', () => { this.selHover = true; this.intel(u.def); });
      listen(nm, 'mouseleave', () => { this.selHover = false; this.intel(null); });
      this.lastKey = key;
    }
    drawSchematic(this.schemCanvas, u, time);
    const g: string[] = [];
    const row = (k: string, frac: number, v: string, n = 12, cls = '') => g.push(`<div class="grow"><span class="k">${k}</span>${segs(frac, n, cls)}<span class="v">${v}</span></div>`);
    if (u.inf) {
      row('Strength', u.hpFrac, `${Math.ceil(u.inf.men)}/${u.inf.maxMen}`);
      row('Morale', u.inf.morale / 100, `${Math.round(u.inf.morale)}`);
      row('Suppr', u.inf.suppression / 100, `${Math.round(u.inf.suppression)}`, 12, 'amber');
    } else {
      row('Integrity', u.hpFrac, `${Math.round(u.hpFrac * 100)}%`);
      if (u.mob.fuelMax > 0) row('Fuel', u.mob.fuel / u.mob.fuelMax, `${Math.round((u.mob.fuel / u.mob.fuelMax) * 100)}%`);
    }
    const pw = u.weapons[0];
    if (pw) {
      let n = 0, m = 0;
      for (const id in pw.ammo) { n += pw.ammo[id]; m += pw.ammoMax[id]; }
      row('Ammo', m ? n / m : 0, `${Math.ceil(n)}`);
    }
    this.readout.querySelector('.gauges')!.innerHTML = g.join('');
    this.readout.querySelector('.flags')!.innerHTML = stamps(u);
    // Weapon keys with reload clock-wipe.
    this.readout.querySelector('.wkeys')!.innerHTML = u.weapons.map((w) => {
      const total = Object.values(w.ammo).reduce((a, b) => a + b, 0);
      const parts = Object.keys(w.ammo).map((a) => `${AMMO[a].kind === 'BULLET' || AMMO[a].kind === 'FLAK' ? '' : AMMO[a].kind + ' '}${Math.ceil(w.ammo[a])}`).join(' · ');
      const p = Math.max(0, Math.min(1, w.cooldown / Math.max(0.01, w.def.reload)));
      return `<span class="wkey ${total <= 0 ? 'out' : ''}" style="--p:${p.toFixed(3)}" title="${Object.keys(w.ammo).map((a) => AMMO[a].name).join(', ')}"><span class="wn">${w.def.name}</span>${parts}</span>`;
    }).join('');
  }

  private renderKeys() {
    const s = this.controls.selection;
    const any = s.length > 0;
    const hasCargo = s.some((u) => u.cargo.length > 0);
    // Transports mid-landing show their unload progress as a clock-wipe on the unload keys.
    const landing = s.find((u) => u.air && u.orders[0]?.type === 'unload');
    for (const b of Array.from(this.keys.querySelectorAll<HTMLButtonElement>('.key'))) {
      const id = b.dataset.cmd!;
      if (['attackmove', 'stop', 'hold', 'formation'].includes(id)) b.disabled = !any;
      if (id === 'unload' || id === 'unloadat') {
        b.disabled = !hasCargo;
        const p = landing && landing.air ? 1 - Math.min(1, landing.altitude / (landing.def.air?.altitude ?? 50)) : 0;
        b.style.setProperty('--p', landing ? String(1 - p) : '0');
      }
      b.classList.toggle('on', (id === 'attackmove' && this.controls.mode === 'attackmove') || (id === 'unloadat' && this.controls.mode === 'unload') || (id === 'hold' && any && s.every((u) => u.stance === 'hold')));
      if (id === 'formation') b.innerHTML = `<span class="hk">F</span><span class="kl">${this.controls.formation === 'none' ? 'Formation' : this.controls.formation}</span>`;
    }
  }
}

import type { FactionId } from '../data/units/types';
import type { World } from '../sim/world';
import { bearing, contactClass, missionClock, unitLabel } from './labels';
import { FACTION_THEME } from './theme/tokens';

/** Short teletype forms of simulation status texts. */
const STATUS: Record<string, string> = {
  'Engine stalled': 'ENGINE STALLED', 'Engine failure': 'ENGINE FAILURE, IMMOBILE', 'Bogged down in the marsh': 'BOGGED, MARSH',
  'Freed from the mud': 'FREE OF MUD, MOVING', 'Track broken': 'MOBILITY KILL, TRACK', 'Engine destroyed': 'MOBILITY KILL, ENGINE',
  'Engine damaged': 'ENGINE HIT', 'Main gun disabled': 'FIREPOWER KILL, MAIN GUN', 'Turret traverse jammed': 'TURRET JAMMED',
  'Vehicle on fire': 'ON FIRE', 'Fire put out': 'FIRE OUT', 'Ammunition detonation!': 'AMMUNITION COOK-OFF',
  'Crew bailed out': 'CREW BAILED', 'Crew knocked out': 'CREW DOWN', 'Squad broken – falling back': 'SQUAD BROKEN, FALLING BACK',
  Rallied: 'RALLIED', 'Brewed up': 'BREWED UP', 'Out of fuel – forced landing': 'NO FUEL, FORCED LANDING',
  'Repaired and re-crewed at depot': 'REPAIRED AT DEPOT',
};

interface Line { el: HTMLElement; text: string; shown: number }

/**
 * Left-edge radio log: teletype paper, lines typed out character by character.
 * Reports contacts ("T-55 #3 — CONTACT, ARMOR, BEARING 040"), own damage, kills and command traffic.
 */
export class RadioLog {
  readonly el: HTMLElement;
  private tape: HTMLElement;
  private lamp: HTMLElement;
  private queue: Line[] = [];
  private lastContact = new Map<string, number>();
  onLine: (level: string) => void = () => {};

  constructor(private world: World, faction: FactionId) {
    const th = FACTION_THEME[faction];
    this.el = document.createElement('div');
    this.el.className = 'plate radiolog';
    this.el.innerHTML = `<div class="hdr"><span class="label">${th.callsign} NET · 42.150 MHZ</span><span class="lamp"></span></div><div class="teletype"></div>`;
    this.tape = this.el.querySelector('.teletype')!;
    this.lamp = this.el.querySelector('.lamp')!;
    const w = world;
    w.bus.on('spotted', (e) => {
      if (e.by !== 0) return;
      const cls = contactClass(e.unit.def);
      if (w.time - (this.lastContact.get(cls) ?? -99) < 12) return;
      this.lastContact.set(cls, w.time);
      // Nearest friendly unit reports, with the bearing from its position.
      let rep = null, best = Infinity;
      for (const u of w.units) if (u.team === 0 && u.alive && u.onMap) { const d = (u.x - e.unit.x) ** 2 + (u.y - e.unit.y) ** 2; if (d < best) { best = d; rep = u; } }
      if (!rep) return;
      this.add(`${unitLabel(rep)} — CONTACT, ${cls}, BEARING ${bearing(rep.x, rep.y, e.unit.x, e.unit.y)}`, 'warn');
    });
    w.bus.on('status', (e) => {
      if (e.unit.team !== 0) return;
      if (/^Boarded|^Dismounted/.test(e.text) && w.time > 5) return this.add(`${unitLabel(e.unit)} — ${e.text.toUpperCase()}`, 'info');
      if (/^Boarded|^Dismounted/.test(e.text)) return;
      if (/killed$/.test(e.text)) return this.add(`${unitLabel(e.unit)} — CASUALTY, ${e.text.replace(' killed', '').toUpperCase()}`, 'warn');
      this.add(`${unitLabel(e.unit)} — ${STATUS[e.text] ?? e.text.toUpperCase()}`, /RALLIED|FREE|OUT|REPAIRED/.test(STATUS[e.text] ?? '') ? 'good' : 'warn');
    });
    w.bus.on('kill', (e) => {
      if (e.unit.ai.detonated) return;
      if (e.unit.team === 0) this.add(`${unitLabel(e.unit)} — ${e.unit.inf ? 'WIPED OUT' : e.brewUp ? 'BREWED UP, NO SURVIVORS' : 'KNOCKED OUT'}`, 'warn');
      else if (e.unit.seenAt[0] > w.time - 3) this.add(`CONFIRMED — ENEMY ${e.unit.def.name.toUpperCase()} DESTROYED`, 'good');
    });
    w.bus.on('message', (e) => { if (e.team === undefined || e.team === null || e.team === 0) this.add(e.text.toUpperCase(), e.level ?? 'info'); });
  }

  add(text: string, level: 'info' | 'warn' | 'good' | string = 'info') {
    const el = document.createElement('div');
    el.className = `ln ${level}`;
    const ln: Line = { el, text, shown: 0 };
    el.innerHTML = `<span class="t">${missionClock(this.world.time)}</span><span class="x"></span>`;
    this.tape.appendChild(el);
    while (this.tape.children.length > 14) this.tape.firstChild?.remove();
    this.queue.push(ln);
    this.onLine(level);
  }

  /** Types queued lines out at teleprinter speed. */
  update(dt: number) {
    const cur = this.queue[0];
    this.lamp.classList.toggle('on', !!cur);
    if (!cur) return;
    cur.el.classList.add('cur');
    cur.shown = Math.min(cur.text.length, cur.shown + dt * (this.queue.length > 3 ? 160 : 70));
    (cur.el.querySelector('.x') as HTMLElement).textContent = cur.text.slice(0, Math.floor(cur.shown));
    if (cur.shown >= cur.text.length) { cur.el.classList.remove('cur'); this.queue.shift(); }
  }
}

import type { Camera } from '../core/camera';
import { AMMO } from '../data/ammo';
import type { World } from '../sim/world';
import { onSettings, setSetting, settings } from '../ui/settings';

/**
 * Placeholder audio: every sound is synthesised with WebAudio (noise bursts, filtered thumps, sweeps).
 * Hooks: the sim emits events ('shot', 'impact', 'explosion', 'missile'…); this module maps them to
 * sound ids. Weapon sound ids come from the weapon data (WeaponDef.sound), so new weapons only need
 * an existing id – or a new recipe added to RECIPES below. Real samples could replace recipes later.
 */
type Recipe = (a: AudioContext, out: AudioNode, t: number, v: number) => void;

let noiseBuf: AudioBuffer | null = null;
function noise(a: AudioContext): AudioBufferSourceNode {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = a.createBufferSource();
  s.buffer = noiseBuf;
  s.loopStart = Math.random();
  return s;
}

function burst(a: AudioContext, out: AudioNode, t: number, v: number, type: BiquadFilterType, f0: number, f1: number, dur: number, q = 0.7) {
  const n = noise(a), f = a.createBiquadFilter(), g = a.createGain();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  n.connect(f).connect(g).connect(out);
  n.start(t, Math.random()); n.stop(t + dur + 0.05);
}

function tone(a: AudioContext, out: AudioNode, t: number, v: number, type: OscillatorType, f0: number, f1: number, dur: number) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.05);
}

const RECIPES: Record<string, Recipe> = {
  // ---- interface: mechanical, never tonal "dings"
  click: (a, o, t, v) => { burst(a, o, t, v * 0.5, 'highpass', 4200, 2500, 0.018, 0.9); tone(a, o, t, v * 0.35, 'sine', 160, 90, 0.04); },
  clack: (a, o, t, v) => { burst(a, o, t, v * 0.7, 'bandpass', 2400, 1200, 0.03, 2); tone(a, o, t + 0.005, v * 0.4, 'square', 110, 70, 0.05); },
  stamp: (a, o, t, v) => { burst(a, o, t, v, 'lowpass', 420, 60, 0.18); tone(a, o, t, v * 0.9, 'sine', 75, 40, 0.16); },
  paper: (a, o, t, v) => { burst(a, o, t, v * 0.35, 'bandpass', 3000, 5200, 0.16, 0.6); },
  // ---- radio: squelch open, band-limited static, squelch tail
  radio: (a, o, t, v) => {
    burst(a, o, t, v * 0.55, 'bandpass', 2100, 1500, 0.05, 3);
    const n = noise(a), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 6; i++) g.gain.setValueAtTime(v * (0.12 + Math.random() * 0.18), t + 0.03 + i * 0.035);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.32);
    n.connect(f).connect(g).connect(o); n.start(t, Math.random()); n.stop(t + 0.35);
    burst(a, o, t + 0.3, v * 0.45, 'highpass', 3000, 1800, 0.06, 1);
  },
  radiowarn: (a, o, t, v) => { RECIPES.radio(a, o, t, v); tone(a, o, t + 0.05, v * 0.12, 'square', 820, 820, 0.08); tone(a, o, t + 0.16, v * 0.12, 'square', 820, 820, 0.08); },
  cannon: (a, o, t, v) => { burst(a, o, t, v, 'lowpass', 1400, 120, 0.9); tone(a, o, t, v * 0.9, 'sine', 90, 35, 0.5); },
  rifle: (a, o, t, v) => { for (let i = 0; i < 3; i++) burst(a, o, t + i * 0.11 + Math.random() * 0.05, v * 0.5, 'highpass', 2400, 900, 0.07); },
  mg: (a, o, t, v) => { for (let i = 0; i < 6; i++) burst(a, o, t + i * 0.06, v * 0.45, 'bandpass', 1500, 600, 0.06, 1.2); },
  hmg: (a, o, t, v) => { for (let i = 0; i < 5; i++) { burst(a, o, t + i * 0.085, v * 0.55, 'lowpass', 1300, 300, 0.09); } },
  flak: (a, o, t, v) => { for (let i = 0; i < 6; i++) { burst(a, o, t + i * 0.05, v * 0.5, 'lowpass', 1800, 400, 0.07); tone(a, o, t + i * 0.05, v * 0.2, 'square', 140, 60, 0.04); } },
  rocket: (a, o, t, v) => { burst(a, o, t, v * 0.7, 'bandpass', 600, 2200, 0.7, 2); burst(a, o, t, v * 0.4, 'lowpass', 900, 200, 0.25); },
  missile: (a, o, t, v) => { burst(a, o, t, v * 0.8, 'lowpass', 500, 150, 0.3); burst(a, o, t + 0.05, v * 0.5, 'bandpass', 900, 2600, 1.4, 3); },
  explosion: (a, o, t, v) => { burst(a, o, t, v, 'lowpass', 900, 60, 1.8); tone(a, o, t, v, 'sine', 70, 25, 1.1); },
  clang: (a, o, t, v) => { tone(a, o, t, v * 0.5, 'triangle', 1300, 900, 0.25); tone(a, o, t, v * 0.3, 'triangle', 1950, 1500, 0.2); },
  ricochet: (a, o, t, v) => { tone(a, o, t, v * 0.35, 'sine', 3400, 1300, 0.22); },
  thud: (a, o, t, v) => { burst(a, o, t, v * 0.5, 'lowpass', 500, 80, 0.35); },
};

// ---------------------------------------------------------------- shared context
let actx: AudioContext | null = null;
let master: GainNode | null = null;
const recent = new Map<string, number>();

/** Must run inside a user gesture (browser autoplay policy). Safe to call repeatedly. */
export function unlockAudio() {
  if (actx) { if (actx.state === 'suspended') void actx.resume(); return; }
  try {
    actx = new AudioContext();
    master = actx.createGain();
    master.gain.value = settings.sound ? settings.volume : 0;
    const comp = actx.createDynamicsCompressor();
    master.connect(comp).connect(actx.destination);
    onSettings((s) => { if (master) master.gain.value = s.sound ? s.volume : 0; });
  } catch { actx = null; }
}

function play(id: string, vol: number, pan: number) {
  const a = actx, m = master;
  if (!a || !m) return;
  const r = RECIPES[id];
  if (!r) return;
  // Rate limit: at most one instance of a sound id every 40 ms.
  const now = a.currentTime;
  if ((recent.get(id) ?? -1) > now - 0.04) return;
  recent.set(id, now);
  const p = a.createStereoPanner();
  p.pan.value = pan;
  p.connect(m);
  r(a, p, now + 0.01, vol);
}

/** Interface sounds (menus and HUD). */
export const uiSound = (id: 'click' | 'clack' | 'stamp' | 'paper' | 'radio' | 'radiowarn', vol = 0.7) => play(id, vol, 0);

/** Battlefield audio for one match: positional effects plus rotor and engine loops. */
export class Audio {
  private rotor: { gain: GainNode } | null = null;
  private engine: { gain: GainNode; osc: OscillatorNode } | null = null;

  constructor(private world: World, private cam: Camera) {
    const bus = world.bus;
    bus.on('shot', (e) => this.at(e.weapon.def.sound, e.x, e.y, AMMO[e.ammoId].caliber >= 60 ? 1 : 0.6));
    bus.on('impact', (e) => {
      if (e.kind === 'pen') this.at('clang', e.x, e.y, 0.9);
      else if (e.kind === 'ricochet') this.at('ricochet', e.x, e.y, 0.8);
      else if (AMMO[e.ammoId].blast >= 6) this.at('thud', e.x, e.y, 0.7);
    });
    bus.on('explosion', (e) => this.at('explosion', e.x, e.y, Math.min(1, 0.5 + e.size * 0.25)));
  }

  unlock() { unlockAudio(); }
  get muted() { return !settings.sound; }
  toggleMute() { setSetting('sound', !settings.sound); }
  ui(id: Parameters<typeof uiSound>[0]) { uiSound(id); }

  /** Positional sound: louder near the camera centre, panned by screen x, quieter zoomed out. */
  at(id: string, x: number, y: number, vol = 1) {
    if (!actx) return;
    const c = this.cam;
    const b = c.bounds();
    const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    const d = Math.hypot(x - c.x, y - c.y);
    const near = 1 - Math.min(1, d / (span * 0.9));
    if (near <= 0.02) return;
    const zoomFactor = Math.min(1, 0.35 + c.zoom * 0.3);
    const pan = Math.max(-1, Math.min(1, (x - c.x) / (span / 2)));
    play(id, vol * near * near * zoomFactor, pan);
  }

  /** Per-frame: rotor and engine loops follow aircraft and moving vehicles near the camera. */
  update() {
    const a = actx, m = master;
    if (!a || !m) return;
    let rotor = 0, engine = 0;
    const b = this.cam.bounds();
    const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    for (const u of this.world.units) {
      if (!u.alive || u.carrier) continue;
      const near = 1 - Math.min(1, Math.hypot(u.x - this.cam.x, u.y - this.cam.y) / span);
      if (near <= 0) continue;
      if (u.isAir && u.def.category !== 'drone') rotor = Math.max(rotor, near);
      else if (!u.isAir && !u.inf && u.mob.moving && (u.team === 0 || u.seenAt[0] > this.world.time - 1)) engine += near * Math.min(1, u.speed / 6) * 0.35;
    }
    if (rotor > 0 && !this.rotor) {
      const src = noise(a); src.loop = true;
      const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      const gain = a.createGain(); gain.gain.value = 0;
      const am = a.createGain(); am.gain.value = 0.5;
      const lfo = a.createOscillator(); lfo.frequency.value = 11; // blade slap
      const lfoGain = a.createGain(); lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain).connect(am.gain);
      src.connect(f).connect(am).connect(gain).connect(m);
      src.start(); lfo.start();
      this.rotor = { gain };
    }
    if (engine > 0 && !this.engine) {
      // Diesel rumble: low sawtooth through a lowpass, plus filtered noise for track clatter.
      const osc = a.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 34;
      const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
      const src = noise(a); src.loop = true;
      const nf = a.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 420; nf.Q.value = 0.8;
      const ng = a.createGain(); ng.gain.value = 0.25;
      const gain = a.createGain(); gain.gain.value = 0;
      osc.connect(f).connect(gain);
      src.connect(nf).connect(ng).connect(gain);
      gain.connect(m);
      osc.start(); src.start();
      this.engine = { gain, osc };
    }
    if (this.rotor) this.rotor.gain.gain.setTargetAtTime(rotor * 0.5, a.currentTime, 0.2);
    if (this.engine) {
      this.engine.gain.gain.setTargetAtTime(Math.min(0.45, engine * 0.4), a.currentTime, 0.3);
      this.engine.osc.frequency.setTargetAtTime(30 + Math.min(1, engine) * 14, a.currentTime, 0.5);
    }
  }

  /** Silences this match's loops (the shared context stays for the menus). */
  dispose() {
    const a = actx;
    if (!a) return;
    if (this.rotor) this.rotor.gain.gain.setTargetAtTime(0, a.currentTime, 0.05);
    if (this.engine) { this.engine.gain.gain.setTargetAtTime(0, a.currentTime, 0.05); this.engine.osc.stop(a.currentTime + 0.3); }
  }
}

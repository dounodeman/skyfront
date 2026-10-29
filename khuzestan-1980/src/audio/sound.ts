import type { Camera } from '../core/camera';
import { AMMO } from '../data/ammo';
import type { World } from '../sim/world';

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
  blip: (a, o, t, v) => { tone(a, o, t, v * 0.25, 'square', 880, 880, 0.05); tone(a, o, t + 0.07, v * 0.2, 'square', 660, 660, 0.05); },
  alert: (a, o, t, v) => { tone(a, o, t, v * 0.25, 'sawtooth', 520, 520, 0.12); tone(a, o, t + 0.16, v * 0.25, 'sawtooth', 390, 390, 0.18); },
};

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rotor: { src: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  private recent = new Map<string, number>();
  muted = false;
  volume = 0.6;

  constructor(private world: World, private cam: Camera) {
    const bus = world.bus;
    bus.on('shot', (e) => this.at(e.weapon.def.sound, e.x, e.y, AMMO[e.ammoId].caliber >= 60 ? 1 : 0.6));
    bus.on('impact', (e) => {
      if (e.kind === 'pen') this.at('clang', e.x, e.y, 0.9);
      else if (e.kind === 'ricochet') this.at('ricochet', e.x, e.y, 0.8);
      else if (AMMO[e.ammoId].blast >= 6) this.at('thud', e.x, e.y, 0.7);
    });
    bus.on('explosion', (e) => this.at('explosion', e.x, e.y, Math.min(1, 0.5 + e.size * 0.25)));
    bus.on('message', (e) => { if (e.level === 'warn') this.ui('alert'); });
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : this.volume; }

  /** Interface sound (not positional). */
  ui(id: string) { this.play(id, 0.6, 0); }

  /** Positional sound: louder near the camera centre, panned by screen x, quieter zoomed out. */
  at(id: string, x: number, y: number, vol = 1) {
    if (!this.ctx) return;
    const c = this.cam;
    const b = c.bounds();
    const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    const d = Math.hypot(x - c.x, y - c.y);
    const near = 1 - Math.min(1, d / (span * 0.9));
    if (near <= 0.02) return;
    const zoomFactor = Math.min(1, 0.35 + c.zoom * 0.3);
    const pan = Math.max(-1, Math.min(1, (x - c.x) / (span / 2)));
    this.play(id, vol * near * near * zoomFactor, pan);
  }

  private play(id: string, vol: number, pan: number) {
    const a = this.ctx, m = this.master;
    if (!a || !m || this.muted) return;
    const r = RECIPES[id];
    if (!r) return;
    // Rate limit: at most one instance of a sound id every 40 ms.
    const now = a.currentTime;
    if ((this.recent.get(id) ?? -1) > now - 0.04) return;
    this.recent.set(id, now);
    const p = a.createStereoPanner();
    p.pan.value = pan;
    p.connect(m);
    r(a, p, now + 0.01, vol);
  }

  /** Per-frame: rotor loop volume follows helicopters near the camera. */
  update() {
    const a = this.ctx, m = this.master;
    if (!a || !m) return;
    let level = 0;
    const b = this.cam.bounds();
    const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    for (const u of this.world.units) {
      if (!u.isAir || !u.alive || u.carrier || u.def.category === 'drone') continue;
      const d = Math.hypot(u.x - this.cam.x, u.y - this.cam.y);
      level = Math.max(level, 1 - Math.min(1, d / span));
    }
    if (level > 0 && !this.rotor) {
      const src = noise(a); src.loop = true;
      const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      const gain = a.createGain(); gain.gain.value = 0;
      const am = a.createGain(); am.gain.value = 0.5;
      const lfo = a.createOscillator(); lfo.frequency.value = 11; // blade slap
      const lfoGain = a.createGain(); lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain).connect(am.gain);
      src.connect(f).connect(am).connect(gain).connect(m);
      src.start(); lfo.start();
      this.rotor = { src, gain, lfo };
    }
    if (this.rotor) this.rotor.gain.gain.setTargetAtTime(this.muted ? 0 : level * 0.5, a.currentTime, 0.2);
  }

  dispose() { try { void this.ctx?.close(); } catch { /* ignore */ } this.ctx = null; }
}

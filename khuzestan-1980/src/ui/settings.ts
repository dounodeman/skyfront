/**
 * Presentation settings (all visual/audio, never gameplay). Persisted per browser when storage works.
 */
export interface Settings {
  grain: boolean;
  vignette: boolean;
  scanlines: boolean; // radar / minimap / drone feed only
  shimmer: boolean; // heat haze over burning wrecks
  shake: boolean; // camera shake on heavy fire
  cleanHud: boolean; // accessibility: no textures, grain, scanlines
  floatText: boolean;
  sound: boolean;
  volume: number; // 0..1
}

const DEFAULTS: Settings = { grain: true, vignette: true, scanlines: true, shimmer: true, shake: true, cleanHud: false, floatText: true, sound: true, volume: 0.7 };
const KEY = 'khz1980.settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* private mode etc. */ }
  return { ...DEFAULTS };
}

export const settings: Settings = load();
const listeners: Array<(s: Settings) => void> = [];

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  settings[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  document.documentElement.classList.toggle('clean', settings.cleanHud);
  for (const l of listeners) l(settings);
}
export function onSettings(fn: (s: Settings) => void) { listeners.push(fn); }
/** Effective switches once "clean HUD" is applied. */
export const fx = {
  get grain() { return settings.grain && !settings.cleanHud; },
  get vignette() { return settings.vignette && !settings.cleanHud; },
  get scanlines() { return settings.scanlines && !settings.cleanHud; },
  get shimmer() { return settings.shimmer && !settings.cleanHud; },
};
export function initSettings() { document.documentElement.classList.toggle('clean', settings.cleanHud); }

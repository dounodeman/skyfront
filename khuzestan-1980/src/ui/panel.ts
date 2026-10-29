import { uiSound } from '../audio/sound';
import { setSetting, settings, type Settings } from './settings';

/**
 * Metal switch panel (pause / settings): guarded toggle switches with lamps, and dials for
 * volume and game speed. Used in-game (pause) and from the menu table's switch-panel object.
 */
const SWITCHES: Array<[keyof Settings, string]> = [
  ['grain', 'Film grain'], ['vignette', 'Vignette'], ['scanlines', 'Scope lines'], ['shimmer', 'Heat haze'],
  ['shake', 'Cam shake'], ['floatText', 'Callouts'], ['sound', 'Sound'], ['cleanHud', 'Clean HUD'],
];
const SPEEDS = [0.5, 1, 2, 4];

export interface PanelOpts {
  title: string;
  /** Game speed dial (in-game only). */
  speed?: { get: () => number; set: (v: number) => void };
  actions: Array<[string, string, () => void]>; // [id, label, handler]
}

export function switchPanel(opts: PanelOpts): HTMLElement {
  const o = document.createElement('div');
  o.className = 'overlay';
  const render = () => {
    const vol = settings.volume;
    const sp = opts.speed ? opts.speed.get() : 1;
    o.innerHTML = `<div class="plate panel chamfer">
      <h1>${opts.title}</h1><span class="label">Control panel · switch up = on</span>
      <div class="grid recess">${SWITCHES.map(([k, l]) => `<button class="bigtog ${settings[k] ? 'on' : ''}" data-s="${k}"><span class="lampx"></span><span class="guard"></span><span class="cap">${l}</span></button>`).join('')}</div>
      <div class="dials recess">
        <div class="dial"><div class="knob" data-d="vol" style="--a:${-135 + vol * 270}deg"></div><span class="label">Volume</span><span class="ticks">${Math.round(vol * 10)}/10</span></div>
        ${opts.speed ? `<div class="dial"><div class="knob" data-d="speed" style="--a:${-135 + (SPEEDS.indexOf(sp) / (SPEEDS.length - 1)) * 270}deg"></div><span class="label">Game speed</span><span class="ticks">×${sp}</span></div>` : ''}
      </div>
      <div class="actions">${opts.actions.map(([id, l], i) => `<button class="btn metal ${i === 0 ? '' : ''}" data-a="${id}">${l}</button>`).join('')}</div></div>`;
  };
  render();
  o.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-s],[data-d],[data-a]');
    if (!t) return;
    if (t.dataset.s) {
      const k = t.dataset.s as keyof Settings;
      setSetting(k, !settings[k] as never);
      uiSound('clack');
      render();
    } else if (t.dataset.d === 'vol') {
      setSetting('volume', settings.volume >= 1 ? 0 : Math.round((settings.volume + 0.1) * 10) / 10);
      uiSound('click'); render();
    } else if (t.dataset.d === 'speed' && opts.speed) {
      const i = SPEEDS.indexOf(opts.speed.get());
      opts.speed.set(SPEEDS[(i + 1) % SPEEDS.length]);
      uiSound('click'); render();
    } else if (t.dataset.a) {
      uiSound('click');
      opts.actions.find(([id]) => id === t.dataset.a)?.[2]();
    }
  });
  return o;
}

import { listen, newSession } from './ui/events';
import { Camera } from './core/camera';
import { TEAM_PLAYER, TILE } from './core/constants';
import { FogGrid } from './sim/systems/vision';
import { GameLoop } from './core/loop';
import { Renderer } from './render/renderer';
import { PostFX } from './render/post';
import type { Unit } from './sim/entity';
import type { World } from './sim/world';
import { Controls, type GameShell } from './ui/controls';
import { Hud } from './ui/hud';
import { Radar } from './ui/radar';
import { Audio, uiSound } from './audio/sound';
import { switchPanel } from './ui/panel';
import { applyFactionTheme } from './ui/theme/tokens';
import { resetLabels } from './ui/labels';

/**
 * Game shell: owns the loop, camera, renderer, input and HUD for one running match.
 * The World (simulation) knows nothing about any of these.
 */
export class Game implements GameShell {
  cam = new Camera();
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  post: PostFX;
  controls: Controls;
  hud: Hud;
  radar: Radar;
  loop: GameLoop;
  time = 0;
  pausedOverlay: HTMLElement | null = null;
  /** Hooks other modules attach to. */
  frameHooks: Array<(dt: number) => void> = [];
  onExit: () => void = () => {};
  audio: Audio;
  revealAll = false;
  private session: AbortController;

  constructor(public world: World) {
    this.session = newSession();
    resetLabels();
    applyFactionTheme(world.teams[0].faction);
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    if (!world.fog) world.fog = Object.assign(new FogGrid(world.map.w, world.map.h), { team: TEAM_PLAYER as 0 });
    this.renderer = new Renderer(this.canvas, world, this.cam, (u) => this.isVisible(u));
    this.post = new PostFX(document.getElementById('post') as HTMLCanvasElement);
    this.controls = new Controls(this);
    this.radar = new Radar(world, this.cam, this.renderer.terrain.baseCanvas, (u) => this.isVisible(u), (x, y, q) => this.controls.orderAt(x, y, q), () => uiSound('clack'));
    this.hud = new Hud(world, this.controls, this.radar, world.teams[0].faction, this.renderer.terrain.baseCanvas, (u) => this.isVisible(u));
    this.hud.onCard('pause', () => this.togglePause());
    this.hud.onCard('help', () => this.showHelp());
    this.hud.onKey = () => uiSound('click', 0.5);
    this.hud.log.onLine = (level) => uiSound(level === 'warn' ? 'radiowarn' : 'radio', 0.45);
    this.loop = new GameLoop((dt) => this.world.step(dt), (dt) => this.frame(dt));
    this.audio = new Audio(world, this.cam);
    listen(window, 'pointerdown', () => this.audio.unlock());
    listen(window, 'keydown', (e) => { this.audio.unlock(); if (e.key.toLowerCase() === 'm') { this.audio.toggleMute(); this.notify(this.audio.muted ? 'Sound muted' : 'Sound on'); } });
    listen(window, 'resize', () => { this.renderer.resize(); this.post.resize(); });
    world.bus.on('end', (e) => this.showResults(e.winner, e.reason));
  }

  /** Order acknowledgement: radio squelch. */
  onOrder() { uiSound('radio', 0.3); }
  onOrderAt(kind: 'move' | 'amove' | 'attack' | 'unload', x: number, y: number, from: { x: number; y: number }) {
    this.renderer.feedback.order(kind, x, y, from.x, from.y);
  }

  /** Tear down: stop the loop and remove every DOM listener and HUD element of this match. */
  dispose() {
    this.loop.stop();
    this.audio.dispose();
    this.session.abort();
    document.getElementById('hud')!.innerHTML = '';
    document.getElementById('screens')!.innerHTML = '';
    const pc = document.getElementById('post') as HTMLCanvasElement;
    pc.getContext('2d')!.clearRect(0, 0, pc.width, pc.height);
  }

  /** After-action report: typed sheet with a slammed result stamp. */
  showResults(winner: number | null, reason: string) {
    const w = this.world;
    const won = winner === TEAM_PLAYER;
    const [me, foe] = w.teams;
    const o = document.createElement('div');
    o.className = 'overlay';
    const verdict = won ? 'VICTORY' : winner === null ? 'STALEMATE' : 'DEFEAT';
    o.innerHTML = `<div class="sheet report">
      <div class="formno">FORM AAR-1 · AFTER-ACTION REPORT · ${me.name.toUpperCase()} COMMAND</div>
      <h1 style="margin-top:6px">${reason}</h1>
      <div class="field">Duration</div><div class="typed">${Math.floor(w.time / 60)} MIN ${Math.floor(w.time % 60)} SEC</div>
      <div class="field">Losses</div>
      <div class="line hdr"><span></span><span>SIDE</span><span class="r">UNITS</span><span class="r">VALUE</span></div>
      <div class="line"><span></span><span>${me.name.toUpperCase()} (YOU)</span><span class="r">${w.stats.lost[0]}</span><span class="r">${w.stats.lostValue[0]}</span></div>
      <div class="line"><span></span><span>${foe.name.toUpperCase()}</span><span class="r">${w.stats.lost[1]}</span><span class="r">${w.stats.lostValue[1]}</span></div>
      <div class="field">Tickets remaining</div><div class="typed">${Math.max(0, Math.ceil(me.tickets))} / ${Math.max(0, Math.ceil(foe.tickets))}</div>
      <div style="margin-top:18px"><button class="btn" data-a="view">View battlefield</button><button class="btn go" data-a="menu">Return to map table</button></div>
      <span class="stamp slam ${won ? 'green' : ''}">${verdict}</span></div>`;
    listen(o, 'click', (ev) => {
      const a = (ev.target as HTMLElement).dataset.a;
      if (a) uiSound('click');
      if (a === 'view') o.remove();
      if (a === 'menu') this.onExit();
    });
    document.getElementById('screens')!.appendChild(o);
    setTimeout(() => { o.querySelector('.slam')?.classList.add('go'); }, 250);
    setTimeout(() => uiSound('stamp'), 520);
  }

  /** Fog-of-war predicate. */
  isVisible(u: Unit): boolean {
    if (this.revealAll || u.team === TEAM_PLAYER || !this.world.fog) return true;
    if (!u.alive) {
      // Wrecks stay on the map once their tile has been seen.
      const i = Math.floor(u.y / TILE) * this.world.map.w + Math.floor(u.x / TILE);
      return this.world.fog.vis[i] > 0;
    }
    return u.seenAt[TEAM_PLAYER] >= this.world.time - 0.5;
  }

  notify(msg: string) { this.hud.message(msg); }

  start() {
    const mine = this.world.units.filter((u) => u.team === TEAM_PLAYER);
    if (mine.length) {
      const x = mine.reduce((s, u) => s + u.x, 0) / mine.length, y = mine.reduce((s, u) => s + u.y, 0) / mine.length;
      this.cam.centerOn(x + 250, y);
    }
    this.cam.zoom = 1.8;
    this.loop.start();
  }

  stop() { this.loop.stop(); }

  private frame(dt: number) {
    this.time += dt;
    this.controls.update(dt);
    const simDt = this.loop.paused ? 0 : dt * this.loop.timeScale;
    this.renderer.effects.update(simDt);
    this.renderer.feedback.update(simDt);
    for (const h of this.frameHooks) h(dt);
    this.audio.update();
    this.renderer.draw({
      selected: this.controls.selectedIds,
      hoverId: this.controls.hoverId,
      box: this.controls.box,
      time: this.time,
      visible: (u) => this.isVisible(u),
      showPaths: true,
      cursorMode: this.controls.mode,
    });
    this.post.draw();
    this.hud.update(dt, this.time);
    this.canvas.style.cursor = this.controls.mode !== 'normal' ? 'cell' : this.controls.hoverId && this.world.get(this.controls.hoverId)?.team !== TEAM_PLAYER && this.controls.selection.length ? 'crosshair' : 'default';
  }

  togglePause() {
    if (this.world.over) return;
    this.loop.paused = !this.loop.paused;
    uiSound('clack');
    if (this.loop.paused) {
      const o = switchPanel({
        title: 'Paused',
        speed: { get: () => this.loop.timeScale, set: (v) => { this.loop.timeScale = v; } },
        actions: [['resume', 'Resume', () => this.togglePause()], ['help', 'Field manual', () => this.showHelp()], ['quit', 'Quit to map table', () => { this.togglePause(); this.onExit(); }]],
      });
      document.getElementById('screens')!.appendChild(o);
      this.pausedOverlay = o;
    } else {
      this.pausedOverlay?.remove();
      this.pausedOverlay = null;
    }
  }

  showHelp() {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.style.zIndex = '70';
    o.innerHTML = `<div class="sheet" style="width:720px;transform:rotate(-0.6deg)"><div class="formno">FM 80-2 · FIELD MANUAL · QUICK REFERENCE CARD</div><h1 style="margin:6px 0 12px">Controls</h1>${HELP_HTML}<div style="margin-top:14px"><button class="btn">Close</button></div></div>`;
    o.querySelector('button')!.addEventListener('click', () => { uiSound('paper'); o.remove(); });
    document.getElementById('screens')!.appendChild(o);
    uiSound('paper');
  }
}

export const HELP_HTML = `<div class="keys2">
<div><kbd>LMB</kbd> select · drag to box-select</div>
<div><kbd>SHIFT</kbd>+click add / remove</div>
<div><kbd>DBL-CLICK</kbd> select all of type on screen</div>
<div><kbd>RMB</kbd> move / attack / board transport</div>
<div><kbd>SHIFT</kbd>+RMB queue waypoint</div>
<div><kbd>Q</kbd> attack-move, then click</div>
<div><kbd>X</kbd> halt · <kbd>H</kbd> hold position</div>
<div><kbd>F</kbd> cycle formation</div>
<div><kbd>E</kbd> dismount · <kbd>U</kbd> unload at point</div>
<div><kbd>C</kbd> (hold) turrets follow cursor</div>
<div><kbd>CTRL+1–9</kbd> set group · <kbd>1–9</kbd> recall</div>
<div><kbd>WASD</kbd> / edge pan · wheel zoom</div>
<div><kbd>SPACE</kbd> centre on selection</div>
<div><kbd>[</kbd> <kbd>]</kbd> speed · <kbd>ESC</kbd> panel · <kbd>M</kbd> mute</div>
<div>Radar: LMB pan · RMB order · switches set layers</div>
</div>`;

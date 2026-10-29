import { Camera } from './core/camera';
import { TEAM_PLAYER, TILE } from './core/constants';
import { FogGrid } from './sim/systems/vision';
import { GameLoop } from './core/loop';
import { Renderer } from './render/renderer';
import type { Unit } from './sim/entity';
import type { World } from './sim/world';
import { Controls, type GameShell } from './ui/controls';
import { Hud } from './ui/hud';
import { Minimap } from './ui/minimap';

/**
 * Game shell: owns the loop, camera, renderer, input and HUD for one running match.
 * The World (simulation) knows nothing about any of these.
 */
export class Game implements GameShell {
  cam = new Camera();
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  controls: Controls;
  hud: Hud;
  minimap: Minimap;
  loop: GameLoop;
  time = 0;
  pausedOverlay: HTMLElement | null = null;
  /** Hooks other modules (audio, effects, fog) attach to. */
  frameHooks: Array<(dt: number) => void> = [];
  onExit: () => void = () => {};

  constructor(public world: World) {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    if (!world.fog) world.fog = Object.assign(new FogGrid(world.map.w, world.map.h), { team: TEAM_PLAYER as 0 });
    this.renderer = new Renderer(this.canvas, world, this.cam);
    this.controls = new Controls(this);
    this.minimap = new Minimap(world, this.cam, this.renderer.terrain.baseCanvas, (u) => this.isVisible(u), (x, y, q) => this.controls.orderAt(x, y, q));
    this.minimap.fog = this.renderer.fog.canvas;
    this.hud = new Hud(world, this.controls, this.minimap, TEAM_PLAYER);
    this.hud.onCard('pause', () => this.togglePause());
    this.hud.onCard('help', () => this.showHelp());
    this.loop = new GameLoop((dt) => this.world.step(dt), (dt) => this.frame(dt));
    window.addEventListener('resize', () => this.renderer.resize());

    world.bus.on('status', (e) => { if (e.unit.team === TEAM_PLAYER) this.hud.message(`${e.unit.def.name}: ${e.text}`, 'warn'); });
    world.bus.on('message', (e) => { if (e.team === undefined || e.team === null || e.team === TEAM_PLAYER) this.hud.message(e.text, e.level ?? 'info'); });
  }

  /** Fog-of-war predicate (replaced when fog is enabled). */
  isVisible(u: Unit): boolean {
    if (this.revealAll || u.team === TEAM_PLAYER || !this.world.fog) return true;
    if (!u.alive) {
      // Wrecks stay on the map once their tile has been seen.
      const i = Math.floor(u.y / TILE) * this.world.map.w + Math.floor(u.x / TILE);
      return this.world.fog.vis[i] > 0;
    }
    return u.seenAt[TEAM_PLAYER] >= this.world.time - 0.5;
  }
  revealAll = false;

  notify(msg: string) { this.hud.message(msg); }

  start() {
    // Start the camera over the player's units.
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
    this.renderer.effects.update(this.loop.paused ? 0 : dt * this.loop.timeScale);
    this.controls.update(dt);
    for (const h of this.frameHooks) h(dt);
    this.renderer.draw({
      selected: this.controls.selectedIds,
      hoverId: this.controls.hoverId,
      box: this.controls.box,
      time: this.time,
      visible: (u) => this.isVisible(u),
      showPaths: true,
      cursorMode: this.controls.mode,
    });
    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) { this.minimap.draw(); this.minimapTimer = 0.1; }
    this.hud.update(dt);
    this.canvas.style.cursor = this.controls.mode !== 'normal' ? 'cell' : this.controls.hoverId && this.world.get(this.controls.hoverId)?.team !== TEAM_PLAYER && this.controls.selection.length ? 'crosshair' : 'default';
  }
  private minimapTimer = 0;

  togglePause() {
    if (this.world.over) return;
    this.loop.paused = !this.loop.paused;
    if (this.loop.paused) {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.innerHTML = `<div class="panel menu" style="width:420px;text-align:center"><h1 style="font-size:26px">Paused</h1>
        <div class="row" style="justify-content:center;margin-top:16px;flex-direction:column">
        <button class="btn primary" data-a="resume">Resume</button>
        <button class="btn" data-a="help">Controls</button>
        <button class="btn" data-a="quit">Quit to menu</button></div></div>`;
      o.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).dataset.a;
        if (a === 'resume') this.togglePause();
        else if (a === 'help') this.showHelp();
        else if (a === 'quit') { this.togglePause(); this.onExit(); }
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
    o.innerHTML = `<div class="panel menu"><h1 style="font-size:24px">Controls</h1>${HELP_HTML}<div class="row"><button class="btn primary">Close</button></div></div>`;
    o.querySelector('button')!.addEventListener('click', () => o.remove());
    document.getElementById('screens')!.appendChild(o);
  }
}

export const HELP_HTML = `<div class="keys">
<div><kbd>Left-click</kbd> select · <kbd>drag</kbd> box-select</div>
<div><kbd>Shift</kbd>+click add/remove</div>
<div><kbd>Double-click</kbd> select all of type on screen</div>
<div><kbd>Right-click</kbd> move / attack / board transport</div>
<div><kbd>Shift</kbd>+right-click queue waypoint</div>
<div><kbd>Q</kbd> attack-move, then left-click</div>
<div><kbd>X</kbd> stop · <kbd>H</kbd> hold position</div>
<div><kbd>F</kbd> cycle formation (line/column/wedge/box)</div>
<div><kbd>E</kbd> dismount here · <kbd>U</kbd> unload at point</div>
<div><kbd>Hold C</kbd> point turrets at cursor</div>
<div><kbd>Ctrl+1–9</kbd> set group · <kbd>1–9</kbd> recall (twice: centre)</div>
<div><kbd>WASD</kbd>/arrows/screen edge pan · <kbd>wheel</kbd> zoom</div>
<div><kbd>Space</kbd> centre on selection</div>
<div><kbd>[</kbd> / <kbd>]</kbd> game speed · <kbd>Esc</kbd>/<kbd>P</kbd> pause</div>
<div>Minimap: left-click pan, right-click order</div>
</div>`;

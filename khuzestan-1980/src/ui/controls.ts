import { listen } from './events';
import type { Camera } from '../core/camera';
import { TEAM_PLAYER } from '../core/constants';
import { FORMATIONS, issueAttack, issueBoard, issueHold, issueMove, issueStop, issueUnload, type FormationId } from '../sim/commands';
import type { Unit } from '../sim/entity';
import type { World } from '../sim/world';
import { airLift } from '../render/sprites';

export type CursorMode = 'normal' | 'attackmove' | 'unload';

/** What controls need from the game shell. */
export interface GameShell {
  world: World;
  cam: Camera;
  canvas: HTMLCanvasElement;
  isVisible(u: Unit): boolean;
  togglePause(): void;
  notify(msg: string): void;
  onOrder?(kind: 'move' | 'attack' | 'amove'): void;
  /** Visual order marker at a world point (view only). */
  onOrderAt?(kind: 'move' | 'amove' | 'attack' | 'unload', x: number, y: number, from: { x: number; y: number }): void;
  loop: { timeScale: number };
}

/** Keyboard + mouse handling: selection, control groups, orders, camera. */
export class Controls {
  selection: Unit[] = [];
  groups: number[][] = Array.from({ length: 10 }, () => []);
  mode: CursorMode = 'normal';
  formation: FormationId = 'none';
  mouse = { x: 400, y: 300, inside: false };
  box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  hoverId = 0;
  manualAim = false;
  private drag: { x: number; y: number } | null = null;
  private keys = new Set<string>();
  private lastGroupKey = 0; private lastGroupTime = 0;
  private lastClickTime = 0; private lastClickId = 0;
  onChange: () => void = () => {};

  constructor(private g: GameShell) {
    const c = g.canvas;
    // Pointer events + capture so a drag that leaves the canvas still ends cleanly.
    listen(c, 'pointerdown', (e) => { c.setPointerCapture(e.pointerId); this.onDown(e); });
    listen(c, 'pointerup', (e) => { if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId); this.onUp(e); });
    listen(window, 'pointermove', (e) => this.onMove(e));
    listen(c, 'contextmenu', (e) => e.preventDefault());
    listen(c, 'wheel', (e) => { e.preventDefault(); g.cam.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    listen(window, 'keydown', (e) => this.onKey(e, true));
    listen(window, 'keyup', (e) => this.onKey(e, false));
    listen(window, 'blur', () => this.keys.clear());
    listen(document, 'mouseleave', () => { this.mouse.inside = false; });
  }

  get player() { return TEAM_PLAYER; }
  private get world() { return this.g.world; }

  // ---------------------------------------------------------------- selection helpers
  setSelection(us: Unit[]) {
    this.selection = us.filter((u) => u.alive && u.team === this.player && !u.carrier);
    this.onChange();
  }
  /** Drops dead units; call each frame. */
  prune() {
    const n = this.selection.length;
    this.selection = this.selection.filter((u) => u.alive && !u.carrier);
    if (n !== this.selection.length) this.onChange();
  }
  get selectedIds() { return new Set(this.selection.map((u) => u.id)); }

  pick(wx: number, wy: number, filter: (u: Unit) => boolean = () => true): Unit | null {
    const px = 11 / this.g.cam.zoom;
    let best: Unit | null = null, bestScore = 1e9;
    for (const u of this.world.units) {
      if (!u.onMap || !u.alive || !this.g.isVisible(u) || !filter(u)) continue;
      const d = Math.hypot(u.x - wx, u.y - airLift(u) - wy);
      const lim = Math.max(u.radius, px);
      if (d > lim) continue;
      const score = d / lim + (u.isAir ? -0.2 : 0);
      if (score < bestScore) { bestScore = score; best = u; }
    }
    return best;
  }

  // ---------------------------------------------------------------- mouse
  private onMove(e: MouseEvent) {
    const r = this.g.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    this.mouse.inside = true;
    if (this.drag) {
      const dx = this.mouse.x - this.drag.x, dy = this.mouse.y - this.drag.y;
      if (Math.hypot(dx, dy) > 5) this.box = { x0: this.drag.x, y0: this.drag.y, x1: this.mouse.x, y1: this.mouse.y };
    }
    const [wx, wy] = this.g.cam.screenToWorld(this.mouse.x, this.mouse.y);
    const h = this.drag ? null : this.pick(wx, wy);
    this.hoverId = h ? h.id : 0;
  }

  private onDown(e: MouseEvent) {
    this.onMove(e);
    if (e.button === 0) {
      if (this.mode !== 'normal') { this.commitModeClick(e.shiftKey); return; }
      this.drag = { x: this.mouse.x, y: this.mouse.y };
    } else if (e.button === 2) {
      if (this.mode !== 'normal') { this.mode = 'normal'; this.onChange(); return; }
      this.rightClick(e.shiftKey);
    }
  }

  private onUp(e: MouseEvent) {
    if (e.button !== 0 || !this.drag) return;
    const [wx, wy] = this.g.cam.screenToWorld(this.mouse.x, this.mouse.y);
    if (this.box) {
      const b = this.box;
      const [ax, ay] = this.g.cam.screenToWorld(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1));
      const [bx, by] = this.g.cam.screenToWorld(Math.max(b.x0, b.x1), Math.max(b.y0, b.y1));
      const inside = this.world.units.filter((u) => u.onMap && u.alive && u.team === this.player && u.x >= ax && u.x <= bx && u.y >= ay && u.y <= by);
      // Prefer fighting units over lone transports/spotters if the box catches a mix.
      this.setSelection(e.shiftKey ? [...this.selection, ...inside.filter((u) => !this.selection.includes(u))] : inside);
    } else {
      const u = this.pick(wx, wy, (x) => x.team === this.player);
      const now = performance.now();
      if (u) {
        if (u.id === this.lastClickId && now - this.lastClickTime < 350) {
          // Double-click: select all visible units of the same type.
          const b = this.g.cam.bounds();
          this.setSelection(this.world.units.filter((o) => o.alive && o.onMap && o.team === this.player && o.def.id === u.def.id && o.x > b.x0 && o.x < b.x1 && o.y > b.y0 && o.y < b.y1));
        } else if (e.shiftKey) {
          this.setSelection(this.selection.includes(u) ? this.selection.filter((s) => s !== u) : [...this.selection, u]);
        } else this.setSelection([u]);
        this.lastClickId = u.id; this.lastClickTime = now;
      } else if (!e.shiftKey) this.setSelection([]);
    }
    this.drag = null; this.box = null;
  }

  private commitModeClick(queue: boolean) {
    const [wx, wy] = this.g.cam.screenToWorld(this.mouse.x, this.mouse.y);
    if (this.mode === 'attackmove') {
      issueMove(this.world, this.selection, wx, wy, { attackMove: true, queue, formation: this.formation });
      this.g.onOrder?.('amove');
      this.g.onOrderAt?.('amove', wx, wy, this.centroid());
    } else if (this.mode === 'unload') {
      issueUnload(this.selection.filter((u) => u.cargo.length > 0), wx, wy);
      this.g.onOrder?.('move');
      this.g.onOrderAt?.('unload', wx, wy, this.centroid());
    }
    if (!queue) this.mode = 'normal';
    this.onChange();
  }

  /** Context-sensitive right click: attack, board, or move. */
  rightClick(queue: boolean) {
    if (!this.selection.length) return;
    const [wx, wy] = this.g.cam.screenToWorld(this.mouse.x, this.mouse.y);
    this.orderAt(wx, wy, queue);
  }

  orderAt(wx: number, wy: number, queue: boolean) {
    const target = this.pick(wx, wy, (u) => u.team !== this.player && u.alive);
    if (target) {
      issueAttack(this.world, this.selection, target, queue);
      this.g.onOrder?.('attack');
      this.g.onOrderAt?.('attack', target.x, target.y, this.centroid());
      return;
    }
    const friend = this.pick(wx, wy, (u) => u.team === this.player && !!u.def.transport && !this.selection.includes(u));
    const inf = this.selection.filter((u) => u.isInfantry);
    if (friend && inf.length) {
      issueBoard(this.world, inf, friend, queue);
      const rest = this.selection.filter((u) => !u.isInfantry);
      if (rest.length) issueMove(this.world, rest, wx, wy, { queue, formation: this.formation });
      this.g.onOrder?.('move');
      return;
    }
    issueMove(this.world, this.selection, wx, wy, { queue, formation: this.formation });
    this.g.onOrder?.('move');
    this.g.onOrderAt?.('move', wx, wy, this.centroid());
  }

  private centroid() {
    const s = this.selection;
    if (!s.length) return { x: 0, y: 0 };
    return { x: s.reduce((a, u) => a + u.x, 0) / s.length, y: s.reduce((a, u) => a + u.y, 0) / s.length };
  }

  // ---------------------------------------------------------------- commands (also used by the command card)
  exec(cmd: string) {
    const s = this.selection;
    switch (cmd) {
      case 'attackmove': this.mode = this.mode === 'attackmove' ? 'normal' : 'attackmove'; break;
      case 'stop': issueStop(s); break;
      case 'hold': issueHold(s); break;
      case 'unload': issueUnload(s.filter((u) => u.cargo.length > 0)); break;
      case 'unloadat': this.mode = this.mode === 'unload' ? 'normal' : 'unload'; break;
      case 'formation': {
        this.formation = FORMATIONS[(FORMATIONS.indexOf(this.formation) + 1) % FORMATIONS.length];
        this.g.notify(`Formation: ${this.formation}`);
        break;
      }
      case 'aim': this.manualAim = !this.manualAim; break;
    }
    this.onChange();
  }

  // ---------------------------------------------------------------- keyboard
  private onKey(e: KeyboardEvent, down: boolean) {
    const k = e.key.toLowerCase();
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (down) this.keys.add(k); else this.keys.delete(k);
    if (!down) return;
    if (e.repeat && !['+', '-'].includes(k)) return;

    if (k === 'escape') {
      if (this.mode !== 'normal') { this.mode = 'normal'; this.onChange(); } else this.g.togglePause();
      return;
    }
    if (k === 'p') { this.g.togglePause(); return; }
    if (e.ctrlKey && k !== 'control' && !(k >= '0' && k <= '9')) return;
    if (k >= '1' && k <= '9' || k === '0') {
      const n = Number(k);
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.groups[n] = this.selection.map((u) => u.id);
        this.g.notify(`Control group ${n} set (${this.selection.length})`);
      } else {
        const us = this.groups[n].map((id) => this.world.alive(id)).filter((u): u is Unit => !!u && u.team === this.player);
        if (us.length) {
          this.setSelection(e.shiftKey ? [...this.selection, ...us] : us);
          const now = performance.now();
          if (this.lastGroupKey === n && now - this.lastGroupTime < 400) this.centerOnSelection();
          this.lastGroupKey = n; this.lastGroupTime = now;
        }
      }
      return;
    }
    // WASD is reserved for camera panning, so commands live on Q/X/H/E/U/F.
    switch (k) {
      case 'q': if (this.selection.length) { this.mode = 'attackmove'; this.onChange(); } break;
      case 'x': this.exec('stop'); break;
      case 'h': this.exec('hold'); break;
      case 'e': this.exec('unload'); break;
      case 'u': if (this.selection.some((u) => u.cargo.length)) this.exec('unloadat'); break;
      case 'f': this.exec('formation'); break;
      case ' ': e.preventDefault(); this.centerOnSelection(); break;
      case '[': this.g.loop.timeScale = Math.max(0.25, this.g.loop.timeScale / 2); this.g.notify(`Speed x${this.g.loop.timeScale}`); break;
      case ']': this.g.loop.timeScale = Math.min(8, this.g.loop.timeScale * 2); this.g.notify(`Speed x${this.g.loop.timeScale}`); break;
    }
  }

  centerOnSelection() {
    if (!this.selection.length) return;
    let x = 0, y = 0;
    for (const u of this.selection) { x += u.x; y += u.y; }
    this.g.cam.centerOn(x / this.selection.length, y / this.selection.length);
  }

  /** Per-frame camera movement and manual turret aim. */
  update(dt: number) {
    this.prune();
    const cam = this.g.cam;
    const speed = 760 * dt;
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) dy -= 1;
    if (k.has('s') || k.has('arrowdown')) dy += 1;
    if (k.has('a') || k.has('arrowleft')) dx -= 1;
    if (k.has('d') || k.has('arrowright')) dx += 1;
    // Edge scroll
    const m = this.mouse;
    if (m.inside && !this.drag) {
      const edge = 6;
      if (m.x < edge) dx -= 1; else if (m.x > cam.viewW - edge) dx += 1;
      if (m.y < edge) dy -= 1; else if (m.y > cam.viewH - edge) dy += 1;
    }
    if (dx || dy) cam.pan(dx * speed, dy * speed);

    // Manual aim: tanks point their turrets at the cursor while C is held.
    this.manualAim = k.has('c');
    if (this.manualAim) {
      const [wx, wy] = cam.screenToWorld(m.x, m.y);
      for (const u of this.selection) if (u.def.turret) u.turretWant = Math.atan2(wy - u.y, wx - u.x);
    } else {
      for (const u of this.selection) if (u.def.turret && u.turretWant !== null && !u.targetId) u.turretWant = null;
    }
  }
}

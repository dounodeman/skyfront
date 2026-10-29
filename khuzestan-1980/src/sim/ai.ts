import { TILE, type TeamId } from '../core/constants';
import { angleTo, dist } from '../core/math';
import { TERRAIN } from '../data/terrain';
import { issueAttack, issueBoard, issueMove, issueUnload } from './commands';
import type { Unit } from './entity';
import { spotted } from './systems/combat';
import { DEPOT_RADIUS, isCombatant } from './systems/objectives';
import { freeSlots } from './systems/transport';
import type { Objective, World } from './world';

export type Difficulty = 'easy' | 'normal' | 'hard';

const PARAMS: Record<Difficulty, { interval: number; focus: boolean; heli: boolean; cover: boolean; budget: number }> = {
  easy: { interval: 3, focus: false, heli: false, cover: true, budget: 0.8 },
  normal: { interval: 1.5, focus: true, heli: true, cover: true, budget: 1 },
  hard: { interval: 0.8, focus: true, heli: true, cover: true, budget: 1.15 },
};
export const aiBudgetFactor = (d: Difficulty) => PARAMS[d].budget;

type Role = 'armor' | 'mech' | 'inf' | 'aa' | 'gunship' | 'airlift' | 'recon' | 'strike';

function roleOf(u: Unit): Role {
  const d = u.def;
  if (d.category === 'drone') return d.kamikaze ? 'strike' : 'recon';
  if (d.category === 'heli') return d.role === 'transport' ? 'airlift' : 'gunship';
  if (d.category === 'aa') return 'aa';
  if (d.category === 'infantry') return 'inf';
  if (d.category === 'apc') return 'mech';
  return 'armor'; // tanks, ATGM jeeps
}

/**
 * Battlefield AI for one team. Every `interval` seconds it:
 *  - picks an objective to take (or defend), and sends armour, mechanised and infantry groups at it
 *    with attack-move (transports dismount on contact);
 *  - pulls badly damaged / out-of-ammo vehicles back to the depot for repair, then sends them back in;
 *  - concentrates fire of tanks on the weakest dangerous enemy in reach (focus fire);
 *  - puts infantry into nearby cover (buildings, groves, trenches) when the enemy is close;
 *  - calls gunships onto enemy armour once spotted (avoiding known AA), and rearms them afterwards;
 *  - uses transport helicopters to lift infantry from the depot to a landing zone short of the objective;
 *  - keeps AA vehicles behind the main armour group, and recon drones over the objective.
 */
export class AIController {
  private timer = 0;
  private p: typeof PARAMS['normal'];
  primary: Objective | null = null;
  private objTimer = 0;

  constructor(private w: World, readonly team: TeamId, readonly difficulty: Difficulty = 'normal') {
    this.p = PARAMS[difficulty];
    this.timer = 2;
  }

  /** System hook: install with world.systems.push(ai.system). */
  system = (_w: World, dt: number) => {
    this.timer -= dt;
    this.objTimer -= dt;
    if (this.timer > 0 || this.w.over) return;
    this.timer = this.p.interval;
    this.think();
  };

  private mine() { return this.w.units.filter((u) => u.team === this.team && u.alive && !u.carrier); }
  private enemyTeam(): TeamId { return this.team === 0 ? 1 : 0; }
  private visibleEnemies() { return this.w.units.filter((u) => u.team !== this.team && u.alive && u.onMap && spotted(this.w, this.team, u)); }

  private think() {
    const w = this.w;
    const units = this.mine();
    if (!units.length) return;
    const enemies = this.visibleEnemies();
    const depot = w.depots[this.team];
    const ground = units.filter((u) => !u.isAir);
    const centroid = ground.length
      ? { x: ground.reduce((s, u) => s + u.x, 0) / ground.length, y: ground.reduce((s, u) => s + u.y, 0) / ground.length }
      : depot;

    this.chooseObjective(centroid, enemies);
    const obj = this.primary;

    for (const u of units) {
      const role = roleOf(u);
      // Passengers bail out of a crippled transport rather than die inside it.
      if (u.cargo.length && !u.isAir && (u.mob.immobilized || u.hpFrac < 0.4) && u.orders[0]?.type !== 'unload') { issueUnload([u]); continue; }
      if (this.handleRetreat(u, depot)) continue;
      switch (role) {
        case 'armor': case 'mech': this.advance(u, obj, role === 'mech' ? 60 : 0); break;
        case 'inf': this.infantry(u, obj, enemies); break;
        case 'aa': this.escort(u, ground, depot); break;
        case 'gunship': this.gunship(u, enemies, obj, depot); break;
        case 'airlift': this.airlift(u, obj, depot); break;
        case 'recon': this.recon(u, obj); break;
        case 'strike': this.strike(u, enemies); break;
      }
    }
    if (this.p.focus) this.focusFire(units.filter((u) => roleOf(u) === 'armor' && u.ai.task !== 'retreat'), enemies);
  }

  // ------------------------------------------------------------------ strategy
  private chooseObjective(c: { x: number; y: number }, enemies: Unit[]) {
    const w = this.w;
    if (!w.objectives.length) { this.primary = null; return; }
    // Defend an owned objective that is being taken.
    const threatened = w.objectives.find((o) => o.owner === this.team && Math.abs(o.progress) < 0.9);
    if (threatened) { this.primary = threatened; return; }
    if (this.primary && this.primary.owner !== this.team && this.objTimer > 0) return;
    let best: Objective | null = null, bestScore = Infinity;
    for (const o of w.objectives) {
      if (o.owner === this.team) continue;
      const defenders = enemies.filter((e) => dist(e.x, e.y, o.x, o.y) < o.radius + 250).length;
      const s = dist(c.x, c.y, o.x, o.y) + defenders * 180 + (o.owner === null ? 0 : 100);
      if (s < bestScore) { bestScore = s; best = o; }
    }
    // Everything held: guard the objective closest to the enemy depot.
    if (!best) {
      const ed = w.depots[this.enemyTeam()];
      best = [...w.objectives].sort((a, b) => dist(a.x, a.y, ed.x, ed.y) - dist(b.x, b.y, ed.x, ed.y))[0];
    }
    if (best !== this.primary) this.objTimer = 25;
    this.primary = best;
  }

  /** Point inside an objective, spread per unit so the group doesn't stack. */
  private slot(u: Unit, o: Objective, back = 0) {
    const a = (u.id * 2.39996) % (Math.PI * 2);
    const r = o.radius * 0.45 * ((u.id % 5) / 5 + 0.2);
    const dep = this.w.depots[this.team];
    const toward = angleTo(o.x, o.y, dep.x, dep.y);
    return { x: o.x + Math.cos(a) * r + Math.cos(toward) * back, y: o.y + Math.sin(a) * r + Math.sin(toward) * back };
  }

  private advance(u: Unit, o: Objective | null, back: number) {
    if (!o) return;
    if (u.orders[0]?.type === 'attack') return; // busy with focus fire
    const target = this.slot(u, o, back);
    const cur = u.orders[0];
    const d = dist(u.x, u.y, target.x, target.y);
    if (u.ai.taskObj === o.id && (cur || d < 40)) return; // on the way or arrived
    if (d < 40) { u.ai.taskObj = o.id; return; }
    issueMove(this.w, [u], target.x, target.y, { attackMove: true });
    u.ai.taskObj = o.id; u.ai.task = 'advance';
  }

  private handleRetreat(u: Unit, depot: { x: number; y: number }): boolean {
    if (u.inf || roleOf(u) === 'recon' || roleOf(u) === 'strike') return false;
    const primary = u.weapons[0];
    const noAmmo = primary && Object.values(primary.ammo).every((n) => n <= 0);
    const fuelLow = u.mob.fuelMax > 0 && u.mob.fuel < u.mob.fuelMax * 0.12;
    const hurt = u.hpFrac < (u.isAir ? 0.45 : 0.35) || u.dmg.gunDisabled;
    const atDepot = dist(u.x, u.y, depot.x, depot.y) < DEPOT_RADIUS * 0.8;
    if (u.ai.task === 'retreat') {
      // Back in the fight once repaired and rearmed.
      const healthy = u.hpFrac > 0.85 && !noAmmo && !u.dmg.gunDisabled && (u.mob.fuelMax === 0 || u.mob.fuel > u.mob.fuelMax * 0.8);
      if (atDepot && healthy) { u.ai.task = ''; u.ai.taskObj = ''; return false; }
      if (!atDepot && !u.orders.length) issueMove(this.w, [u], depot.x, depot.y);
      return true;
    }
    if ((hurt || noAmmo || fuelLow) && u.canMove || (u.isAir && (hurt || noAmmo || fuelLow))) {
      if (u.mob.immobilized) return false;
      u.ai.task = 'retreat';
      issueMove(this.w, [u], depot.x + this.w.rng.range(-40, 40), depot.y + this.w.rng.range(-40, 40));
      return true;
    }
    return false;
  }

  private infantry(u: Unit, o: Objective | null, enemies: Unit[]) {
    const inf = u.inf!;
    if (inf.state === 'broken') return; // infantry system handles the rout
    const now = this.w.time;
    // Take cover when the enemy is close and we are standing in the open.
    if (this.p.cover && inf.cover < 0.3 && !(u.ai.coverUntil > now) && !(u.ai.noCoverUntil > now)) {
      const threat = enemies.find((e) => isCombatant(e) && dist(e.x, e.y, u.x, u.y) < 450);
      if (threat) {
        const spot = this.findCover(u, threat);
        if (spot) {
          issueMove(this.w, [u], spot.x, spot.y);
          u.ai.coverUntil = now + 25; u.ai.task = 'cover';
          return;
        }
      }
    }
    if (u.ai.coverUntil > now) return; // holding in cover
    // Cover timer over: push on (attack-move) – but give the next cover check a grace period.
    if (u.ai.task === 'cover') { u.ai.task = ''; u.ai.taskObj = ''; u.ai.coverUntil = now - 0.01; u.ai.noCoverUntil = now + 20; }
    this.advance(u, o, 0);
  }

  /** Best cover tile within ~110 m, preferring tiles not further from the threat. */
  findCover(u: Unit, threat: Unit): { x: number; y: number } | null {
    const map = this.w.map;
    const tx0 = Math.floor(u.x / TILE), ty0 = Math.floor(u.y / TILE);
    let best: { x: number; y: number } | null = null, bestS = 0.25;
    const dThreat = dist(u.x, u.y, threat.x, threat.y);
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
      const tx = tx0 + dx, ty = ty0 + dy;
      if (!map.inb(tx, ty) || map.speedMul('foot', tx, ty) <= 0) continue;
      const c = TERRAIN[map.get(tx, ty)].cover;
      if (c < 0.3) continue;
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
      const s = c - Math.hypot(dx, dy) * 0.025 - Math.max(0, dist(x, y, threat.x, threat.y) - dThreat) * 0.002;
      if (s > bestS) { bestS = s; best = { x, y }; }
    }
    return best;
  }

  private escort(u: Unit, ground: Unit[], depot: { x: number; y: number }) {
    const armor = ground.filter((g) => roleOf(g) === 'armor' || roleOf(g) === 'mech');
    if (!armor.length) { this.advance(u, this.primary, 220); return; }
    const cx = armor.reduce((s, g) => s + g.x, 0) / armor.length, cy = armor.reduce((s, g) => s + g.y, 0) / armor.length;
    const back = angleTo(cx, cy, depot.x, depot.y);
    const tx = cx + Math.cos(back) * 180, ty = cy + Math.sin(back) * 180;
    if (dist(u.x, u.y, tx, ty) > 220 && (!u.orders.length || this.w.time - (u.ai.lastOrder ?? 0) > 20)) {
      issueMove(this.w, [u], tx, ty, { attackMove: true });
      u.ai.lastOrder = this.w.time;
    }
  }

  // ------------------------------------------------------------------ air
  private gunship(u: Unit, enemies: Unit[], o: Objective | null, depot: { x: number; y: number }) {
    const cur = u.orders[0];
    if (cur?.type === 'attack' && this.w.alive(cur.targetId)) return;
    if (!this.p.heli) { if (o && !cur) this.advance(u, o, 300); return; }
    // Call in on spotted armour, skipping targets covered by known AA.
    const aa = enemies.filter((e) => e.def.category === 'aa' || e.def.role === 'aa');
    const armor = enemies.filter((e) => (e.def.category === 'tank' || e.def.category === 'apc' || e.def.category === 'atgm') && !e.isAir)
      .filter((e) => !aa.some((a) => dist(a.x, a.y, e.x, e.y) < 1100))
      .sort((a, b) => dist(u.x, u.y, a.x, a.y) - dist(u.x, u.y, b.x, b.y));
    if (armor.length) {
      issueAttack(this.w, [u], armor[0]);
      u.ai.task = 'strike';
      if (!u.ai.called) { this.w.bus.emit({ type: 'message', text: 'Enemy helicopters inbound', team: this.enemyTeam(), level: 'warn' }); u.ai.called = true; }
      return;
    }
    // Otherwise loiter behind our lines, ready.
    if (!cur) {
      const hold = o ? this.slot(u, o, 650) : depot;
      if (dist(u.x, u.y, hold.x, hold.y) > 150) issueMove(this.w, [u], hold.x, hold.y);
    }
  }

  private airlift(u: Unit, o: Objective | null, depot: { x: number; y: number }) {
    if (u.orders.length) return;
    const atDepot = dist(u.x, u.y, depot.x, depot.y) < 400;
    if (u.cargo.length && (freeSlots(u) === 0 || (u.ai.waitUntil ?? 0) < this.w.time)) {
      if (!o) return;
      // Landing zone: short of the objective on our side, so troops walk the last stretch.
      const a = angleTo(o.x, o.y, depot.x, depot.y);
      const lx = o.x + Math.cos(a) * (o.radius + 260), ly = o.y + Math.sin(a) * (o.radius + 260);
      issueUnload([u], lx, ly);
      u.ai.task = 'insert';
      return;
    }
    if (!atDepot) { issueMove(this.w, [u], depot.x, depot.y); return; }
    // Pick up idle infantry waiting near the depot.
    const waiting = this.w.units.filter((p) => p.team === this.team && p.alive && p.isInfantry && !p.carrier && p.inf!.state === 'ok'
      && dist(p.x, p.y, u.x, u.y) < 450 && p.orders[0]?.type !== 'board' && p.ai.task !== 'cover');
    const n = Math.min(freeSlots(u), waiting.length);
    if (n > 0) {
      issueBoard(this.w, waiting.slice(0, n), u);
      u.ai.waitUntil = this.w.time + 25;
    }
  }

  private recon(u: Unit, o: Objective | null) {
    if (!o || u.orders.length) return;
    const ed = this.w.depots[this.enemyTeam()];
    const a = angleTo(o.x, o.y, ed.x, ed.y);
    const tx = o.x + Math.cos(a) * 250, ty = o.y + Math.sin(a) * 250;
    if (dist(u.x, u.y, tx, ty) > 100) issueMove(this.w, [u], tx, ty);
  }

  private strike(u: Unit, enemies: Unit[]) {
    if (u.orders[0]?.type === 'attack') return;
    const t = enemies.filter((e) => !e.isAir && (e.def.category === 'tank' || e.def.category === 'aa' || e.def.category === 'apc'))
      .sort((a, b) => b.def.cost - a.def.cost)[0];
    if (t) issueAttack(this.w, [u], t);
  }

  // ------------------------------------------------------------------ tactics
  private focusFire(tanks: Unit[], enemies: Unit[]) {
    if (tanks.length < 2) return;
    const candidates = enemies.filter((e) => !e.isAir && (e.def.category === 'tank' || e.def.role === 'at' || e.def.category === 'atgm' || e.def.category === 'apc'));
    let best: Unit | null = null, bestS = 0, shooters: Unit[] = [];
    for (const e of candidates) {
      const inReach = tanks.filter((t) => isCombatant(t) && dist(t.x, t.y, e.x, e.y) < (t.weapons[0]?.def.range ?? 0) * 0.95);
      if (inReach.length < 2) continue;
      const threat = e.def.category === 'tank' ? 2 : 1.4;
      const s = threat * (1.6 - e.hpFrac) * inReach.length;
      if (s > bestS) { bestS = s; best = e; shooters = inReach; }
    }
    if (!best) return;
    for (const t of shooters.slice(0, 4)) {
      const cur = t.orders[0];
      if (cur?.type === 'attack' && cur.targetId === best.id) continue;
      if (cur && cur.type !== 'move') continue;
      // Interrupt the advance; the next think re-issues the objective once the target is dead.
      issueAttack(this.w, [t], best);
      t.ai.taskObj = '';
    }
  }
}

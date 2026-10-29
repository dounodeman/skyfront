import './style.css';
import { Rng } from './core/rng';
import { AI_PRESET } from './data/aiPresets';
import { STARTER_MAP } from './data/maps/starter';
import { rosterFor } from './data/units';
import { Game } from './game';
import { AIController, aiBudgetFactor } from './sim/ai';
import { buildForce } from './sim/forcebuilder';
import { createWorld, other } from './sim/setup';
import type { World } from './sim/world';
import { mainMenu, purchaseScreen, skirmishSetup, type SkirmishSettings } from './ui/menus';

/** App shell: menus → setup → purchase → match → results → menu. */
let game: Game | null = null;
const settings: SkirmishSettings = { faction: 'iraq', era: 1980, light: 0, dust: false, budget: 1500, difficulty: 'normal' };

function toMenu() {
  if (game) { game.dispose(); game = null; }
  mainMenu({ skirmish: setup, scenario: () => scenario() });
}

function setup() { skirmishSetup(settings, (s) => purchaseScreen(s, startSkirmish, setup), toMenu); }

function startSkirmish(force: Parameters<Parameters<typeof purchaseScreen>[1]>[0]) {
  const s = settings;
  const ef = other(s.faction);
  const rng = new Rng(Date.now() % 1e9);
  const enemyForce = buildForce(rosterFor(ef, s.era), Math.round(s.budget * aiBudgetFactor(s.difficulty)), AI_PRESET[ef], rng);
  const world = createWorld({
    map: STARTER_MAP, playerFaction: s.faction, era: s.era, light: s.light, dust: s.dust,
    playerForce: force, enemyForce, tickets: 600,
  });
  run(world, s.difficulty);
}

/** Scripted scenario hook (milestone 6). */
function scenario() { setup(); }

export function run(world: World, difficulty: SkirmishSettings['difficulty']) {
  document.getElementById('screens')!.innerHTML = '';
  const ai = new AIController(world, 1, difficulty);
  world.systems.push(ai.system);
  game = new Game(world);
  game.onExit = toMenu;
  game.start();
  (window as any).game = game;
}

toMenu();

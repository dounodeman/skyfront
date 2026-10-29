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
import { codex, mainMenu, purchaseScreen, scenarioBriefing, skirmishSetup, type SkirmishSettings } from './ui/menus';
import { BORDER_SCENARIO } from './data/scenarios/border';
import { createScenarioWorld } from './sim/scenario';

/** App shell: menus → setup → purchase → match → results → menu. */
let game: Game | null = null;
const settings: SkirmishSettings = { faction: 'iraq', era: 1980, light: 0, dust: false, budget: 1500, difficulty: 'normal' };

function toMenu() {
  if (game) { game.dispose(); game = null; }
  mainMenu({ skirmish: setup, scenario: () => scenario(), codex: () => codex(toMenu) });
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

function scenario() {
  scenarioBriefing(BORDER_SCENARIO, (side, difficulty) => {
    const world = createScenarioWorld(BORDER_SCENARIO, side);
    // The AI defends if it is the defending side.
    run(world, difficulty, side === BORDER_SCENARIO.attacker ? 'defend' : 'attack');
  }, toMenu);
}

export function run(world: World, difficulty: SkirmishSettings['difficulty'], mode: 'attack' | 'defend' = 'attack') {
  document.getElementById('screens')!.innerHTML = '';
  const ai = new AIController(world, 1, difficulty, mode);
  world.systems.push(ai.system);
  game = new Game(world);
  game.onExit = toMenu;
  game.start();
  (window as any).game = game;
}

toMenu();

import './style.css';
import { TILE } from './core/constants';
import { STARTER_MAP } from './data/maps/starter';
import { Game } from './game';
import { buildMap } from './sim/mapgen';
import { defaultSystems } from './sim/systems';
import { World } from './sim/world';

/** Milestone 1 sandbox: a T-55 platoon on the starter map. */
function sandbox() {
  const map = buildMap(STARTER_MAP);
  const world = new World(map, [
    { id: 0, faction: 'iraq', name: 'Iraq', tickets: 500, ticketsMax: 500, isHuman: true },
    { id: 1, faction: 'iran', name: 'Iran', tickets: 500, ticketsMax: 500, isHuman: false },
  ]);
  world.systems = defaultSystems();
  for (let i = 0; i < 4; i++) world.spawn('iq_t55', 0, 22 * TILE + i * 14, 60 * TILE + i * 18, 0);
  const g = new Game(world);
  g.start();
  (window as any).game = g;
}
sandbox();

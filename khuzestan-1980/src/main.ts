import './style.css';
import { STARTER_MAP } from './data/maps/starter';
import { Game } from './game';
import { createWorld } from './sim/setup';

/** Milestone 3 sandbox: mixed forces on the starter map (no enemy AI yet). */
function sandbox() {
  const world = createWorld({
    map: STARTER_MAP, playerFaction: 'iraq', era: 1980, light: 0, dust: false,
    playerForce: [
      { defId: 'iq_t55', count: 3 }, { defId: 'iq_t62', count: 1 }, { defId: 'iq_t72', count: 1 }, { defId: 'iq_pt76', count: 1 },
      { defId: 'iq_bmp1', count: 2 }, { defId: 'iq_btr60', count: 1 }, { defId: 'iq_btr50', count: 1 },
      { defId: 'iq_rifle', count: 3 }, { defId: 'iq_rpg', count: 2 }, { defId: 'iq_pkm', count: 1 }, { defId: 'iq_rg', count: 1 }, { defId: 'iq_sa7', count: 1 },
      { defId: 'iq_zsu234', count: 1 }, { defId: 'iq_zu23', count: 1 },
      { defId: 'iq_mi24', count: 1 }, { defId: 'iq_mi8', count: 1 }, { defId: 'iq_gazelle', count: 1 },
    ],
    enemyForce: [
      { defId: 'ir_chieftain', count: 2 }, { defId: 'ir_m60a1', count: 1 }, { defId: 'ir_m48', count: 1 }, { defId: 'ir_scorpion', count: 1 },
      { defId: 'ir_m113', count: 2 }, { defId: 'ir_tow', count: 1 }, { defId: 'ir_aa35', count: 1 },
      { defId: 'ir_ah1j', count: 1 }, { defId: 'ir_ch47', count: 1 }, { defId: 'ir_bell214', count: 1 }, { defId: 'ir_ab205', count: 1 },
      { defId: 'ir_rifle', count: 2 }, { defId: 'ir_mg3', count: 1 }, { defId: 'ir_rr', count: 1 }, { defId: 'ir_rpg', count: 1 }, { defId: 'ir_irgc', count: 2 }, { defId: 'ir_basij', count: 2 },
    ],
    mountInfantry: true,
    seed: 7,
  });
  const g = new Game(world);
  g.start();
  (window as any).game = g;
}
sandbox();

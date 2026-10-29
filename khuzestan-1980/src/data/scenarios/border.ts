import { T } from '../terrain';
import { STARTER_MAP } from '../maps/starter';
import type { ScenarioDef } from './types';

/**
 * "The Border Crossing" – Iraqi mechanised assault across an irrigation canal on the Khuzestan plain,
 * Iranian delaying defence. Fictional locality; force mixes follow the opening days of the war.
 * Play as Iraq (assault) or Iran (delay). All of it is data: edit freely.
 */
export const BORDER_SCENARIO: ScenarioDef = {
  id: 'border_crossing',
  name: 'The Border Crossing',
  date: '22 September 1980',
  map: STARTER_MAP,
  extraOps: [
    // Iranian trench line and berm east of the canal, covering the central bridge.
    { op: 'line', t: T.Trench, pts: [[92, 48], [93, 56], [92, 62]], width: 1, only: [T.Sand, T.Dune, T.Grove, T.Road] },
    { op: 'line', t: T.Trench, pts: [[92, 67], [93, 74], [92, 80]], width: 1, only: [T.Sand, T.Dune, T.Grove, T.Road] },
    { op: 'line', t: T.Dune, pts: [[95, 50], [96, 60]], width: 1.4, only: [T.Sand] },
    { op: 'line', t: T.Dune, pts: [[95, 69], [96, 79]], width: 1.4, only: [T.Sand] },
    { op: 'line', t: T.Trench, pts: [[132, 58], [132, 72]], width: 1, only: [T.Sand, T.Dune, T.Grove] },
    // Border post huts at the bridge approach.
    { op: 'town', rect: [72, 60, 76, 63], block: [2, 1], gap: 1, skip: 0 },
  ],
  objectives: [
    { id: 'bridge', name: 'Border Bridge', x: 82, y: 64, radius: 8, owner: 'iran' },
    { id: 'trenches', name: 'Canal Trenches', x: 93, y: 64, radius: 9, owner: 'iran' },
    { id: 'town', name: 'Town of Shahrak', x: 147, y: 65, radius: 11, owner: 'iran' },
    { id: 'village', name: 'North Village', x: 126, y: 21, radius: 8, owner: 'iran' },
  ],
  light: 1, // dawn assault
  dust: false,
  attacker: 'iraq',
  required: ['bridge', 'trenches', 'town'],
  holdFor: 30,
  timeLimit: 20 * 60,
  briefing: {
    iraq: {
      title: 'Assault: seize the crossing',
      text: 'Dawn, 22 September 1980. Your mechanised brigade crosses the frontier at first light. Take the border bridge and the trench line behind it, then push on and secure the town of Shahrak before Iranian reinforcements can arrive. You have 20 minutes. A Hind arrives at 03:00 and a T-62 company at 05:00; Republican Guard troops will be flown forward later. Iranian Cobras are known to be in the area – keep the Shilka and SA-7 teams close to your armour.',
    },
    iran: {
      title: 'Delay: hold the canal line',
      text: 'Dawn, 22 September 1980. An Iraqi armoured column is crossing the frontier. Your garrison – a few Chieftains and Pattons, army infantry in the canal trenches and Revolutionary Guards in the town – must delay it. Hold the town of Shahrak, the bridge or the trench line for 20 minutes. Army Aviation Cobras have been promised at 05:00, and volunteers are on their way from Ahvaz. Chieftains are powerful but their engines are fragile: avoid the marsh.',
    },
  },
  forces: [
    {
      faction: 'iraq', rect: [6, 44, 30, 84],
      units: [
        { defId: 'iq_t55', count: 5 }, { defId: 'iq_t62', count: 2 }, { defId: 'iq_bmp1', count: 3 }, { defId: 'iq_btr60', count: 1 },
        { defId: 'iq_rifle', count: 4 }, { defId: 'iq_rpg', count: 2 }, { defId: 'iq_pkm', count: 1 }, { defId: 'iq_sa7', count: 2 },
        { defId: 'iq_zsu234', count: 1 },
      ],
    },
  ],
  placements: {
    iraq: [],
    iran: [
      // Trench line at the canal
      { defId: 'ir_rifle', x: 93, y: 56, hold: true }, { defId: 'ir_rifle', x: 92, y: 61, hold: true },
      { defId: 'ir_mg3', x: 93, y: 68, hold: true }, { defId: 'ir_rifle', x: 93, y: 74, hold: true },
      { defId: 'ir_rr', x: 94, y: 64, hold: true }, { defId: 'ir_rpg', x: 91, y: 66, hold: true },
      // Armour reserve behind the palm grove, hull-down by the dunes
      { defId: 'ir_chieftain', x: 101, y: 58, heading: Math.PI, hold: true }, { defId: 'ir_chieftain', x: 101, y: 71, heading: Math.PI, hold: true },
      { defId: 'ir_m48', x: 110, y: 62, heading: Math.PI }, { defId: 'ir_m48', x: 110, y: 68, heading: Math.PI },
      { defId: 'ir_m60a1', x: 138, y: 66, heading: Math.PI, hold: true },
      { defId: 'ir_scorpion', x: 118, y: 40, heading: Math.PI },
      { defId: 'ir_tow', x: 104, y: 46, heading: Math.PI, hold: true },
      { defId: 'ir_aa35', x: 140, y: 64, hold: true },
      { defId: 'ir_aa35', x: 104, y: 60, hold: true }, { defId: 'ir_aa35', x: 104, y: 70, hold: true },
      // Town garrison
      { defId: 'ir_irgc', x: 140, y: 60, hold: true }, { defId: 'ir_irgc', x: 145, y: 69, hold: true }, { defId: 'ir_rpg', x: 150, y: 63, hold: true },
      { defId: 'ir_m113', x: 155, y: 66, heading: Math.PI }, { defId: 'ir_rifle', x: 155, y: 66, mountIn: 16 },
      // Village outpost
      { defId: 'ir_rifle', x: 126, y: 21, hold: true },
    ],
  },
  triggers: [
    { when: { type: 'time', at: 2 }, actions: [{ type: 'message', to: 'all', text: 'H-hour: the Iraqi column is crossing the frontier.', level: 'warn' }] },
    { when: { type: 'time', at: 120 }, actions: [{ type: 'env', light: 0 }, { type: 'message', to: 'all', text: 'Sunrise – visibility improving.' }] },
    {
      when: { type: 'time', at: 180 }, actions: [
        { type: 'spawn', faction: 'iraq', units: [{ defId: 'iq_mi24', count: 1 }], at: [10, 60], note: 'Hind' },
        { type: 'message', to: 'iraq', text: 'Air support: a Mi-24 Hind is on station at the depot.', level: 'good' },
      ],
    },
    {
      when: { type: 'time', at: 300 }, actions: [
        { type: 'spawn', faction: 'iraq', units: [{ defId: 'iq_t62', count: 3 }, { defId: 'iq_bmp1', count: 1 }, { defId: 'iq_rifle', count: 1 }], at: [8, 64], attackMoveTo: [70, 64], note: 'T-62 battalion' },
        { type: 'message', to: 'iraq', text: 'Reinforcements: T-62 company arriving on the west road.', level: 'good' },
        { type: 'message', to: 'iran', text: 'Observers report more Iraqi armour on the west road.', level: 'warn' },
      ],
    },
    {
      when: { type: 'time', at: 300 }, actions: [
        { type: 'spawn', faction: 'iran', units: [{ defId: 'ir_ah1j', count: 2 }], at: [186, 60], attackMoveTo: [120, 62], note: 'Cobras' },
        { type: 'message', to: 'iran', text: 'Army Aviation: two Cobras inbound from the east.', level: 'good' },
        { type: 'message', to: 'iraq', text: 'Warning: enemy attack helicopters approaching from the east.', level: 'warn' },
      ],
    },
    { when: { type: 'objective', id: 'trenches', owner: 'iraq' }, actions: [{ type: 'message', to: 'all', text: 'The canal trench line has fallen.', level: 'warn' }] },
    {
      when: { type: 'time', at: 600 }, actions: [
        { type: 'spawn', faction: 'iraq', units: [{ defId: 'iq_mi8', count: 1 }, { defId: 'iq_rg', count: 2 }], at: [10, 50], note: 'Republican Guard airlift' },
        { type: 'message', to: 'iraq', text: 'A Hip with two Republican Guard squads is ready at the depot – fly them forward.', level: 'good' },
      ],
    },
    {
      when: { type: 'time', at: 720 }, actions: [
        { type: 'spawn', faction: 'iran', units: [{ defId: 'ir_irgc', count: 2 }, { defId: 'ir_basij', count: 3 }, { defId: 'ir_chieftain', count: 1 }], at: [184, 66], attackMoveTo: [148, 65], note: 'Volunteers from Ahvaz' },
        { type: 'message', to: 'iran', text: 'Volunteers and a Chieftain from Ahvaz have reached the town.', level: 'good' },
      ],
    },
    { when: { type: 'losses', faction: 'iraq', fraction: 0.5 }, actions: [{ type: 'message', to: 'all', text: 'The Iraqi assault is faltering – heavy losses reported.', level: 'warn' }] },
    { when: { type: 'time', at: 900 }, actions: [{ type: 'message', to: 'all', text: 'Five minutes remaining.', level: 'warn' }] },
  ],
};

export const SCENARIOS: ScenarioDef[] = [BORDER_SCENARIO];

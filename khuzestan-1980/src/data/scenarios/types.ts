import type { MapDef, PaintOp, ObjectiveDef } from '../maps/types';
import type { FactionId } from '../units/types';

export interface Placement { defId: string; x: number; y: number; heading?: number; hold?: boolean; mountIn?: number }
export interface ForceSpec { faction: FactionId; units: Array<{ defId: string; count: number }>; rect: [number, number, number, number] }

/** Scripted actions fired by triggers. Tile coordinates throughout. */
export type ScenarioAction =
  | { type: 'message'; text: string; to?: FactionId | 'all'; level?: 'info' | 'warn' | 'good' }
  | { type: 'spawn'; faction: FactionId; units: Array<{ defId: string; count: number }>; at: [number, number]; attackMoveTo?: [number, number]; note?: string }
  | { type: 'env'; light?: 0 | 1 | 2; dust?: boolean };

export type ScenarioCondition =
  | { type: 'time'; at: number } // seconds
  | { type: 'objective'; id: string; owner: FactionId }
  | { type: 'losses'; faction: FactionId; fraction: number }; // share of starting value lost

export interface ScenarioTrigger { when: ScenarioCondition; actions: ScenarioAction[] }

export interface ScenarioDef {
  id: string;
  name: string;
  date: string;
  map: MapDef;
  extraOps: PaintOp[];
  /** Objectives replace the map's. */
  objectives: ObjectiveDef[];
  light: 0 | 1 | 2;
  dust: boolean;
  attacker: FactionId;
  /** Attacker must own all of these at once (for `holdFor` seconds) before the time limit. */
  required: string[];
  holdFor: number;
  timeLimit: number; // seconds
  briefing: Record<FactionId, { title: string; text: string }>;
  /** Units deployed in a spawn rectangle (infantry mounted in transports). */
  forces: ForceSpec[];
  /** Units placed at exact positions (dug-in defenders). */
  placements: Record<FactionId, Placement[]>;
  triggers: ScenarioTrigger[];
}

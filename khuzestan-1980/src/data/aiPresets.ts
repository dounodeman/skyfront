import type { FactionId, UnitCategory } from './units/types';

/**
 * How the AI (and the "auto-fill" presets on the purchase screen) spend points.
 * Weights are relative shares of the budget per category; caps limit copies of one unit type.
 */
export interface ForcePreset { name: string; weights: Partial<Record<UnitCategory, number>>; caps?: Record<string, number> }

export const PRESETS: Record<string, ForcePreset> = {
  balanced: { name: 'Balanced', weights: { tank: 0.36, apc: 0.16, infantry: 0.24, atgm: 0.05, aa: 0.07, heli: 0.12, drone: 0.04 } },
  armoured: { name: 'Armoured', weights: { tank: 0.55, apc: 0.15, infantry: 0.12, aa: 0.08, heli: 0.1 } },
  infantry: { name: 'Infantry', weights: { tank: 0.15, apc: 0.15, infantry: 0.5, atgm: 0.08, aa: 0.06, heli: 0.06 } },
  airmobile: { name: 'Air assault', weights: { tank: 0.15, infantry: 0.35, aa: 0.05, heli: 0.45 } },
};

/** Faction flavour used by the AI: Iraq leans on armour, Iran (1980) on infantry and Cobras. */
export const AI_PRESET: Record<FactionId, string> = { iraq: 'balanced', iran: 'balanced' };

/** Never field more than this many of a given unit (premium / rare types). */
export const UNIT_CAPS: Record<string, number> = {
  iq_t72: 2, ir_chieftain: 4, iq_mi24: 2, ir_ah1j: 2, iq_gazelle: 2, ir_ch47: 1, iq_mi8: 2, ir_bell214: 2, ir_ab205: 2,
  iq_zsu234: 2, iq_zu23: 2, ir_aa35: 2, ir_tow: 3,
};

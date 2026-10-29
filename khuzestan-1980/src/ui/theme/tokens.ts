/**
 * Design tokens — the single source of truth for colour, type and surface treatment.
 * CSS reads them as custom properties (see applyTokens); canvas code imports TOKENS directly.
 * Concept: a 1980 field command post — recon-photo map table, grease-pencil acetate, green radar scope.
 */
import type { FactionId } from '../../data/units/types';

export const PALETTE = {
  // Ground and materials
  sand: '#c9b27a', sandLight: '#ddc893', sandDark: '#a38c58',
  khaki: '#b3a374', khakiDark: '#8a7b55',
  olive: '#5b5e3d', oliveDark: '#3a3d27', oliveLight: '#7a7c55',
  oil: '#16140f', oilSoft: '#24211a', oilMid: '#322e24',
  bone: '#e8e0c8', boneDim: '#bfb69b',
  paper: '#e3d7b5', paperAged: '#d2c095', paperDark: '#b6a476',
  ink: '#27231c', pencil: '#3b3a36', graphite: '#55534c',
  steel: '#6e6a5e', steelDark: '#45423a', brass: '#a8893e',
  // Sharp accents (only these may be saturated)
  signal: '#d0301c', signalDim: '#7f2014', // enemy / danger
  amber: '#e9a31a', amberDim: '#8a5f12', // warnings / selection
  phosphor: '#86ff6e', phosphorMid: '#3fae38', phosphorDim: '#1d5a1d', phosphorDark: '#071408', // radar
} as const;

export const FONTS = {
  stencil: "'Allerta Stencil', 'Stardos Stencil', 'Courier New', monospace",
  stencilHeavy: "'Stardos Stencil', 'Allerta Stencil', 'Courier New', monospace",
  type: "'Special Elite', 'Courier New', monospace",
  mono: "'Share Tech Mono', 'Courier New', monospace",
} as const;

/** Per-faction interface identity: plating, paper, accent, markings and radio tone. */
export interface FactionTheme {
  plate: string; plateDark: string; plateLight: string;
  paper: string; ink: string; accent: string;
  marking: string; // stencilled on the console
  callsign: string; // radio log prefix
  logPaper: string;
  emblem: 'chevrons' | 'lattice';
  dossierName: string;
}

export const FACTION_THEME: Record<FactionId, FactionTheme> = {
  iraq: {
    plate: '#6f6242', plateDark: '#4a412c', plateLight: '#8f805a',
    paper: '#dccb94', ink: '#2b2116', accent: '#b5561d',
    marking: 'FMN 3 · ARMD · NORTH SECTOR', callsign: 'NAHR', logPaper: '#ddd0a2',
    emblem: 'chevrons', dossierName: 'FOLDER A — WESTERN FORCES',
  },
  iran: {
    plate: '#4c5337', plateDark: '#343a25', plateLight: '#687050',
    paper: '#c4c7a6', ink: '#1e271f', accent: '#3f8167',
    marking: 'GRP 92 · ARMD · KARUN SECTOR', callsign: 'KARUN', logPaper: '#cdd0b0',
    emblem: 'lattice', dossierName: 'FOLDER B — EASTERN FORCES',
  },
};

export const TOKENS = {
  ...PALETTE,
  friendly: PALETTE.bone, // own units: bone frames on dark olive
  friendlyFill: '#2d3420',
  enemy: PALETTE.signal, // enemies ALWAYS read as signal red
  enemyFill: '#5a140b',
  neutral: '#d9d2bc',
  selection: PALETTE.amber,
  chamfer: '10px',
  chamferSm: '6px',
} as const;

/** Writes palette, fonts and faction theme as CSS custom properties on :root. */
export function applyTokens(faction: FactionId = 'iraq') {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(TOKENS)) root.style.setProperty(`--${kebab(k)}`, String(v));
  for (const [k, v] of Object.entries(FONTS)) root.style.setProperty(`--font-${kebab(k)}`, v);
  applyFactionTheme(faction);
}

export function applyFactionTheme(faction: FactionId) {
  const root = document.documentElement;
  const t = FACTION_THEME[faction];
  root.dataset.faction = faction;
  for (const [k, v] of Object.entries(t)) if (typeof v === 'string' && v.startsWith('#')) root.style.setProperty(`--f-${kebab(k)}`, v);
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

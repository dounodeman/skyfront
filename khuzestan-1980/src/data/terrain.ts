/**
 * Terrain type table. Everything about how terrain behaves lives here.
 * speed multipliers: 0 = impassable for that movement class.
 */
export const T = {
  Sand: 0, Road: 1, Marsh: 2, Canal: 3, Bridge: 4, Grove: 5, Building: 6, Rubble: 7, Trench: 8, Dune: 9,
} as const;
export type TerrainId = (typeof T)[keyof typeof T];

export type MoveClass = 'tracked' | 'wheeled' | 'amphibious' | 'foot' | 'air';

export interface TerrainDef {
  name: string;
  color: string;
  /** Speed multiplier per movement class (air ignores terrain). */
  speed: Record<Exclude<MoveClass, 'air'>, number>;
  /** Fraction of incoming small-arms/blast damage absorbed for infantry standing here. */
  cover: number;
  /** Line-of-sight opacity per tile (>= 1 total along a ray blocks sight). */
  opacity: number;
  /** Heavy vehicles may bog down here. */
  bogs?: boolean;
  /** Hit points of a destructible tile (buildings). */
  hp?: number;
  /** Tile this turns into when destroyed. */
  becomes?: TerrainId;
}

export const TERRAIN: TerrainDef[] = [
  /* Sand */   { name: 'Desert sand', color: '#c9b27a', speed: { tracked: 1, wheeled: 0.8, foot: 1, amphibious: 1 }, cover: 0, opacity: 0 },
  /* Road */   { name: 'Road', color: '#8d8372', speed: { tracked: 1.35, wheeled: 1.7, foot: 1.1, amphibious: 1.3 }, cover: 0, opacity: 0 },
  /* Marsh */  { name: 'Marsh', color: '#6f8a62', speed: { tracked: 0.55, wheeled: 0.3, foot: 0.55, amphibious: 0.85 }, cover: 0.12, opacity: 0.12, bogs: true },
  /* Canal */  { name: 'Irrigation canal', color: '#4d7f93', speed: { tracked: 0, wheeled: 0, foot: 0, amphibious: 0.7 }, cover: 0, opacity: 0 },
  /* Bridge */ { name: 'Bridge', color: '#7b6a55', speed: { tracked: 1, wheeled: 1.2, foot: 1, amphibious: 1 }, cover: 0, opacity: 0 },
  /* Grove */  { name: 'Date palm grove', color: '#5f7a3a', speed: { tracked: 0.7, wheeled: 0.5, foot: 0.8, amphibious: 0.7 }, cover: 0.38, opacity: 0.4 },
  /* Building */ { name: 'Building', color: '#b9a98a', speed: { tracked: 0, wheeled: 0, foot: 0.5, amphibious: 0 }, cover: 0.62, opacity: 1, hp: 140, becomes: 7 },
  /* Rubble */ { name: 'Rubble', color: '#9a8f7a', speed: { tracked: 0.5, wheeled: 0.3, foot: 0.65, amphibious: 0.5 }, cover: 0.3, opacity: 0.1 },
  /* Trench */ { name: 'Trench', color: '#a08a58', speed: { tracked: 0.45, wheeled: 0.25, foot: 0.8, amphibious: 0.45 }, cover: 0.75, opacity: 0 },
  /* Dune */   { name: 'Dune', color: '#d6bf86', speed: { tracked: 0.75, wheeled: 0.5, foot: 0.85, amphibious: 0.75 }, cover: 0.2, opacity: 0.45 },
];

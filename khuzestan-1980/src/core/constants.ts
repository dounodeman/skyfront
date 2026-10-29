/** World geometry and timing constants. 1 world unit = 1 metre. */
export const TILE = 16; // metres per tile
export const MAP_W = 192; // tiles
export const MAP_H = 128;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

/** Fixed simulation step (30 Hz). Rendering interpolates nothing: it draws the latest state. */
export const SIM_DT = 1 / 30;
export const MAX_FRAME_TIME = 0.25; // clamp to avoid spiral of death after tab switch

/** Sprites are drawn larger than true scale so units stay readable. */
export const SPRITE_SCALE = 1.7;

export const TEAM_PLAYER = 0;
export const TEAM_ENEMY = 1;
export type TeamId = 0 | 1;
export const TEAM_COLORS = ['#4aa8ff', '#ff5a47'] as const;

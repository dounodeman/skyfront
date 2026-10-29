import type { TerrainId } from '../terrain';
import type { FactionId } from '../units/types';

type Rect = [number, number, number, number]; // x0,y0,x1,y1 in tiles

/** Declarative terrain painting. Ops are applied in order by sim/mapgen.ts. */
export type PaintOp =
  | { op: 'fill'; t: TerrainId; rect: Rect }
  /** Irregular ellipse. `only` restricts which existing terrain may be overwritten. */
  | { op: 'blob'; t: TerrainId; cx: number; cy: number; rx: number; ry: number; rough?: number; only?: TerrainId[] }
  | { op: 'blobs'; t: TerrainId; rect: Rect; count: number; rx: [number, number]; ry: [number, number]; only?: TerrainId[] }
  /** Thick wobbly polyline (canals, roads, trenches, palm rows). `bridge`: canal tiles become bridges. */
  | { op: 'line'; t: TerrainId; pts: [number, number][]; width: number; wobble?: number; bridge?: boolean; only?: TerrainId[] }
  /** Rectangular block of buildings laid out on a grid (towns/villages). */
  | { op: 'town'; rect: Rect; block: [number, number]; gap: number; skip: number }
  | { op: 'ring'; rect: Rect; gaps?: number }
  | { op: 'scatter'; t: TerrainId; rect: Rect; density: number; only?: TerrainId[] };

export interface ObjectiveDef {
  id: string;
  name: string;
  x: number; y: number; // tile coords
  radius: number; // tiles
  owner: FactionId | null;
}

export interface MapDef {
  id: string;
  name: string;
  description: string;
  seed: number;
  ops: PaintOp[];
  objectives: ObjectiveDef[];
  spawn: Record<FactionId, Rect>;
  depot: Record<FactionId, [number, number]>;
}

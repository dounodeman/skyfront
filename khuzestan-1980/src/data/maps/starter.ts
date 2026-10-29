import { T } from '../terrain';
import type { MapDef } from './types';

/**
 * "Khuzestan Plain" – handcrafted starter map (192x128 tiles, 16 m each = 3.1 x 2.0 km).
 * West: Iraqi start. East: Iranian start. A N-S irrigation canal splits the map; bridges are chokepoints.
 * Marsh to the south, palm groves along the canal banks, a town in the east, a village in the north.
 */
export const STARTER_MAP: MapDef = {
  id: 'khuzestan_plain',
  name: 'Khuzestan Plain',
  description: 'Flat desert split by an irrigation canal. Three bridges, a marsh to the south, palm groves and a small town.',
  seed: 1980,
  ops: [
    { op: 'fill', t: T.Sand, rect: [0, 0, 191, 127] },
    // Dunes: low ridges that break up sight lines.
    { op: 'blobs', t: T.Dune, rect: [0, 0, 70, 127], count: 22, rx: [3, 7], ry: [1.5, 3] },
    { op: 'blobs', t: T.Dune, rect: [150, 0, 191, 127], count: 16, rx: [3, 7], ry: [1.5, 3] },
    { op: 'blobs', t: T.Dune, rect: [84, 0, 150, 40], count: 8, rx: [2, 5], ry: [1.5, 2.5] },
    // Marsh
    { op: 'blob', t: T.Marsh, cx: 118, cy: 112, rx: 32, ry: 14, rough: 0.35 },
    { op: 'blob', t: T.Marsh, cx: 112, cy: 12, rx: 18, ry: 9, rough: 0.35 },
    { op: 'blob', t: T.Marsh, cx: 94, cy: 104, rx: 9, ry: 7, rough: 0.3 },
    { op: 'blob', t: T.Marsh, cx: 66, cy: 14, rx: 8, ry: 5, rough: 0.3 },
    // Irrigation canals
    { op: 'line', t: T.Canal, pts: [[79, 0], [81, 20], [79, 42], [82, 64], [80, 88], [82, 108], [80, 127]], width: 3.2, wobble: 0.7 },
    { op: 'line', t: T.Canal, pts: [[83, 90], [100, 92], [118, 90], [140, 94], [160, 90], [191, 92]], width: 2.4, wobble: 0.6 },
    // Palm rows along the canal banks
    { op: 'line', t: T.Grove, pts: [[86, 0], [88, 20], [86, 42], [89, 64], [88, 88]], width: 2.2, wobble: 0.8, only: [T.Sand, T.Dune] },
    { op: 'line', t: T.Grove, pts: [[73, 4], [75, 22], [73, 44], [76, 62]], width: 1.6, wobble: 0.8, only: [T.Sand, T.Dune] },
    // Groves
    { op: 'blob', t: T.Grove, cx: 94, cy: 50, rx: 6, ry: 12, rough: 0.4, only: [T.Sand, T.Dune] },
    { op: 'blob', t: T.Grove, cx: 98, cy: 80, rx: 7, ry: 7, rough: 0.4, only: [T.Sand, T.Dune] },
    { op: 'blob', t: T.Grove, cx: 128, cy: 52, rx: 9, ry: 5, rough: 0.4, only: [T.Sand, T.Dune] },
    { op: 'blob', t: T.Grove, cx: 131, cy: 82, rx: 8, ry: 5, rough: 0.4, only: [T.Sand, T.Dune] },
    { op: 'blob', t: T.Grove, cx: 168, cy: 46, rx: 7, ry: 9, rough: 0.4, only: [T.Sand, T.Dune] },
    { op: 'blob', t: T.Grove, cx: 170, cy: 82, rx: 6, ry: 7, rough: 0.4, only: [T.Sand, T.Dune] },
    { op: 'blob', t: T.Grove, cx: 44, cy: 76, rx: 6, ry: 6, rough: 0.4, only: [T.Sand, T.Dune] },
    { op: 'blob', t: T.Grove, cx: 52, cy: 30, rx: 7, ry: 5, rough: 0.4, only: [T.Sand, T.Dune] },
    { op: 'blob', t: T.Grove, cx: 112, cy: 40, rx: 5, ry: 7, rough: 0.4, only: [T.Sand, T.Dune] },
    // Roads (bridge: true turns canal crossings into bridges)
    { op: 'line', t: T.Road, pts: [[0, 64], [40, 64], [70, 64], [82, 64], [100, 64], [125, 65], [146, 65], [170, 64], [191, 64]], width: 1.6, wobble: 0.15, bridge: true },
    { op: 'line', t: T.Road, pts: [[100, 64], [104, 46], [114, 30], [127, 22]], width: 1.2, wobble: 0.2, bridge: true },
    { op: 'line', t: T.Road, pts: [[30, 38], [60, 33], [80, 31], [112, 30]], width: 1.2, wobble: 0.2, bridge: true },
    { op: 'line', t: T.Road, pts: [[100, 64], [106, 80], [112, 91], [114, 104], [100, 106], [80, 104], [64, 101], [40, 96]], width: 1.2, wobble: 0.2, bridge: true },
    // Settlements
    { op: 'town', rect: [134, 52, 160, 78], block: [3, 3], gap: 2, skip: 0.14 },
    { op: 'town', rect: [118, 14, 134, 28], block: [2, 2], gap: 2, skip: 0.2 },
    { op: 'ring', rect: [57, 97, 67, 105], gaps: 3 },
    { op: 'town', rect: [60, 99, 64, 103], block: [2, 1], gap: 1, skip: 0.3 },
    { op: 'town', rect: [24, 56, 32, 62], block: [2, 2], gap: 2, skip: 0.2 }, // border-post huts
  ],
  objectives: [
    { id: 'bridge', name: 'Central Bridge', x: 82, y: 64, radius: 8, owner: null },
    { id: 'village', name: 'North Village', x: 126, y: 21, radius: 8, owner: null },
    { id: 'town', name: 'Town of Shahrak', x: 147, y: 65, radius: 10, owner: null },
    { id: 'farms', name: 'South Farms', x: 62, y: 101, radius: 8, owner: null },
  ],
  spawn: { iraq: [5, 40, 28, 90], iran: [164, 40, 187, 90] },
  depot: { iraq: [14, 64], iran: [178, 64] },
};

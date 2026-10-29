import type { UnitDef } from './types';

/**
 * Shared defaults for infantry squads so the faction files only state what differs.
 * Everything here is still plain data and can be overridden per unit.
 */
type InfOpts = Omit<UnitDef, 'category' | 'moveClass' | 'hp' | 'crew' | 'mobility' | 'vision' | 'sprite' | 'slots'> & {
  mobility?: Partial<UnitDef['mobility']>;
  vision?: Partial<UnitDef['vision']>;
};

export function infantry(o: InfOpts): UnitDef {
  return {
    category: 'infantry', moveClass: 'foot', hp: 0, crew: [], slots: 1,
    ...o,
    mobility: { speed: 3.2, turnRate: 360, accel: 3, fuel: 0, reliability: 1, bogRisk: 0, moveFirePenalty: 0.6, ...o.mobility },
    vision: { range: 650, night: 0.15, signature: 0.75, ...o.vision },
    sprite: { kind: 'infantry', length: 6, width: 6 },
  };
}

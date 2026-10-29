import { STARTER_MAP } from '../src/data/maps/starter';
import { buildMap, dumpMap } from '../src/sim/mapgen';
console.log(dumpMap(buildMap(STARTER_MAP), 2));

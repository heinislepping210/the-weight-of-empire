// Provisional road network of the Vitebsk–Smolensk theatre (MAP_AND_GEOGRAPHY.md).
//
// Every road here is a working assumption until it is traced on a period map. `metres` is the
// great-circle distance between the places × 1.25 for winding roads (assumption G-007), computed
// once and stored as an integer so every browser sees the same number. Crossings are only marked
// where an account supports them; unknown crossings are left out rather than guessed.

import type { EdgeDef, NodeDef } from '../../engine/graph';
import { PLACES } from './places';

export type RoadStatus = 'provisional' | 'traced';

export interface Road extends EdgeDef {
  status: RoadStatus;
  basis: string;
}

const MAIN_EAST_WEST = 'Orsha–Smolensk stretch of the main road to Moscow; route widely described, line to be traced';

export const ROADS: readonly Road[] = [
  // Vitebsk–Smolensk road, north of the Dnieper (axis of the Russian advance towards Rudnia in August 1812)
  { id: 'vitebsk-liozno', a: 'vitebsk', b: 'liozno', metres: 54_507, road: 'post', crossing: null, status: 'provisional', basis: 'Vitebsk–Smolensk road' },
  { id: 'liozno-rudnia', a: 'liozno', b: 'rudnia', metres: 24_133, road: 'post', crossing: null, status: 'provisional', basis: 'Vitebsk–Smolensk road' },
  { id: 'rudnia-smolensk-north', a: 'rudnia', b: 'smolensk-north', metres: 80_767, road: 'post', crossing: null, status: 'provisional', basis: 'Vitebsk–Smolensk road, entering the north-bank suburb' },

  // Northern flank along the Dvina and through Porechye (the Russian false alarm of 8 August, H-012)
  { id: 'vitebsk-surazh', a: 'vitebsk', b: 'surazh', metres: 53_772, road: 'secondary', crossing: null, status: 'provisional', basis: 'Dvina valley road' },
  { id: 'surazh-velizh', a: 'surazh', b: 'velizh', metres: 46_274, road: 'secondary', crossing: null, status: 'provisional', basis: 'Dvina valley road' },
  { id: 'velizh-porechye', a: 'velizh', b: 'porechye', metres: 52_630, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'surazh-porechye', a: 'surazh', b: 'porechye', metres: 65_663, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'rudnia-porechye', a: 'rudnia', b: 'porechye', metres: 56_726, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'porechye-smolensk-north', a: 'porechye', b: 'smolensk-north', metres: 77_694, road: 'secondary', crossing: null, status: 'provisional', basis: 'route of the Russian 1st Army to Smolensk, arriving 1 August (H-013)' },

  // Cross-country links between the Vitebsk road and the Dnieper
  { id: 'vitebsk-babinovichi', a: 'vitebsk', b: 'babinovichi', metres: 58_207, road: 'secondary', crossing: null, status: 'provisional', basis: 'Vitebsk–Orsha road' },
  { id: 'liozno-babinovichi', a: 'liozno', b: 'babinovichi', metres: 31_636, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'babinovichi-liubavichi', a: 'babinovichi', b: 'liubavichi', metres: 30_605, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'liubavichi-rudnia', a: 'liubavichi', b: 'rudnia', metres: 18_324, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'babinovichi-orsha', a: 'babinovichi', b: 'orsha', metres: 47_050, road: 'secondary', crossing: 'bridge', status: 'provisional', basis: 'Vitebsk–Orsha road; Dnieper crossing at Orsha' },

  // The southern swing: across the Dnieper at Rasasna, then east along the main road (H-004, H-005)
  { id: 'liubavichi-rasasna', a: 'liubavichi', b: 'rasasna', metres: 27_037, road: 'track', crossing: null, status: 'provisional', basis: 'approach to the crossing used on 13–14 August' },
  { id: 'rasasna-liady', a: 'rasasna', b: 'liady', metres: 24_324, road: 'track', crossing: 'pontoon', status: 'provisional', basis: 'Dnieper bridged by engineers on the night of 13–14 August; no permanent bridge assumed' },
  { id: 'orsha-dubrovna', a: 'orsha', b: 'dubrovna', metres: 23_033, road: 'post', crossing: null, status: 'provisional', basis: MAIN_EAST_WEST },
  { id: 'dubrovna-liady', a: 'dubrovna', b: 'liady', metres: 38_849, road: 'post', crossing: null, status: 'provisional', basis: MAIN_EAST_WEST },
  { id: 'liady-krasnyi', a: 'liady', b: 'krasnyi', metres: 22_132, road: 'post', crossing: null, status: 'provisional', basis: MAIN_EAST_WEST },
  { id: 'krasnyi-smolensk', a: 'krasnyi', b: 'smolensk', metres: 58_010, road: 'post', crossing: null, status: 'provisional', basis: MAIN_EAST_WEST },

  // Smolensk and the Moscow road
  { id: 'smolensk-bridges', a: 'smolensk', b: 'smolensk-north', metres: 1_398, road: 'post', crossing: 'bridge', status: 'provisional', basis: 'bridges between the Old Town and the north-bank suburb' },
  { id: 'smolensk-north-valutino', a: 'smolensk-north', b: 'valutino', metres: 12_755, road: 'post', crossing: null, status: 'provisional', basis: 'Moscow road' },
  { id: 'valutino-dorogobuzh', a: 'valutino', b: 'dorogobuzh', metres: 90_214, road: 'post', crossing: null, status: 'provisional', basis: 'Moscow road; whether it crosses the Dnieper on this stretch is still to be checked' },

  // Southern edge (Bagration's line of approach; crossings at Mogilev not yet modelled)
  { id: 'orsha-mogilev', a: 'orsha', b: 'mogilev', metres: 83_709, road: 'post', crossing: null, status: 'provisional', basis: 'Dnieper valley road' },
  { id: 'mogilev-mstislavl', a: 'mogilev', b: 'mstislavl', metres: 114_021, road: 'secondary', crossing: null, status: 'provisional', basis: 'route only broadly known; Dnieper crossing to be checked' },
  { id: 'mstislavl-krasnyi', a: 'mstislavl', b: 'krasnyi', metres: 78_703, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'mstislavl-smolensk', a: 'mstislavl', b: 'smolensk', metres: 109_205, road: 'secondary', crossing: null, status: 'provisional', basis: 'approach of the Russian 2nd Army to Smolensk' },
];

/** Engine-ready network: nodes and edges without the research fields. */
export function vitebskNetwork(): { nodes: NodeDef[]; edges: EdgeDef[] } {
  return {
    nodes: PLACES.map(({ id, name }) => ({ id, name })),
    edges: ROADS.map(({ id, a, b, metres, road, crossing }) => ({ id, a, b, metres, road, crossing })),
  };
}

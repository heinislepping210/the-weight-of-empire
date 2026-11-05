// Provisional road network of the Vitebsk–Smolensk theatre (MAP_AND_GEOGRAPHY.md).
//
// Every road here is a working assumption until it is traced on a period map. `metres` is the
// great-circle distance between the places × 1.25 for winding roads (assumption G-007), computed
// once and stored as an integer so every browser sees the same number. Road classes and crossings
// follow Piadyshev's maps of 1820–21 where those show them (the road audit, D-052); elsewhere a
// crossing is marked only where an account supports it. The maps' lengths are not adopted yet.

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
  { id: 'vitebsk-liozno', a: 'vitebsk', b: 'liozno', metres: 54_507, road: 'secondary', crossing: null, status: 'provisional', basis: 'Vitebsk–Smolensk road; on Piadyshev a lesser road by Polowiki and Gryshanki' },
  { id: 'liozno-rudnia', a: 'liozno', b: 'rudnia', metres: 24_133, road: 'secondary', crossing: null, status: 'provisional', basis: 'Vitebsk–Smolensk road; not on Piadyshev (1821), heavy on Schubert (1853)' },
  { id: 'rudnia-smolensk-north', a: 'rudnia', b: 'smolensk-north', metres: 80_767, road: 'secondary', crossing: null, status: 'provisional', basis: 'Vitebsk–Smolensk road, entering the north-bank suburb; not on Piadyshev (1821), heavy on Schubert (1853)' },

  // Northern flank along the Dvina and through Porechye (the Russian false alarm of 8 August, H-012)
  { id: 'vitebsk-surazh', a: 'vitebsk', b: 'surazh', metres: 53_772, road: 'post', crossing: null, status: 'provisional', basis: 'Dvina valley road; a main post road on Piadyshev' },
  { id: 'surazh-velizh', a: 'surazh', b: 'velizh', metres: 46_274, road: 'secondary', crossing: null, status: 'provisional', basis: 'Dvina valley road' },
  { id: 'velizh-porechye', a: 'velizh', b: 'porechye', metres: 52_630, road: 'secondary', crossing: null, status: 'provisional', basis: 'district road on Piadyshev, by Kariaki' },
  { id: 'surazh-porechye', a: 'surazh', b: 'porechye', metres: 65_663, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'rudnia-porechye', a: 'rudnia', b: 'porechye', metres: 56_726, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'porechye-smolensk-north', a: 'porechye', b: 'smolensk-north', metres: 77_694, road: 'post', crossing: null, status: 'provisional', basis: 'a main post road on Piadyshev; route of the Russian 1st Army to Smolensk, arriving 1 August (H-013)' },

  // Cross-country links between the Vitebsk road and the Dnieper
  { id: 'vitebsk-babinovichi', a: 'vitebsk', b: 'babinovichi', metres: 58_207, road: 'post', crossing: null, status: 'provisional', basis: 'Vitebsk–Orsha road; a main post road on Piadyshev' },
  { id: 'liozno-babinovichi', a: 'liozno', b: 'babinovichi', metres: 31_636, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'babinovichi-liubavichi', a: 'babinovichi', b: 'liubavichi', metres: 30_605, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'liubavichi-rudnia', a: 'liubavichi', b: 'rudnia', metres: 18_324, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'babinovichi-orsha', a: 'babinovichi', b: 'orsha', metres: 47_050, road: 'post', crossing: null, status: 'provisional', basis: 'Vitebsk–Orsha road, a main post road on Piadyshev; it reaches Orsha on the west bank, with no crossing' },

  // The southern swing: across the Dnieper at Rasasna, then east along the main road (H-004, H-005)
  { id: 'liubavichi-rasasna', a: 'liubavichi', b: 'rasasna', metres: 27_037, road: 'track', crossing: 'pontoon', status: 'provisional', basis: 'approach to the crossing used on 13–14 August: Rasasna stands on the south bank, so the river falls here' },
  { id: 'rasasna-liady', a: 'rasasna', b: 'liady', metres: 24_324, road: 'secondary', crossing: null, status: 'provisional', basis: 'south bank: Schubert shows a road from Rosasna to Kozyany on the post road; Piadyshev has Kozyany to Liady as post road' },
  { id: 'orsha-dubrovna', a: 'orsha', b: 'dubrovna', metres: 23_033, road: 'post', crossing: 'bridge', status: 'provisional', basis: `${MAIN_EAST_WEST}; Orsha stands west of the Dnieper, so the crossing falls here` },
  { id: 'dubrovna-liady', a: 'dubrovna', b: 'liady', metres: 38_849, road: 'post', crossing: null, status: 'provisional', basis: MAIN_EAST_WEST },
  { id: 'liady-krasnyi', a: 'liady', b: 'krasnyi', metres: 22_132, road: 'post', crossing: null, status: 'provisional', basis: MAIN_EAST_WEST },
  { id: 'krasnyi-smolensk', a: 'krasnyi', b: 'smolensk', metres: 58_010, road: 'post', crossing: null, status: 'provisional', basis: MAIN_EAST_WEST },

  // Smolensk and the Moscow road
  { id: 'smolensk-bridges', a: 'smolensk', b: 'smolensk-north', metres: 1_398, road: 'post', crossing: 'bridge', status: 'provisional', basis: 'bridges between the Old Town and the north-bank suburb' },
  { id: 'smolensk-north-valutino', a: 'smolensk-north', b: 'valutino', metres: 12_755, road: 'post', crossing: null, status: 'provisional', basis: 'Moscow road' },
  {
    id: 'smolensk-prudichevo-valutino',
    a: 'smolensk',
    b: 'valutino',
    metres: 12_598,
    road: 'track',
    crossing: 'ford',
    status: 'provisional',
    basis:
      'Foord (1914), ch. V: from the south side of Smolensk a track crossed the Dnieper by a ford at Prudichevo, about 6 miles out, and joined the Moscow high road about 2 miles west of Lubino; on 19 August Eblé bridged it and Junot crossed there (H-022). Length by the network rule (G-007); the track itself was longer. Adopted on your decision (D-044)',
  },
  { id: 'valutino-dorogobuzh', a: 'valutino', b: 'dorogobuzh', metres: 90_214, road: 'post', crossing: 'bridge', status: 'provisional', basis: 'Moscow road; on Piadyshev it crosses the Dnieper just east of Pnewa, with no bridge or ferry marked, so the kind of crossing is assumed' },

  // Southern edge (Bagration's line of approach)
  { id: 'orsha-mogilev', a: 'orsha', b: 'mogilev', metres: 83_709, road: 'post', crossing: null, status: 'provisional', basis: 'Dnieper valley road' },
  { id: 'mogilev-mstislavl', a: 'mogilev', b: 'mstislavl', metres: 114_021, road: 'secondary', crossing: 'bridge', status: 'provisional', basis: 'Piadyshev, by Sukhari and Riasna; Mogilev stands west of the Dnieper, so the road crosses at the town, the kind of crossing assumed' },
  { id: 'mstislavl-krasnyi', a: 'mstislavl', b: 'krasnyi', metres: 78_703, road: 'track', crossing: null, status: 'provisional', basis: 'country road' },
  { id: 'mstislavl-smolensk', a: 'mstislavl', b: 'smolensk', metres: 109_205, road: 'secondary', crossing: null, status: 'provisional', basis: 'approach of the Russian 2nd Army to Smolensk' },

  // Found by the road audit (D-052): 25¾ versts on the map, the one road here with its length from the map.
  { id: 'liozno-liubavichi', a: 'liozno', b: 'liubavichi', metres: 27_470, road: 'secondary', crossing: null, status: 'provisional', basis: 'Piadyshev, Mogilev province, 1821' },
];

/**
 * Roads found in the sources but not yet adopted (MAP_AND_GEOGRAPHY.md, "Missing"). They are left out of the game
 * until you decide, and offered only for what-if runs (`vitebskNetwork({ candidates: true })`).
 */
export const CANDIDATE_ROADS: readonly Road[] = [];

/** A Russian verst in metres. */
export const VERST_METRES = 1_066.8;

/** The lengths Piadyshev's maps of 1820–21 give a road, for the road audit (HISTORICAL_RESEARCH). Not adopted: a what-if. */
export interface RoadReading {
  /** The stages between stations as the map numbers them, in versts. */
  stages: readonly number[];
  /** The stations between its ends, in the map's order. */
  via?: string;
  /** A stage is not numbered and was judged from the map's scale. */
  estimated?: boolean;
  /** The stages run from Smolensk, so the road from there to this road's start is taken off. */
  fromSmolensk?: boolean;
}

export const ROAD_READINGS: Readonly<Record<string, RoadReading>> = {
  'vitebsk-liozno': { stages: [21.75, 11, 9], via: 'Polowiki, Gryshanki', estimated: true },
  'vitebsk-surazh': { stages: [19.75, 20.25], via: 'Naponovshchina' },
  'surazh-velizh': { stages: [20, 21], via: 'Verkhovye' },
  'velizh-porechye': { stages: [18, 23], via: 'Kariaki' },
  'porechye-smolensk-north': { stages: [14, 18, 18, 23], via: 'Peresud, Kiseleva, Perikhova' },
  'vitebsk-babinovichi': { stages: [21.75, 25], via: 'Polowiki' },
  'babinovichi-orsha': { stages: [18, 20], via: 'Orekhi' },
  'orsha-dubrovna': { stages: [16.25] },
  'dubrovna-liady': { stages: [13, 17.5], via: 'Kozyany' },
  'liady-krasnyi': { stages: [16] },
  'krasnyi-smolensk': { stages: [23, 23], via: 'Korytnia' },
  'valutino-dorogobuzh': { stages: [23, 17, 25, 23], via: 'Bredikhino, Pnewa, Mikhailovka', fromSmolensk: true },
  'orsha-mogilev': { stages: [21.75, 17, 13, 20], via: 'Alexandria, Shklov, Dobreika' },
  'mogilev-mstislavl': { stages: [16.25, 12.75, 19, 13.5, 15.25, 17], via: 'Bryle, Sukhari, Suslovka, Riasna, Bystritsa' },
  'mstislavl-smolensk': { stages: [15, 17, 28, 27], via: 'Mazyki, Khislavichi' },
};

/** The length a reading gives a road, or null if it gives none. */
export function readingMetres(id: string): number | null {
  const r = ROAD_READINGS[id];
  if (!r) return null;
  const metres = Math.round(r.stages.reduce((n, v) => n + v, 0) * VERST_METRES);
  return r.fromSmolensk ? metres - (ROADS.find((x) => x.id === 'smolensk-north-valutino')?.metres ?? 0) : metres;
}

/**
 * Engine-ready network: nodes and edges without the research fields; with `candidates`, the roads not yet adopted
 * too; with `readings`, the road audit's lengths in place of G-007's, for what-if runs only.
 */
export function vitebskNetwork(options: { candidates?: boolean; readings?: boolean } = {}): { nodes: NodeDef[]; edges: EdgeDef[] } {
  const base = options.candidates ? [...ROADS, ...CANDIDATE_ROADS] : ROADS;
  const roads = options.readings ? base.map((r) => ({ ...r, metres: readingMetres(r.id) ?? r.metres })) : base;
  return {
    nodes: PLACES.map(({ id, name }) => ({ id, name })),
    edges: roads.map(({ id, a, b, metres, road, crossing }) => ({ id, a, b, metres, road, crossing })),
  };
}

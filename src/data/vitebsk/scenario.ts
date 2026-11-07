// The Vitebsk Decision: the situation on 5 August 1812 (GAME_DESIGN_DOCUMENT.md §2.3).
//
// Status of the numbers (HISTORICAL_ASSUMPTIONS.md):
// - Totals sit inside the researched ranges (H-009): French central group ≈180,000,
//   Russian 1st and 2nd Armies ≈120,000–130,000 plus Cossacks. The French are taken at their mid-August
//   strength, after the straggling of early August, though the game starts on 5 August (D-048).
// - The split of those totals across force groups is a game assumption (G-010), pending orders of battle.
// - Start positions are working assumptions from the chronology (G-011, H-001 to H-003).
// - Carried supplies, depot stocks and countryside yields are placeholders (G-012).
// - Cavalry, guns and the Guard's quality are game assumptions guided by the sources in H-021 (G-021).

import type { DepotInit, ConvoyInit, ForceInit, ScenarioDef, Strength } from '../../engine/scenario';
import type { District } from '../../engine/types';
import { PLACES } from './places';
import { vitebskNetwork } from './roads';

const days = (people: number, n: number) => people * n;

const FORCES: ForceInit[] = [
  // French: dispersed in cantonments to feed and rest after the advance to Vitebsk
  { id: 'fr-guard', side: 'fr', name: 'Imperial Guard and Headquarters', at: 'vitebsk', men: [28_000, 36_000], cavalry: [4_000, 6_000], guns: [100, 112], quality: 1200, horses: [6_000, 8_000], posture: 'dispersed', wagons: 300, stock: { food: days(32_000, 4), fodder: days(7_000, 1), ammo: 6_000 } },
  { id: 'fr-vanguard', side: 'fr', name: "Vanguard: Murat's cavalry and Ney's corps", at: 'liozno', men: [38_000, 50_000], cavalry: [13_000, 17_000], guns: [130, 190], horses: [14_000, 20_000], posture: 'dispersed', wagons: 250, stock: { food: days(44_000, 3), fodder: days(17_000, 1), ammo: 8_000 } },
  { id: 'fr-left', side: 'fr', name: "Left wing: Eugène's corps", at: 'surazh', men: [28_000, 36_000], cavalry: [3_000, 5_000], guns: [130, 165], horses: [6_000, 8_000], posture: 'dispersed', wagons: 200, stock: { food: days(32_000, 3), fodder: days(7_000, 1), ammo: 6_000 } },
  { id: 'fr-right', side: 'fr', name: "Right wing: Davout's corps", at: 'dubrovna', men: [42_000, 55_000], cavalry: [2_500, 4_500], guns: [190, 250], horses: [8_000, 11_000], posture: 'dispersed', wagons: 300, stock: { food: days(48_000, 3), fodder: days(9_500, 1), ammo: 9_000 } },
  { id: 'fr-south', side: 'fr', name: 'Southern group: Poniatowski and Junot', at: 'mogilev', men: [26_000, 36_000], cavalry: [4_000, 6_000], guns: [120, 165], horses: [6_000, 8_000], posture: 'dispersed', wagons: 200, stock: { food: days(31_000, 3), fodder: days(7_000, 1), ammo: 6_000 } },

  // Russians: united at Smolensk under political pressure to stop retreating
  // Starting stocks fit what each group can carry (G-019): a day of fodder for the armies, and Cossack horses living mostly off the grass.
  { id: 'ru-1st', side: 'ru', name: '1st Western Army (Barclay de Tolly)', at: 'smolensk-north', men: [70_000, 80_000], cavalry: [10_000, 13_000], guns: [330, 400], horses: [14_000, 18_000], posture: 'dispersed', wagons: 400, stock: { food: days(75_000, 6), fodder: days(16_000, 1), ammo: 15_000 } },
  { id: 'ru-2nd', side: 'ru', name: '2nd Western Army (Bagration)', at: 'smolensk', men: [38_000, 46_000], cavalry: [5_500, 7_500], guns: [190, 216], horses: [8_000, 10_000], posture: 'dispersed', wagons: 250, stock: { food: days(42_000, 6), fodder: days(9_000, 1), ammo: 8_000 } },
  { id: 'ru-cossacks', side: 'ru', name: "Platov's Cossacks", at: 'rudnia', men: [7_000, 10_000], cavalry: 'all', guns: [0, 12], horses: [9_000, 12_000], posture: 'dispersed', wagons: 30, stock: { food: days(8_500, 3), fodder: 2_500, ammo: 500 } },
  { id: 'ru-neverovsky', side: 'ru', name: "Neverovsky's division", at: 'krasnyi', men: [6_000, 8_000], cavalry: [1_000, 1_500], guns: 14, horses: [1_000, 1_500], posture: 'dispersed', wagons: 40, stock: { food: days(7_000, 5), fodder: days(1_200, 2), ammo: 1_500 } },
];

const DEPOTS: DepotInit[] = [
  { node: 'vitebsk', side: 'fr', stock: { food: 1_200_000, fodder: 120_000, ammo: 80_000 } },
  { node: 'orsha', side: 'fr', stock: { food: 600_000, fodder: 60_000, ammo: 40_000 } },
  { node: 'mogilev', side: 'fr', stock: { food: 300_000, fodder: 30_000, ammo: 20_000 } },
  { node: 'smolensk', side: 'ru', stock: { food: 1_500_000, fodder: 150_000, ammo: 100_000 } },
  { node: 'dorogobuzh', side: 'ru', stock: { food: 400_000, fodder: 50_000, ammo: 40_000 } },
];

const CONVOYS: ConvoyInit[] = [
  { id: 'cv-vitebsk-guard', side: 'fr', home: 'vitebsk', serves: 'fr-guard', wagons: 150 },
  { id: 'cv-vitebsk-vanguard', side: 'fr', home: 'vitebsk', serves: 'fr-vanguard', wagons: 250 },
  { id: 'cv-vitebsk-left', side: 'fr', home: 'vitebsk', serves: 'fr-left', wagons: 150 },
  { id: 'cv-orsha-right', side: 'fr', home: 'orsha', serves: 'fr-right', wagons: 250 },
  { id: 'cv-mogilev-south', side: 'fr', home: 'mogilev', serves: 'fr-south', wagons: 150 },
  // Line trains of the transport battalions: idle at their depots until the staff sends them forward (G-016).
  { id: 'cv-line-vitebsk', side: 'fr', home: 'vitebsk', wagons: 300 },
  { id: 'cv-line-orsha', side: 'fr', home: 'orsha', wagons: 250 },
  { id: 'cv-smolensk-1st', side: 'ru', home: 'smolensk', serves: 'ru-1st', wagons: 100 },
  { id: 'cv-smolensk-2nd', side: 'ru', home: 'smolensk', serves: 'ru-2nd', wagons: 80 },
  { id: 'cv-smolensk-neverovsky', side: 'ru', home: 'smolensk', serves: 'ru-neverovsky', wagons: 40 },
];

/**
 * The French strength the scenario starts with. `mid-august` is the adopted one (H-009). The others are what-ifs,
 * not adopted: the groups at their strength on 5 August, the game's start, by Nafziger's returns of 1 and 15 August
 * (HISTORICAL_RESEARCH, "The third review's history audit"); with `-cavalry`, their cavalry from the returns too.
 */
export type FrenchStrength = 'mid-august' | 'returns-5-august' | 'returns-5-august-cavalry';

/** Each group on 5 August by the returns, with the scenario's spread of ±12.5% around the estimate. */
const RETURNS_5_AUGUST: Record<string, { men: readonly [number, number]; cavalry: readonly [number, number] }> = {
  'fr-guard': { men: [31_100, 40_000], cavalry: [5_100, 6_600] },
  'fr-vanguard': { men: [50_800, 65_300], cavalry: [24_500, 31_500] },
  'fr-left': { men: [36_800, 47_300], cavalry: [3_700, 4_800] },
  'fr-right': { men: [57_800, 74_400], cavalry: [2_800, 3_600] },
  'fr-south': { men: [38_500, 49_500], cavalry: [4_300, 5_600] },
};

/** How much larger a group is on 5 August than in the adopted scenario; 1 for the adopted strength and the Russians. */
function growth(f: ForceInit, strength: FrenchStrength): number {
  const target = RETURNS_5_AUGUST[f.id];
  if (strength === 'mid-august' || !target || typeof f.men === 'number') return 1;
  return (target.men[0] + target.men[1]) / (f.men[0] + f.men[1]);
}

/**
 * A French group at the chosen strength: its men from the returns, and its horses, wagons and carried stocks grown
 * by the same factor, so that it has as many days of food per man; its guns as they are. Its cavalry grows with it,
 * or comes from the returns with a mount for each extra horseman.
 */
function atStrength(f: ForceInit, strength: FrenchStrength): ForceInit {
  const factor = growth(f, strength);
  const target = RETURNS_5_AUGUST[f.id];
  if (factor === 1 || !target) return { ...f, stock: { ...f.stock } };
  const scale = (x: number) => Math.round(x * factor);
  const range = (s: Strength): readonly [number, number] => (typeof s === 'number' ? [scale(s), scale(s)] : [scale(s[0]), scale(s[1])]);
  let horses = range(f.horses);
  let cavalry = f.cavalry === undefined || f.cavalry === 'all' ? f.cavalry : range(f.cavalry);
  if (strength === 'returns-5-august-cavalry' && Array.isArray(cavalry)) {
    horses = [horses[0] + target.cavalry[0] - cavalry[0], horses[1] + target.cavalry[1] - cavalry[1]];
    cavalry = target.cavalry;
  }
  return { ...f, men: target.men, cavalry, horses, wagons: scale(f.wagons), stock: { food: scale(f.stock.food), fodder: scale(f.stock.fodder), ammo: scale(f.stock.ammo) } };
}

/** What the countryside around each place can still yield (G-012): uniform placeholders. */
const DISTRICTS: Record<string, District> = Object.fromEntries(PLACES.map((p) => [p.id, { food: 150_000, fodder: 150_000 }]));

/**
 * The scenario. For what-if runs only: `candidateRoads` adds the roads not yet adopted (MAP_AND_GEOGRAPHY.md),
 * `frenchStrength` starts the French at another strength, their wagon trains grown with them, and `roadReadings`
 * uses the lengths the road audit read from the maps of 1820–21, and `pontoonStart` starts the bridging train elsewhere.
 */
export function vitebskDecision(options: { candidateRoads?: boolean; frenchStrength?: FrenchStrength; roadReadings?: boolean; pontoonStart?: string } = {}): ScenarioDef {
  const { nodes, edges } = vitebskNetwork({ candidates: options.candidateRoads ?? false, readings: options.roadReadings ?? false });
  const strength = options.frenchStrength ?? 'mid-august';
  const served = new Map(FORCES.map((f) => [f.id, growth(f, strength)]));
  return {
    id: ['vitebsk-decision', ...(options.candidateRoads ? ['candidate-roads'] : []), ...(strength !== 'mid-august' ? [strength] : []), ...(options.roadReadings ? ['road-readings'] : [])].join('+'),
    title: 'The Vitebsk Decision',
    startDate: '1812-08-05',
    turns: 10,
    nodes,
    edges,
    forces: FORCES.map((f) => atStrength(f, strength)),
    depots: DEPOTS.map((d) => ({ ...d, stock: { ...d.stock } })),
    convoys: CONVOYS.map((c) => ({ ...c, wagons: Math.round(c.wagons * (c.serves ? (served.get(c.serves) ?? 1) : 1)) })),
    districts: Object.fromEntries(Object.entries(DISTRICTS).map(([k, v]) => [k, { ...v }])),
    // Places of Smolensk province, the "old Russian" soil whose loss raised pressure on Barclay (G-014).
    pressurePlaces: ['rudnia', 'porechye', 'krasnyi', 'smolensk', 'smolensk-north', 'valutino', 'dorogobuzh'],
    keyPlaces: ['smolensk', 'smolensk-north'],
    pontoonStart: options.pontoonStart ?? 'orsha',
    raiders: ['ru-cossacks'],
    // The walled Old Town (H-006); the north-bank suburb is fought over as open ground for now (G-022).
    battlefields: { smolensk: 'smolensk' },
    // The Moscow road eastwards: the Russian line of retreat.
    exitPlaces: ['dorogobuzh'],
    // §2.13: Valutino (Lubino) or Dorogobuzh on the Moscow road; to verify against the period road network.
    cutOffPlaces: ['valutino', 'dorogobuzh'],
  };
}

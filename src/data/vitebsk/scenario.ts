// The Vitebsk Decision: the situation on 5 August 1812 (GAME_DESIGN_DOCUMENT.md §2.3).
//
// Status of the numbers (HISTORICAL_ASSUMPTIONS.md):
// - Totals sit inside the researched ranges (H-009): French central group ≈180,000,
//   Russian 1st and 2nd Armies ≈120,000–130,000 plus Cossacks.
// - The split of those totals across force groups is a game assumption (G-010), pending orders of battle.
// - Start positions are working assumptions from the chronology (G-011, H-001 to H-003).
// - Carried supplies, depot stocks and countryside yields are placeholders (G-012).

import type { DepotInit, ConvoyInit, ForceInit, ScenarioDef } from '../../engine/scenario';
import type { District } from '../../engine/types';
import { PLACES } from './places';
import { vitebskNetwork } from './roads';

const days = (people: number, n: number) => people * n;

const FORCES: ForceInit[] = [
  // French: dispersed in cantonments to feed and rest after the advance to Vitebsk
  { id: 'fr-guard', side: 'fr', name: 'Imperial Guard and Headquarters', at: 'vitebsk', men: [28_000, 36_000], horses: [6_000, 8_000], posture: 'dispersed', wagons: 300, stock: { food: days(32_000, 4), fodder: days(7_000, 1), ammo: 6_000 } },
  { id: 'fr-vanguard', side: 'fr', name: "Vanguard: Murat's cavalry and Ney's corps", at: 'liozno', men: [38_000, 50_000], horses: [14_000, 20_000], posture: 'dispersed', wagons: 250, stock: { food: days(44_000, 3), fodder: days(17_000, 1), ammo: 8_000 } },
  { id: 'fr-left', side: 'fr', name: "Left wing: Eugène's corps", at: 'surazh', men: [28_000, 36_000], horses: [6_000, 8_000], posture: 'dispersed', wagons: 200, stock: { food: days(32_000, 3), fodder: days(7_000, 1), ammo: 6_000 } },
  { id: 'fr-right', side: 'fr', name: "Right wing: Davout's corps", at: 'dubrovna', men: [42_000, 55_000], horses: [8_000, 11_000], posture: 'dispersed', wagons: 300, stock: { food: days(48_000, 3), fodder: days(9_500, 1), ammo: 9_000 } },
  { id: 'fr-south', side: 'fr', name: 'Southern group: Poniatowski and Junot', at: 'mogilev', men: [26_000, 36_000], horses: [6_000, 8_000], posture: 'dispersed', wagons: 200, stock: { food: days(31_000, 3), fodder: days(7_000, 1), ammo: 6_000 } },

  // Russians: united at Smolensk under political pressure to stop retreating
  { id: 'ru-1st', side: 'ru', name: '1st Western Army (Barclay de Tolly)', at: 'smolensk-north', men: [70_000, 80_000], horses: [14_000, 18_000], posture: 'dispersed', wagons: 400, stock: { food: days(75_000, 6), fodder: days(16_000, 2), ammo: 15_000 } },
  { id: 'ru-2nd', side: 'ru', name: '2nd Western Army (Bagration)', at: 'smolensk', men: [38_000, 46_000], horses: [8_000, 10_000], posture: 'dispersed', wagons: 250, stock: { food: days(42_000, 6), fodder: days(9_000, 2), ammo: 8_000 } },
  { id: 'ru-cossacks', side: 'ru', name: "Platov's Cossacks", at: 'rudnia', men: [7_000, 10_000], horses: [9_000, 12_000], posture: 'dispersed', wagons: 30, stock: { food: days(8_500, 3), fodder: days(10_500, 1), ammo: 500 } },
  { id: 'ru-neverovsky', side: 'ru', name: "Neverovsky's division", at: 'krasnyi', men: [6_000, 8_000], horses: [1_000, 1_500], posture: 'dispersed', wagons: 40, stock: { food: days(7_000, 5), fodder: days(1_200, 2), ammo: 1_500 } },
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
  { id: 'cv-smolensk-1st', side: 'ru', home: 'smolensk', serves: 'ru-1st', wagons: 100 },
  { id: 'cv-smolensk-2nd', side: 'ru', home: 'smolensk', serves: 'ru-2nd', wagons: 80 },
  { id: 'cv-smolensk-neverovsky', side: 'ru', home: 'smolensk', serves: 'ru-neverovsky', wagons: 40 },
];

/** What the countryside around each place can still yield (G-012): uniform placeholders. */
const DISTRICTS: Record<string, District> = Object.fromEntries(PLACES.map((p) => [p.id, { food: 150_000, fodder: 150_000 }]));

export function vitebskDecision(): ScenarioDef {
  const { nodes, edges } = vitebskNetwork();
  return {
    id: 'vitebsk-decision',
    title: 'The Vitebsk Decision',
    startDate: '1812-08-05',
    turns: 10,
    nodes,
    edges,
    forces: FORCES.map((f) => ({ ...f, stock: { ...f.stock } })),
    depots: DEPOTS.map((d) => ({ ...d, stock: { ...d.stock } })),
    convoys: CONVOYS.map((c) => ({ ...c })),
    districts: Object.fromEntries(Object.entries(DISTRICTS).map(([k, v]) => [k, { ...v }])),
    // Places of Smolensk province, the "old Russian" soil whose loss raised pressure on Barclay (G-014).
    pressurePlaces: ['rudnia', 'porechye', 'krasnyi', 'smolensk', 'smolensk-north', 'valutino', 'dorogobuzh'],
  };
}

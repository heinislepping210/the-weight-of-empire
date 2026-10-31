import type { ScenarioDef } from '../../src/engine';

const NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** Synthetic map for engine tests. Not historical data. */
export function testGround(adjust: (s: ScenarioDef) => void = () => {}): ScenarioDef {
  const scenario: ScenarioDef = {
    id: 'test-ground',
    title: 'Engine test ground (synthetic)',
    startDate: '1812-08-05',
    turns: 5,
    nodes: NODES.map((id) => ({ id, name: `Node ${id}` })),
    edges: [
      { id: 'A-B', a: 'A', b: 'B', metres: 8_000, road: 'post', crossing: null },
      { id: 'B-C', a: 'B', b: 'C', metres: 20_000, road: 'secondary', crossing: null },
      { id: 'C-D', a: 'C', b: 'D', metres: 18_000, road: 'post', crossing: null },
      { id: 'B-E', a: 'B', b: 'E', metres: 15_000, road: 'track', crossing: null },
      { id: 'E-D', a: 'E', b: 'D', metres: 22_000, road: 'secondary', crossing: 'ford' },
      { id: 'D-F', a: 'D', b: 'F', metres: 25_000, road: 'post', crossing: null },
      { id: 'A-G', a: 'A', b: 'G', metres: 12_000, road: 'track', crossing: null },
    ],
    forces: [
      { id: 'fr-main', side: 'fr', name: 'Main body', at: 'B', men: 60_000, horses: 9_000, wagons: 120, stock: { food: 120_000, fodder: 18_000, ammo: 3_000 } },
      { id: 'fr-flank', side: 'fr', name: 'Flank corps', at: 'A', men: 20_000, horses: 3_000, wagons: 40, stock: { food: 60_000, fodder: 9_000, ammo: 1_000 } },
      { id: 'ru-main', side: 'ru', name: 'Russian main army', at: 'D', men: 55_000, horses: 9_000, wagons: 100, stock: { food: 165_000, fodder: 27_000, ammo: 3_000 } },
      { id: 'ru-post', side: 'ru', name: 'Cossack post', at: 'E', men: 2_000, horses: 400, wagons: 5, stock: { food: 6_000, fodder: 1_200, ammo: 100 } },
    ],
    depots: [
      { node: 'A', side: 'fr', stock: { food: 400_000, fodder: 100_000, ammo: 20_000 } },
      { node: 'F', side: 'ru', stock: { food: 400_000, fodder: 100_000, ammo: 20_000 } },
    ],
    convoys: [{ id: 'cv-fr-1', side: 'fr', home: 'A', serves: 'fr-main', wagons: 60 }],
    districts: Object.fromEntries(NODES.map((id) => [id, { food: 40_000, fodder: 15_000 }])),
  };
  adjust(scenario);
  return scenario;
}

export function forceInit(s: ScenarioDef, id: string) {
  const f = s.forces.find((x) => x.id === id);
  if (!f) throw new Error(`no force ${id} in fixture`);
  return f;
}

// What horses and men can carry (G-019). Shared by turn resolution and the staff planner, so the
// forecast and the outcome follow the same rule.

import type { Rules } from './rules';
import type { Force, Supplies } from './types';
import { emptySupplies } from './util';

const SHED_ORDER = ['fodder', 'food', 'ammo'] as const;

export function weightGrams(x: Supplies, rules: Rules): number {
  return x.food * rules.gramsPerUnit.food + x.fodder * rules.gramsPerUnit.fodder + x.ammo * rules.gramsPerUnit.ammo;
}

/** Only wagons with their draught horses move with a load. */
export function usableWagons(wagons: number, horses: number, rules: Rules): number {
  return Math.max(0, Math.min(wagons, Math.floor(horses / rules.draught.horsesPerWagon)));
}

/** What a force can carry on the march: its men's packs and its horse-drawn wagons. */
export function capacityGrams(f: Force, rules: Rules): number {
  return f.men * rules.carrying.manGrams + usableWagons(f.wagons, f.draught, rules) * rules.convoy.payloadGrams;
}

/** What fits within `capacity`: fodder is left behind first, then food, ammunition last. */
export function withinCapacity(stock: Supplies, capacity: number, rules: Rules): { kept: Supplies; dropped: Supplies } {
  const kept = { ...stock };
  const dropped = emptySupplies();
  let over = weightGrams(kept, rules) - capacity;
  for (const kind of SHED_ORDER) {
    if (over <= 0) break;
    const unit = rules.gramsPerUnit[kind];
    const n = Math.min(kept[kind], Math.ceil(over / unit));
    kept[kind] -= n;
    dropped[kind] += n;
    over -= n * unit;
  }
  return { kept, dropped };
}

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

/** The stock a group is issued up to, from a depot or a wagon train: all the food it can carry (D-040), fodder and ammunition by `depotIssue`. */
export function issueTarget(f: Force, supply: keyof Supplies, rules: Rules): number {
  const { depotIssue, consumption } = rules;
  if (supply === 'food') return Math.floor(capacityGrams(f, rules) / rules.gramsPerUnit.food);
  if (supply === 'fodder') return (f.horses + f.draught) * consumption.fodderPerHorse * depotIssue.fodderDays;
  return Math.floor((f.men * depotIssue.ammoPerThousandMen) / 1000);
}

/** Issue order: food first, then ammunition, then fodder. */
export const ISSUE_ORDER = ['food', 'ammo', 'fodder'] as const;

/**
 * What a group takes when supplies are on offer, from a depot or a wagon train (G-019, D-040): up to the stock
 * it is issued to, and only what it could still march with once it has them. Marching, a group leaves fodder
 * behind first, then food, ammunition last, so the fodder it already holds never stops it taking food.
 */
export function takenUp(f: Force, offered: Supplies, rules: Rules): Supplies {
  const held = { food: f.stock.food + f.incoming.food, fodder: f.stock.fodder + f.incoming.fodder, ammo: f.stock.ammo + f.incoming.ammo };
  const wanted = emptySupplies();
  for (const supply of ISSUE_ORDER) wanted[supply] = Math.min(offered[supply], Math.max(0, issueTarget(f, supply, rules) - held[supply]));
  const { kept } = withinCapacity({ food: held.food + wanted.food, fodder: held.fodder + wanted.fodder, ammo: held.ammo + wanted.ammo }, capacityGrams(f, rules), rules);
  const taken = emptySupplies();
  for (const supply of ISSUE_ORDER) taken[supply] = Math.max(0, Math.min(wanted[supply], kept[supply] - held[supply]));
  return taken;
}

// Intelligence (§2.8): each side sees enemy forces only within its own forces' detection range,
// with a seeded error in the strength estimate. Sightings persist, and their age shows how stale they are.

import { roadDistance } from './graph';
import { drawBetween } from './rng';
import type { Context } from './scenario';
import type { Force, GameState } from './types';
import { sortedValues } from './util';

export function detectionRange(f: Force, ctx: Context): number {
  const r = ctx.rules.intel;
  return Math.min(r.maxMetres, r.baseMetres + Math.floor((f.horses * r.metresPerThousandHorses) / 1000));
}

export function updateIntel(s: GameState, ctx: Context): void {
  const turn = s.resolution.turn;
  const err = ctx.rules.intel.estimateErrorPermille;
  for (const side of ['fr', 'ru'] as const) {
    const observers = sortedValues(s.forces).filter((f) => f.side === side && f.men > 0);
    for (const target of sortedValues(s.forces)) {
      if (target.side === side || target.men <= 0) continue;
      if (!observers.some((o) => roadDistance(ctx.graph, o.at, target.at) <= detectionRange(o, ctx))) continue;
      const factor = drawBetween(s.seed, ['intel', side, target.id, turn], 1000 - err, 1000 + err);
      // Estimates are reported to the nearest hundred.
      s.intel[side][target.id] = { at: target.at, men: Math.round((target.men * factor) / 100_000) * 100, turn };
    }
  }
}

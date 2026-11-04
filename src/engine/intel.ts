// Intelligence (§2.8): each side sees enemy forces only within its own forces' detection range,
// with a seeded error in the strength estimate. Sightings persist, and their age shows how stale they are.

import { roadDistance } from './graph';
import { drawBetween } from './rng';
import type { Context } from './scenario';
import type { Force, GameState, NodeId, Side } from './types';
import { sortedValues } from './util';

export function detectionRange(f: Force, ctx: Context): number {
  const r = ctx.rules.intel;
  return Math.min(r.maxMetres, r.baseMetres + Math.floor((f.horses * r.metresPerThousandHorses) / 1000));
}

/** Whether any of a side's forces has an enemy force within its detection range, by road. */
export function seenBy(s: GameState, ctx: Context, side: Side, target: Force): boolean {
  if (target.side === side || target.men <= 0) return false;
  return sortedValues(s.forces).some((o) => o.side === side && o.men > 0 && roadDistance(ctx.graph, o.at, target.at) <= detectionRange(o, ctx));
}

/** A side's estimate of an enemy force's men in a turn, to the nearest hundred, with that turn's seeded error. */
export function estimateOf(s: GameState, ctx: Context, side: Side, target: Force, turn: number): number {
  const err = ctx.rules.intel.estimateErrorPermille;
  const factor = drawBetween(s.seed, ['intel', side, target.id, turn], 1000 - err, 1000 + err);
  return Math.round((target.men * factor) / 100_000) * 100;
}

/** The places a side can see now: those within its forces' detection range by road, as for enemy forces. */
export function observedPlaces(s: GameState, ctx: Context, side: Side): NodeId[] {
  const observers = sortedValues(s.forces).filter((o) => o.side === side && o.men > 0);
  return [...ctx.graph.nodes.keys()].filter((node) => observers.some((o) => roadDistance(ctx.graph, o.at, node) <= detectionRange(o, ctx))).sort();
}

export function updateIntel(s: GameState, ctx: Context): void {
  const turn = s.resolution.turn;
  for (const side of ['fr', 'ru'] as const) {
    for (const target of sortedValues(s.forces)) {
      if (!seenBy(s, ctx, side, target)) continue;
      s.intel[side][target.id] = { at: target.at, men: estimateOf(s, ctx, side, target, turn), turn };
    }
  }
}

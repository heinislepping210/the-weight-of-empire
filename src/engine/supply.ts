// Supply lines (M2, G5): what each French wagon train can bring a day at its present distance, against what the
// group it serves eats. A forecast from the movement rules, on today's roads, for a group that stays where it is;
// a group on the march is harder to reach, and the train waits for it to halt (§2.6).

import { roadFactor } from './advance';
import { usableWagons } from './carriage';
import { edgeBetween, shortestPath } from './graph';
import type { Context } from './scenario';
import { exposedRoads } from './raids';
import type { Convoy, ConvoyId, EdgeId, ForceId, GameState, NodeId } from './types';
import { closedRoads, must, sortedValues } from './util';

export interface SupplyLine {
  convoy: ConvoyId;
  home: NodeId;
  /** Where it delivers: the place of the group it serves, or the depot it stocks. */
  to: NodeId;
  /** The road from its depot to there, both ends included. */
  path: NodeId[];
  serves: ForceId | null;
  feeds: NodeId | null;
  /** Wagons it can load: those with their draught horses (G-019). */
  wagons: number;
  /** Days a round trip takes: out and back, each leg in whole daylight sub-steps, as the trains move (§3.4a). */
  cycleDays: number;
  /** Rations of food in one load: what its wagons hold, or what is left at its depot if that is less. */
  load: number;
  /** Rations of food a day it can bring. */
  perDay: number;
  /** Rations of food a day the group it serves eats; null for a line train that stocks a depot. */
  need: number | null;
  /** The roads on its way the raiders could reach, where the French last saw them (G-028). */
  exposed: EdgeId[];
}

/** Where a train delivers, as in turn resolution (`deliveryOf`); null when it stands idle or has no one to supply. */
function targetOf(s: GameState, c: Convoy): NodeId | null {
  if (c.serves !== null) {
    const f = s.forces[c.serves];
    return f && f.men > 0 ? f.at : null;
  }
  if (c.feeds !== null && c.feeds !== c.home) return s.depots[c.feeds]?.side === c.side ? c.feeds : null;
  return null;
}

/** Every French wagon train at work, with what it can bring a day. */
export function supplyLines(s: GameState, ctx: Context): SupplyLine[] {
  const { convoy, gramsPerUnit, consumption } = ctx.rules;
  const feared = exposedRoads(s, ctx);
  const lines: SupplyLine[] = [];
  for (const c of sortedValues(s.convoys)) {
    if (c.side !== 'fr') continue;
    const to = targetOf(s, c);
    if (to === null) continue;
    const way = to === c.home ? [] : shortestPath(ctx.graph, c.home, to, new Set(), closedRoads(s, ctx, c.side));
    if (way === null) continue;
    const path = [c.home, ...way];
    // Each road converts the train's ideal distance at its own speed, and a leg ends at its place (`travel`).
    let ideal = 0;
    const exposed: EdgeId[] = [];
    for (let i = 1; i < path.length; i++) {
      const edge = must(edgeBetween(ctx.graph, path[i - 1] as NodeId, path[i] as NodeId), `road ${path[i - 1]}–${path[i]}`);
      ideal += Math.ceil((edge.metres * 1000) / roadFactor(s, ctx, edge));
      if (feared.has(edge.id)) exposed.push(edge.id);
    }
    // Out in this many sub-steps, delivering at the end of the last; back in as many, loading as it arrives; two a day.
    const cycleDays = Math.max(1, Math.ceil(ideal / convoy.metresPerSlot));
    const wagons = usableWagons(c.wagons, c.horses, ctx.rules);
    const holds = Math.floor((wagons * convoy.payloadGrams * convoy.loadPermille.food) / 1000 / gramsPerUnit.food);
    const depot = s.depots[c.home];
    const load = Math.min(holds, c.cargo.food + (depot && depot.side === c.side ? depot.stock.food : 0));
    const served = c.serves !== null ? s.forces[c.serves] : undefined;
    lines.push({
      convoy: c.id,
      home: c.home,
      to,
      path,
      serves: c.serves,
      feeds: c.serves === null ? c.feeds : null,
      wagons,
      cycleDays,
      load,
      perDay: Math.floor(load / cycleDays),
      need: served ? served.men * consumption.foodPerMan : null,
      exposed,
    });
  }
  return lines;
}

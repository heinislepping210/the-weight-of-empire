// Raids on the wagon trains (V4, G-028, D-057), off at `raids.permille` 0. Light cavalry rides out from where it
// stands, round the enemy's columns by roads free of its troops, and falls on trains on the roads no group covers: an
// army that marches off lays its roads open, a group left on them covers them. The raiders' own group stays at its post.

import { chance } from './rng';
import { pathMetres, shortestPath } from './graph';
import type { Context } from './scenario';
import type { EdgeId, GameState, LogEntry, NodeId, Side } from './types';
import { closedRoads, note, sortedValues } from './util';

const NO_ROADS: ReadonlySet<EdgeId> = new Set();

/** The roads raiders at `from` could reach, with how far off each is: none of `target`'s groups stands at either end. */
function roadsOpenFrom(s: GameState, ctx: Context, from: NodeId, target: Side): Map<EdgeId, number> {
  const held = new Set(sortedValues(s.forces).filter((f) => f.side === target && f.men > 0 && f.transit === null).map((f) => f.at));
  const shut = closedRoads(s, ctx, target === 'fr' ? 'ru' : 'fr');
  const distance = (node: NodeId) => {
    if (node === from) return 0;
    const way = shortestPath(ctx.graph, from, node, held, shut);
    return way ? pathMetres(ctx.graph, from, way) : Infinity;
  };
  const open = new Map<EdgeId, number>();
  for (const e of ctx.graph.edges.values()) {
    if (held.has(e.a) || held.has(e.b)) continue;
    const metres = Math.min(distance(e.a), distance(e.b));
    if (metres <= ctx.rules.raids.reachMetres) open.set(e.id, metres);
  }
  return open;
}

/** The roads the French have reason to fear: those open to the raiders where they last saw them (§2.8). */
export function exposedRoads(s: GameState, ctx: Context): ReadonlySet<EdgeId> {
  if (ctx.rules.raids.permille <= 0) return NO_ROADS;
  const roads = new Set<EdgeId>();
  for (const id of ctx.scenario.raiders ?? []) {
    const seen = s.intel.fr[id];
    if (seen && s.forces[id]?.side === 'ru') for (const edge of roadsOpenFrom(s, ctx, seen.at, 'fr').keys()) roads.add(edge);
  }
  return roads;
}

/** Each raider may fall on the nearest train it can reach, once a sub-step, burning part of its load (G-028). */
export function raidConvoys(s: GameState, ctx: Context, log: LogEntry[]): void {
  const { permille, cargoPermille, horsesPermille } = ctx.rules.raids;
  if (permille <= 0) return;
  const { turn, slot } = s.resolution;
  for (const id of ctx.scenario.raiders ?? []) {
    const raider = s.forces[id];
    if (!raider || raider.men <= 0 || raider.battle !== null) continue;
    const open = roadsOpenFrom(s, ctx, raider.transit ? raider.transit.to : raider.at, raider.side === 'fr' ? 'ru' : 'fr');
    const nearest = sortedValues(s.convoys)
      .filter((c) => c.side !== raider.side && c.transit !== null && open.has(c.transit.edge))
      .sort((a, b) => (open.get(a.transit?.edge ?? '') as number) - (open.get(b.transit?.edge ?? '') as number))[0];
    if (!nearest?.transit || !chance(s.dice, ['raid', turn, slot, id], permille)) continue;
    const burned = { food: 0, fodder: 0, ammo: 0 };
    for (const kind of ['food', 'fodder', 'ammo'] as const) {
      burned[kind] = Math.floor((nearest.cargo[kind] * cargoPermille) / 1000);
      nearest.cargo[kind] -= burned[kind];
      s.ledger.destroyed[kind] += burned[kind];
    }
    const horses = Math.floor((nearest.horses * horsesPermille) / 1000);
    nearest.horses -= horses;
    s.ledger.horsesLost += horses;
    note(s, log, 'raided', { convoy: nearest.id, by: id, node: nearest.at, to: nearest.transit.to, edge: nearest.transit.edge, ...burned, horses });
  }
}

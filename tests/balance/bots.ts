// Strategy bots for balancing (GAMEPLAY_BALANCING.md §7). Each plays like a player: through army
// directives and the staff planner, seeing only French intelligence, with battles left to the marshal.
// They are tuned once for all seeds, never per seed.

import { axesTo, leadGroup, ordersFrom, planDirective, planLogistics } from '../../src/engine';
import type { Axis, Context, Directive, GameState, GroupOrder, LogisticsOrders, LogisticsStance, NodeId } from '../../src/engine';
import { roadDistance, shortestPath } from '../../src/engine/graph';
import { randomPolicy, type Policy } from '../fixtures/driver';

// By default every bot brings its supply base forward, as a competent staff would (§2.6); the paired
// supply-stance probe plays the same bots keeping the depots instead.
const base: Directive = { objective: null, axis: null, tempo: 'steady', posture: 'concentrated', engagement: 'seek', holdBack: [], logistics: 'forward' };

/** The directive a bot chose last, so its supply orders follow the same objective. */
const chosen = new WeakMap<GameState, Directive>();

function orders(s: GameState, ctx: Context, d: Partial<Directive>): GroupOrder[] {
  const directive = { ...base, ...d };
  chosen.set(s, directive);
  return ordersFrom(planDirective(s, ctx, directive));
}

function supply(ctx: Context, stance: LogisticsStance) {
  return (s: GameState): LogisticsOrders | null => planLogistics(s, ctx, { ...(chosen.get(s) ?? base), logistics: stance }).orders;
}

function axisVia(s: GameState, ctx: Context, objective: NodeId, landmark: string): Axis | null {
  const lead = leadGroup(s, ctx, objective);
  if (!lead) return null;
  return axesTo(ctx, lead.at, objective).find((a) => a.label.includes(landmark)) ?? null;
}

const frenchHold = (s: GameState, node: NodeId) =>
  Object.values(s.forces).some((f) => f.side === 'fr' && f.men > 0 && f.transit === null && f.at === node && f.battle === null) &&
  !Object.values(s.forces).some((f) => f.side === 'ru' && f.men > 0 && f.transit === null && f.at === node);

const battleAt = (s: GameState, node: NodeId) => Object.values(s.battles).some((b) => b.node === node);

/** A large enemy force seen within the last turn within `km` of a place: what the French know, nothing more. */
const armySeenNear = (s: GameState, ctx: Context, node: NodeId, km: number, men: number) =>
  Object.values(s.intel.fr).some(
    (x) => s.resolution.turn - x.turn <= 1 && x.men >= men && (x.at === node || ctx.graph.neighbours.get(node)?.some((n) => n.node === x.at && n.edge.metres <= km * 1000)),
  );

const delegate = { round: () => 'delegate' as const, nightfall: () => 'delegate' as const };

/** Every bot plays like a player: battles left to the marshal, supply to the staff. */
const BASE_BOTS: Record<string, (ctx: Context) => Policy> = {
  /** The whole army up the Rudnia road to Smolensk's north bank, concentrated, seeking battle. */
  'concentrated-push': (ctx) => ({ orders: (s) => orders(s, ctx, { objective: 'smolensk-north' }), ...delegate }),

  /** Across the Dnieper at Rasasna to the Old Town, then on to Valutino to cut the Moscow road. */
  // The corridor is chosen once, as a player would choose it, and kept while the lead group changes.
  'southern-envelopment': (ctx) => {
    let corridor: Axis | null = null;
    return {
      orders: (s) => {
        if (frenchHold(s, 'smolensk') || frenchHold(s, 'smolensk-north')) return orders(s, ctx, { objective: 'valutino' });
        corridor ??= axisVia(s, ctx, 'smolensk', 'Rasasna');
        return orders(s, ctx, { objective: 'smolensk', axis: corridor });
      },
      ...delegate,
    };
  },

  /** Concentrate at Liozno where the vanguard stands as bait, receive the Russian strike, then push on. */
  'bait-and-converge': (ctx) => {
    let struck = false;
    return {
      orders: (s, turn) => {
        // The Cossack screen at Rudnia is not the strike: wait for a Russian army or a battle at Liozno.
        if (battleAt(s, 'liozno') || armySeenNear(s, ctx, 'liozno', 30, 30_000)) struck = true;
        if (turn <= 4 && !struck) return orders(s, ctx, { objective: 'liozno', engagement: 'accept' });
        return orders(s, ctx, { objective: 'smolensk-north' });
      },
      ...delegate,
    };
  },

  /** Concentrate forward, rest dispersed to feed for two turns, then advance. */
  methodical: (ctx) => ({
    orders: (s, turn) =>
      turn <= 2 ? orders(s, ctx, { objective: 'liozno', engagement: 'accept' }) : turn <= 4 ? orders(s, ctx, { posture: 'dispersed', engagement: 'accept' }) : orders(s, ctx, { objective: 'smolensk-north' }),
    ...delegate,
  }),

  /** Declare a halt on the first turn and hold, dispersed to feed. */
  'prudent-halt': (ctx) => ({ orders: (s) => orders(s, ctx, { posture: 'dispersed', engagement: 'accept' }), halt: () => true, ...delegate }),

  /** Forced marches straight at Smolensk. */
  rush: (ctx) => ({ orders: (s) => orders(s, ctx, { objective: 'smolensk-north', tempo: 'forced' }), ...delegate }),

  // Competent variants (review stage F): the same approaches, played as a careful player would.

  /** The concentrated push done patiently: gather the army around Rudnia first, then attack together. */
  'concentrated-push-staged': (ctx) => {
    let gathered = false;
    return {
      orders: (s, turn) => {
        // Three quarters of the army within 30 km of Rudnia, or four turns gone: then forward together.
        if (!gathered && (turn > 4 || shareNear(s, ctx, 'rudnia', 30) >= 750)) gathered = true;
        return gathered ? orders(s, ctx, { objective: 'smolensk-north' }) : orders(s, ctx, { objective: 'rudnia', engagement: 'accept' });
      },
      ...delegate,
    };
  },

  /**
   * The southern envelopment that keeps the trap shut (after the second review, D3): the same corridor to
   * the Old Town, but once Smolensk is taken or Valutino reached it commits to Valutino and holds it to the
   * end, standing to fight there, instead of turning back whenever Smolensk is no longer held.
   */
  'southern-envelopment-hold': (ctx) => {
    let corridor: Axis | null = null;
    let committed = false;
    return {
      orders: (s) => {
        if (frenchHold(s, 'smolensk') || frenchHold(s, 'smolensk-north') || frenchAt(s, 'valutino')) committed = true;
        if (committed) return orders(s, ctx, { objective: 'valutino', engagement: 'accept' });
        corridor ??= axisVia(s, ctx, 'smolensk', 'Rasasna');
        return orders(s, ctx, { objective: 'smolensk', axis: corridor });
      },
      ...delegate,
    };
  },

  /**
   * A concentrated strike at the Russian army itself (after the second review): gather the army around
   * Rudnia first, then march on the largest Russian army the scouts have seen in the last turn, wherever it
   * stands, seeking battle; Smolensk's north bank if none is in sight.
   */
  'concentrated-strike': (ctx) => {
    let gathered = false;
    return {
      orders: (s, turn) => {
        if (!gathered && (turn > 4 || shareNear(s, ctx, 'rudnia', 30) >= 750)) gathered = true;
        if (!gathered) return orders(s, ctx, { objective: 'rudnia', engagement: 'accept' });
        return orders(s, ctx, { objective: largestArmySeen(s, 30_000) ?? 'smolensk-north' });
      },
      ...delegate,
    };
  },

  /** A halt prepared first: outlying groups move to depots for two turns, then the halt is declared. */
  'supplied-halt': (ctx) => ({
    orders: (s, turn) => (turn >= 3 || s.halted ? orders(s, ctx, { posture: 'dispersed', engagement: 'accept' }) : toStations(s, ctx)),
    halt: (_s, turn) => turn >= 3,
    ...delegate,
  }),
};

/** French troops standing at a place, out of battle. */
const frenchAt = (s: GameState, node: NodeId) => Object.values(s.forces).some((f) => f.side === 'fr' && f.men > 0 && f.transit === null && f.at === node);

/** Where the largest Russian force seen in the last turn stands, if it has at least `men`: French intelligence only. */
function largestArmySeen(s: GameState, men: number): NodeId | null {
  const seen = Object.values(s.intel.fr).filter((x) => s.resolution.turn - x.turn <= 1 && x.men >= men);
  seen.sort((a, b) => b.men - a.men || (a.at < b.at ? -1 : 1));
  return seen[0]?.at ?? null;
}

/** Permille of the French army standing within `km` by road of a place. */
function shareNear(s: GameState, ctx: Context, node: NodeId, km: number): number {
  const french = Object.values(s.forces).filter((f) => f.side === 'fr' && f.men > 0);
  const total = french.reduce((n, f) => n + f.men, 0);
  const near = french.filter((f) => f.transit === null && roadDistance(ctx.graph, f.at, node) <= km * 1000).reduce((n, f) => n + f.men, 0);
  return Math.floor((near * 1000) / Math.max(1, total));
}

/**
 * Where the supplied halt puts each group: Eugène from Surazh and Davout from Dubrovna to the depots at
 * Vitebsk and Orsha; the Guard (Vitebsk), the vanguard (Liozno, which the staff makes a depot) and
 * Poniatowski (Mogilev) stay where they are.
 */
const STATIONS: Record<string, NodeId> = { 'fr-left': 'vitebsk', 'fr-right': 'orsha' };

function toStations(s: GameState, ctx: Context): GroupOrder[] {
  chosen.set(s, { ...base, posture: 'dispersed', engagement: 'accept' });
  return Object.values(s.forces)
    .filter((f) => f.side === 'fr' && f.men > 0 && f.battle === null)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((f) => {
      const target = STATIONS[f.id];
      const from = f.transit ? f.transit.to : f.at;
      if (!target || (from === target && !f.transit)) return { force: f.id, route: f.transit ? [f.transit.to] : [], pace: 'steady', posture: 'dispersed', engagement: 'accept' };
      const path = shortestPath(ctx.graph, from, target) ?? [];
      return { force: f.id, route: f.transit ? [f.transit.to, ...path] : path, pace: 'steady', engagement: 'accept' };
    });
}

/** The purposeful bots with a given supply stance; their group orders are the same either way. */
export function botsWithSupply(stance: LogisticsStance): Record<string, (ctx: Context) => Policy> {
  return Object.fromEntries(Object.entries(BASE_BOTS).map(([name, make]) => [name, (ctx: Context) => ({ ...make(ctx), logistics: supply(ctx, stance) })]));
}

export const BOTS: Record<string, (ctx: Context) => Policy> = {
  ...botsWithSupply('forward'),
  /** Random valid orders, random supply arrangements included, different in every game: the control that should rarely do well. */
  random: (ctx) => randomPolicy(ctx, 0x5eed, true),
};

/** The three approach families of §2.13; the others are controls. */
export const FAMILIES = ['concentrated-push', 'southern-envelopment', 'bait-and-converge'];

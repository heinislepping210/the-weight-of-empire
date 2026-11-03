// Strategy bots for balancing (GAMEPLAY_BALANCING.md §7). Each plays like a player: through army
// directives and the staff planner, seeing only French intelligence, with battles left to the marshal.
// They are tuned once for all seeds, never per seed.

import { axesTo, leadGroup, ordersFrom, planDirective, planLogistics } from '../../src/engine';
import type { Axis, Context, Directive, Force, ForceId, GameState, GroupOrder, LogisticsOrders, LogisticsStance, NodeId } from '../../src/engine';
import { neighboursOf, pathMetres, roadDistance, shortestPath } from '../../src/engine/graph';
import { randomPolicy, type Policy, type Run } from '../fixtures/driver';

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
  'southern-envelopment-hold': (ctx) => holdingEnvelopment(ctx, () => []),

  /**
   * The holding envelopment that keeps its wagon trains close (after the haul what-if): a group that has run
   * short of food halts for its wagon train when the train is loaded and within two days' haul behind it, and
   * marches on once fed, as a player would halt a corps for its wagons.
   */
  'southern-envelopment-wait-for-trains': (ctx) => holdingEnvelopment(ctx, (s) => waitingForTrains(s, ctx)),

  /**
   * The holding envelopment that leaves the Guard at the main depot (after the haul what-if): the Guard and
   * headquarters stay at Vitebsk, fed from its magazine, while the corps make the swing and hold Valutino.
   */
  'southern-envelopment-guard-at-base': (ctx) => holdingEnvelopment(ctx, (s) => (s.forces['fr-guard']?.at === 'vitebsk' ? ['fr-guard'] : [])),

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

  /**
   * A pinning attack (after the sector battles, D-043): close every road out of the place where a Russian army
   * stands, one corps on each, and strike with the corps to spare once every road is held, so that a beaten army
   * has nowhere to go (contract D). It goes for the largest army seen whose roads out can all be reached without
   * passing through it, else the largest seen, else Smolensk's north bank; corps go round the enemy, never through.
   * It re-plans every turn, nearest pairs first; kept as it was for comparison (third review).
   */
  'pinning-attack': (ctx) => {
    const trace: PinTrace = { planned: null, plans: 0, longest: 0, closed: null };
    return { orders: (s) => pinningOrders(s, ctx, trace), ...delegate, pinTrace: trace } as Policy;
  },

  /**
   * The pinning attack planned by search (third review): every road out gets a corps of its own, a corps is left to
   * strike, the plan closing soonest is chosen (`assignBlockers`) and kept while the army is still seen there; the
   * strikers go in once every road is held. Corps go round the enemy armies seen, never through them.
   */
  'pinning-attack-search': (ctx) => pinningPolicy(ctx, 'close-first'),

  /**
   * The same plan the other way round (third review): the strikers go in at once and stand, holding the army in
   * battle, while the blockers close its roads out behind it.
   */
  'pinning-fix-first': (ctx) => pinningPolicy(ctx, 'fix-first'),

  /** A halt prepared first: outlying groups move to depots for two turns, then the halt is declared. */
  'supplied-halt': (ctx) => ({
    orders: (s, turn) => (turn >= 3 || s.halted ? orders(s, ctx, { posture: 'dispersed', engagement: 'accept' }) : toStations(s, ctx)),
    halt: (_s, turn) => turn >= 3,
    ...delegate,
  }),
};

/**
 * The southern envelopment that holds Valutino, with the groups `heldBack` names staying where they are: the
 * corridor via Rasasna to the Old Town, then, once Smolensk is taken or Valutino reached, Valutino to the end,
 * standing there.
 */
function holdingEnvelopment(ctx: Context, heldBack: (s: GameState) => ForceId[]): Policy {
  let corridor: Axis | null = null;
  let committed = false;
  return {
    orders: (s) => {
      if (frenchHold(s, 'smolensk') || frenchHold(s, 'smolensk-north') || frenchAt(s, 'valutino')) committed = true;
      const holdBack = heldBack(s);
      // The block stands: its marshal does not give up the road while it can still fight (rules 0.17.2).
      if (committed) return orders(s, ctx, { objective: 'valutino', engagement: 'stand', holdBack });
      corridor ??= axisVia(s, ctx, 'smolensk', 'Rasasna');
      return orders(s, ctx, { objective: 'smolensk', axis: corridor, holdBack });
    },
    ...delegate,
  };
}

/** The road from `from` to `to` that does not pass through `around`, as the places after `from`; null if there is none. */
const routeAround = (ctx: Context, from: NodeId, to: NodeId, around: NodeId) => shortestPath(ctx.graph, from, to, new Set([around]));

/** Places one road from `node`: the ways out of it. */
const waysOut = (ctx: Context, node: NodeId) => neighboursOf(ctx.graph, node).map((n) => n.node).sort();

/**
 * The first pinning attack's orders for this turn: a corps on every road out, then the rest strike (French knowledge
 * only). `trace` records its stages for the report; it plays no part in the orders.
 */
function pinningOrders(s: GameState, ctx: Context, trace: PinTrace): GroupOrder[] {
  const french = Object.values(s.forces).filter((f) => f.side === 'fr' && f.men > 0).sort((a, b) => (a.id < b.id ? -1 : 1));
  const free = french.filter((f) => f.battle === null);
  const from = (f: Force) => (f.transit ? f.transit.to : f.at);
  const seen = Object.values(s.intel.fr).filter((x) => s.resolution.turn - x.turn <= 1 && x.men >= 30_000).sort((a, b) => b.men - a.men || (a.at < b.at ? -1 : 1));
  const closable = (node: NodeId) => waysOut(ctx, node).every((e) => free.some((f) => from(f) !== node && routeAround(ctx, from(f), e, node) !== null));
  const target = (seen.find((x) => closable(x.at)) ?? seen[0])?.at ?? 'smolensk-north';
  chosen.set(s, { ...base, objective: target });

  // The nearest corps to each road out, closest pairs first; a corps on its way finishes the road it is on.
  const exits = waysOut(ctx, target);
  const pairs = free
    .filter((f) => from(f) !== target)
    .flatMap((f) => exits.map((e) => ({ f, e, path: routeAround(ctx, from(f), e, target) })))
    .filter((p): p is { f: Force; e: NodeId; path: NodeId[] } => p.path !== null)
    .map((p) => ({ ...p, metres: pathMetres(ctx.graph, from(p.f), p.path) }))
    .sort((a, b) => a.metres - b.metres || (a.f.id < b.f.id ? -1 : a.f.id > b.f.id ? 1 : a.e < b.e ? -1 : 1));
  const holds = new Map<ForceId, NodeId>();
  for (const p of pairs) if (!holds.has(p.f.id) && ![...holds.values()].includes(p.e)) holds.set(p.f.id, p.e);
  // The corps to spare wait on their nearest road out until every road is held.
  const waits = new Map<ForceId, NodeId>();
  for (const p of pairs) if (!holds.has(p.f.id) && !waits.has(p.f.id)) waits.set(p.f.id, p.e);
  const standing = (f: Force, at: NodeId) => f.transit === null && f.at === at;
  const closed = exits.every((e) => free.some((f) => holds.get(f.id) === e && standing(f, e)));
  // Its plan is complete when every road out has a corps and one is left over, against an army seen. It re-plans
  // every turn, so it adopts no plan to count or keep.
  const strikers = free.filter((f) => !holds.has(f.id)).map((f) => f.id);
  if (seen.length > 0 && holds.size === exits.length && strikers.length > 0) trace.planned ??= s.resolution.turn;
  if (closed && trace.closed === null) trace.closed = { state: s, target, strikers };

  return french.map((f): GroupOrder => {
    if (f.battle !== null) return { force: f.id };
    const head = (path: NodeId[]) => (f.transit ? [f.transit.to, ...path] : path);
    const station = holds.get(f.id) ?? waits.get(f.id);
    const striking = !holds.has(f.id) && (station === undefined || (closed && standing(f, station)));
    if (striking) {
      const path = from(f) === target ? [] : (shortestPath(ctx.graph, from(f), target) ?? []);
      return { force: f.id, route: head(path), pace: 'steady', engagement: 'seek' };
    }
    const path = routeAround(ctx, from(f), station as NodeId, target) ?? [];
    // Holding a road out, a corps accepts battle but does not stand: alone against an army it would be destroyed
    // (standing was tried and did worse, Repulse 64% against 25% on 200 seeds).
    return { force: f.id, route: head(path), pace: 'steady', posture: 'concentrated', engagement: 'accept' };
  });
}

/** A steady day's march (L-001): the pinning attack counts its blockers' marches in whole days. */
const DAY_METRES = 22_000;

/** One way of closing a place: the corps holding each road out, and the corps left to strike. */
export interface Blocking {
  holds: Map<ForceId, NodeId>;
  strikers: ForceId[];
  /** Every road out has a corps of its own, and at least one corps is left to strike. */
  complete: boolean;
}

/**
 * The pinning attack's assignment, by search rather than nearest pairs first (third review): every way of giving
 * the roads out distinct corps while leaving at least one corps to strike. The plan holding the most roads wins,
 * then the one whose last blocker is in place soonest, in whole days' march, then the one with the strongest
 * strike, then the one with the least marching in all, then by name. `metres` is a corps' march to a road out, or
 * null if it cannot get there.
 */
export function assignBlockers(corps: readonly { id: ForceId; men: number }[], exits: readonly NodeId[], metres: (f: ForceId, e: NodeId) => number | null): Blocking {
  const named = [...corps].sort((a, b) => (a.id < b.id ? -1 : 1));
  const roads = [...exits].sort();
  let best: { holds: [ForceId, NodeId][]; key: number[] } | null = null;
  const better = (p: number[], q: number[]) => {
    for (let k = 0; k < p.length; k++) if (p[k] !== q[k]) return p[k]! < q[k]!;
    return false;
  };
  const chosen: [ForceId, NodeId, number][] = [];
  const search = (k: number) => {
    if (k === roads.length) {
      const strike = named.filter((c) => !chosen.some(([f]) => f === c.id)).reduce((n, c) => n + c.men, 0);
      if (named.length > 0 && chosen.length === named.length) return;
      const key = [-chosen.length, Math.max(0, ...chosen.map(([, , m]) => Math.ceil(m / DAY_METRES))), -strike, chosen.reduce((n, [, , m]) => n + m, 0)];
      if (best === null || better(key, best.key)) best = { holds: chosen.map(([f, e]) => [f, e]), key };
      return;
    }
    const road = roads[k] as NodeId;
    for (const c of named) {
      if (chosen.some(([f]) => f === c.id)) continue;
      const m = metres(c.id, road);
      if (m === null) continue;
      chosen.push([c.id, road, m]);
      search(k + 1);
      chosen.pop();
    }
    search(k + 1); // or leave this road unheld
  };
  search(0);
  const holds = new Map<ForceId, NodeId>((best as { holds: [ForceId, NodeId][] } | null)?.holds ?? []);
  return { holds, strikers: named.filter((c) => !holds.has(c.id)).map((c) => c.id), complete: holds.size === roads.length && holds.size < named.length };
}

/** What the pinning attack reached in one game (third review): for the report only, never for its decisions. */
export interface PinTrace {
  /** The first turn on which it had a complete plan against an army it had seen. */
  planned: number | null;
  /** How many complete plans it adopted, and the most turns it kept one. */
  plans: number;
  longest: number;
  /** The first moment every road out was held at once: the state at those orders, the place and the strikers. */
  closed: { state: GameState; target: NodeId; strikers: ForceId[] } | null;
}

/** The pinning attack's record, if a policy is one. */
export const pinTraceOf = (p: Policy): PinTrace | null => (p as Policy & { pinTrace?: PinTrace }).pinTrace ?? null;

/**
 * The stages of a pinning attack, each counted only if the one before was reached (third review): a complete
 * plan; every road out held at once; a Russian main army really at the place then; a striker in a battle there,
 * going on then or begun later; the Russians leaving that battle (withdrawn, routed or trapped); and their road
 * out blocked then.
 */
export const PIN_STAGES = ['planned', 'closed', 'armyThere', 'strikerArrived', 'russiansLeft', 'exitBlocked'] as const;

export function pinStages(run: Run, trace: PinTrace): Record<(typeof PIN_STAGES)[number], boolean> {
  const c = trace.closed;
  const there = c !== null && c.state.mainArmies.some((id) => c.state.forces[id]?.transit === null && c.state.forces[id]?.at === c.target && (c.state.forces[id]?.men ?? 0) > 0);
  const going = (id: string) => c !== null && c.state.battles[id] !== undefined && c.state.battles[id]!.phase !== 'over';
  const battles = c === null ? [] : Object.values(run.final.battles).filter((b) => b.node === c.target && (going(b.id) || b.startsAt.turn >= c.state.resolution.turn) && b.sides.fr.some((id) => c.strikers.includes(id)));
  const left = battles.filter((b) => b.field.result.ru !== null);
  const exits = run.logs.flat().filter((e) => e.kind === 'fieldResult' && e.detail.side === 'ru' && left.some((b) => b.id === e.detail.battle));
  const reached = [trace.planned !== null, c !== null, there, battles.length > 0, left.length > 0, exits.some((e) => e.detail.exit === 'blocked')];
  return Object.fromEntries(PIN_STAGES.map((stage, k) => [stage, reached.slice(0, k + 1).every(Boolean)])) as Record<(typeof PIN_STAGES)[number], boolean>;
}

/**
 * The pinning attack (French knowledge only): a complete plan is kept, roads, blockers and strikers, while the army
 * it closes in is still seen at its place. Closing first, the strikers wait on their nearest road out until every
 * road is held at once, then go in, and keep going in. Fixing first, they go in at once and stand, to hold the
 * army in battle while the blockers close the roads behind it. Without a complete plan it re-plans every turn.
 */
function pinningPolicy(ctx: Context, order: 'close-first' | 'fix-first'): Policy {
  const trace: PinTrace = { planned: null, plans: 0, longest: 0, closed: null };
  let plan: (Blocking & { target: NodeId; strike: boolean; since: number }) | null = null;
  const from = (f: Force) => (f.transit ? f.transit.to : f.at);

  const orders = (s: GameState): GroupOrder[] => {
    const turn = s.resolution.turn;
    const french = Object.values(s.forces).filter((f) => f.side === 'fr' && f.men > 0).sort((a, b) => (a.id < b.id ? -1 : 1));
    const sightings = Object.values(s.intel.fr).filter((x) => x.men >= 30_000);
    const seen = sightings.filter((x) => turn - x.turn <= 1).sort((a, b) => b.men - a.men || (a.at < b.at ? -1 : 1));
    // Routes go round the place closed in and round every other army seen in the last turn.
    const armies = new Set(seen.map((x) => x.at));
    const route = (f: Force, to: NodeId, around: NodeId) => (from(f) === to ? [] : shortestPath(ctx.graph, from(f), to, new Set([...armies, around].filter((n) => n !== to))));
    const planFor = (target: NodeId) => {
      const corps = french.filter((f) => f.battle === null && from(f) !== target);
      const metres = (id: ForceId, e: NodeId) => {
        const f = s.forces[id] as Force;
        const path = route(f, e, target);
        return path === null ? null : pathMetres(ctx.graph, from(f), path);
      };
      return { ...assignBlockers(corps, waysOut(ctx, target), metres), target, strike: false, since: turn };
    };

    // Kept while the army is still seen there (in the last two turns) and no corps in the plan has been destroyed.
    if (plan && !(sightings.some((x) => x.at === plan!.target && turn - x.turn <= 2) && [...plan.holds.keys(), ...plan.strikers].every((id) => (s.forces[id]?.men ?? 0) > 0))) plan = null;
    if (!plan?.complete) {
      const candidates = seen.map((x) => planFor(x.at));
      // Only a plan against an army seen counts; with none in sight the army makes for Smolensk's north bank.
      plan = candidates.find((p) => p.complete) ?? candidates[0] ?? { ...planFor('smolensk-north'), complete: false };
      if (plan.complete) {
        trace.planned ??= turn;
        trace.plans++;
        if (order === 'fix-first') plan.strike = true;
      }
    }
    if (plan.complete) trace.longest = Math.max(trace.longest, turn - plan.since + 1);
    const target = plan.target;
    chosen.set(s, { ...base, objective: target });

    const standing = (id: ForceId, at: NodeId) => s.forces[id]?.transit === null && s.forces[id]?.at === at;
    if (plan.complete && trace.closed === null && [...plan.holds].every(([id, e]) => standing(id, e))) trace.closed = { state: s, target, strikers: [...plan.strikers] };
    if (plan.complete && !plan.strike && [...plan.holds].every(([id, e]) => standing(id, e))) plan.strike = true;
    // Strikers wait on the nearest road out they can reach around the place.
    const staging = (f: Force) => {
      let near: { e: NodeId; metres: number } | null = null;
      for (const e of waysOut(ctx, target)) {
        const path = route(f, e, target);
        const metres = path === null ? Infinity : pathMetres(ctx.graph, from(f), path);
        if (Number.isFinite(metres) && (near === null || metres < near.metres)) near = { e, metres };
      }
      return near?.e ?? from(f);
    };

    return french.map((f): GroupOrder => {
      if (f.battle !== null) return { force: f.id };
      const head = (path: NodeId[]) => (f.transit ? [f.transit.to, ...path] : path);
      const holding = plan!.holds.get(f.id);
      if (holding === undefined && plan!.strike) return { force: f.id, route: head(shortestPath(ctx.graph, from(f), target) ?? []), pace: 'steady', engagement: order === 'fix-first' ? 'stand' : 'seek' };
      const station = holding ?? staging(f);
      // Holding a road out, a corps accepts battle but does not stand: alone against an army it would be destroyed
      // (standing was tried and did worse, Repulse 64% against 25% on 200 seeds).
      return { force: f.id, route: head(route(f, station, target) ?? []), pace: 'steady', posture: 'concentrated', engagement: 'accept' };
    });
  };
  return { orders, ...delegate, pinTrace: trace } as Policy;
}

/** French troops standing at a place, out of battle. */
const frenchAt = (s: GameState, node: NodeId) => Object.values(s.forces).some((f) => f.side === 'fr' && f.men > 0 && f.transit === null && f.at === node);

/** Where the largest Russian force seen in the last turn stands, if it has at least `men`: French intelligence only. */
function largestArmySeen(s: GameState, men: number): NodeId | null {
  const seen = Object.values(s.intel.fr).filter((x) => s.resolution.turn - x.turn <= 1 && x.men >= men);
  seen.sort((a, b) => b.men - a.men || (a.at < b.at ? -1 : 1));
  return seen[0]?.at ?? null;
}

/** How far behind a group its loaded wagon train may be for the group to halt for it: two days' haul on a post road. */
const TRAIN_WAIT_METRES = 36_000;

/**
 * Groups out of battle with less than a day's food whose own wagon train is on its way to them, loaded with
 * at least a day's food, and no farther than TRAIN_WAIT_METRES by road: French knowledge only.
 */
function waitingForTrains(s: GameState, ctx: Context): ForceId[] {
  const waiting: ForceId[] = [];
  for (const f of Object.values(s.forces)) {
    if (f.side !== 'fr' || f.men <= 0 || f.battle !== null || f.stock.food >= f.men) continue;
    const train = Object.values(s.convoys).find((c) => c.serves === f.id && c.leg === 'outbound' && c.cargo.food >= f.men);
    if (!train) continue;
    const behind = roadDistance(ctx.graph, train.transit ? train.transit.to : train.at, f.transit ? f.transit.to : f.at);
    if (behind <= TRAIN_WAIT_METRES) waiting.push(f.id);
  }
  return waiting.sort();
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

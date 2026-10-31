// Army directives and the staff planner (§2.4b). The staff turns one directive into orders for every
// French group, each with a forecast and its reasons, using only what the French know. Planning never
// changes the state: the player reviews the plan, may override any order, and only then commits.

import { edgeBetween, pathMetres, roadDistance, shortestPath, type EdgeDef } from './graph';
import type { Context } from './scenario';
import { calendar, slotIndex, SLOTS_PER_TURN } from './time';
import type { Engagement, Force, ForceId, GameState, GroupOrder, NodeId, Pace, Posture, Slot, SlotRef } from './types';
import { fatiguePermille, sortedValues } from './util';

export interface Axis {
  id: string;
  label: string;
  /** Starting place, then the places along the axis, ending at the objective. */
  places: NodeId[];
  metres: number;
}

export interface Directive {
  /** Where the army goes; null holds the current line. */
  objective: NodeId | null;
  /** One of `axesTo(...)`; null lets the staff take the shortest roads. */
  axis: string | null;
  tempo: Pace;
  /** For groups that halt. Groups on the march are always concentrated. */
  posture: Posture;
  engagement: Engagement;
  /** Groups that stay where they are whatever the objective. */
  holdBack: ForceId[];
}

export interface PlannedOrder {
  force: ForceId;
  name: string;
  order: GroupOrder;
  arrival: { dry: SlotRef; mud: SlotRef } | null;
  foodDaysOnArrival: number | null;
  reasons: string[];
}

const placeName = (ctx: Context, id: NodeId) => ctx.graph.nodes.get(id)?.name ?? id;

/** The French group nearest to the objective: the axes are traced from there. */
export function leadGroup(s: GameState, ctx: Context, objective: NodeId): Force | null {
  let best: Force | null = null;
  let bestDistance = Infinity;
  for (const f of sortedValues(s.forces)) {
    if (f.side !== 'fr' || f.men <= 0) continue;
    const distance = roadDistance(ctx.graph, f.at, objective);
    if (distance < bestDistance) {
      best = f;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Up to `max` genuinely different routes from `from` to `objective`: the shortest road, then the
 * shortest roads that avoid one or two of its places, keeping only those that share less than half
 * their places with a route already chosen.
 */
export function axesTo(ctx: Context, from: NodeId, objective: NodeId, max = 3): Axis[] {
  const found = new Map<string, NodeId[]>();
  const queue: NodeId[][] = [[]];
  for (let explored = 0; queue.length > 0 && explored < 40; explored++) {
    const avoid = queue.shift() as NodeId[];
    const path = shortestPath(ctx.graph, from, objective, new Set(avoid));
    if (!path) continue;
    found.set(path.join('>'), path);
    if (avoid.length < 2) for (const n of path.slice(0, -1)) queue.push([...avoid, n]);
  }
  const byLength = [...found.values()].sort((a, b) => pathMetres(ctx.graph, from, a) - pathMetres(ctx.graph, from, b) || (a.join() < b.join() ? -1 : 1));
  const chosen: NodeId[][] = [];
  for (const path of byLength) {
    const inner = new Set(path.slice(0, -1));
    const distinct = chosen.every((c) => {
      const other = new Set(c.slice(0, -1));
      const shared = [...inner].filter((n) => other.has(n)).length;
      const union = new Set([...inner, ...other]).size;
      return union === 0 || shared * 2 < union;
    });
    if (distinct) chosen.push(path);
    if (chosen.length === max) break;
  }
  return chosen.map((path) => {
    const others = new Set(chosen.filter((c) => c !== path).flatMap((c) => c.slice(0, -1)));
    const unique = path.slice(0, -1).filter((n) => !others.has(n));
    const mid = Math.max(0, Math.floor((unique.length - 1) / 2));
    const landmarks = unique.length === 0 ? [] : unique.slice(mid, mid + 2);
    const label = landmarks.length === 0 ? 'Direct road' : `Via ${landmarks.map((n) => placeName(ctx, n)).join(' and ')}`;
    return { id: `via:${landmarks.join('+') || 'direct'}`, label, places: [from, ...path], metres: pathMetres(ctx.graph, from, path) };
  });
}

/**
 * Join the axis before the objective, where the total road is shortest, then follow it. A way of
 * joining that passes through the objective itself would not be following the axis, so it is skipped.
 */
function routeAlong(ctx: Context, start: NodeId, axis: Axis | null, objective: NodeId): NodeId[] {
  const direct = shortestPath(ctx.graph, start, objective) ?? [];
  if (!axis) return direct;
  let best: NodeId[] | null = null;
  let bestMetres = Infinity;
  axis.places.slice(0, -1).forEach((join, i) => {
    const toJoin = shortestPath(ctx.graph, start, join);
    if (toJoin === null || toJoin.includes(objective)) return;
    const route = [...toJoin, ...axis.places.slice(i + 1)];
    const metres = pathMetres(ctx.graph, start, route);
    if (metres < bestMetres) {
      best = route;
      bestMetres = metres;
    }
  });
  return best ?? direct;
}

function slotAfter(from: SlotRef, slots: number): SlotRef {
  const index = slotIndex(from) + Math.max(0, slots - 1);
  return { turn: Math.floor(index / SLOTS_PER_TURN) + 1, slot: (index % SLOTS_PER_TURN) as Slot };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "9 Aug morning": for forecasts and reasons. */
export function when(ctx: Context, ref: SlotRef): string {
  const { date, hour } = calendar(ctx.scenario.startDate, ref);
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${hour < 12 ? 'morning' : 'afternoon'}`;
}

/** Daylight sub-steps needed to cover `route` (gathering included), with roads as they are now or in wet weather. */
function slotsToCover(s: GameState, ctx: Context, f: Force, route: NodeId[], pace: Pace, wet: boolean): number {
  const r = ctx.rules.march;
  const factorOf = (edge: EdgeDef) => {
    let factor: number = r.roadPermille[edge.road];
    if (s.roads[edge.id] === 'mud') factor = Math.floor((factor * r.mudPermille) / 1000);
    else if (wet) factor = Math.floor((factor * (1000 + r.mudPermille)) / 2000);
    if (edge.crossing === 'ford' || edge.crossing === 'pontoon') factor = Math.floor((factor * r.crossingPermille) / 1000);
    return Math.max(1, factor);
  };
  const legs: { metres: number; factor: number }[] = [];
  let at = f.at;
  if (f.transit) {
    const edge = ctx.graph.edges.get(f.transit.edge);
    if (edge) legs.push({ metres: edge.metres - f.transit.metres, factor: factorOf(edge) });
    at = f.transit.to;
  }
  for (const next of route.slice(f.transit ? 1 : 0)) {
    const edge = edgeBetween(ctx.graph, at, next);
    if (!edge) break;
    legs.push({ metres: edge.metres, factor: factorOf(edge) });
    at = next;
  }

  let slots = f.gathering > 0 ? f.gathering : f.posture === 'dispersed' ? ctx.rules.posture.gatherSlots : 0;
  let fatigue = f.fatigue;
  let leg = 0;
  let left = legs[0]?.metres ?? 0;
  while (leg < legs.length) {
    if (slots > 200) return Infinity;
    let budget = Math.floor((r.metresPerSlot[pace] * fatiguePermille(fatigue, ctx.rules)) / 1000);
    if (budget <= 0) return Infinity;
    while (budget > 0 && leg < legs.length) {
      const factor = (legs[leg] as { factor: number }).factor;
      const reach = Math.floor((budget * factor) / 1000);
      if (reach >= left) {
        budget -= Math.ceil((left * 1000) / factor);
        leg++;
        left = legs[leg]?.metres ?? 0;
      } else {
        left -= reach;
        budget = 0;
      }
    }
    slots++;
    fatigue = Math.min(1000, fatigue + (pace === 'forced' ? ctx.rules.fatigue.marchForced : ctx.rules.fatigue.marchSteady));
    if (slots % 2 === 0) fatigue = Math.max(0, fatigue - ctx.rules.fatigue.nightAfterMarch);
  }
  return slots;
}

function engagementReason(e: Engagement): string {
  return e === 'seek' ? 'Will seek battle.' : e === 'avoid' ? 'Avoids battle where it can withdraw.' : 'Accepts battle if attacked.';
}

/** Known enemies within 30 km of the route, from the French picture only. */
function knownThreats(s: GameState, ctx: Context, route: NodeId[], start: NodeId): string[] {
  const turn = s.resolution.turn;
  const places = [start, ...route];
  return Object.keys(s.intel.fr)
    .sort()
    .flatMap((id) => {
      const x = s.intel.fr[id];
      if (!x || turn - x.turn > 2) return [];
      if (!places.some((p) => roadDistance(ctx.graph, p, x.at) <= 30_000)) return [];
      const name = s.forces[id]?.name ?? id;
      const age = turn - x.turn === 0 ? 'this turn' : turn - x.turn === 1 ? 'last turn' : `${turn - x.turn} turns ago`;
      return [`Known enemy: ${name} reported at ${placeName(ctx, x.at)}, about ${x.men.toLocaleString('en-GB')} men (${age}).`];
    });
}

export function planDirective(s: GameState, ctx: Context, d: Directive): PlannedOrder[] {
  const lead = d.objective ? leadGroup(s, ctx, d.objective) : null;
  const axis = d.objective && d.axis && lead ? (axesTo(ctx, lead.at, d.objective).find((a) => a.id === d.axis) ?? null) : null;
  const now: SlotRef = { turn: s.resolution.turn, slot: 0 };
  const lastSlot = slotIndex({ turn: ctx.scenario.turns, slot: 3 });
  const plans: PlannedOrder[] = [];

  for (const f of sortedValues(s.forces)) {
    if (f.side !== 'fr' || f.men <= 0) continue;
    const here = placeName(ctx, f.at);
    if (f.battle !== null) {
      plans.push({ force: f.id, name: f.name, order: { force: f.id }, arrival: null, foodDaysOnArrival: null, reasons: [`Engaged in battle at ${here}: no new movement until it ends.`] });
      continue;
    }
    const start = f.transit ? f.transit.to : f.at;
    const holding = d.objective === null || d.tempo === 'rest' || d.holdBack.includes(f.id) || (start === d.objective && !f.transit);
    if (holding) {
      const reasons = [
        d.posture === 'dispersed'
          ? `Holds at ${here}, dispersed to feed: forages its own and the neighbouring districts, but needs about a day to gather.`
          : `Holds at ${here}, concentrated: ready to march or fight at once, but forages only its own district.`,
        engagementReason(d.engagement),
      ];
      if (d.holdBack.includes(f.id) && d.objective) reasons.unshift('Held back by your order.');
      plans.push({
        force: f.id,
        name: f.name,
        order: { force: f.id, route: f.transit ? [f.transit.to] : [], pace: d.tempo === 'rest' ? 'rest' : 'steady', posture: d.posture, engagement: d.engagement },
        arrival: null,
        foodDaysOnArrival: Math.floor(f.stock.food / Math.max(1, f.men)),
        reasons: [...reasons, ...knownThreats(s, ctx, [], start)],
      });
      continue;
    }

    const objective = d.objective as NodeId;
    const path = routeAlong(ctx, start, axis, objective);
    const route = f.transit ? [f.transit.to, ...path] : path;
    const metres = pathMetres(ctx.graph, start, path) + (f.transit ? (ctx.graph.edges.get(f.transit.edge)?.metres ?? 0) - f.transit.metres : 0);
    const dry = slotsToCover(s, ctx, f, route, d.tempo, false);
    const mud = slotsToCover(s, ctx, f, route, d.tempo, true);
    const days = Math.ceil(dry / 2);
    const foraged = Math.floor((f.men * ctx.rules.forage.food.march) / 1000) * dry;
    const foodDays = Math.max(0, Math.floor((f.stock.food + foraged - f.men * days) / Math.max(1, f.men)));
    const crossings = path.flatMap((n, i) => {
      const from = i === 0 ? start : (path[i - 1] as NodeId);
      const e = edgeBetween(ctx.graph, from, n);
      return e && (e.crossing === 'ford' || e.crossing === 'pontoon') ? [`${placeName(ctx, from)} and ${placeName(ctx, n)}`] : [];
    });

    const reasons = [`Route: ${[start, ...path].map((n) => placeName(ctx, n)).join(' → ')}, ${Math.round(metres / 1000)} km.`];
    if (axis && path.length > 0 && !axis.places.includes(start)) {
      const join = path.find((n) => axis.places.includes(n));
      if (join && join !== objective) reasons.push(`Joins the route ${axis.label.replace(/^Via /, 'via ')} at ${placeName(ctx, join)}.`);
      else reasons.push('Converges on the objective by its own road.');
    }
    if (crossings.length > 0) reasons.push(`Crosses a river between ${crossings.join(', ')}: slower going.`);
    if (f.posture === 'dispersed' || f.gathering > 0) reasons.push('Gathers first from its cantonments: about a day before it can march.');
    if (d.tempo === 'forced') reasons.push('Forced march: faster, but tires men and horses and leaves stragglers.');
    reasons.push(
      Number.isFinite(dry)
        ? `Arrives ${when(ctx, slotAfter(now, dry))}${mud !== dry && Number.isFinite(mud) ? ` (dry roads) to ${when(ctx, slotAfter(now, mud))} (wet weather)` : ''}${slotIndex(slotAfter(now, dry)) > lastSlot ? ', after the campaign ends' : ''}.`
        : 'Too exhausted to reach the objective without rest.',
    );
    reasons.push(`Food on arrival: about ${foodDays} day${foodDays === 1 ? '' : 's'} from what it carries, before deliveries from its wagon train; foraging on the march gathers little.`);
    reasons.push(engagementReason(d.engagement));
    reasons.push(...knownThreats(s, ctx, path, start));

    plans.push({
      force: f.id,
      name: f.name,
      order: { force: f.id, route, pace: d.tempo, posture: 'concentrated', engagement: d.engagement },
      arrival: Number.isFinite(dry) ? { dry: slotAfter(now, dry), mud: slotAfter(now, Number.isFinite(mud) ? mud : dry) } : null,
      foodDaysOnArrival: foodDays,
      reasons,
    });
  }
  return plans;
}

/** The orders to commit: the staff's plan with any of the player's own orders in place of the staff's. */
export function ordersFrom(plan: readonly PlannedOrder[], overrides: readonly GroupOrder[] = []): GroupOrder[] {
  return plan.map((p) => overrides.find((o) => o.force === p.force) ?? p.order);
}

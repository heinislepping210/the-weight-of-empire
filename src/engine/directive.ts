// Army directives and the staff planner (§2.4b). The staff turns one directive into orders for every
// French group, each with a forecast and its reasons, using only what the French know. Planning never
// changes the state: the player reviews the plan, may override any order, and only then commits.

import { HOURS_PER_SLOT, hourlyShare, marchBudget, marchHour } from './advance';
import { capacityGrams, weightGrams, withinCapacity } from './carriage';
import { edgeBetween, pathMetres, roadDistance, shortestPath } from './graph';
import type { Context } from './scenario';
import { calendar, slotIndex, SLOTS_PER_TURN } from './time';
import type { ConvoyOrder, Crossing, Engagement, Force, ForceId, GameState, GroupOrder, LogisticsOrders, NodeId, Pace, Posture, Slot, SlotRef } from './types';
import { enemyPresent, sortedValues } from './util';

export interface Axis {
  id: string;
  label: string;
  /** Starting place, then the places along the axis, ending at the objective. */
  places: NodeId[];
  /** The places that name it, in the order it passes them ("Via Orsha and Dubrovna"); none for a direct road. */
  landmarks: NodeId[];
  metres: number;
}

export interface Directive {
  /** Where the army goes; null holds the current line. */
  objective: NodeId | null;
  /**
   * The chosen corridor, one of `axesTo(...)` when it was chosen; null lets the staff take the shortest
   * roads. It is kept whole, so it still guides the groups after another group becomes the lead.
   */
  axis: Axis | null;
  tempo: Pace;
  /** For groups that halt. Groups on the march are always concentrated. */
  posture: Posture;
  engagement: Engagement;
  /** Groups that stay where they are whatever the objective. */
  holdBack: ForceId[];
  /** Keep the depots and wagon trains as they are, or bring the supply base forward behind the army (§2.6). */
  logistics: LogisticsStance;
  /** The player's own pace or battle stance for a group, planned and forecast like the staff's. */
  overrides?: Record<ForceId, GroupOverride>;
}

export interface GroupOverride {
  pace?: Pace;
  engagement?: Engagement;
  /** Follow the chosen route, or take its own road to the objective (§2.4b). */
  road?: RoadChoice;
}

export type RoadChoice = 'route' | 'own';

/**
 * Staff default (D-034): a group not already on the chosen route takes its own road when following the route
 * would add more than half again to its march; the player can send it round the route regardless.
 */
const LONG_DETOUR_PERMILLE = 1500;

export type LogisticsStance = 'hold' | 'forward';

export interface LogisticsPlan {
  orders: LogisticsOrders | null;
  reasons: string[];
}

export interface PlannedOrder {
  force: ForceId;
  name: string;
  order: GroupOrder;
  arrival: { dry: SlotRef; mud: SlotRef } | null;
  foodDaysOnArrival: number | null;
  /** Fatigue (permille) on arrival by dry roads, for a group on the march; null for one that holds or cannot arrive. */
  fatigueOnArrival: number | null;
  reasons: string[];
  /** The player's own pace, battle stance or road replaced the staff's for this group. */
  own: boolean;
  /** With a chosen route: whether the staff would have this group follow it or take its own road. */
  staffRoad: RoadChoice | null;
  /** The group marches for the objective: neither holding nor in battle. */
  marching: boolean;
}

const placeName = (ctx: Context, id: NodeId) => ctx.graph.nodes.get(id)?.name ?? id;
const tonnes = (g: number) => `${Math.round(g / 1_000_000).toLocaleString('en-GB')} t`;

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
    return { id: `via:${landmarks.join('+') || 'direct'}`, label, places: [from, ...path], landmarks, metres: pathMetres(ctx.graph, from, path) };
  });
}

/**
 * Join the axis before the objective, where the total road is shortest, then follow it. A way of
 * joining that passes through the objective itself would not be following the axis, so it is skipped.
 */
function routeAlong(ctx: Context, start: NodeId, axis: Axis | null, objective: NodeId): NodeId[] {
  const direct = shortestPath(ctx.graph, start, objective) ?? [];
  // Already bound for the objective: it finishes the stretch it is on (D-037).
  if (!axis || start === objective) return direct;
  // The what-ifs (rules.staff.joinRoute): a group on the route follows it from here; with `by-first-landmark` another
  // joins it no later than its first named place, so that every group passes the places that name the route.
  const join = ctx.rules.staff.joinRoute;
  const byLandmark = join === 'by-first-landmark';
  const on = axis.places.indexOf(start);
  if (join !== 'shortest' && on >= 0 && on < axis.places.length - 1) return axis.places.slice(on + 1);
  const firstNamed = (axis.landmarks ?? []).length > 0 ? axis.places.indexOf(axis.landmarks[0] as NodeId) : -1;
  const lastJoin = byLandmark && firstNamed >= 0 ? firstNamed : axis.places.length - 2;
  let best: NodeId[] | null = null;
  let bestMetres = Infinity;
  axis.places.slice(0, -1).forEach((join, i) => {
    if (i > lastJoin) return;
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

/**
 * Daylight sub-steps a force needs to reach the end of `route` from now, marching alone at `pace` (D-040), and its
 * fatigue when it arrives. It is projected through the engine's own hourly movement, with the same fatigue, rest at
 * night and gathering, so the forecast is what the force will do if nothing intervenes: today's roads as they are,
 * then dry roads (or, `wet`, mud on every road from tomorrow). Enemy columns, battles and the weather itself are not
 * foreseen. Infinity when it cannot get there.
 */
function marchForecast(s: GameState, ctx: Context, f: Force, route: NodeId[], pace: Pace, wet: boolean): { slots: number; fatigue: number } {
  const goal = route[route.length - 1];
  if (goal === undefined) return { slots: 0, fatigue: f.fatigue };
  const { fatigue, posture } = ctx.rules;
  const g: Force = { ...structuredClone(f), route: [...route], pace, battle: null };
  const alone = { ...s, forces: { [g.id]: g }, roads: { ...s.roads } } as GameState;
  let gathering = f.gathering > 0 ? f.gathering : f.posture === 'dispersed' ? posture.gatherSlots : 0;
  let marchedToday = f.marchedToday;
  let slot: Slot = s.resolution.slot;
  for (let n = 1; n <= 200; n++) {
    if (gathering > 0) {
      gathering--;
      g.fatigue = Math.max(0, g.fatigue + fatigue.halt);
    } else {
      const before = JSON.stringify([g.at, g.transit]);
      const total = marchBudget(g, ctx.rules);
      for (let hour = 0; hour < HOURS_PER_SLOT; hour++) marchHour(alone, ctx, [g], [hourlyShare(total, hour)], hour, []);
      const moved = JSON.stringify([g.at, g.transit]) !== before;
      g.fatigue = Math.max(0, Math.min(1000, g.fatigue + (moved ? (pace === 'forced' ? fatigue.marchForced : fatigue.marchSteady) : fatigue.halt)));
      marchedToday = marchedToday || moved;
      if (!moved && total <= 0) return { slots: Infinity, fatigue: g.fatigue };
    }
    if (g.transit === null && g.at === goal) return { slots: n, fatigue: g.fatigue };
    if (slot === 1 || slot === 3) {
      g.fatigue = Math.max(0, g.fatigue - (marchedToday ? fatigue.nightAfterMarch : fatigue.nightAfterRest));
      marchedToday = false;
      for (const id of Object.keys(alone.roads)) alone.roads[id] = wet ? 'mud' : 'dry';
    }
    slot = ((slot + 1) % SLOTS_PER_TURN) as Slot;
  }
  return { slots: Infinity, fatigue: g.fatigue };
}

function engagementReason(e: Engagement): string {
  if (e === 'stand') return 'Stand: marches as ordered. In battle, if most of the men there are under Stand orders, the marshal holds on after the position is lost, and breaks off only when the army is close to breaking.';
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

/** "Your order: forced march, avoid battle." */
function overrideReason(ov: GroupOverride): string {
  const parts = [
    ov.pace === 'rest' ? 'rest here' : ov.pace === 'forced' ? 'forced march' : ov.pace === 'steady' ? 'steady pace' : '',
    ov.engagement === 'seek' ? 'seek battle' : ov.engagement === 'avoid' ? 'avoid battle' : ov.engagement === 'accept' ? 'accept battle' : ov.engagement === 'stand' ? 'stand' : '',
    ov.road === 'route' ? 'follow the route' : ov.road === 'own' ? 'own road' : '',
  ].filter(Boolean);
  return `Your order: ${parts.join(', ')}.`;
}

export function planDirective(s: GameState, ctx: Context, d: Directive): PlannedOrder[] {
  // The chosen corridor is kept whole, so a change of lead group cannot silently drop it (§2.4b).
  const axis = d.objective && d.axis && d.axis.places.at(-1) === d.objective ? d.axis : null;
  const now: SlotRef = { turn: s.resolution.turn, slot: 0 };
  const lastSlot = slotIndex({ turn: ctx.scenario.turns, slot: 3 });
  const plans: PlannedOrder[] = [];

  for (const f of sortedValues(s.forces)) {
    if (f.side !== 'fr' || f.men <= 0) continue;
    const here = placeName(ctx, f.at);
    if (f.battle !== null) {
      plans.push({ force: f.id, name: f.name, order: { force: f.id }, arrival: null, foodDaysOnArrival: null, fatigueOnArrival: null, reasons: [`Engaged in battle at ${here}: no new movement until it ends.`], own: false, staffRoad: null, marching: false });
      continue;
    }
    // The player's own pace or battle stance replaces the staff's, and is forecast like it.
    const ov = d.overrides?.[f.id] ?? {};
    const own = ov.pace !== undefined || ov.engagement !== undefined || ov.road !== undefined;
    const tempo = ov.pace ?? d.tempo;
    const engagement = ov.engagement ?? d.engagement;
    const start = f.transit ? f.transit.to : f.at;
    const holding = d.objective === null || tempo === 'rest' || d.holdBack.includes(f.id) || (start === d.objective && !f.transit);
    if (holding) {
      const reasons = [
        d.posture === 'dispersed'
          ? `Holds at ${here}, dispersed to feed: forages its own and the neighbouring districts within reach, but needs about a day to gather.`
          : `Holds at ${here}, concentrated: ready to march or fight at once, but forages only its own district.`,
        engagementReason(engagement),
      ];
      if (d.holdBack.includes(f.id) && d.objective) reasons.unshift('Held back by your order.');
      if (own) reasons.unshift(overrideReason(ov));
      plans.push({
        force: f.id,
        name: f.name,
        order: { force: f.id, route: f.transit ? [f.transit.to] : [], pace: tempo === 'rest' ? 'rest' : 'steady', posture: d.posture, engagement },
        arrival: null,
        foodDaysOnArrival: Math.floor(f.stock.food / Math.max(1, f.men)),
        fatigueOnArrival: null,
        reasons: [...reasons, ...knownThreats(s, ctx, [], start)],
        own,
        staffRoad: null,
        marching: false,
      });
      continue;
    }

    const objective = d.objective as NodeId;
    // With a chosen route: follow it, or take its own road when the route would be a long detour (D-034).
    const direct = shortestPath(ctx.graph, start, objective) ?? [];
    const along = routeAlong(ctx, start, axis, objective);
    const directMetres = pathMetres(ctx.graph, start, direct);
    const alongMetres = pathMetres(ctx.graph, start, along);
    const staffRoad: RoadChoice | null = !axis ? null : !axis.places.includes(start) && alongMetres * 1000 > directMetres * LONG_DETOUR_PERMILLE ? 'own' : 'route';
    const ownRoad = axis !== null && (ov.road ?? staffRoad) === 'own';
    const path = ownRoad ? direct : along;
    const route = f.transit ? [f.transit.to, ...path] : path;
    const metres = pathMetres(ctx.graph, start, path) + (f.transit ? (ctx.graph.edges.get(f.transit.edge)?.metres ?? 0) - f.transit.metres : 0);
    const dryForecast = marchForecast(s, ctx, f, route, tempo, false);
    const dry = dryForecast.slots;
    const mud = marchForecast(s, ctx, f, route, tempo, true).slots;
    const days = Math.ceil(dry / 2);
    // Foraging on the march, but never more than the districts on the way still hold.
    const onTheWay = [...new Set([f.at, ...route])].reduce((n, p) => n + (s.districts[p]?.food ?? 0), 0);
    const foraged = Math.min(onTheWay, Math.floor((f.men * ctx.rules.forage.food.march) / 1000) * (Number.isFinite(dry) ? dry : 0));
    // Setting out, it keeps only what its men and horse-drawn wagons can carry (G-019).
    const { kept, dropped } = withinCapacity(f.stock, capacityGrams(f, ctx.rules), ctx.rules);
    const foodDays = Math.max(0, Math.floor((kept.food + foraged - f.men * days) / Math.max(1, f.men)));
    const crossings = path.flatMap((n, i) => {
      const from = i === 0 ? start : (path[i - 1] as NodeId);
      const e = edgeBetween(ctx.graph, from, n);
      return e && (e.crossing === 'ford' || e.crossing === 'pontoon') ? [`${placeName(ctx, from)} and ${placeName(ctx, n)}`] : [];
    });

    const reasons = [`Route: ${[start, ...path].map((n) => placeName(ctx, n)).join(' → ')}, ${Math.round(metres / 1000)} km.`];
    if (axis && ownRoad && ov.road === undefined) {
      reasons.push(`Takes its own road: following the route ${axis.label.replace(/^Via /, 'via ')} would add ${km(alongMetres - directMetres)} (${km(alongMetres)} against ${km(directMetres)}).`);
    } else if (axis && !ownRoad && ov.road === 'route' && staffRoad === 'own') {
      reasons.push(`Follows the route as you ordered: ${km(alongMetres - directMetres)} longer than its own road.`);
    }
    if (axis && !ownRoad && path.length > 0 && !axis.places.includes(start)) {
      const join = path.find((n) => axis.places.includes(n));
      if (join && join !== objective) reasons.push(`Joins the route ${axis.label.replace(/^Via /, 'via ')} at ${placeName(ctx, join)}.`);
      else reasons.push('Converges on the objective by its own road.');
    }
    if (crossings.length > 0) reasons.push(`Crosses a river between ${crossings.join(', ')}: slower going.`);
    if (f.posture === 'dispersed' || f.gathering > 0) reasons.push('Gathers first from its cantonments: about a day before it can march.');
    if (weightGrams(dropped, ctx.rules) > 0) {
      const parts = [
        dropped.food > 0 ? `${dropped.food.toLocaleString('en-GB')} rations` : '',
        dropped.fodder > 0 ? `${dropped.fodder.toLocaleString('en-GB')} horse-rations of fodder` : '',
        dropped.ammo > 0 ? `${dropped.ammo.toLocaleString('en-GB')} ammunition` : '',
      ].filter(Boolean);
      const depot = !f.transit && s.depots[f.at]?.side === 'fr';
      reasons.push(`Can carry only ${tonnes(capacityGrams(f, ctx.rules))} of its ${tonnes(weightGrams(f.stock, ctx.rules))} of stores: it leaves ${parts.join(', ')} behind${depot ? ', back in the depot' : ', lost'}.`);
    }
    if (tempo === 'forced') reasons.push('Forced march: faster, but tires men and horses and leaves stragglers.');
    reasons.push(
      Number.isFinite(dry)
        ? `Arrives ${when(ctx, slotAfter(now, dry))}${mud !== dry && Number.isFinite(mud) ? ` (dry roads) to ${when(ctx, slotAfter(now, mud))} (wet weather)` : ''}${slotIndex(slotAfter(now, dry)) > lastSlot ? ', after the campaign ends' : ''}.`
        : 'Too exhausted to reach the objective without rest.',
    );
    reasons.push(`Food on arrival: about ${foodDays} day${foodDays === 1 ? '' : 's'} from what it carries, before deliveries from its wagon train; foraging on the march gathers little.`);
    reasons.push(engagementReason(engagement));
    reasons.push(...knownThreats(s, ctx, path, start));
    if (own) reasons.unshift(overrideReason(ov));

    plans.push({
      force: f.id,
      name: f.name,
      order: { force: f.id, route, pace: tempo, posture: 'concentrated', engagement },
      arrival: Number.isFinite(dry) ? { dry: slotAfter(now, dry), mud: slotAfter(now, Number.isFinite(mud) ? mud : dry) } : null,
      foodDaysOnArrival: foodDays,
      fatigueOnArrival: Number.isFinite(dry) ? dryForecast.fatigue : null,
      reasons,
      own,
      staffRoad,
      marching: true,
    });
  }
  return plans;
}

/** What a route would do for the whole army, read before it is chosen (M2, G1 and G3). French knowledge only. */
export interface RoutePreview {
  /** The route, or null for each group's shortest roads. */
  axis: Axis | null;
  /** Each marching group's way from where it stands: what the map draws for this route. */
  paths: NodeId[][];
  /** The first arrival by dry roads, and the last in wet weather. */
  arrival: { first: SlotRef; last: SlotRef } | null;
  /** Marching groups that would not arrive before the campaign ends, or at all without rest. */
  late: string[];
  /** The marching group most tired on arrival (fatigue, permille), and the one with least food (days). */
  tiredest: { force: ForceId; name: string; fatigue: number } | null;
  hungriest: { force: ForceId; name: string; days: number } | null;
  /** River crossings on the way, each once: between which places, and how. */
  crossings: { between: string; by: Crossing }[];
  /** Known enemies near the way, in the plan's words. */
  threats: string[];
  /**
   * An earlier route in the list that comes to the very same orders, if any: its label, or null for the shortest
   * roads. Groups join a route where their total road is shortest, so a route can come to another's orders.
   */
  sameAs: string | null | undefined;
}

/**
 * Previews each route the staff could take to the objective: the army planned once for each, as it would be
 * committed, and summed up. It changes nothing; choosing a route still goes through `planDirective`.
 */
export function previewRoutes(s: GameState, ctx: Context, d: Directive, axes: readonly (Axis | null)[]): RoutePreview[] {
  const lastSlot = slotIndex({ turn: ctx.scenario.turns, slot: 3 });
  const seen = new Map<string, string | null>();
  return axes.map((axis) => {
    const marching = planDirective(s, ctx, { ...d, axis }).filter((p) => p.marching);
    const paths = marching.map((p) => [(s.forces[p.force] as Force).at, ...(p.order.route ?? [])]);
    const arrived = marching.filter((p) => p.arrival !== null);
    const crossings = new Map<string, { between: string; by: Crossing }>();
    for (const path of paths) {
      path.slice(1).forEach((n, i) => {
        const from = path[i] as NodeId;
        const e = edgeBetween(ctx.graph, from, n);
        if (e?.crossing) crossings.set(e.id, { between: `${placeName(ctx, from)} and ${placeName(ctx, n)}`, by: e.crossing });
      });
    }
    const places = [...new Set(paths.flat())];
    const worst = <T>(xs: T[], key: (x: T) => number) => xs.reduce<T | null>((w, x) => (w === null || key(x) > key(w) ? x : w), null);
    const tired = worst(
      marching.filter((p) => p.fatigueOnArrival !== null),
      (p) => p.fatigueOnArrival as number,
    );
    const hungry = worst(
      marching.filter((p) => p.foodDaysOnArrival !== null),
      (p) => -(p.foodDaysOnArrival as number),
    );
    const orders = JSON.stringify(marching.map((p) => p.order));
    const sameAs = seen.has(orders) ? seen.get(orders) : undefined;
    if (!seen.has(orders)) seen.set(orders, axis?.label ?? null);
    return {
      sameAs,
      axis,
      paths,
      arrival:
        arrived.length === 0
          ? null
          : {
              first: arrived.map((p) => p.arrival!.dry).reduce((a, b) => (slotIndex(b) < slotIndex(a) ? b : a)),
              last: arrived.map((p) => p.arrival!.mud).reduce((a, b) => (slotIndex(b) > slotIndex(a) ? b : a)),
            },
      late: marching.filter((p) => p.arrival === null || slotIndex(p.arrival.dry) > lastSlot).map((p) => p.name),
      tiredest: tired ? { force: tired.force, name: tired.name, fatigue: tired.fatigueOnArrival as number } : null,
      hungriest: hungry ? { force: hungry.force, name: hungry.name, days: hungry.foodDaysOnArrival as number } : null,
      crossings: [...crossings.values()],
      threats: places.length > 0 ? knownThreats(s, ctx, places.slice(1), places[0] as NodeId) : [],
    };
  });
}

export interface PlanSummary {
  arrival: { first: SlotRef; last: SlotRef } | null;
  /** Groups that may meet a known enemy stronger than themselves. */
  exposed: string[];
  /** The worst-fed group, and horses short of fodder before they start to die. */
  supply: string[];
  /** All of it in reading order: arrivals, exposure, supply, then what the forecasts leave out. */
  lines: string[];
}

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/**
 * The consequences that matter most, read before the orders of each group (§2.4b): how far apart the
 * groups arrive, which groups may meet a stronger known enemy, and where supply is worst. French
 * knowledge only, like the plan itself.
 */
export function summarizePlan(s: GameState, ctx: Context, plan: readonly PlannedOrder[]): PlanSummary {
  const arrivals = plan.flatMap((p) => (p.arrival ? [p.arrival.dry] : [])).sort((a, b) => slotIndex(a) - slotIndex(b));
  const arrival = arrivals.length > 0 ? { first: arrivals[0] as SlotRef, last: arrivals[arrivals.length - 1] as SlotRef } : null;
  let arrivalLine = 'Arrivals: no group marches.';
  if (arrival) {
    const apart = Math.round((slotIndex(arrival.last) - slotIndex(arrival.first)) / 2);
    const late = plan.filter((p) => p.arrival && slotIndex(p.arrival.dry) > slotIndex({ turn: ctx.scenario.turns, slot: 3 })).map((p) => p.name);
    arrivalLine = `Arrivals: first ${when(ctx, arrival.first)}, last ${when(ctx, arrival.last)}${apart >= 1 ? `, about ${days(apart)} apart: the first to arrive may have to fight alone` : ''}.`;
    if (late.length > 0) arrivalLine += ` After the campaign ends: ${late.join('; ')}.`;
  }

  const turn = s.resolution.turn;
  const exposed: string[] = [];
  for (const p of plan) {
    const f = s.forces[p.force];
    if (!f || f.battle !== null) continue;
    const marching = (p.order.route ?? []).length > 0 && p.arrival !== null;
    const places = marching ? [f.at, ...(p.order.route ?? [])] : [f.at];
    for (const id of Object.keys(s.intel.fr).sort()) {
      const x = s.intel.fr[id];
      if (!x || turn - x.turn > 2 || x.men <= f.men) continue;
      if (!places.some((n) => roadDistance(ctx.graph, n, x.at) <= 30_000)) continue;
      const enemy = `${s.forces[id]?.name ?? id} (about ${x.men.toLocaleString('en-GB')} men, reported at ${placeName(ctx, x.at)})`;
      exposed.push(
        marching
          ? `${p.name} may meet ${enemy} on its way, stronger than its own ${f.men.toLocaleString('en-GB')} men.`
          : `${p.name} at ${placeName(ctx, f.at)} has ${enemy} within reach, stronger than its own ${f.men.toLocaleString('en-GB')} men.`,
      );
    }
  }

  const supply: string[] = [];
  let worst: PlannedOrder | null = null;
  for (const p of plan) if (p.foodDaysOnArrival !== null && (worst === null || p.foodDaysOnArrival < (worst.foodDaysOnArrival as number))) worst = p;
  if (worst) supply.push(`Least food: ${worst.name}, about ${days(worst.foodDaysOnArrival as number)} ${worst.arrival ? 'on arrival' : 'in hand'}, before deliveries.`);
  for (const p of plan) {
    const f = s.forces[p.force];
    const horses = f ? f.horses + f.draught : 0;
    if (!f || horses === 0) continue;
    if (f.stock.fodder === 0) supply.push(`${p.name}: no fodder in hand; its horses must find grass or start to die.`);
    else if (f.stock.fodder * 2 < horses) supply.push(`${p.name}: fodder for less than half a day; its horses must find grass or start to die.`);
  }

  return {
    arrival,
    exposed,
    supply,
    lines: [
      arrivalLine,
      ...(exposed.length > 0 ? exposed : ['No group is known to face a stronger enemy on its own.']),
      ...supply,
      'Forecasts leave out deliveries still on the road, weather worse than wet roads, and enemies not yet seen.',
    ],
  };
}

const km = (metres: number) => `${Math.round(metres / 1000)} km`;

/**
 * The staff's supply arrangements for a directive (§2.6). Holding keeps everything as it is. Bringing
 * the base forward founds one depot per turn where French troops stand far enough beyond the existing
 * depots but within a line train's haul of one; sends each idle line train from a depot with a full load
 * waiting to the depot nearest the front within its haul, so stores move up in relays; and has each
 * group's wagons load at the nearest depot with at least a day's food for it.
 */
export function planLogistics(s: GameState, ctx: Context, d: Directive): LogisticsPlan {
  if (d.logistics === 'hold') return { orders: null, reasons: ['Depots and wagon trains keep their present arrangements.'] };
  const ours = sortedValues(s.depots).filter((x) => x.side === 'fr');
  const french = sortedValues(s.forces).filter((f) => f.side === 'fr' && f.men > 0);
  const largest = french.reduce<Force | null>((a, f) => (a === null || f.men > a.men ? f : a), null);
  const front = d.objective ?? largest?.at ?? null;
  if (front === null || ours.length === 0) return { orders: null, reasons: ['No French depot remains to supply from.'] };
  const fromFront = (node: NodeId) => roadDistance(ctx.graph, node, front);
  const nearestDepot = (node: NodeId) => Math.min(...ours.map((x) => roadDistance(ctx.graph, node, x.node)));
  const byFront = (a: NodeId, b: NodeId) => fromFront(a) - fromFront(b) || (a < b ? -1 : 1);
  const { minDepotSpacingMetres: spacing, maxLineHaulMetres: haul } = ctx.rules.logistics;
  const reasons: string[] = [];

  const sites = [...new Set(french.filter((f) => f.transit === null && f.battle === null).map((f) => f.at))]
    .filter((n) => !s.depots[n] && !enemyPresent(s, 'fr', n) && nearestDepot(n) >= spacing && nearestDepot(n) <= haul)
    .sort(byFront);
  const site = sites[0];
  if (site !== undefined) {
    reasons.push(
      `Found a depot at ${placeName(ctx, site)}, ${km(nearestDepot(site))} beyond the nearest one. It starts empty, and falls to the enemy if no French troops hold it: much of what is stored there would then be burned.`,
    );
  } else {
    reasons.push(`No new depot: no place held by French troops lies between ${km(spacing)} and ${km(haul)} beyond the existing depots.`);
  }

  const depots = [...ours.map((x) => x.node), ...(site !== undefined ? [site] : [])];
  const convoys: ConvoyOrder[] = [];

  for (const c of sortedValues(s.convoys)) {
    if (c.side !== 'fr') continue;
    if (c.serves === null) {
      // A train on its way with a load finishes that delivery first.
      if (c.leg === 'outbound') continue;
      const { convoy, gramsPerUnit } = ctx.rules;
      const load = Math.floor((c.wagons * convoy.payloadGrams * convoy.loadPermille.food) / 1000 / gramsPerUnit.food);
      const at = c.transit ? c.transit.to : c.at;
      let best: { home: NodeId; feeds: NodeId; cost: number } | null = null;
      for (const home of ours.filter((x) => x.stock.food >= load).map((x) => x.node)) {
        for (const feeds of depots) {
          if (feeds === home || byFront(feeds, home) >= 0 || roadDistance(ctx.graph, home, feeds) > haul) continue;
          const cost = roadDistance(ctx.graph, at, home) + roadDistance(ctx.graph, home, feeds);
          if (best === null || byFront(feeds, best.feeds) < 0 || (feeds === best.feeds && cost < best.cost)) best = { home, feeds, cost };
        }
      }
      if (best === null || (best.home === c.home && best.feeds === c.feeds)) continue;
      convoys.push({ convoy: c.id, home: best.home, feeds: best.feeds });
      reasons.push(`Line train of ${c.wagons} wagons will carry supplies from ${placeName(ctx, best.home)} to ${placeName(ctx, best.feeds)}, ${km(roadDistance(ctx.graph, best.home, best.feeds))} by road.`);
      continue;
    }
    const f = s.forces[c.serves];
    if (!f || f.men <= 0) continue;
    const at = f.transit ? f.transit.to : f.at;
    const stocked = ours.filter((x) => x.stock.food >= f.men).map((x) => x.node);
    const best = [...stocked].sort((a, b) => roadDistance(ctx.graph, at, a) - roadDistance(ctx.graph, at, b) || (a < b ? -1 : 1))[0];
    if (best === undefined || best === c.home) continue;
    const gain = roadDistance(ctx.graph, at, c.home) - roadDistance(ctx.graph, at, best);
    if (gain <= 0) continue;
    convoys.push({ convoy: c.id, home: best, serves: f.id });
    reasons.push(`${f.name}: its wagons will load at ${placeName(ctx, best)} instead of ${placeName(ctx, c.home)}, ${km(gain)} closer.`);
  }

  const orders: LogisticsOrders = {};
  if (site !== undefined) orders.foundDepot = site;
  if (convoys.length > 0) orders.convoys = convoys;
  return { orders: site !== undefined || convoys.length > 0 ? orders : null, reasons };
}

/** The orders to commit: the staff's plan with any of the player's own orders in place of the staff's. */
export function ordersFrom(plan: readonly PlannedOrder[], overrides: readonly GroupOrder[] = []): GroupOrder[] {
  return plan.map((p) => overrides.find((o) => o.force === p.force) ?? p.order);
}

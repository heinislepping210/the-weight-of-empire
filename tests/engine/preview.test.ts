// Trustworthy previews (independent review, stage C): the plan the player sees is the plan that is
// committed, the chosen route keeps its identity, and the army-level summary comes first.

import { describe, expect, it } from 'vitest';
import { advance, createContext, newGame, slotIndexOf, statusOf } from '../../src/engine';
import type { Axis, Directive, GameState } from '../../src/engine';
import { axesTo, leadGroup, ordersFrom, planDirective, previewRoutes, summarizePlan } from '../../src/engine/directive';
import { shortestPath } from '../../src/engine/graph';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { inputFor } from '../fixtures/driver';

const ctx = createContext(vitebskDecision());
const start = () => newGame(ctx, 1812);
const directive = (over: Partial<Directive>): Directive => ({ objective: null, axis: null, tempo: 'steady', posture: 'concentrated', engagement: 'accept', holdBack: [], logistics: 'hold', ...over });
const southern = (): Axis => axesTo(ctx, 'liozno', 'smolensk').find((a) => a.label.includes('Rasasna'))!;

describe("the player's own orders are part of the plan", () => {
  it('a pace override changes the forecast and the order together', () => {
    const d = directive({ objective: 'smolensk-north' });
    const staff = planDirective(start(), ctx, d).find((p) => p.force === 'fr-left')!;
    const own = planDirective(start(), ctx, { ...d, overrides: { 'fr-left': { pace: 'rest' } } }).find((p) => p.force === 'fr-left')!;
    expect(staff.arrival).not.toBeNull();
    expect(own.arrival).toBeNull();
    expect(own.order).toMatchObject({ route: [], pace: 'rest' });
    expect(own.own).toBe(true);
    expect(own.reasons[0]).toBe('Your order: rest here.');
  });

  it('a forced march brings the forecast arrival forward, and only for that group', () => {
    const d = directive({ objective: 'smolensk-north' });
    const staff = planDirective(start(), ctx, d);
    const own = planDirective(start(), ctx, { ...d, overrides: { 'fr-vanguard': { pace: 'forced' } } });
    const arrival = (plan: typeof staff, id: string) => slotIndexOf(plan.find((p) => p.force === id)!.arrival!.dry);
    expect(arrival(own, 'fr-vanguard')).toBeLessThan(arrival(staff, 'fr-vanguard'));
    expect(own.find((p) => p.force === 'fr-vanguard')!.order.pace).toBe('forced');
    expect(own.filter((p) => p.force !== 'fr-vanguard')).toEqual(staff.filter((p) => p.force !== 'fr-vanguard'));
  });

  it('the orders committed are exactly the orders previewed', () => {
    const plan = planDirective(start(), ctx, directive({ objective: 'smolensk-north', overrides: { 'fr-left': { pace: 'rest' }, 'fr-guard': { engagement: 'avoid' } } }));
    expect(ordersFrom(plan)).toEqual(plan.map((p) => p.order));
    expect(plan.find((p) => p.force === 'fr-guard')!.order.engagement).toBe('avoid');
  });
});

describe('the chosen route keeps its identity', () => {
  it('a southern route chosen on the first turn still guides the groups after another group takes the lead', () => {
    const axis = southern();
    const d = directive({ objective: 'smolensk', axis });
    let s: GameState = start();
    while (!(statusOf(s).kind === 'awaitingOrders' && s.resolution.turn === 3)) {
      const status = statusOf(s);
      const policy = { orders: (x: GameState) => ordersFrom(planDirective(x, ctx, d)), round: () => 'delegate' as const, nightfall: () => 'delegate' as const };
      const r = advance(s, inputFor(s, status, policy), ctx);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    // The lead has changed, and the route's identity no longer exists among the routes traced from the new lead…
    const lead = leadGroup(s, ctx, 'smolensk')!;
    expect(lead.at).not.toBe('liozno');
    expect(axesTo(ctx, lead.at, 'smolensk').some((a) => a.id === axis.id)).toBe(false);
    // …yet groups still behind keep to the chosen corridor, unless the staff says they take their own road.
    const plan = planDirective(s, ctx, d);
    const corridor = new Set(axis.places);
    const followers = plan.filter((p) => p.order.route && p.order.route.length > 1 && !corridor.has(s.forces[p.force]!.at));
    expect(followers.length).toBeGreaterThan(0);
    let viaCorridor = 0;
    for (const p of followers) {
      const f = s.forces[p.force]!;
      const from = f.transit ? f.transit.to : f.at;
      const shortest = shortestPath(ctx.graph, from, 'smolensk') ?? [];
      if (p.reasons.some((r) => r.startsWith('Takes its own road'))) {
        expect(p.order.route, p.force).toEqual(f.transit ? [from, ...shortest] : shortest);
      } else {
        expect(p.order.route!.some((n) => corridor.has(n) && n !== 'smolensk') || shortest.some((n) => corridor.has(n) && n !== 'smolensk'), p.force).toBe(true);
        viaCorridor++;
      }
    }
    expect(viaCorridor).toBeGreaterThan(0);
  });
});

describe('the road each group takes (§2.4b)', () => {
  const plan = (overrides?: Directive['overrides']) => planDirective(start(), ctx, directive({ objective: 'smolensk', axis: southern(), overrides }));
  const group = (p: ReturnType<typeof plan>, id: string) => p.find((x) => x.force === id)!;
  const shortestFrom = (id: string) => shortestPath(ctx.graph, start().forces[id]!.at, 'smolensk');

  it('a group far from the chosen route takes its own road by default, and says why', () => {
    const eugene = group(plan(), 'fr-left');
    expect(eugene.staffRoad).toBe('own');
    expect(eugene.order.route).toEqual(shortestFrom('fr-left'));
    expect(eugene.reasons.some((r) => r.startsWith('Takes its own road: following the route via Liubavichi and Rasasna would add'))).toBe(true);
  });

  it('a group near the route follows it', () => {
    const guard = group(plan(), 'fr-guard');
    expect(guard.staffRoad).toBe('route');
    expect(guard.order.route).toContain('rasasna');
  });

  it('your order sends a group round the route after all, or by its own road, and the staff choice is still shown', () => {
    const p = plan({ 'fr-left': { road: 'route' }, 'fr-guard': { road: 'own' } });
    expect(group(p, 'fr-left').order.route).toContain('rasasna');
    expect(group(p, 'fr-left').reasons[0]).toBe('Your order: follow the route.');
    expect(group(p, 'fr-left').staffRoad).toBe('own');
    expect(group(p, 'fr-guard').order.route).toEqual(shortestFrom('fr-guard'));
    expect(group(p, 'fr-guard').reasons[0]).toBe('Your order: own road.');
    expect(group(p, 'fr-guard').staffRoad).toBe('route');
  });
});

describe('the army-level summary comes first', () => {
  it('gives the spread of arrivals across the groups', () => {
    const plan = planDirective(start(), ctx, directive({ objective: 'smolensk-north' }));
    const summary = summarizePlan(start(), ctx, plan);
    const arrivals = plan.flatMap((p) => (p.arrival ? [slotIndexOf(p.arrival.dry)] : []));
    expect(slotIndexOf(summary.arrival!.first)).toBe(Math.min(...arrivals));
    expect(slotIndexOf(summary.arrival!.last)).toBe(Math.max(...arrivals));
    expect(summary.lines[0]).toMatch(/^Arrivals: first /);
  });

  it('names the groups that would arrive only after the campaign ends', () => {
    // Eugène sent all the way round the southern route, against the staff's advice.
    const plan = planDirective(start(), ctx, directive({ objective: 'smolensk', axis: southern(), overrides: { 'fr-left': { road: 'route' } } }));
    const late = plan.filter((p) => p.arrival && slotIndexOf(p.arrival.dry) > slotIndexOf({ turn: ctx.scenario.turns, slot: 3 }));
    expect(late.length).toBeGreaterThan(0);
    expect(summarizePlan(start(), ctx, plan).lines[0]).toContain(`After the campaign ends: ${late.map((p) => p.name).join('; ')}.`);
  });

  it('names a group that would meet a stronger known enemy on its own', () => {
    const s = start();
    // The French have word of the 1st Army at Rudnia, on the vanguard's road.
    s.intel.fr['ru-1st'] = { at: 'rudnia', men: 75_000, turn: 1 };
    const summary = summarizePlan(s, ctx, planDirective(s, ctx, directive({ objective: 'smolensk-north' })));
    expect(summary.exposed.some((x) => x.startsWith("Vanguard: Murat's cavalry and Ney's corps") && x.includes('1st Western Army'))).toBe(true);
  });

  it('names the worst-fed group, and horses without fodder before they die', () => {
    const s = start();
    s.forces['fr-left']!.stock.fodder = 0;
    const plan = planDirective(s, ctx, directive({ objective: 'smolensk-north' }));
    const summary = summarizePlan(s, ctx, plan);
    const worst = plan.filter((p) => p.foodDaysOnArrival !== null).sort((a, b) => a.foodDaysOnArrival! - b.foodDaysOnArrival!)[0]!;
    expect(summary.supply.some((x) => x.startsWith(`Least food: ${worst.name}`))).toBe(true);
    expect(summary.supply.some((x) => x.startsWith("Left wing: Eugène's corps: no fodder in hand"))).toBe(true);
  });

  it('forecasts foraging on the march only from what the districts on the way still hold', () => {
    const s = start();
    // Enough food to arrive with some left, so what is foraged on the way shows in the forecast.
    s.forces['fr-vanguard']!.stock = { food: 300_000, fodder: 1_000, ammo: 1_000 };
    const d = directive({ objective: 'smolensk-north' });
    const full = planDirective(s, ctx, d).find((p) => p.force === 'fr-vanguard')!;
    const bare = structuredClone(s);
    for (const id of Object.keys(bare.districts)) bare.districts[id] = { food: 0, fodder: 0 };
    const stripped = planDirective(bare, ctx, d).find((p) => p.force === 'fr-vanguard')!;
    expect(stripped.foodDaysOnArrival!).toBeLessThan(full.foodDaysOnArrival!);
  });
});

describe('route previews (M2, G1 and G3): each route read before it is chosen', () => {
  const d = directive({ objective: 'smolensk' });
  const routes = () => [null, ...axesTo(ctx, 'liozno', 'smolensk')];

  it('gives one preview for each route, planned as it would be committed', () => {
    const s = start();
    const previews = previewRoutes(s, ctx, d, routes());
    expect(previews).toHaveLength(4);
    for (const p of previews) {
      const plan = planDirective(s, ctx, { ...d, axis: p.axis });
      const summary = summarizePlan(s, ctx, plan);
      expect(p.paths).toHaveLength(plan.filter((x) => x.marching).length);
      expect(p.arrival?.first).toEqual(summary.arrival?.first);
      expect(slotIndexOf(p.arrival!.last)).toBeGreaterThanOrEqual(slotIndexOf(p.arrival!.first));
    }
  });

  it('tells the routes apart, and says when one comes to the same orders as another', () => {
    const previews = previewRoutes(start(), ctx, d, routes().slice(1));
    for (const p of previews.filter((x) => x.sameAs === undefined)) {
      const twins = previews.filter((x) => JSON.stringify(x.paths) === JSON.stringify(p.paths));
      expect(twins.every((x) => x === p || x.sameAs === p.axis?.label)).toBe(true);
    }
    // On the opening turn the route by Orsha and Dubrovna comes to the orders of the one by Rasasna: every group
    // joins it at Liady, after the places that name it (a finding for the planner, not yet changed).
    const orsha = previews.find((p) => p.axis?.label.includes('Orsha'))!;
    expect(orsha.sameAs).toBe(previews.find((p) => p.axis?.label.includes('Rasasna'))!.axis!.label);
    // The southern swing crosses the Dnieper on the pontoons between Rasasna and Liady.
    const south = previews.find((p) => p.axis?.label.includes('Rasasna'))!;
    expect(south.crossings).toContainEqual({ between: 'Rasasna and Liady', by: 'pontoon' });
  });

  it('forecasts fatigue on arrival, higher on a forced march', () => {
    const s = start();
    const steady = previewRoutes(s, ctx, d, [null])[0]!;
    const forced = previewRoutes(s, ctx, { ...d, tempo: 'forced' }, [null])[0]!;
    expect(steady.tiredest).not.toBeNull();
    expect(forced.tiredest!.fatigue).toBeGreaterThan(steady.tiredest!.fatigue);
    expect(steady.hungriest!.days).toBeGreaterThanOrEqual(0);
  });

  it('holding the line previews no march, and nothing in the game changes', () => {
    const s = start();
    const before = JSON.stringify(s);
    const [hold] = previewRoutes(s, ctx, directive({}), [null]);
    expect(hold!.paths).toEqual([]);
    expect(hold!.arrival).toBeNull();
    previewRoutes(s, ctx, d, routes());
    expect(JSON.stringify(s)).toBe(before);
  });
});

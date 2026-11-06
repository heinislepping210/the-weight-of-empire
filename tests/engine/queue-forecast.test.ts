// Forecasts that see queues (G-024, G2): the staff forecasts the army's columns together, through the engine's own
// hourly movement, so that what road capacity would do shows in the previews. The contract:
//   1. With road capacity off, a group's forecast is what it would be if it marched alone.
//   2. With it on, the forecast is the march: with no enemy and no rain, each group arrives when the plan said.
//   3. A group held up says behind whom, where, and by how much; one with a clear road says nothing.
//   4. The route cards and the army summary say it too.
//   5. Forecasts change no order, and planning changes no state.

import { describe, expect, it } from 'vitest';
import { RULES, createContext, newGame, stateHash } from '../../src/engine';
import type { Context, Directive, GameState, Rules, ScenarioDef } from '../../src/engine';
import { axesTo, ordersFrom, planDirective, previewRoutes, summarizePlan } from '../../src/engine/directive';
import { slotIndex } from '../../src/engine/time';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { play } from '../fixtures/driver';
import { holdStill, testGround } from '../fixtures/testGround';

/** Road capacity on, and no rain, so that a forecast by dry roads is exact. */
const OFF: Rules = { ...RULES, march: { ...RULES.march, columnMetresPerThousand: 0 } };
const DRY = { ...OFF, weather: { rainPermille: 0 } } as unknown as Rules;
const QUEUE: Rules = { ...DRY, march: { ...RULES.march, columnMetresPerThousand: 500 } };

const directive = (over: Partial<Directive> = {}): Directive => ({ objective: 'C', axis: null, tempo: 'steady', posture: 'concentrated', engagement: 'accept', holdBack: [], logistics: 'hold', ...over });

/** Both French columns at B, a post road to C that is the shortest way there, the Russians far off at F. */
function ground(edit: (d: ScenarioDef) => void = () => {}): ScenarioDef {
  return testGround((d) => {
    d.turns = 8;
    d.convoys = [];
    Object.assign(d.edges.find((e) => e.id === 'B-C')!, { metres: 50_000, road: 'post' });
    for (const f of d.forces) f.at = f.side === 'fr' ? 'B' : 'F';
    edit(d);
  });
}

const contextFor = (scenario: ScenarioDef, rules: Rules): Context => createContext(scenario, rules, { russianCommand: holdStill });
const plannedFor = (ctx: Context, d: Directive = directive(), s: GameState = newGame(ctx, 7)) => planDirective(s, ctx, d);
const planned = (ctx: Context, id: string, d?: Directive, s?: GameState) => plannedFor(ctx, d, s).find((p) => p.force === id)!;

/** The sub-step each group reached a place in the game itself, with the plan's orders and no others. */
function arrivals(ctx: Context, d: Directive, goal: string): Record<string, number> {
  const orders = ordersFrom(planDirective(newGame(ctx, 7), ctx, d));
  const run = play(ctx, 7, { orders: (s) => (s.resolution.turn === 1 ? orders : []), round: () => 'delegate', nightfall: () => 'delegate' });
  const out: Record<string, number> = {};
  for (const e of run.logs.flat()) {
    if (e.kind === 'arrived' && e.detail.node === goal) out[String(e.detail.force)] ??= slotIndex({ turn: e.turn, slot: e.slot });
  }
  return out;
}

describe('with road capacity off', () => {
  it('a group is forecast as if it marched alone', () => {
    const ctx = contextFor(ground(), DRY);
    const together = plannedFor(ctx);
    const alone = contextFor(ground((d) => (d.forces = d.forces.filter((f) => f.id !== 'fr-flank'))), DRY);
    const main = together.find((p) => p.force === 'fr-main')!;
    expect(main.arrival).toEqual(planned(alone, 'fr-main').arrival);
    expect(main.fatigueOnArrival).toBe(planned(alone, 'fr-main').fatigueOnArrival);
    expect(together.every((p) => p.queue === null)).toBe(true);
  });

  it('says nothing of queues on the real map either', () => {
    const ctx = createContext(vitebskDecision(), OFF);
    const d = directive({ objective: 'smolensk' });
    const s = newGame(ctx, 1812);
    expect(summarizePlan(s, ctx, planDirective(s, ctx, d)).queues).toEqual([]);
    for (const p of previewRoutes(s, ctx, d, [null, ...axesTo(ctx, 'liozno', 'smolensk')])) expect(p.queues).toEqual([]);
  });
});

describe('with road capacity on', () => {
  const ctx = contextFor(ground(), QUEUE);

  it('the forecast is the march: each group arrives in the game when the plan said', () => {
    const plan = plannedFor(ctx);
    const seen = arrivals(ctx, directive(), 'C');
    for (const id of ['fr-main', 'fr-flank']) {
      expect(seen[id], id).toBe(slotIndex(plan.find((p) => p.force === id)!.arrival!.dry));
    }
    expect(seen['fr-main']!).toBeGreaterThan(seen['fr-flank']!);
  });

  it('with road capacity off the same check holds, and the groups arrive together', () => {
    const off = contextFor(ground(), DRY);
    const seen = arrivals(off, directive(), 'C');
    expect(seen['fr-main']).toBe(seen['fr-flank']);
    expect(seen['fr-main']).toBe(slotIndex(planned(off, 'fr-main').arrival!.dry));
  });

  it('the group held up says behind whom, where and by how much; the one in front says nothing', () => {
    const main = planned(ctx, 'fr-main');
    expect(main.queue).toMatchObject({ behind: 'Flank corps', at: 'Node B', slots: 1 });
    expect(main.reasons.join(' ')).toContain('Shares the road from Node B with Flank corps');
    expect(main.reasons.join(' ')).toContain('half a day later');
    expect(planned(ctx, 'fr-flank').queue).toBeNull();
  });

  it('columns on different roads do not queue, and arrive as they would with queues off', () => {
    const apart = ground((d) => {
      d.forces.find((f) => f.id === 'fr-main')!.at = 'C';
      d.forces.find((f) => f.id === 'fr-flank')!.at = 'E';
    });
    const d = directive({ objective: 'D' });
    const [on, off] = [plannedFor(contextFor(apart, QUEUE), d), plannedFor(contextFor(apart, DRY), d)];
    expect(on.map((p) => p.order.route)).toEqual([['D'], ['D']]);
    expect(on.map((p) => p.queue)).toEqual([null, null]);
    expect(on.map((p) => p.arrival)).toEqual(off.map((p) => p.arrival));
  });

  it('a group held back at the start leaves the road clear', () => {
    expect(planned(ctx, 'fr-main', directive({ holdBack: ['fr-flank'] })).queue).toBeNull();
  });

  it('a column resting on the road holds up those behind it, and the forecast sees it', () => {
    const s = newGame(ctx, 7);
    s.roadSeq = 1;
    Object.assign(s.forces['fr-flank']!, { transit: { edge: 'B-C', to: 'C', metres: 2_000, seq: 0 } });
    const main = planned(ctx, 'fr-main', directive({ overrides: { 'fr-flank': { pace: 'rest' } } }), s);
    expect(main.arrival).toBeNull();
    expect(main.reasons.join(' ')).toContain('Held up by Flank corps, stopped on the road from Node B');
    expect(main.queue).toMatchObject({ behind: 'Flank corps', slots: Infinity });
  });

  it('forecasts change no order, and planning changes no state', () => {
    const off = contextFor(ground(), DRY);
    expect(plannedFor(ctx).map((p) => p.order)).toEqual(plannedFor(off).map((p) => p.order));
    const s = newGame(ctx, 7);
    const before = stateHash(s);
    planDirective(s, ctx, directive());
    expect(stateHash(s)).toBe(before);
  });
});

describe('on the real map, with road capacity on', () => {
  const ctx = createContext(vitebskDecision());
  const d = directive({ objective: 'smolensk-north' });
  /** The Guard brought up to the vanguard at Liozno, so that two columns want the same road. */
  const s = () => {
    const x = newGame(ctx, 1812);
    x.forces['fr-guard']!.at = 'liozno';
    return x;
  };

  it('the army summary names who follows whom, and the route cards list it', () => {
    const plan = planDirective(s(), ctx, d);
    const held = plan.filter((p) => p.queue !== null);
    expect(held.length).toBeGreaterThan(0);
    const summary = summarizePlan(s(), ctx, plan);
    expect(summary.queues).toHaveLength(held.length);
    expect(summary.lines).toContain(summary.queues[0]);
    const cards = previewRoutes(s(), ctx, d, [null, ...axesTo(ctx, 'liozno', 'smolensk-north')]);
    expect(cards[0]!.queues).toHaveLength(held.length);
    expect(cards[0]!.queues[0]).toMatchObject({ force: held[0]!.force, slots: held[0]!.queue!.slots });
  });

  it('a held group arrives no earlier than it would alone', () => {
    const off = createContext(vitebskDecision(), OFF);
    const without = planDirective(s(), off, d);
    for (const p of planDirective(s(), ctx, d)) {
      const q = without.find((x) => x.force === p.force)!;
      if (p.arrival && q.arrival) expect(slotIndex(p.arrival.dry), p.force).toBeGreaterThanOrEqual(slotIndex(q.arrival.dry));
    }
  });
});

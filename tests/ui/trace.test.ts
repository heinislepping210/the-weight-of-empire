// Tracing the top bar to the map (M2, G4): select a change in the top bar and its cause is highlighted. The contract:
//   1. Between the last orders and now, a figure's causes add up exactly to its change, with nothing left unexplained.
//   2. Each cause says what happened; what happened at a place marks that place, and what touches a group wherever it
//      stands marks the group.
//   3. Only the French: no Russian group appears, whatever the log holds of them.
//   4. The window runs from the last orders to the present pause, a battle's pauses included.
//   5. Tracing reads and changes nothing: the entries it reads are in the log, not in the state.

import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, newGame, stateHash, statusOf } from '../../src/engine';
import type { GameState, LogEntry } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { FIGURES, causeDetail, figuresOf, placeOf, signed, traceTurn, windowOf, type Cause, type Figure } from '../../src/ui/trace';
import { BOTS } from '../balance/bots';
import { inputFor, play, type Policy } from '../fixtures/driver';
import { holdStill, testGround } from '../fixtures/testGround';

const ctx = createContext(vitebskDecision());

const holdFirst: Policy = { orders: () => [], round: () => 'delegate', nightfall: () => 'delegate' };
const sum = (causes: readonly Cause[]) => causes.reduce((n, c) => n + c.amount, 0);

/** The first pauses of a game in which the army holds where it stands. */
function opening(seed: number, inputs: number) {
  const states = [newGame(ctx, seed)];
  const logs: LogEntry[][] = [];
  for (let i = 0; i < inputs; i++) {
    const s = states[i] as GameState;
    const r = advance(s, inputFor(s, statusOf(s), holdFirst), ctx);
    if (!r.ok) throw new Error(r.reason);
    states.push(r.state);
    logs.push(r.log);
  }
  return { states, logs, final: states[inputs] as GameState };
}

/** Every pause of a game, with what the top bar would trace at it. */
function pauses(states: readonly GameState[], logs: readonly LogEntry[][]) {
  return states.slice(1).map((after, i) => {
    const window = windowOf(states.slice(0, i + 2), logs.slice(0, i + 1));
    if (!window) throw new Error('every pause after the first has a window');
    return { before: window.before, after, log: window.log, traces: traceTurn(window.before, after, window.log, ctx) };
  });
}

describe('over whole games on the real map', () => {
  it('the causes add up exactly to every change, and only the French appear', () => {
    const seen = new Set<string>();
    for (const bot of ['southern-envelopment-hold', 'concentrated-push', 'southern-envelopment-guard-at-base', 'random']) {
      for (let seed = 1; seed <= 5; seed++) {
        const run = play(ctx, seed, BOTS[bot]!(ctx));
        for (const { before, after, traces } of pauses(run.states, run.logs)) {
          const [was, now] = [figuresOf(before), figuresOf(after)];
          for (const figure of FIGURES) {
            const t = traces[figure];
            expect(t.change, `${bot} ${seed} ${figure}`).toBe(now[figure] - was[figure]);
            expect(sum(t.causes), `${bot} ${seed} ${figure}`).toBe(t.change);
            for (const c of t.causes) {
              seen.add(c.id.split(':')[0] as string);
              expect(c.id, `${bot} ${seed} ${figure}`).not.toBe('unexplained');
              expect(c.amount).not.toBe(0);
              expect(c.marks.reduce((n, m) => n + m.amount, 0)).toBe(c.amount);
              for (const m of c.marks) expect(after.forces[m.force]?.side).toBe('fr');
            }
          }
        }
      }
    }
    expect([...seen].sort()).toEqual(expect.arrayContaining(['battle', 'delivered', 'eaten', 'foraged', 'issued', 'sickness']));
  }, 60_000); // twenty whole games, every pause of each
});

describe('a turn with no fighting', () => {
  const run = opening(1812, 1);
  const window = windowOf(run.states, run.logs)!;
  const traces = traceTurn(window.before, run.final, window.log, ctx);

  it('sickness marks each group where it stands, not a place', () => {
    const sick = traces.men.causes.find((c) => c.id === 'sickness')!;
    expect(sick.text).toBe('Sickness');
    expect(sick.amount).toBeLessThan(0);
    expect(sick.marks.length).toBeGreaterThan(1);
    for (const m of sick.marks) expect(m.node).toBeNull();
  });

  it('food eaten goes against the figure, and what was foraged for it marks where', () => {
    const eaten = traces.food.causes.find((c) => c.id === 'eaten')!;
    const foraged = traces.food.causes.find((c) => c.id === 'foraged')!;
    expect(eaten.amount).toBeLessThan(0);
    expect(foraged.amount).toBeGreaterThan(0);
    for (const m of foraged.marks) expect(ctx.graph.nodes.has(m.node!)).toBe(true);
  });

  it('a group at a place shares that place\'s ring; one out on the road has its own', () => {
    const s = structuredClone(run.final);
    const mark = { force: 'fr-guard', node: null, amount: -10 };
    expect(placeOf(mark, s)).toBe(s.forces['fr-guard']!.at);
    s.forces['fr-guard']!.transit = { edge: 'x', to: 'y', metres: 5, seq: 0 };
    expect(placeOf(mark, s)).toBeNull();
    expect(placeOf({ ...mark, node: 'liozno' }, s)).toBe('liozno');
  });

  it('the largest cause comes first', () => {
    for (const figure of FIGURES) {
      const sizes = traces[figure].causes.map((c) => Math.abs(c.amount));
      expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    }
  });

  it('says who and where in words', () => {
    const foraged = traces.food.causes.find((c) => c.id === 'foraged')!;
    expect(causeDetail(foraged, run.final, ctx)).toMatch(/^[A-Zè a-z]+ at [A-Z]/);
    expect(signed(-1240)).toBe('−1,240');
    expect(signed(30_000)).toBe('+30,000');
  });
});

describe('a battle', () => {
  const run = play(ctx, 13, BOTS['southern-envelopment-hold']!(ctx));
  const all = pauses(run.states, run.logs);

  it('is named, marks its field, and its men are the ones it recorded', () => {
    const fought = all.flatMap((p) => p.traces.men.causes.map((c) => ({ c, after: p.after, before: p.before }))).filter((x) => x.c.id.startsWith('battle:'));
    expect(fought.length).toBeGreaterThan(0);
    for (const { c, after, before } of fought) {
      const b = after.battles[c.id.slice('battle:'.length)]!;
      expect(c.text).toBe(`In the battle at ${ctx.graph.nodes.get(b.node)!.name}`);
      for (const m of c.marks) {
        expect(m.node).toBe(b.node);
        expect(m.amount).toBe((before.battles[b.id]?.losses[m.force] ?? 0) - (b.losses[m.force] ?? 0));
      }
    }
  });
});

describe('the window', () => {
  it('has nothing to trace before the first orders', () => {
    const s = newGame(ctx, 1812);
    expect(windowOf([s], [])).toBeNull();
  });

  it('runs from the last orders, through a battle\'s pauses, to now', () => {
    const run = play(ctx, 13, BOTS['southern-envelopment-hold']!(ctx));
    const pause = run.states.findIndex((s) => statusOf(s).kind === 'awaitingBattleInput');
    expect(pause).toBeGreaterThan(0);
    let last = pause;
    while (statusOf(run.states[last]!).kind !== 'awaitingOrders') last--;
    const window = windowOf(run.states.slice(0, pause + 1), run.logs.slice(0, pause))!;
    expect(window.before).toBe(run.states[last]);
    expect(window.log).toEqual(run.logs.slice(last, pause).flat());
  });

  it('at new orders it is the turn just ended', () => {
    const run = opening(1812, 3);
    const orders = run.states.map((s, i) => [s, i] as const).filter(([s]) => statusOf(s).kind === 'awaitingOrders');
    const [, previous] = orders[orders.length - 2]!;
    const [, last] = orders[orders.length - 1]!;
    const window = windowOf(run.states.slice(0, last + 1), run.logs.slice(0, last))!;
    expect(window.before).toBe(run.states[previous]);
  });
});

describe('tracing itself', () => {
  it('changes nothing', () => {
    const run = opening(1812, 1);
    const window = windowOf(run.states, run.logs)!;
    const before = [stateHash(window.before), stateHash(run.final)];
    traceTurn(window.before, run.final, window.log, ctx);
    expect([stateHash(window.before), stateHash(run.final)]).toEqual(before);
  });

  it('a group lost with its stores is told as that, on a ground where one can be', () => {
    const ground = createContext(
      testGround((d) => {
        d.convoys = [];
        d.turns = 2;
      }),
      RULES,
      { russianCommand: holdStill },
    );
    const before = newGame(ground, 7);
    const after = structuredClone(before);
    const f = after.forces['fr-flank']!;
    const rations = f.stock.food;
    const men = f.men;
    f.men = 0;
    const figures: Figure[] = ['men', 'food'];
    const traces = traceTurn(before, after, [], ground);
    for (const figure of figures) expect(traces[figure].causes.map((c) => c.id)).toEqual(figure === 'men' ? ['unexplained'] : ['destroyed']);
    expect(traces.men.change).toBe(-men);
    expect(traces.food.change).toBe(-rations);
  });
});
